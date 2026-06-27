# API Call Redundancy Audit Report

## Summary

This audit inspected client-side `fetch` calls, shared auth/watchlist/liked hooks, key page-level server fetches, NestJS controllers, Prisma-backed services, Redis/TMDB-backed services, and public versus protected endpoint behavior.

Context7 was used for current docs:

- Next.js App Router `fetch`, `next.revalidate`, `cache: "no-store"`, and React `cache` memoization.
- React `useEffect` fetch cleanup and dependency behavior.
- TanStack Query dependent queries and `enabled` gating patterns, even though this project mostly uses custom hooks instead of query hooks.

## Current Problems Found

| Area | File | Endpoint | Trigger | Guest Behavior | Duplicate Risk | Recommendation |
|---|---|---|---|---|---|---|
| Global auth bootstrap | `client/app/context/AuthProvider.tsx` | `GET /auth/me`, `POST /auth/refresh` | App mount | Previously fresh guests could hit refresh after `/auth/me` returned 401 | Medium | Keep one `/auth/me` status check, only refresh when browser has a prior session marker |
| Watchlist shared hook | `client/hooks/useWatchlist.ts` | `GET /watchlist`, `POST /watchlist/toggle` | Any component using `useWatchlist` | Previously ran for guests and treated 401 as empty state | High | Gate behind auth bootstrap and `isAuthenticated` |
| Liked shared hook | `client/hooks/useLiked.ts` | `GET /liked`, `POST /liked/toggle` | Feed/detail components using `useLiked` | Previously ran for guests and could 401 | High | Gate behind auth bootstrap and `isAuthenticated` |
| Current profile page | `client/app/profile/page.tsx` | `/auth/me`, `/watchlist`, `/reviews/me`, `/auth/me/achievements` | Profile page mount/tab | Already gated by auth | Medium | Keep gating; future improvement is to reuse richer provider state or add a profile summary endpoint |
| Watchlist page | `client/app/watchlist/page.tsx` | `/watchlist` then many TMDB detail calls | Private page after auth | Already waits for auth | Medium | Move TMDB enrichment server-side or cache by ID to avoid direct client fan-out |
| Liked page | `client/app/liked/page.tsx` | `/liked` then many TMDB detail calls | Private page after auth | Already waits for auth | Medium | Same as watchlist |
| Public profile page | `client/app/profile/[userId]/page.tsx` | `/reviews/users/:id/profile`, then many TMDB detail calls | Public profile load | Public | High on large profiles | Prefer backend-enriched profile response or cached batch enrichment |
| Movie details | `client/app/movies/[id]/page.tsx` | details, images, videos, recommendations, reviews, stats | Server render | Public | Medium | Consider backend bulk details endpoint if latency becomes visible |
| TV details | `client/app/tv/[id]/page.tsx` | details, seasons, images, videos, recommendations, reviews, stats | Server render | Public | Medium | Same as movie details |
| TV home | `client/app/tv/page.tsx` | TV section endpoints | Server render | Public | Was high before previous patch | Keep parallel section fetching; avoid serial bulk fallback |
| Review modal/list | `client/components/selected-content/sections/reviews.tsx`, `client/components/selected-content/extended/allReviews.tsx` | `/reviews`, replies, reactions | User action/list render | Public reads; protected writes | Medium | Keep writes auth-gated; delay reply/reaction calls until panel is opened |
| Search | `client/app/search/page.tsx`, `client/components/ui/searchbar.tsx` | `/search`, suggestions, videos | Input/query changes | Public | Medium | Ensure debounce/abort remains in place; avoid video calls until preview is visible |
| Feed | `client/app/feed/page.tsx` | `/all/video-feed`, `/all/video-feed/viewed` | Feed load/viewed event | Public plus interaction logging | Medium | Keep viewed logging fire-and-forget; gate user actions through auth |

## Changes Implemented

1. `useWatchlist` now waits for `AuthProvider` to finish bootstrapping and skips `/watchlist` for guests.
2. `useWatchlist.add` and `useWatchlist.remove` now show the login toast before calling protected mutation endpoints.
3. `useLiked` now waits for auth bootstrap and skips `/liked` for guests.
4. `useLiked.like` and `useLiked.unlike` now show the login toast before calling protected mutation endpoints.
5. `AuthProvider` now keeps a non-sensitive local session marker. Fresh guests still get one `/auth/me` check, but no longer trigger `/auth/refresh` unless the browser previously had a session.
6. The sign-in hook marks the browser as session-capable after a successful login.

## Guest User Issues

Before this pass, guest users could trigger protected user endpoints indirectly:

- `GET /watchlist` from `useWatchlist` on public hero/carousel/detail/feed components.
- `GET /liked` from `useLiked` on public feed/detail components.
- `POST /auth/refresh` after an initial guest `/auth/me` 401.

After this pass, guest browsing should be limited to:

- One global `GET /auth/me` session check.
- Public media, search, review listing, and metadata endpoints.
- No automatic watchlist/liked list requests.
- No refresh request for a browser that has never had a Moodies session marker.

## Duplicate Calls

