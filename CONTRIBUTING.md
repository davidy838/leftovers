# Contributing (team workflow)

We're two people, each working with Claude Code. The goal is **never to block each other or overwrite each other's work.**

## One-time setup
```bash
git clone https://github.com/davidy838/leftovers.git
cd leftovers
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for real AI
npm run dev
```
Open the folder in Claude Code. It reads `CLAUDE.md` automatically. A good first prompt:
> Read docs/LLD.md and CONTRIBUTING.md, then pick up issue #N.

## The loop
1. **Pick an issue** on the [Issues board](https://github.com/davidy838/leftovers/issues) and **assign yourself** (so we don't both build it).
   No issue for your idea? Open one first (there's a template) so the other person knows.
2. **Branch from fresh main:**
   ```bash
   git checkout main && git pull
   git checkout -b feat/12-discord-alerts
   ```
3. **Build it.** Commit early and often. Push your branch whenever you like (`git push -u origin HEAD`).
4. **Before the PR:**
   ```bash
   git fetch && git rebase origin/main
   npm run check       # lint + typecheck + tests
   ```
5. **Open a PR** (`gh pr create --fill` or the GitHub UI). Link the issue with `Closes #12`.
6. **CI must be green.** Merge with **Squash and merge**. Approval is optional (hackathon speed), but ping the other person
   if you touched shared files (`types.ts`, `store/*`, `docs/LLD.md`, SQL migrations).
7. Delete the branch, `git checkout main && git pull`, repeat.

## Avoiding conflicts
- **Divide by area:** e.g. one person on UI (`src/components`, `src/app/**/page.tsx`), the other on AI/backend (`src/lib/ai`, `src/lib/store`, `src/app/api`).
- **Shared files** (`src/lib/types.ts`, `src/lib/constants.ts`, `docs/LLD.md`): make small, separate PRs and merge them quickly.
- **Database changes:** add a *new* file `supabase/migrations/000N_name.sql`. Never edit an applied one.
- **Prompt changes:** bump the prompt version in `src/lib/ai/prompts.ts` and note eval results in the PR.

## Getting each other's changes into your branch
```bash
git fetch
git rebase origin/main     # or: git merge origin/main
```
If there are conflicts, ask Claude Code: *"resolve the rebase conflicts, keep both features, then run npm run check"*.

## Secrets
Each person keeps their own `.env.local` (git-ignored). Share keys over DMs, never in commits, issues or PRs.
