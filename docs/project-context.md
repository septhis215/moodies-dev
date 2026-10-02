# Moodies — Project Context Brief

> **Purpose of this document.** This is a hand-off brief for an AI assistant (or a new
> human contributor) who needs to understand Moodies *before* answering a question or
> making a change. Paste or attach this file alongside your prompt. It describes what the
> product is, how the codebase is currently organised, and the brand/technical identity
> that changes must respect. Everything here is derived from the repository as it stands
> on `trunk`; section §9 lists places where the repo has drifted and should not be
> trusted blindly.

---

## 1. What Moodies is

**Moodies is a mood-driven movie and TV discovery platform.** Instead of starting from
genre, popularity, or a search box, the user starts from *how they feel* (or want to
feel), and Moodies returns scored, reasoned recommendations for films and series that fit
that emotional state.

- **One-line description:** "Moodies – Movie & Series Recommendations"
- **Longer description:** "Discover trending movies, series, and personalized
  recommendations on Moodies."
- **Content source:** TMDB (The Movie Database) is the single upstream for all titles,
  artwork, credits, people, trailers, and trend data. Moodies owns no media catalogue; it
  curates, scores, and contextualises TMDB data.
- **Origins and posture:** the project began as a personal hobby app and is being
  deliberately matured into a production-grade SaaS. The result is a working, feature-rich
  product with recognised architectural debt — see §9. Do not assume a pattern found in
  one file is the intended pattern; check §9 and the audit docs first.

### Product pillars

Each pillar below maps to real, shipped code, not aspirations.

1. **Mood-first discovery.** A seeded taxonomy of 21 moods, each carrying a psychological
   profile (valence/arousal) and a set of TMDB genre mappings, drives a scoring engine.
2. **Editorial shelves.** Curated rails — trending, featured, fresh-off-the-screen,
   Korean hits, world-cup docs, box office, indie, award winners, k-drama, top-rated.
3. **Community.** User reviews with replies, reactions, an auto-computed moderation
   toxicity score, and a ban guard. Two named surfaces present reviews: *Critics' Corner*
   and *Community Picks*.
4. **Personal library.** Per-user watchlist and liked items, stored as rows (not arrays).
5. **Gamification.** Achievements and badges, plus a personality quiz that produces
   recommendations independently of the mood flow.
6. **Engagement signals.** Per-title like/save/review counters (`MediaStat`) and a
   `community-pulse` aggregate feed.
7. **Privacy by row.** Users opt in to disclosing profile info, watchlist, reviews, liked
   items, badges, and recent activity through six `disclose*` booleans on `User`, each
   with its own default (`true` for profile/reviews/badges/recent activity, `false` for
   watchlist/liked).

---

## 2. Technology stack

| Layer | Choice | Pin |
|---|---|---|
| Frontend framework | Next.js App Router, React Server Components + client components | Next `^15.5.19`, React `^19.1.0` |
| Frontend styling | Tailwind CSS v4 (CSS-first config, `@theme` in `globals.css`), `tw-animate-css`, `class-variance-authority`, Radix primitives | Tailwind `^4.1.12` |
| Frontend motion | Framer Motion | `^12.23.12` |
| Frontend data | `@tanstack/react-query` v5 for client cache; native `fetch` with `next: { revalidate }` in server components | `^5.85.5` |
| Icons | `@tabler/icons-react` (primary) and `lucide-react` (secondary) | — |
| Backend framework | NestJS 11 (Express platform), global `api` prefix, Swagger | `^11.0.1` |
| ORM / primary DB | Prisma 6.15 on PostgreSQL 15 | `^6.15.0` |
| Cache | Redis (L1) with Prisma tables as durable L2 | `redis` `^5.8.2` |
| Secondary DBs present | MongoDB + TypeORM + Mongoose are installed and wired in `AppModule`/compose but are **legacy/side** stores, not the source of truth | — |
| Auth | JWT access + refresh cookies, Argon2 and bcrypt both present, Passport Google OAuth2 | — |
| Bot protection | Cloudflare Turnstile (`@marsidev/react-turnstile` client, Nest guard server) | — |
| Email | Nodemailer with a `MAIL_SUPPORT` sender; Resend config key supported | — |
| Avatars / uploads | Supabase Storage | — |
| Secrets | Doppler (`doppler.yaml` per workspace), with `.env` fallback | — |
| Testing | Jest (server unit + e2e), Vitest 4 + Storybook 10 browser tests + Playwright 1.61 smoke (client), MSW for mocking | — |
| Deploy targets | Cloudflare Workers via `@opennextjs-cloudflare` (`wrangler.jsonc`), Hostinger VPS via systemd + nginx for the API (`deploy/hostinger/`), Docker Compose for local/full-stack | — |

