# Goal Leaderboard

Post a goal, submit photo proof, and get ranked on a leaderboard.

**Live:** https://goal-leaderboard-beta.vercel.app

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind)
- [Supabase](https://supabase.com) — Postgres, Auth (magic link), Storage
- Deployed on [Vercel](https://vercel.com); auto-deploys on push to `main`

## Data model

- `profiles` — one row per signed-up user, auto-created via a DB trigger.
- `goals` — a posted goal. Two shapes: `cadence` (recurring, e.g. "workout
  3x/week") and `target` (single count by a deadline, e.g. "read 12 books").
- `proof_entries` — a photo + date logged against a goal.
- The leaderboard is a derived view (`src/lib/leaderboard.ts`), not a table:
  ranks goals by completion rate, then streak, then proof count.

Full schema: `supabase/migrations/`.

## Local development

```bash
npm install
npm run dev
```

Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` for the linked Supabase project (not
committed).

## Tests

```bash
npm test          # unit (Vitest) + e2e (Playwright)
npm run test:unit # ranking-logic pure functions only
npm run test:e2e  # full browser + DB integration suite
```

E2E tests need `.env.test.local` with `SUPABASE_SERVICE_ROLE_KEY` (also not
committed) to create/tear down test users via the Supabase admin API and to
establish real sessions without clicking email links — see
`tests/e2e/helpers/auth.ts` and `src/app/api/test/login/route.ts` (hard-gated
to non-production).

Coverage: auth flow, goal-posting (both goal types), proof submission (real
file upload), leaderboard ranking, the `handle_new_user` DB trigger, the
`cadence_fields_required` check constraint, and cross-user RLS boundaries
(one user can't read/write another user's goals or proof).
