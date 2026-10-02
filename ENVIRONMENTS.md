# Environment & Deployment Guide 2.0

How the frontend/backend connect across **local**, **staging**, and **prod**, and what
you need to do after pulling this branch.

---

## TL;DR — after pulling

```bash
# backend
cd server
npm install
npx prisma generate        # IMPORTANT: schema changed; regenerate the Prisma client

# frontend
cd ../client
npm install
cp .env.example .env
npm run dev:local          # or npm run dev:staging
```

If you skip `npx prisma generate`, the server fails to compile with errors like
`Property 'discloseProfileInfo' does not exist` — that just means the generated
Prisma client is stale. Regenerate it.

---

## Frontend: switching which backend it talks to

The frontend reads all environment settings from one `.env` file. The npm command
selects which API URL is active, so the host URL does not need to be edited.

| Command (run in `client/`) | Frontend talks to |
|---|---|
| `npm run dev:local`   | `LOCAL_API_URL` |
| `npm run dev:staging` | `STAGING_API_URL` |
| `npm run build:production` | `PRODUCTION_API_URL` |

Next.js reads `.env` at startup and inlines `NEXT_PUBLIC_*` values during the build.

### How it works (env file layout)

| File | Purpose | Committed? |
|---|---|---|
| `.env` | All local settings and local/staging/production API URLs | ❌ gitignored — copy `.env.example` |

- `npm run dev:local` selects `LOCAL_API_URL`.
- `npm run dev:staging` selects `STAGING_API_URL`.
- `npm run build:production` selects `PRODUCTION_API_URL`.

> ⚠️ **Note:** Next.js does **not** load `.env.staging`; this setup intentionally uses
> one `.env` file and selects the target through the npm command.

---

## Frontend: the API-URL rule for components (important)

Two env vars exist, and they are **not** interchangeable:

- `NEST_API_URL` — **server components only** (server-side `fetch`). Not visible in the browser.
- `NEXT_PUBLIC_API_URL` — **client components** (`"use client"`). The only one exposed to the browser.

**Rule:** any `"use client"` component (or hook, or anything that runs in the browser)
**must** use `process.env.NEXT_PUBLIC_API_URL`. Server components (`app/**/page.tsx` without
`"use client"`) use `NEST_API_URL`.

> Using `NEST_API_URL` in a client component "works" only when the backend happens to be on
> `localhost:4000` (the fallback string). It silently breaks against any remote backend.
> Several section components had this bug and were fixed on this branch.

---

## Backend deployment

- Build with `npm run build` from the repository root; start with `npm run start:prod`
  from `server/`.
- Provide `DATABASE_URL`, `DIRECT_URL` when migrations are needed, and all required secrets
  through the hosting environment. Never commit production secrets.
- For Dokploy Redis, configure the backend only with Dokploy secrets: use the Redis service's
  internal hostname as `REDIS_HOST`, internal container port `6379` as `REDIS_PORT`, and the
  generated Redis password as `REDIS_PASS`. Alternatively set `REDIS_URL` to Dokploy's
  internal connection URL. Do not expose Redis to the public internet just to connect the API.
- Configure `CLIENT_URL`, `CORS_ORIGINS`, and `GOOGLE_CALLBACK_URL` with the real public
  origins for each environment.

### Google OAuth

OAuth credentials were moved to **our own Google Cloud project**. The OAuth client has these
**Authorized redirect URIs** registered:

```
http://localhost:4000/api/auth/google/callback                          (local backend)
https://api.example.com/auth/google/callback  (staging example)
```

Relevant env vars (set in the hosted environment for staging; in `server/.env` for local):

| Var | Local (`server/.env`) | Hosted environment |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | our project's credentials | same |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | `https://api.example.com/api/auth/google/callback` |
| `CLIENT_URL` | unset → defaults to `http://localhost:3000` | unset → defaults to `http://localhost:3000` |

> `server/.env` is gitignored — get the `GOOGLE_CLIENT_SECRET` (and other secrets) from a
> teammate; don't commit them. If you're a new test user, you may need to be added under
> **Google Console → OAuth consent screen → Test users**.

---

## Hosted frontend and backend

- Set `NEST_API_URL` and `NEXT_PUBLIC_API_URL` in the frontend hosting environment.
- Set `CLIENT_URL` to the public frontend origin and add that exact origin to `CORS_ORIGINS`.
- Keep deployment URLs outside the repository; use the environment switch script only for
  local operator workflows.

