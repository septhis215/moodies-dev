# Staging Watchlist/Like Performance Report

## Summary

Watchlist and liked actions already use optimistic client state in the shared hooks, so the button state should change before the staging request returns. The backend mutation path, however, was doing avoidable database work after every toggle:

- `POST /watchlist/toggle` performed the membership change, updated `media_stats`, then counted the user's movie saves and series saves.
- `POST /liked/toggle` performed the membership change, updated `media_stats`, then counted the user's movie likes and series likes.

The current clients only read `{ removed }` and `{ liked }`, so those total counts added extra database reads inside the mutation transaction without any user-visible benefit. That cost is easy to miss locally with a small database and low latency, but it becomes more visible on staging where the backend, Supabase Postgres, Redis, and browser may all be separated by network hops.

This pass removed the unused count queries and added CORS preflight caching.

## Evidence

### Code Evidence

| Area | Evidence | Impact |
|---|---|---|
| Frontend optimistic update | `client/hooks/useWatchlist.ts` updates local sets before `toggleWatchlist`; `client/hooks/useLiked.ts` does the same before `toggleLiked` | Perceived UI can be instant if controls are wired to the hook state |
| Watchlist mutation overhead | `server/src/watchlist/watchlist.service.ts` previously ran two `count()` queries after each toggle | Removed; response is now `{ removed }` |
| Liked mutation overhead | `server/src/liked/liked.service.ts` previously ran two `count()` queries after each toggle | Removed; response is now `{ liked }` |
| Indexes | `server/prisma/schema.prisma` has `@@unique([userId, tmdbId, mediaType])` and `@@index([userId, addedAt])` for both watchlist and liked tables | Direct membership lookup is indexed |
| CORS | `server/src/main.ts` uses credentialed CORS and cross-origin JSON mutations will preflight on staging | Added `maxAge: 600` to cache successful preflight checks |
| External APIs | Watchlist/liked toggle services do not call TMDB or Redis | Slow action is not caused by TMDB in the toggle path |

### Timing Comparison

Authenticated staging timing still needs a browser/network capture because this environment does not have a staging login cookie/session. Use this table during verification:

| Action | Endpoint | Local Time | Staging Time | TTFB | Duplicate Calls | Notes |
|---|---|---:|---:|---:|---|---|
| Add movie to watchlist | `POST /watchlist/toggle` | TBD | TBD | TBD | Should be no | Should return small `{ removed: false }` |
| Remove movie from watchlist | `POST /watchlist/toggle` | TBD | TBD | TBD | Should be no | Should return small `{ removed: true }` |
| Add series to watchlist | `POST /watchlist/toggle` | TBD | TBD | TBD | Should be no | `type: "series"` maps to `MediaType.TV` |
| Remove series from watchlist | `POST /watchlist/toggle` | TBD | TBD | TBD | Should be no | No TMDB call expected |
| Like movie/series | `POST /liked/toggle` | TBD | TBD | TBD | Should be no | Should return small `{ liked: true }` |
| Unlike movie/series | `POST /liked/toggle` | TBD | TBD | TBD | Should be no | Should return small `{ liked: false }` |

## Request Flow

## Flow: Save Movie or Series to Watchlist

### Frontend

1. User clicks a watchlist control.
2. Component calls `useWatchlist.add(id, type, meta)`.
3. Hook checks auth state.
4. Hook updates local `movieIds` or `seriesIds` immediately.
5. Hook calls `toggleWatchlist(id, type)`.
6. `toggleWatchlist` sends `POST /watchlist/toggle` with credentials.
7. If the request fails, hook rolls back the local set and shows an error/login toast.

### Backend

1. `WatchlistController.toggle` receives the request.
2. `JwtGuard` validates the cookie JWT and loads a narrow user object.
3. `WatchlistService.toggle` maps `movie` to `MOVIE`, `series` to `TV`.
4. Prisma transaction checks the unique membership row.
5. Existing row: delete it.
6. Missing row: create it.
7. Update `media_stats.savedCount`.
8. Return `{ removed }`.

## Flow: Like or Unlike Movie/Series

### Frontend

1. User clicks like/favorite.
2. Component calls `useLiked.like` or `useLiked.unlike`.
3. Hook checks auth state.
4. Hook updates local liked state immediately.
5. Hook calls `toggleLiked(id, type)`.
6. If the request fails, hook rolls back.

### Backend

1. `LikedController.toggle` receives the request.
2. `JwtGuard` validates the cookie JWT and loads a narrow user object.
3. `LikedService.toggle` checks the unique membership row.
4. Existing row: delete it.
5. Missing row: create it.
6. Update `media_stats.likeCount`.
7. Return `{ liked }`.

