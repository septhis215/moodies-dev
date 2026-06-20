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
| `npm run env:local`   | `http://localhost:4000` (your local backend) |
| `npm run env:staging` | Railway staging (`https://moodies-staging-production.up.railway.app`) |
| `npm run env:prod`    | Production *(URL is a placeholder until prod exists)* |

After switching, **restart the dev server** (`Ctrl+C`, then `npm run dev`) — Next.js only
reads env files at startup.

### How it works (env file layout)

| File | Purpose | Committed? |
|---|---|---|
| `.env` | Shared, non-URL values (e.g. TMDB key) | ❌ gitignored — get values from a teammate |
| `.env.development` | Local API URLs (`localhost:4000`) — auto-loaded by `next dev` | ✅ yes |
| `.env.production` | Prod API URLs — auto-loaded by `next build`/`start` | ❌ gitignored |
| `.env.local` | Active override; written by the `env:*` scripts | ❌ gitignored |

- `npm run env:staging`/`env:prod` write `.env.local` (which wins over everything).
- `npm run env:local` deletes `.env.local` so it falls back to `.env.development`.
- The URLs live in one place: `client/scripts/use-env.mjs` → `ENVIRONMENTS`. Update the
  `prod` line there once we have a production domain.

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

> Using `NEST_API_URL` in a client component "works" only when the backend happens to be on
> `localhost:4000` (the fallback string). It silently breaks against any remote backend.
> Several section components had this bug and were fixed on this branch.

---

## Backend: Railway (staging)

- Deployed via **Nixpacks** (no Dockerfile — it was removed). Config in `server/railway.json`.
- Build runs `npx prisma generate && nest build` (Prisma types must exist before TS compiles).
- DB is **Supabase**; Railway uses the Supabase **pooler** URLs (`DATABASE_URL` on port 6543,
  `DIRECT_URL` on 5432).
- Secrets/config live in **Railway variables**, not in the repo.

### Google OAuth

OAuth credentials were moved to **our own Google Cloud project**. The OAuth client has these
**Authorized redirect URIs** registered:

```
http://localhost:4000/auth/google/callback                              (local backend)
https://moodies-staging-production.up.railway.app/auth/google/callback  (staging)
```

Relevant env vars (set in Railway for staging; in `server/.env` for local):

| Var | Local (`server/.env`) | Railway (staging) |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | our project's credentials | same |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/auth/google/callback` | `https://moodies-staging-production.up.railway.app/auth/google/callback` |
| `CLIENT_URL` | unset → defaults to `http://localhost:3000` | unset → defaults to `http://localhost:3000` |

> `server/.env` is gitignored — get the `GOOGLE_CLIENT_SECRET` (and other secrets) from a
> teammate; don't commit them. If you're a new test user, you may need to be added under
> **Google Console → OAuth consent screen → Test users**.

---

## When the frontend deploys to Vercel (future)

- Set `NEST_API_URL` + `NEXT_PUBLIC_API_URL` in the **Vercel dashboard** per environment
  (Preview = staging URL, Production = prod URL). The local `.env.*` files aren't used there.
- On Railway, set `CLIENT_URL` to the Vercel URL (so OAuth redirects back to the frontend)
  and add the Vercel domain to `CORS_ORIGINS`.

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
