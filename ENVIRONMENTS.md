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
npm run env:local          # or env:staging — see below
```

If you skip `npx prisma generate`, the server fails to compile with errors like
`Property 'discloseProfileInfo' does not exist` — that just means the generated
Prisma client is stale. Regenerate it.

---

## Frontend: switching which backend it talks to

The frontend reads its API base URL from env vars. There are now **three** target
environments and a one-command switch.

| Command (run in `client/`) | Frontend talks to |
|---|---|
| `npm run env:local`   | `https://dev.api.moodies.tech/api` (hosted dev backend) |
| `npm run env:staging` | The API URL in `MOODIES_STAGING_API_URL` |
| `npm run env:prod`    | The API URL in `MOODIES_PROD_API_URL` |

After switching, **restart the dev server** (`Ctrl+C`, then `npm run dev`) — Next.js only
reads env files at startup.

### How it works (env file layout)

| File | Purpose | Committed? |
|---|---|---|
| `.env` | Shared, non-URL values (e.g. TMDB key) | ❌ gitignored — get values from a teammate |
| `.env.development` | Dev API URLs (`dev.api.moodies.tech/api`) — auto-loaded by `next dev` | ✅ yes |
| `.env.production` | Prod API URLs — auto-loaded by `next build`/`start` | ❌ gitignored |
| `.env.local` | Active override; written by the `env:*` scripts | ❌ gitignored |

- `npm run env:staging`/`env:prod` write `.env.local` (which wins over everything).
- `npm run env:local` deletes `.env.local` so it falls back to `.env.development`.
- Set `MOODIES_STAGING_API_URL` or `MOODIES_PROD_API_URL` in your shell before running
  the matching switch command. The scripts intentionally do not contain deployment URLs.

> ⚠️ **Note:** Next.js does **not** load `.env.staging`. Only `.env`, `.env.local`,
> `.env.development`, `.env.production` are auto-loaded. Don't rely on a `.env.staging` file.

---

## Frontend: the API-URL rule for components (important)

Two env vars exist, and they are **not** interchangeable:

- `NEST_API_URL` — **server components only** (server-side `fetch`). Not visible in the browser.
- `NEXT_PUBLIC_API_URL` — **client components** (`"use client"`). The only one exposed to the browser.

**Rule:** any `"use client"` component (or hook, or anything that runs in the browser)
**must** use `process.env.NEXT_PUBLIC_API_URL`. Server components (`app/**/page.tsx` without
`"use client"`) use `NEST_API_URL`.

> Using `NEST_API_URL` in a client component silently breaks in the browser because the var is
> empty there, so the code falls back to the hardcoded `https://dev.api.moodies.tech/api` string
> even when the app is pointed at another backend.
> Several section components had this bug and were fixed on this branch.

---

## Backend deployment

