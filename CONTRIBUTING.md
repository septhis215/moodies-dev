# Contributing

## Local Workflow

1. Pull the latest `trunk`.
2. Install dependencies with `npm run install:all`.
3. Copy `client/.env.example` and `server/.env.example` to local `.env` files.
4. Run `npm run dev:server` and `npm run dev:client` in separate terminals.
5. Before opening a PR, run `npm run verify`.

## Pull Request Checklist

- The change is scoped to one feature, fix, or cleanup.
- `npm run lint` passes.
- `npm run typecheck` passes, or known legacy type debt is called out.
- `npm run build` passes.
- Server tests pass with `npm test -- --runInBand --prefix server`.
- Client tests pass after `cd client && npx playwright install chromium && npm test`.
- Any database schema change includes a Prisma migration.
- Any auth, cookie, CORS, rate-limit, token, or env change includes a manual security test note.
- New environment variables are added to the relevant `.env.example`.

## Branching

- `trunk` is the integration branch.
- Keep PRs small enough to review without broad unrelated refactors.
- Avoid running mutating format/lint commands across the whole repo unless the PR is explicitly cleanup-only.