---

## 3. Repository layout

npm-workspaces monorepo. Two workspaces, `client` and `server`, plus shared docs and
infra at the root.

```
moodies-dev/
├── package.json           # workspaces: ["client", "server"] + root orchestration scripts
├── docker-compose.yml     # postgres-dev, mongo, server, client
├── AGENTS.md              # mandatory Context7 CLI policy for AI agents
├── CONTRIBUTING.md        # local workflow + PR checklist
├── ENVIRONMENTS.md        # env file / staging / production contract
├── SECURITY.md            # NOTE: this is an audit *prompt*, not a security policy (§9)
├── README.md              # product + setup + support email policy
├── docs/                  # specs and prior audit reports
│   ├── typography-spec.md             # canonical UI type contract (§7)
│   ├── BRANCH_PROTECTION.md
│   ├── api-call-redundancy-audit.md
│   ├── error-handling-inventory.md
│   ├── redis-cache-audit.md
│   ├── root-toast-system-report.md
│   └── staging-watchlist-like-performance.md
├── deploy/hostinger/      # nginx conf + systemd unit + README for the VPS API host
├── .github/               # CODEOWNERS, PR template, ISSUE_TEMPLATE,
│   └── workflows/         #   pr-checks.yml, staging-smoke-test.yml
└── .devcontainer/devcontainer.json
```

### 3.1 `client/` — the Next.js app

```
client/
├── app/                   # App Router: every directory with page.tsx is a route
│   ├── layout.tsx         # fonts, metadata, provider tree, auth pre-hide script
│   ├── client-layout.tsx  # Navbar shell + NAVBAR_HIDDEN_PREFIXES
│   ├── globals.css        # Tailwind v4 @theme, design tokens, .ui-* component classes
│   ├── page.tsx           # landing page (the canonical design reference)
│   ├── <feature>/         # one directory per route (§4)
│   └── context/           # AuthProvider, ToastProvider, AppErrorProvider, …
├── components/
│   ├── Navbar.tsx         # single nav component, desktop + mobile + drawer
│   ├── sections/          # 17 landing/listing rails (Trending, CommunityPicks, …)
│   ├── hero/              # HeroCarousel + HomepageMediaHero
│   ├── ui/                # 30 shadcn-style primitives (components.json present)
│   ├── category-content/ media/ providers/ security/ selected-content/ snapshot/ collection/
│   └── discover/          # empty leftover directory (§9)
├── hooks/                 # useAuth, useWatchlist, useLiked, useMediaStats, useTurnstileGate, …
├── lib/                   # api/, errors/, snapshot/, toast/, utils/, app-config, mediaApi, tmdb, serverFetch, turnstile
├── types/                 # all.ts, movie.ts, series.ts, person.ts, knownFor.ts, communityPulse.ts
├── utils/                 # apiFetch, likedClient, watchlistClient, mediaStatsClient
├── scripts/               # test.mjs, use-env.mjs (writes/removes .env.local)
├── tests/e2e/smoke.mjs    # Playwright smoke, run via `npm run test:e2e`
├── .storybook/            # main.ts, preview.tsx, msw-handlers.ts
├── Dockerfile, Dockerfile.dev, docker-compose.yml, wrangler.jsonc, open-next.config.ts
└── middleware.ts          # sets x-pathname header; staging redirect for /celeb
```

**Architecture notes that matter when editing the client:**

- Server components fetch the Nest API directly with `NEST_API_URL`; client components
  must use `NEXT_PUBLIC_API_URL`. These are **not interchangeable** — see §6.
- Data fetching is split three ways and all three are live: server-component `fetch` with
  `revalidate`, TanStack Query in client components, and Next server actions
  (`app/movies/action.ts`, `app/tv/action.ts`, `app/movies/action/page.tsx` is a *route*,
  not an action file).
- The provider order in `app/layout.tsx` is load-bearing:
  `PerformanceMonitor → ToastProvider → AuthProvider → AppErrorProvider → TurnstileGateProvider → ClientLayout → AppToaster`.
- `app/layout.tsx` injects an inline "auth pre-hide" script that blanks the page when a
  session marker exists in `localStorage` (`moodies:session`) — relevant to any flash,
  hydration, or white-screen bug report.
- Toasts are the app-wide error surface; the inventory of what currently uses it is in
  `docs/root-toast-system-report.md` and `docs/error-handling-inventory.md`.

### 3.2 `server/` — the NestJS API