For the current action-based CAPTCHA, trusted-proxy requirements, Redis outage
policy, and Cloudflare staging/origin setup, follow [BOT_PROTECTION.md](BOT_PROTECTION.md).
`TRUST_PROXY=true` now requires `TRUSTED_PROXY_CIDRS`. Build the frontend with its
matching `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; set `TURNSTILE_ALLOWED_HOSTNAMES` to the
frontend hostnames on the backend (or derive them from correct existing origins).
The old generic CAPTCHA cookie no longer authorizes protected actions.
Root Compose published ports now bind to `127.0.0.1`; use the controlled reverse
proxy rather than exposing the frontend/API or database ports directly.

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

### Transactional email: Hostinger SMTP

Configure these variables on the **backend** in Dokploy (or in the active Doppler
configuration if it supplies runtime secrets). Never put mailbox credentials in
frontend variables, build arguments, or committed files.

```dotenv
MAIL_USER=support@moodies.tech
MAIL_PASS='YOUR_MAILBOX_PASSWORD'
MAIL_FROM="Moodies <support@moodies.tech>"
MAIL_SUPPORT=support@moodies.tech
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
CLIENT_URL=https://dev.moodies.tech
```

`SMTP_HOST` and `SMTP_PORT` default to the values above, so existing deployments
only need the mailbox credentials and sender/link settings. Port 465 uses TLS
immediately; port 587 requires STARTTLS. Certificate verification stays enabled.
Hosted backends fail configuration validation if credentials are missing.
Set an HTTPS `CLIENT_URL` matching the frontend for each hosted environment.
The sender should be the authenticated mailbox, not a Webmail-only alias.

For Dokploy **Applications**, save runtime variables on the backend service and
redeploy. For **Docker Compose**, the editor's `.env` is not automatically
injected into containers: add these names to the backend service's existing
`environment` mapping, or load the appropriate `env_file`. The root Compose file
currently reads `server/.env.staging`; it does not load Dokploy's root `.env` into
the backend automatically. Give the backend at least 30 seconds to stop normally
(`stop_grace_period: 30s` for Compose) so SMTP deliveries can drain.

Set `NEXT_PUBLIC_SUPPORT_EMAIL=support@moodies.tech` in the frontend **build**
environment and rebuild to replace any older configured public support address.

One SMTP pool per backend process reuses up to two connections and permits at most
20 pending messages. DNS/connect/greeting/socket timeouts bound stalled SMTP work.
Explicit temporary SMTP 4xx rejections get one retry; authentication failures,
permanent rejections and ambiguous network failures do not. SMTP acceptance does
not prove inbox delivery. Normal shutdown drains pending work for up to 25 seconds.
The in-memory buffer is not a durable outbox: crashes, forced termination, capacity
rejection or provider outages can require the user to request another reset.

Reset requests retain Turnstile and Redis-backed protection. Additional shared
token buckets allow one request per minute and five per hour per normalized email,
five per minute per IP, and ten per minute across the deployment (these permit an
initial burst and refill gradually). Unknown accounts consume the same budgets.
These budgets do not replace Hostinger's daily mailbox quota, which includes mail
sent outside the app. Check the exact allowance in hPanel before launch or scaling.
Daily active users are not the same as daily email sends. If recovery emails need
to survive crashes automatically, add a durable outbox before increasing volume.

Manual deployment/security check:

1. Request a reset for an existing test account; the response remains generic and
   responsive while SMTP runs in the background. Verify the sender, Reply-To, both
   message formats, HTTPS frontend link, and SPF/DKIM/DMARC results in the inbox.
2. Complete code verification and password reset, then confirm the new password
   works and prior sessions are revoked. Never paste reset codes into logs/tickets.
3. Request another reset within a minute: expect 429 and `Retry-After`. An unknown
   account must return the same generic response and be rate limited too.
4. In an isolated staging deployment, use deliberately invalid SMTP credentials:
   check backend delivery-error logs without exposing credentials or reset codes.
   Restore credentials and redeploy. Never perform this check on the live backend.
5. Test delivery at Gmail and Outlook. During a normal redeploy, check that pending
   deliveries finish before the process exits. Monitor delivery errors and hPanel
   sending quota; public browsing must remain available during email outages.

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
are documented in `client/.env.production.example`.

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
token-in-URL risks), with a refresh token tracked server-side in PostgreSQL so logout
actually revokes the session.

**What changed**
- `signin` / `signup` / Google callback set two cookies (`mood_at` access, `mood_rt`
  refresh) instead of returning a token. The Google callback **no longer puts the token
  in the redirect URL**.
- `POST /api/auth/refresh` rotates the refresh token; `POST /api/auth/logout` revokes it,
  including when the access JWT has expired. The refresh cookie has `Path=/api/auth`.
- The JWT strategy reads the access token exclusively from the cookie and checks
  session revocation and the user's authentication version.
- Protected client API calls use `client/lib/auth/session.ts`, send `credentials: "include"`, and no `Authorization`
  header. The old `secureStorage` util and `NEXT_PUBLIC_STORAGE_SECRET` were **removed**
  — the token is never exposed to JS, so client-side storage isn't needed.

**New backend env vars** (all optional — safe defaults shown):

| Var | Default | Notes |
|---|---|---|
| `JWT_ACCESS_EXPIRES` | `15m` | Access-token (cookie) lifetime. |
| `REFRESH_EXPIRES_DAYS` | `30` | Absolute session lifetime; rotation never extends it. |
| `COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none`. See cross-site note below. |
| `COOKIE_SECURE` | `NODE_ENV==='production'` | Force `true`/`false`. Required `true` when SameSite=None. |
| `COOKIE_DOMAIN` | host-only | Set e.g. `.moodies.com` to share the cookie across subdomains. |

New sessions store only current/previous refresh-token hashes in the `auth_sessions`
PostgreSQL table. Redis is needed only to import remaining legacy sessions, not for
new login/refresh. See [session hardening](SESSION_HARDENING.md) for rollout,
retry behavior, testing, and rollback constraints.

**SameSite / cross-origin rule (important)**
- `http://localhost:3000 ↔ http://localhost:4000` and an HTTPS `app.x.com ↔ api.x.com` split are **same-site**
  (SameSite ignores port; both share the registrable domain), so the default
  `SameSite=Lax` cookies are sent on `fetch(credentials:"include")` — no change needed.
- Only if the API is on a **truly different domain** from the client do you need
  `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` (and HTTPS). This includes a localhost
  frontend calling a hosted API. Browsers can still block third-party cookies;
  prefer a local API or frontend/API hosts on the same site.
- CORS already runs with `credentials: true`; just ensure the client origin is in
  `CORS_ORIGINS` (it must be an explicit origin, never `*`).
- Refresh/logout additionally validate the browser's `Origin` against that allowlist.

**Manual test checklist after deploying this**
1. Email signin → cookies `mood_at`/`mood_rt` set (DevTools → Application → Cookies); no token in `localStorage`.
2. Protected pages work (watchlist, liked, profile, post a review/reply).
3. Google sign-in → lands on `/` (or `/auth/onboarding`) with **no `?token=` in the URL**.
4. Logout (Navbar + profile) → cookies cleared and `/auth/me` returns 401.
5. Let the access token expire (or delete `mood_at`) and hit a protected page → it
   silently refreshes via `/api/auth/refresh` and succeeds.

> **Note (SEC-6, not addressed):** `docker-compose.yml` still has a hardcoded Postgres
> password and a passwordless, port-exposed MongoDB. Left as-is per decision; only safe
> for a local laptop. Harden (env-driven creds, Mongo auth, no published DB ports) before
> running that compose file on any shared/staging host.
