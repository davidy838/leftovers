# Leftovers — Low-Level Design (LLD)

> HackCamp 2026 · Theme: *identify a problem facing a community and build a solution that makes a meaningful difference.*
>
> This document is the contract for the codebase. If you (or your Claude Code session) change behaviour described here, update this file in the same PR.

---

## 0. Summary

Campus events throw away surplus food while many students skip meals. **Leftovers** is a mobile-first web app where anyone can post surplus food (a photo of the leftovers, or an event poster that promises free food) and nearby students see it on a live map with a countdown, dietary tags and "it's gone" crowd signals.

AI (Claude, vision + structured outputs) is used for **two narrow, verified jobs**:

1. Food photo → suggested title, items, servings estimate, dietary tags, possible allergens.
2. Event poster → draft post (title, date, time, location, food mentioned).

Every AI suggestion is **reviewed by a human before it is published**, locations are **constrained to a known building list** (the model cannot invent a location), and every AI run is logged with which fields the human corrected so we can measure the model honestly. An offline eval harness scores prompts against hand-labelled images.

---

## 1. Goals / non-goals

| Goals (MVP) | Non-goals |
|---|---|
| Post food in < 20 s from a phone | Native apps |
| Live map + list, updates within ~5 s | Payments, delivery, reservations |
| Expiry countdown + crowd "gone" signal | Food-safety certification |
| Dietary filters, "near me" sort | User accounts / passwords (MVP is anonymous) |
| AI suggestions with human confirmation | Moderation dashboard (future) |
| Runs locally with **zero setup** (no keys) | Multi-campus support (data model allows it later) |
| Measurable AI quality (eval + correction rate) | |

---

## 2. Architecture

```
 ┌──────────────── Browser (Next.js client components) ───────────────┐
 │  /           FoodFeed: map (Leaflet/OSM) + list + filters          │
 │  /post       PostForm: image → resize → AI suggest → edit → submit  │
 │  /about      How it works, safety, AI transparency stats           │
 │  usePosts(): poll /api/posts every 5 s (+ Supabase realtime ping)  │
 └───────────────▲───────────────────────────────┬────────────────────┘
                 │ JSON                          │ JSON (base64 image)
 ┌───────────────┴───────────── Next.js Route Handlers (server) ───────┐
 │ GET/POST /api/posts      POST /api/posts/:id/signals               │
 │ POST /api/ai/extract     GET /api/buildings   GET /api/stats       │
 │ GET /api/photos/:name (memory mode only)      GET /api/health      │
 │        │ validation (zod) · rate limit · status derivation          │
 │        ▼                                                            │
 │  lib/store  ──► PostStore interface                                 │
 │     ├─ MemoryStore   (default; JSON file in .data/, photos on disk) │
 │     └─ SupabaseStore (if SUPABASE_URL + SERVICE_ROLE_KEY set)       │
 │  lib/ai     ──► extract(mode, image) → Claude or deterministic mock │
 │  lib/discord.server ──► after(): new-post webhook (optional)        │
 └─────────────────────────────────────────────────────────────────────┘
```