```
server/
├── src/
│   ├── main.ts                 # global 'api' prefix, CORS allowlist, validation pipe, port
│   ├── app.module.ts           # Joi env contract, ScheduleModule, global RateLimitGuard
│   ├── auth/                   # signup/signin/refresh/logout, Google OAuth, Argon2/bcrypt,
│   │                           # cookie naming, JWT + Turnstile guards, email sending
│   ├── common/                 # AllExceptionsFilter, guards, Turnstile verification
│   ├── external-apis/tmdb/     # TMDB HTTP services behind a bottleneck rate limiter
│   ├── jobs/                   # @nestjs/schedule cron tasks (cache warm, stat sync)
│   ├── liked/                  # per-user like rows: GET / POST toggle / DELETE
│   ├── watchlist/              # per-user watchlist rows: GET / POST toggle / POST clear / DELETE
│   ├── media/                  # all/, movies/, tv/, people/, category/
│   ├── media-stats/            # batch counters + community-pulse
│   ├── prisma/                 # PrismaModule + service
│   ├── quiz/                   # personality quiz → recommendations
│   ├── redis/                  # RedisModule, cache service (L1)
│   ├── routes/
│   │   ├── moods/              # ★ the core engine — moods.service.ts is ~1500 LOC
│   │   ├── review/             # reviews, replies, reactions, snapshot, ban guard, moderation
│   │   ├── search/             # unified search, suggestions, genres, countries, filters
│   │   ├── moderation/         # profanity filter + toxicity analysis + decision service
│   │   └── user/               # public user profile read
│   └── utils/
├── prisma/
│   ├── schema.prisma           # 20 models + 3 enums — source of truth for the data model
│   ├── migrations/             # 22 migration directories
│   ├── seed.ts                 # entrypoint
│   └── seed/{moods,achievements}.seed.ts
└── test/                       # jest-e2e config + app.e2e-spec.ts
```

**Architecture notes that matter when editing the server:**

- Route ordering is fragile. `routes/moods/moods.controller.ts` documents it explicitly:
  static paths (`analytics/global`, `history/:userId`) must be declared before
  `:id`, or Nest matches the literal as a param. Preserve those comments when adding
  endpoints.
- Two ORM/DB layers coexist: Prisma (authoritative) and TypeORM/Mongoose/mongodb
  (legacy). New work should use Prisma.
- Guard layering: a **global** `RateLimitGuard`, per-route `JwtGuard` /
  `OptionalJwtGuard` (moods deliberately uses `OptionalJwtGuard` so anonymous users still
  get recommendations), `ReviewBanGuard`, and Turnstile guards on sensitive auth routes.
- `OptionalJwtGuard` + `resolveUserId(req)` is the pattern for "personalised if logged in,
  generic otherwise".
- Env validation is a **Joi schema in `app.module.ts`**, not `env.ts`. Required:
  `JWT_SECRET`, `DATABASE_URL`. Optional-with-defaults: TMDB, Redis, Turnstile, Google,
  Resend, Supabase, `CORS_ORIGINS`, `CLIENT_URL`, `PORT`.
- The API base URL **must always end in `/api`** because of `app.setGlobalPrefix("api")`
  in `main.ts`. A base URL without the suffix fails silently (404 against the root).

### 3.3 Data model (Prisma — 20 models, 3 enums)

All tables use `@@map` to snake_case plural names. IDs are `cuid()` for `User` and `uuid()`
elsewhere; every mutable model carries `updatedAt @updatedAt`.

