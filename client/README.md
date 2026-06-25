# Moodies Client

Next.js frontend for Moodies.

## Setup

```bash
npm ci
cp .env.example .env
npm run env:local
```

`npm run env:local` removes `.env.local` so `.env.development` points the app at `http://localhost:4000`.

## Scripts

- `npm run dev`: start the Next.js dev server.
- `npm run lint:check`: run ESLint without modifying files.
- `npm run typecheck`: run TypeScript checks.
- `npm run build`: production build.
- `npm run verify`: lint, typecheck, and build.
- `npm run test`: Storybook/Vitest browser tests.
- `npm run storybook`: start Storybook.

Before running browser tests locally:

```bash
npx playwright install chromium
```

The test script disables Storybook telemetry for repeatable local and CI runs.

## Environment Rules

- Browser/client code must use `NEXT_PUBLIC_API_URL`.
- Server components can use `NEST_API_URL`.
- Do not commit real `.env`, `.env.local`, `.env.production`, or `.env.staging` files.

See [../ENVIRONMENTS.md](../ENVIRONMENTS.md) for deployment-specific environment behavior.