| Duplicate | Current behavior | Recommendation |
|---|---|---|
| Auth profile data | Global `/auth/me` plus profile page `/auth/me` | Acceptable for now because profile page needs richer disclosure fields. Long term, return those fields from the provider or add `/auth/me/summary`. |
| Detail pages | Details, reviews, stats, images, videos, recommendations are separate calls | Keep for modularity, but add a backend `details-dashboard` endpoint if page latency is high. |
| Watchlist/liked TMDB enrichment | Client fetches TMDB once per ID | Move to backend batch enrichment with Redis/TMDB service cache. |
| Public profile enrichment | One public profile request followed by per-item TMDB enrichment | Return enriched public profile items from `reviews/users/:id/profile` or add a batch endpoint. |
| Replies/reactions | Review components fetch per selected review | Keep lazy; verify no hidden panel fetches fire before expansion. |

## Backend Inefficiencies

| Area | File | Finding | Recommendation |
|---|---|---|---|
| TMDB details/recommendations | `server/src/media/movies/**`, `server/src/media/tv/**` | Mostly uses Redis/DB caches, but detail pages still fan out at the page layer | Consider aggregate endpoints per page where needed |
| Review carousel enrichment | `server/src/routes/review/review.service.ts` | Already batches cached `mediaDetail` lookup before TMDB fallback | Keep; this is a good pattern |
| Watchlist/liked services | `server/src/watchlist/watchlist.service.ts`, `server/src/liked/liked.service.ts` | DB select is narrow and transactional | Keep security guards; add optional enriched/batched read endpoint later |
| Media stats pulse | `server/src/media-stats/media-stats.service.ts` | Uses batch DB queries then TMDB enrichment | Keep caching under review if pulse is high traffic |
| External API client | `server/src/external-apis/services/tmdb.service.ts` | Redis-backed TMDB caching is present | Keep Redis first; avoid direct client TMDB calls for user lists |

## Recommended API Flow

### Guest Homepage / Public Browse

1. `GET /auth/me` once from the provider.
2. Public page endpoints only: `/all/*`, `/movies/*`, `/tv/*`, `/reviews/media/*`, `/search*`.
3. No `/watchlist`, `/liked`, `/reviews/me`, `/auth/me/achievements`, or `/auth/refresh`.

### Logged-In Homepage / Public Browse

1. `GET /auth/me` once from the provider.
2. Public page endpoints.
3. User-specific `/watchlist` and `/liked` only where a mounted feature needs status.
4. Mutations only after user action.

### Guest Clicking Watchlist / Like / Review Submit

1. No protected mutation request.
2. Show login prompt or route to login.
3. Backend guards remain unchanged.

### Logged-In Profile

1. Fetch profile-specific user data.
2. Fetch reviews only when reviews tab is active.
3. Fetch watchlist data only when required by the page.
4. Future: use backend-enriched watchlist/review items instead of browser-to-TMDB fan-out.

## Priority Fix Plan

### Priority 1: Gate user-specific shared hooks

- Status: Done.
- Files affected: `client/hooks/useWatchlist.ts`, `client/hooks/useLiked.ts`.
- Risk: Low.
- Expected benefit: Removes repeated guest 401s across public pages using shared media controls.

### Priority 2: Avoid refresh calls for fresh guests

- Status: Done.
- Files affected: `client/app/context/AuthProvider.tsx`, `client/hooks/useAuth.ts`.
- Risk: Low to medium. The marker is intentionally non-sensitive, but older sessions with expired access cookies and no marker may need to sign in again.
- Expected benefit: Reduces normal guest auth traffic from `/auth/me` plus `/auth/refresh` to `/auth/me` only.

### Priority 3: Backend-enrich watchlist/liked/profile items

- Status: Recommended.
- Files affected: `client/app/watchlist/page.tsx`, `client/app/liked/page.tsx`, `client/app/profile/page.tsx`, `client/app/profile/[userId]/page.tsx`, backend watchlist/liked/review profile services.
- Risk: Medium.
- Expected benefit: Removes client-side TMDB fan-out and hides TMDB key usage from those flows.

### Priority 4: Add optional page aggregate endpoints for details

- Status: Recommended.
- Files affected: `client/app/movies/[id]/page.tsx`, `client/app/tv/[id]/page.tsx`, `server/src/media/movies`, `server/src/media/tv`.
- Risk: Medium.
- Expected benefit: Fewer backend round trips for details pages.

### Priority 5: Review hidden/modal fetches

- Status: Recommended.
- Files affected: review modal/list components.
- Risk: Low.
- Expected benefit: Replies/reactions/comments only load when visible.

## Risk Assessment

- Frontend gating does not replace backend guards. All protected NestJS routes should remain guarded.
- The local session marker is not an auth token and should never contain user identity.
- Auth refresh is now conservative for fresh guests. This reduces waste but may require old browsers without the marker to sign in again if their access cookie expired before this change.
- Direct client TMDB enrichment is functional but higher cost and less cacheable than backend enrichment.

## Testing Checklist

- Fresh guest visit: verify only one `/auth/me`, no `/auth/refresh`, `/watchlist`, or `/liked`.
- Guest homepage, movie detail, TV detail: verify public endpoints still load.
- Guest watchlist/like click: verify login toast/redirect and no protected mutation.
- Logged-in homepage: verify watchlist/liked states load where controls are visible.
- Logged-in watchlist and liked pages: verify lists still load and removal works.
- Logged-in profile: verify profile, watchlist, reviews, achievements, and edit save still work.
- Logout: verify session marker clears and guest calls are gated.
- Expired session with marker: verify one refresh attempt, then normal user reload or logout.
- Search: verify debounce and no calls with empty or undefined params.
- Review modal: verify protected submit still requires auth and public reviews still load.