| Domain | Models | What to know |
|---|---|---|
| Identity | `User`, `EmailVerification` | `password` is nullable — Google-only accounts have `provider` + `unique googleId`. Carries `preferredGenres`/`preferredLanguages` string arrays, the six `disclose*` privacy booleans, and the review-reputation trio `reviewCount` / `reviewWarningScore` / `reviewBannedUntil`. |
| Mood core ★ | `Mood`, `MoodLog`, `Recommendation`, `UserPreference` | `Mood` = unique `name` + `color` + `icon` + `description` + `keywords[]` + `tmdbGenres Int[]` + **`valence`/`arousal` as `Decimal(3,2)`** in `[-1, 1]` + `isActive`. `Recommendation` stores `score`, `reason`, `algorithm`, `metadata Json`, a consumed-state tail (`viewed`/`liked`/`saved`/`rating`), and is unique per `(userId, moodId, tmdbId, mediaType)`. `MoodLog` is the raw mood-history signal. |
| Personal library | `WatchlistItem`, `LikedItem` | One **row per title** keyed by `tmdbId` + type, replacing an earlier array-on-user design. Mutation shape is a `toggle`, not a set. |
| Community | `Review`, `ReviewReply`, `ReviewReaction`, `ReviewReplyReaction` | `Review` = SmallInt `rating` + `content` + `moodEmojis[]` + `status ReviewStatus` + moderation columns `toxicityScore Float?` / `profanityHit` / `flaggedReason` / `affectsRating`. Reactions are the six Facebook-style types, unique per `(reviewId, userId)`. `affectsRating = false` is how flagged content is excluded from aggregates without deletion. |
| Gamification | `Achievement`, `BadgeDefinition`, `UserAchievement`, `Quiz` | Rule logic and presentation are split: `Achievement` holds `requirementType` / `requirementTarget` / `requiredCount` / `progressLogic` / `reasoningTemplate` / `lockedHint`, while the 1:1 `BadgeDefinition` (unique `achievementId`, cascade delete) holds `badgeName`, `icon`, `rarity`, `displayOrder`, and the visual themes as JSON — including `mascotMood` / `mascotMotion`, because badges are embodied by the mood mascots. `UserAchievement` tracks `currentProgress` / `completionPercentage` / `unlocked` per `(userId, achievementId)`. `Quiz` stores `answers Json` plus `resultMood`. |
| Engagement | `MediaStat` | Composite PK `(tmdbId, mediaType)`; `likeCount` / `savedCount` / `reviewCount` maintained **incrementally on each mutation, never recomputed by scanning**; a missing row means all zeros. |
| Durable cache (L2) | `MediaDetail`, `TvSeasonBundle`, `RecommendationCache` | Whole assembled TMDB responses stored as `payload Json` with `fetchedAt` staleness checks. Redis is hot L1; these survive eviction. |
| Enums | `ReviewStatus` (`PUBLISHED`/`FLAGGED`/`REJECTED`), `MediaType` (`MOVIE`/`TV`), `ReactionType` (`LIKE`/`LOVE`/`HAHA`/`WOW`/`SAD`/`ANGRY`) | `REJECTED` is declared but unused — reserved for a planned ML toxicity model. |

> **Naming trap:** the API and some client code use `series`/`tv`/`movie` interchangeably
> with the enum's `MOVIE`/`TV`. Watchlist and liked `POST /toggle` bodies take
> `type: "movie" | "series"`, while `DELETE :type/:id` takes `"movie" | "tv"`. Check the
> exact expected literal per endpoint rather than normalising globally.

---

## 4. Route map (client, 46 routes)

The landing page is the reference implementation for layout and type. Its composition,
in order, from `client/app/page.tsx`:

`HeroCarousel` (featured, fetched server-side from `GET /api/all/featured` with
`revalidate: 60`) → `MoodDiscoverySection variant="teaser"` → `TrendingSection` →
`PremiereHighlights` → `CommunityPicks` → `UpcomingTrailers`, wrapped in
`<main className="min-h-screen overflow-x-hidden bg-[var(--surface-0)] text-[var(--ink)]">`.
A failed featured fetch returns `[]` rather than throwing, so the hero must tolerate an
empty list.

| Group | Routes |
|---|---|
| Landing | `/` |
| Auth | `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/verify-code`, `/auth/change-password`, `/auth/onboarding` (all under a dedicated auth layout with its own background/poster treatment; navbar hidden) |
| Moods ★ | `/moods`, `/moods/explore` |
| Movies | `/movies` (hub), `/movies/[id]`, `/movies/[id]/credits`, `/movies/[id]/reviews`, plus rails: `/movies/featured`, `/movies/new-releases`, `/movies/box-office`, `/movies/award-winners`, `/movies/indie`, `/movies/animated`, `/movies/korean-cinema`, `/movies/action` (Action genre) |
| TV | `/tv`, `/tv/[id]`, `/tv/[id]/credits`, `/tv/[id]/reviews`, `/tv/trending`, `/tv/top-rated`, `/tv/new-releases`, `/tv/airing/today`, `/tv/airing/week`, `/tv/k-drama` |
| Editorial shelves | `/trending`, `/fresh-off-the-screen`, `/korean-hits`, `/world-cup-docs`, `/collection` |
| Discovery/search | `/search` (the single discovery-and-search surface; `/discover` was removed) |
| Personal | `/watchlist`, `/liked`, `/profile`, `/profile/[userId]`, `/feed` (navbar hidden) |
| Community/people | `/celeb`, `/celeb/[id]`, `/quiz` |
| Legal/misc | `/terms`, `/coming-soon` |

