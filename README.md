# 🍱 Leftovers

**Free food on campus, right now.** Campus events throw away surplus food while many students skip meals.
Leftovers lets anyone post leftover food (a photo, or an event poster), and nearby students see it on a live
map with a countdown, dietary tags and "it's gone" crowd signals.

Built for **HackCamp 2026**. Theme: *identify a problem facing a community and build a solution that makes a meaningful difference.*

## How we use AI, and why it isn't a wrapper
- Claude (vision + structured outputs) **suggests** post details from a food photo or an event poster.
- A **human confirms every field** before posting. AI-filled fields are badged until edited.
- Locations are matched against a **fixed building list**, so the model can't invent places.
- Low-confidence results leave dietary tags blank rather than guess.
- We **measure** the AI: every run logs which fields people corrected (shown on `/about`), and `npm run eval`
  scores prompt versions against hand-labelled images.

Full design: [`docs/LLD.md`](docs/LLD.md).

## Quick start (no accounts or keys needed)

```bash
git clone https://github.com/davidy838/leftovers.git
cd leftovers
npm install
npm run seed     # optional: demo posts so the map isn't empty
npm run dev      # http://localhost:3000
```

With no `.env.local`, the app stores data in `.data/` and uses a clearly labelled **demo AI**.
To use real AI, `cp .env.example .env.local` and set `ANTHROPIC_API_KEY`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run check` | Lint + typecheck + tests (run before every PR) |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run seed` | Insert demo posts |
| `npm run reset-data` | Wipe local `.data/` |
| `npm run eval` | Score the AI against `evals/labels.json` (**uses API credits**) |

## Deploying (Vercel + Supabase)
1. Create a Supabase project → SQL Editor → run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
2. Import the repo on Vercel and add the env vars from `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, optionally the two `NEXT_PUBLIC_SUPABASE_*`).
3. Deploy. (Memory mode is for local dev only, because Vercel's filesystem is ephemeral.)

## Team workflow
See [`CONTRIBUTING.md`](CONTRIBUTING.md). Both of us use Claude Code, which reads [`CLAUDE.md`](CLAUDE.md) automatically.

## Tech
Next.js 16 · React 19 · TypeScript · Tailwind v4 · Leaflet/OpenStreetMap · zod · Anthropic SDK · Supabase · Vitest
