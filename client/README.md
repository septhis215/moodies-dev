# Moodies Client

Next.js frontend for Moodies.

## Setup

```bash
npm ci
cp .env.example .env
npm run dev:local
```

The single `.env` file contains both backend URLs. Use `npm run dev:local` or
`npm run dev:staging` to choose the target without editing the file.

## Scripts

- `npm run dev`: start the local-backend Next.js dev server.
- `npm run dev:staging`: start Next.js against the staging backend.
- `npm run lint:check`: run ESLint without modifying files.
- `npm run typecheck`: run TypeScript checks.
- `npm run build`: staging build.
- `npm run build:local`: build against the local backend.
- `npm run verify`: lint, typecheck, and build.
- `npm run test`: Storybook/Vitest browser tests.
- `npm run storybook`: start Storybook.

Before running browser tests locally:

```bash
npx playwright install chromium
```

The test script disables Storybook telemetry for repeatable local and CI runs.

## Environment Rules

- `LOCAL_API_URL`, `STAGING_API_URL`, and `PRODUCTION_API_URL` are the host settings.
- Browser/client code uses the selected `NEXT_PUBLIC_API_URL`.
- Server components use the selected `NEST_API_URL`.
- Do not commit `.env`.

See [../ENVIRONMENTS.md](../ENVIRONMENTS.md) for deployment-specific environment behavior.

## Typography

Font families, sizes, weights, and the section-header recipes are specified in
[`docs/typography-spec.md`](../docs/typography-spec.md). The landing page (`app/page.tsx` and its
sections) is the canonical implementation — copy from it rather than inventing new values.