Navigation model: `components/Navbar.tsx` owns a `routes` list (drives the mobile drawer
and bottom nav), a `routeOptions` map (per-route quick links), a `routeIcons` map, and a
separate desktop nav array. **Adding or removing a route means touching all of these plus
`NAVBAR_HIDDEN_PREFIXES` in `app/client-layout.tsx`.**

---

## 5. API surface (Nest, all paths prefixed with `/api`)

| Prefix | Notable endpoints |
|---|---|
| *(root)* | `GET /health` |
| `auth` | `bootstrap`, `signup`, `signin`, `refresh`, `logout`, `change-password`, `google`, `google/callback`, `request-reset`, `verify-code`, `reset-password`, `me/profile`, `me/avatar` |
| `moods` ★ | `GET /`, `GET /:id`, `GET /recommendations`, `POST /recommendations/regenerate`, `POST /recommendations/feedback`, `POST /log`, `GET /history/:userId`, `GET /analytics/global`, `GET /analytics/:userId` |
| `reviews` | `POST /`, `POST /:id/replies`, `POST /:id/reactions`, `DELETE /:id/reactions`, `POST /replies/:id/reactions`, `DELETE /replies/:id/reactions`, `POST /:id/snapshot`, `GET /`, `GET /critics-corner/movies`, `GET /critics-corner/tv`, `GET /community-picks`, `GET /users/:userId/profile`, `GET /media/:mediaType/:tmdbId` |
| `search` | `GET /`, `GET /discover`, `GET /suggestions/content`, `GET /suggestions/person`, `GET /genres`, `GET /countries`, `GET /filters` |
| `all` | `trending`, `trending/day`, `trending/week`, `featured`, `trailers`, `favorites`, `koreaTrending`, `football-stories`, `peoples`, `trending-reviews`, `upcoming-trailers`, `search/suggestions`, `search/trending-terms`, `:type/:id/recommendations` |
| `movies` | `details/:id`, `trending`, `featured`, `trailers`, `favorites`, `koreaTrending`, `trending-reviews`, `upcoming-trailers`, `batch/trailers`, `recommendations…`, `health`, `cache/status` |
| `tv` | `details/:id`, `seasons/episodes/:id`, `airing/today`, `airing/week`, `revenue`, `trending`, `featured`, `trailers`, `favorites` |
| `people` | `trending/:type`, `popular`, `search`, `discover`, `:id`, `:id/videos`, `:id/movie-credits`, `:id/tv-credits`, `:id/images` |
| `category` | `trending`, `fresh-off-the-screen`, `korean-hits`, `world-cup-docs` |
| `watchlist` | `GET /`, `POST /toggle`, `POST /clear`, `DELETE /:type/:id` |
| `liked` | `GET /`, `POST /toggle`, `DELETE /:type/:id` |
| `media-stats` | `GET /batch`, `GET /community-pulse` |
| `quiz` | `GET /recommendations`, `POST /recommendations` |
| `user` | public profile read |

> **Caution:** `GET /search/discover` and `GET /people/discover` are backend endpoints
> that survived the removal of the `/discover` *frontend route*. Do not delete them while
> doing navigation cleanup.

---

## 6. Environments, config, and the API base URL contract

Authoritative doc: [`ENVIRONMENTS.md`](../ENVIRONMENTS.md).

| Name | Frontend | API |
|---|---|---|
| Local dev | `next dev --turbopack` on :3000 | hosted dev API `https://dev.api.moodies.tech/api` (a locally run Nest is optional, on `PORT=4000`) |
| Staging | `APP_ENV=staging`, Docker Compose / `build:staging` | staging API host |
| Production | Cloudflare Workers (`build:cloudflare`) | production API host |

**Hard invariants — violating these causes silent breakage:**

1. `NEST_API_URL` is readable **only** in server components, route handlers, and server
   actions. `NEXT_PUBLIC_API_URL` is the only variable available in the browser. Every
   file must pick the correct one.
2. Both values must include the trailing `/api`. The recent migration repointed 93
   occurrences across 69 client files to `"https://dev.api.moodies.tech/api"`. **Never
   reintroduce a `localhost:4000` fallback** — a bare host without `/api` 404s against the
   Nest global prefix.
3. Next.js only auto-loads `.env`, `.env.local`, `.env.development`, `.env.production`.
   `.env.staging` / `.env.production.local` are **not** auto-loaded; `npm run
   env:local|staging|prod` (→ `scripts/use-env.mjs`) materialises the choice as
   `.env.local`.
4. Secrets come from Doppler when `DOPPLER_TOKEN` is set; `env_file` in Compose is the
   fallback. Never commit a real `.env`.