**Why two stores?** A teammate (or judge) can `npm install && npm run dev` and everything works with no accounts or keys. Supabase is the production/deploy path (Vercel's filesystem is read-only, so memory mode is for local dev only).

**Why polling + realtime ping?** Polling every 5 s is simple and always correct. When Supabase is configured, the client also subscribes to `postgres_changes` on `posts` and refetches immediately, so the update feels instant. The realtime payload is never trusted for data; it only triggers a refetch.

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 |
| Map | Leaflet 1.9 + react-leaflet 5, OpenStreetMap tiles, emoji `divIcon` markers |
| Validation | zod 4 (shared between client and server) |
| AI | `@anthropic-ai/sdk` → `client.beta.messages.parse` + `betaZodOutputFormat`, model `claude-opus-5-5` (override with `ANTHROPIC_MODEL`), effort `low`, server-side refusal fallback `fallbacks: "default"` |
| DB (deploy) | Supabase Postgres + Storage + Realtime |
| Tests | Vitest |
| CI | GitHub Actions: lint → typecheck → test → build |

---

## 3. Directory layout

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    post/page.tsx                 # create post
    about/page.tsx                # how it works + AI stats
    api/
      health/route.ts
      buildings/route.ts
      posts/route.ts              # GET list, POST create
      posts/[id]/signals/route.ts # POST heading|gone
      ai/extract/route.ts         # POST image → suggestion
      photos/[name]/route.ts      # memory-mode photo serving
      stats/route.ts
  components/                     # client UI pieces
  hooks/usePosts.ts
  lib/
    types.ts         # domain zod schemas + types (single source of truth)
    constants.ts     # tunables (thresholds, limits, durations)
    config.ts        # env → feature flags (server only)
    buildings.ts     # campus building list + matchBuilding()
    status.ts        # deriveStatus(), sort/filter helpers
    time.ts          # Vancouver-zoned date/time → UTC
    geo.ts           # haversine distance
    http.ts          # json helpers, error responses, client id, IP
    rateLimit.ts     # in-memory sliding window
    discord.server.ts # new-post Discord webhook message + best-effort send
    edits.ts         # diff AI suggestion vs submitted post
    image.server.ts  # base64 decode + magic-byte check
    client/          # browser-only helpers (clientId, image resize, api)
    store/           # PostStore interface + memory + supabase impls
    ai/              # schemas, prompts (versioned), extract, mock, postprocess
    eval/score.ts    # eval scoring (pure functions, unit tested)
scripts/
  eval.ts            # run eval set against the live model
  seed.ts            # seed demo posts (memory or supabase)
supabase/migrations/0001_init.sql
evals/               # labels + images for the eval harness
tests/               # vitest unit tests
docs/LLD.md          # this file
```

---

## 4. Domain model

All types live in `src/lib/types.ts` as zod schemas; TypeScript types are `z.infer`'d from them. **Never hand-write a duplicate interface.**

### 4.1 Enumerations

| Name | Values |
|---|---|
| `DietaryTag` | `vegetarian`, `vegan`, `halal`, `kosher`, `gluten_free`, `dairy_free` |
| `Allergen` | `peanuts`, `tree_nuts`, `dairy`, `gluten`, `eggs`, `soy`, `fish`, `shellfish`, `sesame` |
| `PostSource` | `photo`, `poster`, `manual` |
| `StoredStatus` | `active`, `gone`, `removed` |
| `DisplayStatus` (derived) | `upcoming`, `live`, `gone`, `expired` |
| `SignalType` | `heading`, `gone` |
| `ExtractMode` | `food`, `poster` |

### 4.2 `Post` (stored)

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | server-generated |
| `title` | string | 1–80 chars, trimmed |
| `description` | string | 0–500 chars |
| `buildingId` | string | must exist in `BUILDINGS` |
| `room` | string \| null | ≤ 40 chars |
| `photoUrl` | string \| null | server-set only |
| `estServings` | int \| null | 1–500 |
| `dietaryTags` | DietaryTag[] | unique |
| `allergens` | Allergen[] | unique — always displayed as "may contain" |
| `source` | PostSource | |
| `availableFrom` | ISO datetime | default now; ≤ now + 14 days |
| `expiresAt` | ISO datetime | > availableFrom; ≤ availableFrom + 12 h |
| `status` | StoredStatus | default `active` |
| `headingCount` | int ≥ 0 | denormalised count of `heading` signals |
| `goneCount` | int ≥ 0 | denormalised count of `gone` signals |
| `aiRunId` | uuid \| null | link to the AI run that suggested it |
| `createdAt` | ISO datetime | server-set |

Owner identity is **not** a column on `Post`. It lives in a separate `post_owners` table so it can never leak through the public API or realtime payloads.

### 4.3 `PublicPost` (API response)

`Post` + `displayStatus: DisplayStatus` + `isMine: boolean` (true when the request's `x-client-id` owns the post).

### 4.4 `AiRun`

| Field | Type |
|---|---|
| `id` | uuid |
| `mode` | ExtractMode |
| `model` | string (`"mock"` in mock mode) |
| `promptVersion` | string, e.g. `food-v3` |
| `output` | JSON (post-processed suggestion) |
| `latencyMs` | int |
| `postId` | uuid \| null — set when a post is created from it |
| `editedFields` | string[] \| null — fields the human changed (null until used) |
| `createdAt` | ISO datetime |

### 4.5 Signals

`(postId, clientId, type)` is unique, so one device counts once per type per post.

---

## 5. Business rules

| Rule | Detail |
|---|---|
| **Display status** (`deriveStatus(post, now)`) | `status ∈ {gone, removed}` → `gone`; `now ≥ expiresAt` → `expired`; `now < availableFrom` → `upcoming`; else `live`. |
| **Feed contents** | `live` posts (sorted by `expiresAt` asc, soonest first) then `upcoming` posts within 7 days (sorted by `availableFrom` asc). `removed`, `gone`, `expired` are excluded. |
| **Gone** | A `gone` signal from the **owner** ends the post immediately. Otherwise the post ends when `goneCount ≥ GONE_THRESHOLD` (2). |
| **Heading** | Increments `headingCount` (shown as "3 people heading there"). |
| **Signals on non-live posts** | 409 `post_not_live`. |
| **Durations** | "Leftovers now" default 45 min, choices 15/30/45/60/90/120. Poster posts default to the event end + 30 min, or start + 2 h if no end. |
| **Stats** | `postsShared` = all non-removed posts; `servingsClaimed` = Σ `estServings` of posts that ended as `gone` (null counts 0); AI: `runs`, `runsUsed` (linked to a post), `runsEdited` (used with ≥ 1 edited field), `fieldEditRate`. |
| **Impact estimate** (`lib/impact.ts`, client-side) | `kgFood = servingsClaimed × KG_FOOD_PER_SERVING (0.4)`, `kgCo2e = kgFood × KG_CO2E_PER_KG_FOOD (2.5)`. Shown in the feed banner and explained on `/about#impact`. Rough, conservative, labelled "≈". |
| **Food alerts** (`lib/alerts.ts`, client-side) | Opt-in per device. After the first load, a post triggers an alert if it is new to this tab, not the viewer's own, `live`/`upcoming`, and has every selected dietary tag. Shown as an in-page banner + `(n)` in the tab title; a system `Notification` too when permitted and the tab is hidden. Only while the page is open (no push server). |
| **Discord announcement** | When `DISCORD_WEBHOOK_URL` is set (and is an `https://discord.com/api/webhooks/…` URL), every successfully **saved** post is announced from `after()` in `POST /api/posts`, i.e. after the response is sent. One line: `<emoji> <title> · <short building> <room> · ~<servings> servings · [starts <time> ·] ends <time> · <link>`. Room, servings and `starts` are omitted when absent/not upcoming; times are campus-zoned (`7:45pm`, or `Sat 7:45pm` on another day); the link is `/?post=<id>` wrapped in `<…>` so Discord doesn't unfurl it. `allowed_mentions: { parse: [] }` so a title can't ping `@everyone`. **Best effort:** 4 s timeout (`DISCORD_TIMEOUT_MS`), any error or non-2xx is logged and ignored. It can never fail or delay the request. Seeded posts (`npm run seed`) are not announced. |
| **Rate limits** (per IP, sliding 10 min) | create post 8, AI extract 20, signals 60. Exceeded → 429 with `retryAfterSec`. |
| **Images** | client resizes to max 1280 px JPEG q=0.8; server accepts jpeg/png/webp ≤ 3 MB decoded and verifies magic bytes. |

---

## 6. API contract

All endpoints return JSON. Errors are always `{ "error": { "code": string, "message": string, "details"?: unknown } }`.

The client sends `x-client-id: <uuid v4>` (random, stored in `localStorage`) on every request. It is not authentication. It dedupes signals and recognises the owner.

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/health` | — | `{ ok, store: "memory"\|"supabase", ai: "live"\|"mock", model }` | — |
| `GET /api/buildings` | — | `{ buildings: Building[] }` | — |
| `GET /api/posts` | — | `{ posts: PublicPost[], serverTime }` | — |
| `POST /api/posts` | `CreatePostRequest` (below) | `201 { post: PublicPost }` | 400 `invalid_request`, 400 `unknown_building`, 400 `invalid_image`, 429 |
| `POST /api/posts/:id/signals` | `{ type: "heading"\|"gone" }` | `{ post: PublicPost }` | 400, 404 `not_found`, 409 `post_not_live`, 429 |
| `POST /api/ai/extract` | `{ mode, image: { mediaType, data(base64) } }` | `{ runId, mode, ai: "live"\|"mock", suggestion }` | 400, 422 `not_food` / `no_event_found`, 429, 502 `ai_failed`, 503 `ai_refused` |
| `GET /api/stats` | — | `Stats` | — |
| `GET /api/photos/:name` | — | image bytes (memory mode) | 404 |

`CreatePostRequest`:
```jsonc
{
  "title": "Pizza from CS Club social",
  "description": "About 3 boxes, mostly cheese",
  "buildingId": "ICCS",
  "room": "X836",
  "estServings": 20,
  "dietaryTags": ["vegetarian"],
  "allergens": ["dairy", "gluten"],
  "source": "photo",
  "availableFrom": null,            // null → now
  "durationMinutes": 45,            // either durationMinutes or expiresAt
  "expiresAt": null,
  "image": { "mediaType": "image/jpeg", "data": "<base64>" } | null,
  "aiRunId": "uuid" | null,
  "acknowledged": true              // must be literally true (safety checkbox)
}
```

### 6.1 AI suggestion shapes (post-processed, returned to client)

`FoodSuggestion`:
```ts
{ title: string; description: string; estServings: number | null;
  dietaryTags: DietaryTag[]; allergens: Allergen[]; confidence: number; lowConfidence: boolean }
```
`PosterSuggestion`:
```ts
{ title: string; description: string; buildingId: string | null; locationText: string | null;
  room: string | null; availableFrom: string | null; expiresAt: string | null;
  dietaryTags: DietaryTag[]; confidence: number; lowConfidence: boolean }
```

---

## 7. AI design

### 7.1 Call shape

```ts
client.beta.messages.parse({
  model: AI_MODEL,                       // default "claude-opus-5-5"
  max_tokens: 2048,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",                  // server-side refusal fallback
  output_config: { effort: "low", format: betaZodOutputFormat(RawFoodSchema) },
  system: FOOD_SYSTEM_PROMPT,            // static → cache-friendly
  messages: [{ role: "user", content: [image, text(with today's date)] }],
})
```

- `stop_reason === "refusal"` → 503 `ai_refused`. `parsed_output === null` → 502 `ai_failed`.
- SDK errors are caught most-specific-first (RateLimit → APIStatus → APIConnection) and mapped to 502 with a safe message.
- Mode is decided by `AI_MODE` env: `live` | `mock` | unset (= `live` if `ANTHROPIC_API_KEY` is set, else `mock`). Mock returns a deterministic, clearly labelled suggestion so the UI works with no key.

### 7.2 Raw model schemas (what Claude must output)

Kept flat and simple (structured outputs support a JSON Schema subset). Range checks happen in post-processing, not in the schema.

`RawFood`: `is_food: boolean, title: string, items: string[], est_servings: number|null, dietary_tags: DietaryTag[], possible_allergens: Allergen[], confidence: number, notes: string|null`

`RawPoster`: `is_event_with_food: boolean, title: string|null, date: string|null (YYYY-MM-DD), start_time: string|null (HH:MM 24h), end_time: string|null, location_text: string|null, room: string|null, food_mentioned: string[], dietary_tags: DietaryTag[], confidence: number`

### 7.3 Post-processing (deterministic, unit-tested — `lib/ai/postprocess.ts`)

Food:
1. `!is_food` → 422 `not_food`.
2. Clamp `confidence` to [0, 1]; `lowConfidence = confidence < 0.5`.
3. `est_servings` → integer in 1..500, else null; **null if low confidence**.
4. Dietary tags: dedupe, **emptied if low confidence** (a wrong "vegan" is worse than none).
5. Allergens: kept even when low confidence (over-warning is the safe direction).
6. Title trimmed to 80 chars, fallback `"Free food"`; description = items joined + notes, ≤ 500.

Poster:
1. `!is_event_with_food` → 422 `no_event_found`.
2. `buildingId = matchBuilding(location_text)`. Unknown → null, **never invented**. The user must pick.
3. Date/time → UTC via `America/Vancouver` (`lib/time.ts`, DST-correct). Invalid → null.
4. `expiresAt = end + 30 min`, or `start + 2 h`; dropped if not after start.
5. Same confidence handling as food.

### 7.4 Prompts

`lib/ai/prompts.ts` exports `FOOD_PROMPT_VERSION` / `POSTER_PROMPT_VERSION` and the prompt text. **Bump the version on every prompt change.** It is stored on every `AiRun` and in eval results, so you can compare versions.

### 7.5 Human-in-the-loop measurement

When a post is created with an `aiRunId`, `diffSuggestion(suggestion, submitted)` (`lib/edits.ts`) computes which of `title`, `estServings`, `dietaryTags`, `allergens`, `buildingId`, `room`, `availableFrom`, `expiresAt` the user changed. The run is updated with `postId` + `editedFields`. `/about` shows the live correction rate.

### 7.6 Offline eval (`npm run eval`)

- `evals/labels.json`: `[{ file, mode, expected }]` with images in `evals/images/`.
- Scores (`lib/eval/score.ts`):
  - **Food:** `is_food` accuracy, dietary-tag precision/recall/F1, servings within ±50 %.
  - **Poster:** detection accuracy, date exact, start time exact, building exact, and **invented-location rate** (predicted building ≠ null while expected is null or different).
- Writes `evals/results/<timestamp>_<promptVersion>.json` plus a console table. It costs real API money: about 1 call per image.

---

## 8. Storage

### 8.1 `PostStore` interface (`lib/store/types.ts`)

```ts
interface PostStore {
  kind: "memory" | "supabase";
  listPosts(): Promise<Post[]>;                    // non-removed, expiresAt > now - 24h
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost, ownerClientId: string): Promise<Post>;
  ownedPostIds(clientId: string, postIds: string[]): Promise<Set<string>>;
  recordSignal(postId: string, clientId: string, type: SignalType): Promise<Post | null>;
  savePhoto(bytes: Uint8Array, mediaType: ImageMediaType): Promise<string>; // → URL
  createAiRun(run: NewAiRun): Promise<AiRun>;
  getAiRun(id: string): Promise<AiRun | null>;
  linkAiRun(id: string, postId: string, editedFields: string[]): Promise<void>;
  getStats(): Promise<Stats>;
}
```

`recordSignal` must be atomic: dedupe, increment, and apply the gone rule together.

### 8.2 MemoryStore

A JSON file at `.data/db.json` (or `$TMPDIR/leftovers-data` on Vercel) and photos in `.data/uploads/`. All mutations go through a promise-chain mutex. Writes go to a temp file followed by a rename, which is atomic.

### 8.3 Supabase schema (`supabase/migrations/0001_init.sql`)

Tables: `posts`, `post_owners(post_id, client_id)`, `signals(post_id, client_id, type, unique)`, `ai_runs`. Function: `record_signal(p_post_id, p_client_id, p_type, p_gone_threshold)` returns the updated post (atomic). RLS is enabled on every table. `anon` may only `SELECT` from `posts` (needed for realtime). All writes go through the server with the service-role key. Storage bucket `photos` is public-read. `posts` is added to the `supabase_realtime` publication.

---

## 9. Frontend

| Component | Responsibility |
|---|---|
| `FoodFeed` | Owns filters + view state; renders `MapView`, `PostList`, `FilterBar`, `ImpactBanner`, the new-food alert banner; opens `/?post=<id>` deep links (selects + scrolls to the post) |
| `MapView` → `FoodMap` | `next/dynamic({ ssr:false })` wrapper around Leaflet; emoji markers; popup with title + countdown; selecting a marker highlights the card; flies to a post **once per selection** (polls don't re-centre the map) |
| `PostCard` | Photo, title, building + room, countdown, servings, tags, allergen warning, "I'm heading there" / "It's gone" buttons (owner sees "Mark as gone"), **Share** (Web Share API → clipboard → show link). Signals this device sent are remembered in `localStorage` so buttons stay ✓ after a reload |
| `FilterBar` | Dietary chips (AND filter), "Live now only", "Sort by distance" (geolocation), "Alert me" toggle |
| `useFoodAlerts` | Alert state, permission request, unseen list, tab-title count (see §5 Food alerts) |
| `app/manifest.ts` + `public/icon.svg` | Web app manifest so the site can be added to a phone home screen |
| `PostForm` | Mode tabs (Leftovers now / Event poster / No photo), image picker → resize → `/api/ai/extract` → prefill; AI-suggested fields get an "AI" badge until edited; building `<select>`; safety acknowledgement; submit |
| `Countdown` | Ticks every second; "Ends in 12m", "Starts in 2h", "Ended" |
| `usePosts` | Fetch + 5 s poll + refetch on focus/visibility + optional Supabase realtime ping; optimistic signal updates (a poll that started before a signal response is discarded, via `lib/requestSeq.ts`) |

Accessibility: every control is a real `<button>`/`<input>` with a label, colour is never the only signal, and the map has a list equivalent.

---

## 10. Configuration (`.env.local`, see `.env.example`)

| Var | Side | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | server | Enables live AI |
| `AI_MODE` | server | `live` \| `mock` (optional override) |
| `ANTHROPIC_MODEL` | server | Default `claude-opus-5-5` |
| `SUPABASE_URL` | server | Enables SupabaseStore (with the key below) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Never expose to the client** |
| `DISCORD_WEBHOOK_URL` | server | Optional. Announce new posts in a Discord channel (§5). **Never `NEXT_PUBLIC_`**: the URL lets anyone post to the channel |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Realtime ping (optional) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Realtime ping (optional) |

---

## 11. Security & safety

- Service-role key, Anthropic key and Discord webhook URL are server-only (no `NEXT_PUBLIC_` prefix).
- The Discord webhook URL is validated as an `https` Discord webhook before use, and announcements disable all mentions.
- All input is zod-validated, and the server ignores client-sent `photoUrl`, counts and status.
- The owner table is separate, so client ids never appear in responses.
- Rate limiting per IP. Note: it's in-memory, so it is per-instance on serverless and therefore best-effort.
- Images are size-checked and magic-byte-checked, and photo names are regex-validated (no path traversal).
- Food safety: "may contain" wording, a mandatory acknowledgement checkbox, and a disclaimer on every card and on `/about`.
- AI output is treated as untrusted data: enums are enforced by schema, then clamped and sanitised again.

---

## 12. Testing strategy

| Layer | What |
|---|---|
| Unit (Vitest) | `deriveStatus`, feed sorting, `matchBuilding`, `zonedToUtc` (incl. DST), post-processing, `diffSuggestion`, eval scoring, rate limiter, image validation, `MemoryStore` signal/gone/owner logic, request schemas |
| CI | lint, `tsc --noEmit`, tests, `next build` on every PR |
| Manual demo checklist | `docs/DEMO.md` |

---

## 13. Future work (not in MVP)

Two-way Discord bot (per-channel dietary filters, "gone" from Discord; one-way webhook announcements already exist, §5) · club accounts & scheduled leftovers · moderation/report button · campus SSO · multi-campus `campus_id` · PWA push · photo blurring of faces.
