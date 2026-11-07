# CLAUDE.md: guide for Claude Code sessions on this repo

@AGENTS.md

Two teammates each drive their own Claude Code session against this repo. Follow these rules so our work merges cleanly.

## Read first
- `docs/LLD.md` is the design contract (data model, API, business rules, AI design). **If you change behaviour it describes, update it in the same PR.**
- `CONTRIBUTING.md` covers branch + PR workflow.

## Commands
- `npm run dev`: http://localhost:3000 (works with zero env vars: file store + demo AI)
- `npm run check`: lint + typecheck + tests. **Must pass before you open a PR.**
- `npm run build`: run before a PR if you touched routes, config, or server/client boundaries.
- `npm run seed` / `npm run reset-data`: demo data in `.data/`.
- `npm run eval`: costs real API money. Only run it when the user asks.

## Architecture rules
- **Types:** all domain shapes are zod schemas in `src/lib/types.ts`. Infer TS types from them; never duplicate interfaces.
- **Tunables** (thresholds, limits, durations) live in `src/lib/constants.ts`.
- **Storage** goes through the `PostStore` interface (`src/lib/store/types.ts`). Any change must be implemented in **both**
  `memory.ts` and `supabase.ts` (+ a new SQL file in `supabase/migrations/`, never edit an applied migration).
  `tests/memoryStore.test.ts` is the behavioural spec.
- **Server vs client:** files under `src/lib/client/`, `src/components/`, `src/hooks/` are browser code (`"use client"`).
  Never import `config.ts`, `store/*`, `ai/*`, `*.server.ts` from client code. Secrets have no `NEXT_PUBLIC_` prefix.
- **Route handlers** (`src/app/api/**/route.ts`) stay thin: validate with zod → call a lib function → map errors with `jsonError`.
  Error body shape is always `{ error: { code, message } }`.
- **This is Next.js 16 with `cacheComponents: true`.** Don't use `export const dynamic = ...`; call `await connection()`
  in GET handlers that must run per request. Route `params` is a Promise. Check `node_modules/next/dist/docs/` before using an API you're unsure of.
- **AI:** prompts are in `src/lib/ai/prompts.ts`. **Bump `*_PROMPT_VERSION` on every prompt change.** Model output is untrusted:
  everything goes through `postprocess.ts`. The AI must never invent a building (use `matchBuilding`).
  Default model `claude-opus-5-5` via `client.beta.messages.parse` + `betaZodOutputFormat`.
- **Leaflet** only loads client-side through `components/MapView.tsx` (`next/dynamic`, `ssr: false`).

## Conventions
- TypeScript strict, no `any`. Small pure functions in `src/lib/` with Vitest tests in `tests/`.
- New pure logic → add tests. Bug fix → add a test that would have caught it.
- UI: Tailwind with the tokens in `globals.css` (`bg-surface`, `text-muted`, `bg-brand`, …), works at 375px wide, real `<button>`/`<label>` elements.
- Commit messages: `feat: …`, `fix: …`, `docs: …`, `test: …`, `chore: …`.

## Git
- Never commit to `main` directly; it's protected. Branch `feat/<issue#>-short-name`, open a PR, CI must pass.
- Before starting work: `git checkout main && git pull`. Before opening a PR: `git fetch && git rebase origin/main`, then `npm run check`.
- Never commit `.env.local`, `.data/`, or eval images/results.
- Keep PRs small and focused on one issue. Pick issues on GitHub and assign yourself so we don't overlap.
