# Environment & Deployment Guide

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
| `.env` | Shared, non-URL values (TMDB key, storage secret) | ❌ gitignored — get values from a teammate |
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
