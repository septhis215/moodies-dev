# Moodies Server

NestJS API for Moodies.

## Setup

```bash
npm ci
cp .env.example .env
npm run generate
```

Set real secrets in `.env` before running the app.

## Scripts

- `npm run start:dev`: start Nest in watch mode.
- `npm run lint:check`: run ESLint errors-only without modifying files.
- `npm run lint:fix`: run ESLint with `--fix` locally.
- `npm run typecheck`: run TypeScript checks.
- `npm run build`: generate Prisma Client and build Nest.
- `npm run test`: run Jest unit tests.
- `npm run verify`: lint, typecheck, and build.

## Database

```bash
npm run migrate:dev
npm run migrate:deploy
npm run generate
npm run seed
```

Local Docker helpers:

```bash
npm run docker:up
npm run docker:down
```

## Environment

Required values are documented in `.env.example`. The app validates key backend variables at boot through `ConfigModule` and Joi.

See [../ENVIRONMENTS.md](../ENVIRONMENTS.md) for staging and deployment notes.
