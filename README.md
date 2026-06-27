# Moodies

Moodies is a movie and TV recommendation platform built around mood-driven discovery.

## Stack

- `client`: Next.js, React, Tailwind CSS, Storybook, Vitest
- `server`: NestJS, Prisma, PostgreSQL, Redis
- Deployment references live in [ENVIRONMENTS.md](./ENVIRONMENTS.md)

## Requirements

- Node.js 20+
- npm
- Docker, if you want local Postgres through `docker-compose.yml`
- Local secrets from the project owner or deployment provider

## First Setup

```bash
npm run install:all

cp client/.env.example client/.env
cp server/.env.example server/.env

cd server
npm run generate
```

For local frontend API wiring:

```bash
cd client
npm run env:local
```

## Development

Run the backend:

```bash
npm run dev:server
```

Run the frontend in another terminal:

```bash
npm run dev:client
```

Frontend: http://localhost:3000  
Backend: http://localhost:4000 or the port configured in `server/.env`

## Support Email

The app uses `NEXT_PUBLIC_SUPPORT_EMAIL` to display the public support contact.
The server email templates use `MAIL_SUPPORT` for the same support contact.

Default:

```txt
moodies.support@gmail.com
```

For now, this is a dedicated Gmail inbox. Do not use a Vercel subdomain as an
email domain because the project does not control the root DNS records.

When a custom domain is added later, change the public support email to:

```txt
support@yourcustomdomain.com
```

The intended future setup is Cloudflare Email Routing:

```txt
support@yourcustomdomain.com -> moodies.support@gmail.com
```

Future deployment steps: add the domain to Cloudflare, point nameservers to
Cloudflare, add the domain to Vercel, configure Vercel DNS records, enable
Cloudflare Email Routing, verify `moodies.support@gmail.com` as the destination
inbox, create the support route, then update `NEXT_PUBLIC_SUPPORT_EMAIL` and
`MAIL_SUPPORT`.

## Verification

From the repository root:

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run verify` runs all three. Client production builds may need network access because `next/font` fetches Google Fonts during build.

Tests:

```bash
npm test -- --runInBand --prefix server
cd client && npx playwright install chromium && npm test
```

Client tests use Storybook/Vitest browser mode, so Playwright browsers must be installed locally first. The test script disables Storybook telemetry to avoid writing global settings during automated runs.

## Database

Backend Prisma commands are run from `server/`:

```bash
npm run migrate:dev
npm run migrate:deploy
npm run generate
npm run seed
```

Use `npm run docker:up` from `server/` if you want the local Postgres service defined in the root compose file.

## Contribution Notes

- Do not commit real `.env` files or secrets.
- Use `lint:check` in automation; `lint:fix` is for local cleanup only.
- Keep client-side API calls on `NEXT_PUBLIC_API_URL`; server components can use `NEST_API_URL`.
- Security-sensitive auth, cookie, CORS, rate-limit, Prisma, and env changes should include a manual test note in the PR.
- Branch protection recommendations are in [docs/BRANCH_PROTECTION.md](./docs/BRANCH_PROTECTION.md).