5. Auth cookies: `mood_at` (access, 15 min) and `mood_session` (marker). Refresh token
   lifetime 30 days. `localStorage` key `moodies:session` mirrors the marker and drives
   the auth pre-hide script.
6. CORS is an **allowlist** from `CORS_ORIGINS` → `CLIENT_URL` →
   `http://localhost:3000`, plus automatic acceptance of dev-only origins on ports
   3000–3999 when `NODE_ENV=development`.

Local infrastructure (Compose): `postgres-dev` on host port **5434** (db
`moodies-postgres`), `mongo` on 27017, `server` published on **4000:4000** (`server/.env`
sets `PORT="4000"`; a bare `nest start` without it falls back to **3001**), `client` on
3000:3000.

---

## 7. Visual and content identity

### 7.1 Design language

Moodies is a **dark-first, cinema-poster** interface: near-black warm surfaces, coral and
gold accents, film-grain-ish gradients, generous `ui-shell` horizontal rhythm, and rails
of poster cards. The landing page (`client/app/page.tsx`) is the canonical reference —
when in doubt, copy what the landing page does rather than inventing.

Tokens, defined in `app/globals.css` and consumed as `var(--token)` inside Tailwind
arbitrary values:

| Token | Value | Role |
|---|---|---|
| `--surface-0` | `#0b0909` | page background (also hard-set on `<html>`/`<body>`) |
| `--surface-1` | `#151112` | section / shell background |
| `--surface-2` | `#1d1718` | card / panel background |
| `--surface-border` | `#35292a` | hairline borders |
| `--ink` | `#f5f1ed` | primary text (warm white) |
| `--ink-muted` | `#b9aca7` | secondary text |
| `--brand-coral` | `#f0644b` | primary brand |
| `--brand-coral-strong` | `#ff765f` | kickers, links, accents |
| `--brand-gold` | `#e6b65c` | ratings, awards, highlight accents |

Shared component classes (use these instead of re-deriving): `.ui-shell` (page gutter +
vertical rhythm), `.ui-panel`, `.ui-kicker`, `.ui-primary-action`,
`.ui-secondary-action`, `.mobile-page-shell`.

Over-media text uses white-with-alpha (`white/78`, `/80`, `/88`, `/100`) rather than
`--ink`, because the ink tokens assume a dark solid background.

### 7.2 Typography contract

Full spec: [`docs/typography-spec.md`](typography-spec.md). Summary:

- **Two families only.** `--font-body` = **Source Sans 3** (variable, all weights) and
  `--font-display` = **Barlow Condensed** loaded at **600 and 700 only**.
- A base-layer rule assigns the display family to `:where(h1, h2, [data-display])`.
  **`h3` and deeper render in the body font** — this is intentional, not a bug.
- Because Barlow only ships 600/700, `font-black` (900) on an `h1`/`h2` produces a
  faux-bold synthesis. Avoid it.
- Canonical section header inside `.ui-shell`:
  `<h2 class="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">` with a lead
  paragraph `mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]`.
- `.ui-kicker` = 0.6875rem / weight 800 / `letter-spacing: 0.16em` / uppercase /
  `--brand-coral-strong`. CTAs (`.ui-primary-action`) = 0.875rem / weight 800.
- Weight ladder: 400 body · 500–700 emphasis and titles · 800 kickers and actions.
- Size discipline: at most two steps apart, `clamp()` reserved for the hero, no new
  one-off arbitrary font sizes.

### 7.3 Voice and copy

- **Warm, plain, second person, encouraging.** Copy speaks to feelings before facts:
  *"Discover the highest-rated TV shows of all time"*, *"Series currently receiving the
  strongest audience attention on Moodies."*, *"Thanks for helping the Moodies community
  decide what to watch next."*
- No slang, no hype punctuation, no emoji in UI strings. Sentence case for body, and short
  uppercase kickers as the only "shouting" device.
- **The mascot is a brand asset.** Each mood has an illustrated character at
  `client/public/images/moods/<mood>.png` (alt text: `"<Mood> mood mascot"`). Review
  flows reuse mascots keyed to score bands — a 9 gets *epic* "A standout watch", a 3 gets
  *bittersweet* "More misses than hits". Preserve mascot-plus-label pairing when touching
  review UI.
- Empty and error states are named gently and give one action: *"Your watchlist is
  empty"*, *"Couldn't load your watchlist"*, *"Welcome to Moodies" /
  "Sign in for your Moodies profile"*.
- Product naming to keep consistent: **Moodies**, **Moodies Feed**, **Moodies guide**
  (nav drawer label), **Critics' Corner**, **Community Picks**, **Community Pulse**,
  **Personality Quiz**.