## Problems Found

## Frontend Issues

- Shared hooks are already optimistic.
- Guest protected calls were addressed in the previous API-call audit pass: hooks now wait for auth and skip protected list fetches for guests.
- No full page refresh was found in the shared watchlist/liked hook flow.
- Some feature components keep their own local overlay state in addition to the shared hook state. This is acceptable, but each should be checked in DevTools to confirm one click produces one mutation.

## Backend Issues

- Fixed: toggle endpoints returned totals that current clients do not use.
- Fixed: those totals required two extra `count()` queries inside each transaction.
- No TMDB call was found in watchlist/liked toggle services.
- No Redis invalidation was found in watchlist/liked toggle services.
- Auth guard performs one user lookup per protected request; it selects only small fields.

## Infrastructure Issues To Verify On Staging

- Client appears to be Vercel and backend Railway, with Supabase Postgres and remote Redis per project environment docs.
- Cross-origin credentialed JSON POSTs can trigger OPTIONS preflight.
- Backend and Supabase region alignment needs to be checked in Railway/Supabase dashboards.
- Railway cold-start/sleep behavior needs to be measured by comparing first, second, and third request after idle.
- `CORS_ORIGINS` should include the staging Vercel origin explicitly.
- Cookie settings must match deployment domains. Truly cross-site frontend/backend domains need `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`.

## Changes Implemented

1. Removed unused `totalMovies` and `totalSeries` counts from `WatchlistService.toggle`.
2. Removed unused `totalMovies` and `totalSeries` counts from `LikedService.toggle`.
3. Added `maxAge: 600` to Nest CORS settings to cache successful staging preflight responses.

## Recommended Fixes

### Priority 1: Verify Perceived Optimistic UI In Staging

- Problem: If a component waits on `ready` or uses stale local overlay state, the action can still feel slow.
- Evidence: Shared hooks are optimistic, but components may layer their own local state.
- Recommended change: In DevTools, verify the icon state changes immediately on click before the network response returns.
- Files affected: Components using `useWatchlist` and `useLiked`.
- Risk: Low.
- Expected improvement: Instant perceived save/like.

### Priority 2: Keep Toggle Backend Minimal

- Problem: Extra aggregate counts add transaction time and DB load.
- Evidence: Removed four count queries across the two toggle endpoints.
- Recommended change: Keep response payloads small: `{ removed }`, `{ liked }`.
- Files affected: `server/src/watchlist/watchlist.service.ts`, `server/src/liked/liked.service.ts`.
- Risk: Low; current shared clients only type/read these booleans.
- Expected improvement: Lower mutation TTFB, especially with larger staging tables.

### Priority 3: Measure CORS Preflight Impact

- Problem: Staging cross-origin POSTs may pay OPTIONS + POST.
- Evidence: Client uses JSON body and credentials across origins.
- Recommended change: Confirm browser Network tab shows `Access-Control-Max-Age` and fewer repeated OPTIONS requests after the first.
- Files affected: `server/src/main.ts`.
- Risk: Low.
- Expected improvement: Faster repeated save/like actions in one browser session.

### Priority 4: Check Region Placement

- Problem: Railway backend, Supabase Postgres, and Redis can be in different regions.
- Evidence: Project environment docs identify Railway/Supabase/remote Redis staging pieces.
- Recommended change: Co-locate backend and database as closely as possible; Redis should be near backend if used for auth refresh.
- Risk: Operational.
- Expected improvement: Lower baseline TTFB for all protected mutations.

## Testing Checklist

- Fresh guest clicks save/like: login prompt, no protected mutation.
- Logged-in save movie: one `POST /watchlist/toggle`, immediate icon update.
- Logged-in remove movie: one `POST /watchlist/toggle`, immediate rollback-safe update.
- Logged-in save/remove series: same as movie.
- Logged-in like/unlike: one `POST /liked/toggle`, immediate icon update.
- Fast repeated clicks: final UI matches server state.
- Expired session: at most one refresh attempt, no retry loop.
- Network failure: optimistic state rolls back.
- Staging Network tab: record OPTIONS presence, POST TTFB, response size, and duplicate calls.
- Backend logs: confirm no TMDB call and no repeated mutation per click.

## Acceptance Criteria

- Guest browsing does not call watchlist/liked APIs automatically.
- Guest clicking save/like does not call protected mutation before login prompt.
- One logged-in click produces one mutation request.
- Mutation response payload is small.
- No full page refresh or full watchlist refetch happens after a simple shared-hook toggle.
- Backend mutation path performs membership change plus counter update only.
- Staging captures show improved TTFB and/or instant perceived UI after deploy.