## Target hosting: Hostinger VPS API + Cloudflare frontend

The NestJS API is prepared for a Hostinger VPS with systemd and Nginx templates in
`deploy/hostinger/`. The API listens on `127.0.0.1:4000`; Nginx terminates TLS and
proxies the public `https://api.example.com` origin to it.

The current Next.js client is dynamic: it uses cookies, middleware, dynamic routes,
and server-side API requests. It is not compatible with a plain Cloudflare Pages
static export without a larger client-side rendering migration. Do not add
`output: "export"` to `client/next.config.ts`, because that would break these features.

For the current client, use Cloudflare's Next.js Workers integration, or deliberately
migrate the client to a fully static/client-rendered architecture before selecting
Cloudflare Pages' **Next.js (Static HTML Export)** preset. Client production variables
are documented in `client/.env.example`.

If the client is later made static, the Pages settings are:

| Setting | Value |
|---|---|
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `out` |
| API variables | `NEST_API_URL`, `NEXT_PUBLIC_API_URL` |

Do not use the `out` directory for the current dynamic client.

---

## Authentication: HttpOnly cookie session (security migration)

Auth no longer uses a Bearer token stored in `localStorage`. The session now lives in
**HttpOnly cookies** that JavaScript can't read (closes the XSS token-theft and
token-in-URL risks), with a refresh token tracked server-side in Redis so logout
actually revokes the session.

**What changed**
- `signin` / `signup` / Google callback set two cookies (`mood_at` access, `mood_rt`
  refresh) instead of returning a token. The Google callback **no longer puts the token
  in the redirect URL**.
- New `POST /auth/refresh` rotates the refresh token; `POST /auth/logout` revokes it.
- The JWT strategy reads the access token from the cookie, with a **Bearer-header
  fallback** during rollout.
- Every client API call now sends `credentials: "include"` and no `Authorization`
  header. The old `secureStorage` util and `NEXT_PUBLIC_STORAGE_SECRET` were **removed**
  — the token is never exposed to JS, so client-side storage isn't needed.

**New backend env vars** (all optional — safe defaults shown):

| Var | Default | Notes |
|---|---|---|
| `JWT_ACCESS_EXPIRES` | `15m` | Access-token (cookie) lifetime. |
| `REFRESH_EXPIRES_DAYS` | `30` | Refresh-token lifetime (also the Redis TTL). |
| `COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none`. See cross-site note below. |
| `COOKIE_SECURE` | `NODE_ENV==='production'` | Force `true`/`false`. Required `true` when SameSite=None. |
| `COOKIE_DOMAIN` | host-only | Set e.g. `.moodies.com` to share the cookie across subdomains. |

> Refresh tokens are stored in Redis (`rt:<token>` → userId), so the existing `REDIS_*`
> vars must be set for login/refresh to work.

**SameSite / cross-origin rule (important)**
- `localhost:3000 ↔ :4000` and a `app.x.com ↔ api.x.com` split are **same-site**
  (SameSite ignores port; both share the registrable domain), so the default
  `SameSite=Lax` cookies are sent on `fetch(credentials:"include")` — no change needed.
- Only if the API is on a **truly different domain** from the client do you need
  `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` (and HTTPS).
- CORS already runs with `credentials: true`; just ensure the client origin is in
  `CORS_ORIGINS` (it must be an explicit origin, never `*`).

**Manual test checklist after deploying this**
1. Email signin → cookies `mood_at`/`mood_rt` set (DevTools → Application → Cookies); no token in `localStorage`.
2. Protected pages work (watchlist, liked, profile, post a review/reply).
3. Google sign-in → lands on `/` (or `/auth/onboarding`) with **no `?token=` in the URL**.
4. Logout (Navbar + profile) → cookies cleared and `/auth/me` returns 401.
5. Let the access token expire (or delete `mood_at`) and hit a protected page → it
   silently refreshes via `/auth/refresh` and succeeds.

> **Note (SEC-6, not addressed):** `docker-compose.yml` still has a hardcoded Postgres
> password and a passwordless, port-exposed MongoDB. Left as-is per decision; only safe
> for a local laptop. Harden (env-driven creds, Mongo auth, no published DB ports) before
> running that compose file on any shared/staging host.