- Support contact is `moodies.support@gmail.com` with a `MAIL_SUPPORT` sender; the
  long-term plan is Cloudflare Email Routing (see `README.md`). Do not introduce other
  contact addresses.

### 7.4 Mood taxonomy — the product's vocabulary

21 seeded moods (`server/prisma/seed/moods.seed.ts`), arranged on the valence/arousal
circumplex. Each carries its own brand colour, Tabler icon name, mascot illustration, one
empathetic description line, keyword list, and mapped TMDB genre IDs. This list is the
product's emotional language — treat additions and renames as brand decisions, not content
edits, and note that `seedMoods` **upserts with the full payload**, so re-running the seed
overwrites manual database edits.

| Seed group | Moods |
|---|---|
| Positive / high energy | Happy `#FFD700` (+0.8/+0.5), Funny `#FFB6C1` (+0.9/+0.6), Cozy `#FFDEAD` (+0.7/+0.2), Whimsy `#BA55D3` (+0.7/+0.5) |
| Positive / low energy | Romantic `#FF69B4` (+0.7/+0.3), Serenity `#20B2AA` (+0.3/−0.3), Chill `#87CEEB` (+0.3/−0.5) |
| Inspirational | Inspirational `#32CD32` (+0.9/+0.6) |
| Nostalgic / reflective | Nostalgic `#FFB347` (+0.6/+0.4), Bittersweet `#708090` (−0.2/+0.2), Sad `#4682B4` (−0.5/+0.3) |
| High energy / action | Thrilling `#FF6B35` (+0.6/+0.9), Epic `#8A2BE2` (+0.5/+0.8), Chaos `#FF4500` (+0.2/+0.9) |
| Dark / suspenseful | Horror `#8B0000` (−0.3/+0.8), Dark `#2F4F4F` (−0.2/+0.4), Gritty `#696969` (−0.3/+0.6), Mind-Bending `#4B0082` (+0.2/+0.7) |
| Genre-specific | Sci-Fi `#00CED1`, Western `#CD853F`, Documentary `#708090` |

Numbers are `valence`/`arousal`. Icon names are Tabler identifiers (`smile`, `mug-hot`,
`magic`, `wind`, `cloud-rain`, `zap`, `crown`, `fire`, `skull`, `moon`, `shield`, `brain`,
`rocket`, `cowboy`, `book`, `star`, `clock`).

The seed also documents the TMDB genre-ID table it maps against (movie IDs 12–10751, TV
IDs 16–10766), which is the reference to consult before adding a genre mapping.

---

## 8. Working on this repo

```bash
npm run install:all            # both workspaces
npm run dev:client             # Next dev (turbopack) on :3000
npm run dev:server             # Nest start on :3001 (or PORT)
npm run lint                   # both workspaces, --fix
npm run typecheck              # tsc --noEmit (client) + prisma generate && tsc (server)
npm run build                  # client staging build + server nest build
npm test -- --runInBand --prefix server
cd client && npx playwright install chromium && npm test
npm run verify                 # lint + typecheck + build  ← the pre-PR gate
```

Useful per-workspace commands: `client` → `npm run test:e2e`, `npm run storybook`,
`npm run build:cloudflare`, `npm run env:staging`. `server` → `npm run studio`,
`npm run seed`, `npm run migrate:dev`, `npm run docker:fresh`.

Branching is **trunk-based**: `trunk` is the integration branch, PRs are scoped to one
feature/fix/cleanup, and repo-wide format or lint sweeps belong in cleanup-only PRs.
CI runs `.github/workflows/pr-checks.yml` and `staging-smoke-test.yml`. Use `lint:check`
in automation and `lint:fix` only locally.

**AI-agent rule from `AGENTS.md`:** before answering, planning, or editing anything that
depends on an external library, run Context7 through npx —
`npx.cmd --yes ctx7 library <name> "<question>"` then
`npx.cmd --yes ctx7 docs <library-id> "<question>"`. Relevant IDs:
`/vercel/next.js`, `/nestjs/docs.nestjs.com`, `/prisma/docs`, `/tanstack/query`,
`/tailwindlabs/tailwindcss.com`, `/storybookjs/storybook`, `/vitest-dev/vitest`,
`/microsoft/playwright`. Say explicitly when Context7 was unavailable.

---

## 9. Known drift, debt, and traps

Read this before trusting any single file as a pattern.

1. **`SECURITY.md` is not a security policy.** It is a prompt template for an AI-driven
   architecture/security audit. Real security behaviour lives in
   `server/src/auth/*`, `server/src/common/*`, `server/src/main.ts`, and
   `client/middleware.ts`.
2. **Giant service files.** `routes/moods/moods.service.ts` (~1500 lines) and
   `routes/review/review.service.ts` (~1375 lines) are god-services; `search.service.ts`
   is ~979. Extract or delegate carefully — these hold the recommendation scoring logic.
3. **Redundant data access layers.** Prisma + TypeORM + Mongoose + raw `mongodb` are all
   installed. Prisma is authoritative; do not add a fifth path.
4. **Both Argon2 and bcrypt are dependencies.** Verify which hash a code path actually
   uses before "modernising" it.
5. **Naming is inconsistent.** `routes/` contains feature *modules* (moods, review,
   search, user, moderation) while top-level dirs (`liked`, `watchlist`, `media/`,
   `quiz`) are equally valid modules. `media/all` vs `media/movies` vs `media/tv` overlap
   substantially (`all/trending` mirrors `movies/trending`).
6. **Duplicate `action` semantics in the client.** `app/movies/action.ts` and
   `app/tv/action.ts` are server-action modules, while `app/movies/action/` is the
   *Action genre route*. Never infer intent from the filename alone.
7. **Frontend API fallbacks were recently migrated.** All client defaults now point at
   `https://dev.api.moodies.tech/api`. `README.md` still tells contributors the backend
   listens on `http://localhost:4000` — that is accurate for a *locally run* Nest process
   (`server/.env` sets `PORT="4000"`), but the frontend no longer defaults to it. Prefer
   `ENVIRONMENTS.md` and this document for the current wiring.
8. **Known typography deviations** are catalogued in `docs/typography-spec.md` §
   "known deviations" (11 items, including a hero `clamp()` regression where the title
   shrinks between 390px and 640px). Fixes are pending a design decision on Barlow
   weights; do not "fix" a deviation silently.
9. **Prior audits are already on file.** Before touching these areas, read the matching
   report in `docs/`: API call redundancy, error handling inventory, Redis cache usage,
   root toast system, staging watchlist/like performance, branch protection. Treat them as
   snapshots that may have drifted, and verify against the code.
10. **`.next` artifact collisions.** `next dev --turbopack` and webpack `next build` write
    incompatible artifacts into the same `client/.next`. A build that fails during
    "Collecting page data" with `Cannot find module
    '../chunks/ssr/[turbopack]_runtime.js'` is this collision, not a code fault — delete
    `client/.next` and rebuild. Stale generated types under `.next/types/` can also break
    `tsc` after a route is removed.
11. **Cache layers.** Redis is L1; `MediaDetail`, `TvSeasonBundle`, and
    `RecommendationCache` Postgres tables are durable L2. Invalidating one without the
    other produces confusing staleness. `movies/health` and `movies/cache/status` exist
    for diagnosis.
12. **TMDB is a rate-limited dependency.** All upstream calls go through the bottleneck
    limiter in `external-apis/tmdb/`. Never add a direct `fetch` to TMDB from a
    controller, service, or client file.
13. **Two stale labels in the schema.** The L2 cache block is commented "L2 cache
    (Supabase)" but `MediaDetail`, `TvSeasonBundle`, and `RecommendationCache` are plain
    Postgres tables (Supabase is used only for avatar storage). `ReviewStatus.REJECTED` is
    declared but unused, reserved for a planned IBM MAX toxicity-detection model.
14. **Leftover empty directories.** `client/app/discover/` and
    `client/components/discover/` are empty remnants of the removed Discover surface and
    are untracked. `/discover` no longer exists as a route.

---

## 10. Quick orientation for a first question

- "Why is this API call 404ing?" → missing `/api` suffix, or wrong env var
  (`NEST_API_URL` in a client component). §6.
- "Why does the nav look wrong on this page?" → `Navbar.tsx` maps (`routes`,
  `routeOptions`, `routeIcons`, desktop array) + `NAVBAR_HIDDEN_PREFIXES`. §4.
- "How are recommendations produced?" → `Mood` valence/arousal + `tmdbGenres` +
  `keywords` → scoring in `routes/moods/moods.service.ts`, personalised when
  `OptionalJwtGuard` resolves a user, cached in Redis + `RecommendationCache`. §3.2, §5.
- "Is this styling change on-brand?" → tokens in `globals.css` §7.1 and
  `docs/typography-spec.md` §7.2; the landing page is the reference implementation.
- "Is this a security hole?" → §9 item 1; read `server/src/auth` and
  `server/src/common` rather than `SECURITY.md`.
- "What should I run before a PR?" → `npm run verify`, plus the checklist in
  `CONTRIBUTING.md`.
