# Redis Audit Report

## Summary

This project uses Redis as a hot cache, rate-limit counter store, and refresh-token store. PostgreSQL, via Prisma, is the durable source of truth for users, reviews, watchlists, likes, achievements, media stats, and the L2 TMDB cache tables.

The best current pattern is already present in `MediaCacheService`: Redis L1 -> PostgreSQL L2 -> TMDB. The biggest improvement areas are key naming consistency, TTL alignment for public lists, diagnostics, and avoiding sensitive values in Redis keys.

Context7 was used before implementation for current docs:

- `/redis/node-redis`: node-redis v5 connection, events, `get`/`set`, and client usage.
- `/redis/docs`: Redis `maxmemory`, TTL, `SCAN`, and eviction policy guidance.
- `/nestjs/docs.nestjs.com`: NestJS providers/modules/DI patterns.
- `/websites/prisma_io`: Prisma/PostgreSQL query optimization and source-of-truth guidance.
- `/vercel/next.js`: Next.js 15 fetch caching behavior.

## Current Architecture

- Frontend: Next.js 15, React 19, TanStack Query present.
- Backend: NestJS 11.
- Database: PostgreSQL through Prisma.
- Redis client: `redis` v5.8.2 (`node-redis`).
- Redis provider: environment-configured remote Redis via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`; no Redis container exists in `docker-compose.yml`.
- External APIs: TMDB through `TMDBService`, plus YouTube oEmbed checks through video scoring/feed code.
- Source of truth: PostgreSQL.
- Redis role: hot temporary cache, refresh-token/session revocation store, and rate-limit counters.
- L2 cache tables: `MediaDetail`, `TvSeasonBundle`, `RecommendationCache`.

## Redis Usage Inventory

| Area | File | Key Pattern | Data Cached | TTL | Risk | Value | Recommendation |
|---|---|---|---|---|---|---|---|
| Base Redis wrapper | `server/src/redis/redis.service.ts` | caller-provided | JSON strings, rate counters, locks | caller-provided | Medium | High | Keep central service; now fail-open for generic cache reads and provides SCAN diagnostics. |
| Single-flight locks | `server/src/redis/redis.service.ts` | `lock:{key}` | lock marker | 10s | Low | High | Keep. Prevents stampedes for expensive cache misses. |
| Rate limiting | `server/src/common/guards/rate-limit.guard.ts` | `rl:{client}:{method}:{path}` | request counters | 60s | Low | High | Keep. Good fixed-window atomic Lua script. |
| Refresh tokens | `server/src/auth/auth.service.ts` | `rt:{sha256(token)}` | token -> userId | `REFRESH_EXPIRES_DAYS`, default 30d | High | Required | Keep. Changed from raw token key to hashed key with legacy fallback. |
| Achievement progress | `server/src/auth/auth.service.ts` | `achievements:{userId}` | user achievement progress rows | 60s | Medium | Medium | Keep short TTL; consider invalidating after review/watchlist/like/mood writes if freshness matters. |
| TMDB generic request cache | `server/src/external-apis/services/tmdb.service.ts` | `tmdb:{absoluteUrl}?{query}` | TMDB response JSON | 1h-24h by endpoint | Medium | High | Keep but standardize/sanitize key names. Avoid full URLs long-term. |
| TMDB keyword memory cache | `server/src/external-apis/services/tmdb.service.ts` | in-process `Map<number,...>` | keyword arrays | 1h, negative 5m | Low | Medium | Keep. Process-local, no Redis memory cost. |
| Media read-through L1/L2 | `server/src/external-apis/services/media-cache.service.ts` | caller-provided | detail/recommendation bundles | caller-provided | Medium | High | Keep. Best architecture in repo. |
| Movie details | `server/src/media/movies/details/movie-details.service.ts` | `detail:movie:{id}` | slim assembled detail bundle | Redis 6h, PG stale 30d | Low | High | Keep. Good L1/L2 split. Rename to namespaced key in next version. |
| TV details | `server/src/media/tv/details/tv-details.service.ts` | `detail:tv:{id}` | slim assembled detail bundle | Redis 6h, PG stale 30d | Low | High | Keep. |
| TV seasons | `server/src/media/tv/details/tv-details.service.ts` | `seasons:tv:{id}` | seasons + episodes bundle | Redis 6h, PG stale 7d | Medium | High | Keep, but monitor size for long-running shows. |
| Movie recommendations | `server/src/media/movies/recommendations/movie-recommendations.service.ts` | `rec:movie:{id}:{limit}` | mapped recommendation list | Redis 6h, PG stale 1d | Low | High | Keep. |
| TV recommendations | `server/src/media/tv/recommendations/tv-recommendations.service.ts` | `rec:tv:{id}:{limit}` | mapped recommendation list | Redis 6h, PG stale 1d | Low | High | Keep. |
| Mixed recommendations | `server/src/media/all/recommendations/recommendations.service.ts` | `smart-rec-v2-{type}-{id}-{limit}` | mapped recommendation list | Redis 6h, PG stale 1d | Medium | High | Keep, but rename to colon namespaced key. |
| Background recommendation hydration | `server/src/media/all/recommendations/recommendations.service.ts` | existing list key | list with embedded recommendations | 24h | Medium | Medium | Review. This can increase payload size under homepage/list keys. |
| Movie catalog lists | `server/src/media/movies/catalog/movie-catalog.service.ts` | `movies:{section}:{limit}` | public movie list arrays | 6h | Low | High | Keep. Good TTL. |
| TV catalog lists | `server/src/media/tv/catalog/tv-catalog.service.ts` | `tv:{section}:{limit}` | public TV list arrays | 6h | Low | High | Keep. Good TTL. |
| TV new releases | `server/src/media/tv/new-releases/tv-new-releases.service.ts` | `tv:newReleases:{limit}` | public TV list array | 6h | Low | High | Keep. |
| Category pages | `server/src/media/category/category.service.ts` | `category:{section}:{page}:{limit}` | public mixed category responses | 24h | Medium | High | Shorten dynamic sections; comments say shorter TTLs but code uses 24h. |
| All featured/trending/Korea | `server/src/media/all/trending/trending.service.ts` | `featured`, `trending-{limit}`, `koreaTrending-{limit}` | public mixed list arrays | 24h | Medium | High | Rename and reduce trending TTL. Root keys are collision-prone. |
| Football stories | `server/src/media/all/trending/trending.service.ts` | `world-cup-football-docs:*` | curated raw/ranked football doc collections | 8h, last-good 14d | Medium | Medium | Keep with max collection size; last-good is acceptable but monitor size. |
| Video feed page | `server/src/media/all/feed/video-feed.service.ts` | `video-feed:{type}:{page}:{limit}:{salt}:{viewer}:{historySeed}` | personalized-ish feed page | 12m | Medium | Medium | Keep TTL short; user-keyed variants can multiply quickly. |
| Viewed trailer history | `server/src/media/all/feed/feed-utils.service.ts` | `video-feed-viewed:{viewerId}` | last 200 viewed trailer entries | 45d | High | Medium | Consider shortening to 14-30d or store in Postgres if durable personalization is needed. |
| Feed TMDB subrequests | `server/src/media/all/feed/feed-utils.service.ts` | `tmdb:{sanitizedEndpoint}` | TMDB response JSON | 24h currently via `CACHE_TTL.BASIC_DATA` | Medium | High | Lower dynamic feed/discover/trending TTL to 1-6h. |
| Feed videos | `server/src/media/all/feed/feed-utils.service.ts` | `feed-videos:{type}:{id}` | video response | 24h | Low | High | Keep or reduce to 12h. |
| YouTube oEmbed availability | `server/src/media/all/feed/feed-utils.service.ts` | `youtube-oembed:{videoKey}` | boolean availability | 24h | Low | Medium | Keep. Negative values may stale; acceptable. |
| Upcoming feed page | `server/src/media/all/trailers/upcoming-feed.service.ts` | `upcoming-feed:{page}:{limit}:{viewer}:{historySeed}` | feed page response | 20m | Medium | Medium | Keep short. |
| Upcoming feed details | `server/src/media/all/trailers/upcoming-feed.service.ts` | `feed-detail:{type}:{id}` | details with videos | 24h | Medium | High | Consider 6-12h for unreleased titles. |
| Enhanced trailers | `server/src/media/all/trailers/trailers.service.ts` | `trailers-enhanced-{limit}` | trailer list | intended cache read only; write missing | Low | Medium | Bug/opportunity: currently reads but does not set this key in `getTrailers`. |
| Per-item trailer key | `server/src/media/all/trailers/trailers.service.ts` | `trailer:{type}:{id}` | YouTube trailer key or null | 24h | Low | High | Keep. Nulls are cached for 24h; consider 1-6h for misses. |
| Movie trailers | `server/src/media/movies/trailers/movie-trailers.service.ts` | `movies:trailers:{limit}`, `movies:upcomingMonthly:*` | movie trailer lists | 6h | Low | High | Keep. |
| TV trailers | `server/src/media/tv/trailers/tv-trailers.service.ts` | analogous `tv:*` | TV trailer lists | 6h | Low | High | Keep. |
| People profile | `server/src/media/people/people.service.ts` | `people:profile:{id}:v2` | shaped person details | 6h | Medium | High | Keep; shaping trims images/credits, good. |
| People credits/images | `server/src/media/people/people.service.ts` | `people:credits:*`, `people:images:*`, `people:tagged-images:*` | person credits/images | 6h | Medium | Medium | Consider not Redis-caching full `tagged_images`; TMDBService skips image caches but PeopleService caches them. |
| People sections | `server/src/media/people/people.service.ts` | `people:similar:*`, `people:upcoming:*`, `people:collaborations:*` | computed people sections | 2h | Low | Medium | Keep. |
| People media videos | `server/src/media/people/people.service.ts` | `people:media-videos:{type}:{id}:en-US:v1` | video arrays | 12h | Low | Medium | Keep. |
| People related videos | `server/src/media/people/people.service.ts` | `people:related-videos:{id}:v3` plus in-process map | shaped related videos | 4h | Low | Medium | Keep. |
| Search cache | `server/src/routes/search/search.service.ts` | in-process map | search response | local TTL in service | Low | Medium | Not Redis. Good for memory isolation but per-instance only. |
| Moods genre cache | `server/src/routes/moods/moods.service.ts` | in-process fields | genre data | 24h in memory | Low | Medium | Not Redis. Keep. |

## Cache Key Audit

Good patterns:

- Many keys are short, predictable, and TTL-backed.
- User-specific feed history sanitizes viewer IDs and caps history to 200 entries.
- No production code uses `KEYS *`.
- New diagnostics use `SCAN`.

Problems found:

- Mixed naming styles: `detail:movie:1`, `smart-rec-v2-movie-1-10`, `trending-30`, `featured`, `tmdb:https___...`.
- Root keys like `featured` are collision-prone.
- `tmdb:{absoluteUrl}?{query}` can become very long and may duplicate the same resource under absolute/relative forms.
- Before this audit, refresh-token keys embedded raw bearer tokens. New writes use `rt:{sha256(token)}` with legacy fallback.
- Some user-specific keys (`video-feed:*viewer_*`) may grow with history/salt/page variants.

Recommended standard for new keys:

```txt
moodies:{domain}:{resource}:{variant}:{id}:v{version}
```

Examples:

```txt
moodies:tmdb:trending:movie:day:page:1:v1
moodies:media:detail:movie:12345:v1
moodies:media:recommendations:movie:12345:limit:10:v1
moodies:reviews:critics:movie:limit:6:v1
moodies:user:feed-history:{viewerIdHash}:v1
```

Migration approach:

1. Add a central `cacheKeys` builder.
2. Start new keys at `moodies:*:v1`.
3. Let old keys expire naturally rather than mass deleting.

## TTL Strategy Review

| Data Class | Current | Recommendation |
|---|---:|---|
| Rate limit counters | 60s | Keep. |
| Refresh tokens | 30d default | Keep, required session behavior. |
| Public review carousels | 120s | Keep; invalidation now added after review creation. |
| Movie/TV catalog lists | 6h | Keep. |
| Category mixed pages | 24h | Shorten to 1-6h for trending/new/current pages. |
| TMDB trending day | 4h in `TMDBService`, 24h in feed helpers | Normalize to 1-6h depending endpoint. |
| TMDB search | 2h | Shorten to 10-30m if query diversity grows. |
| TMDB details | 6h Redis, 30d PG L2 | Keep. |
| Recommendations | 6h Redis, 1d PG L2 | Keep. |
| TV seasons | 6h Redis, 7d PG L2 | Keep but monitor size. |
| Video feed pages | 12m/20m | Keep. |
| Viewed trailer history | 45d | Shorten to 14-30d unless analytics require longer. |
| Football last-good | 14d | Keep only because it is a fallback, capped to 125 items. |

## Memory Risks

Highest risk:

- `people:tagged-images:*`: PeopleService caches image-list payloads even though central TMDB cache intentionally skips `/images` and `/tagged_images`.
- `video-feed-viewed:{viewerId}`: 200 entries for 45 days per user; can grow linearly with active users.
- `tmdb:{absoluteUrl}?{query}`: long keys and query diversity may create many variants.
- `feed-detail:*` and `tmdb:*discover*` at 24h: dynamic feed sources may accumulate if many pages/salts are requested.
- Background recommendation hydration stores nested recommendations into list keys, increasing payload size.

Lower risk:

- Rate limit counters.
- Review carousel caches.
- Movie/TV list caches with fixed `limit`.
- Detail/recommendation L1 caches backed by Postgres L2.

## Supabase/PostgreSQL + Redis Recommendation

Keep in PostgreSQL:

- Users, auth identity, reviews, replies, reactions.
- Watchlist and liked rows.
- Durable media engagement counters.
- Achievement progress rows.
- L2 media details/recommendations/seasons cache tables.

Keep in Redis:

- Rate-limit counters.
- Refresh-token revocation/session state.
- Hot public TMDB/list/detail views.
- Short-lived feed pages.
- Short-lived computed review carousels.
- Temporary single-flight locks.

Avoid Redis or use shorter TTL:

- Private user profile data.
- Long-lived user feed history.
- Large image/tagged-image payloads.
- High-cardinality raw search/feed query variants.

## Cache Invalidation Strategy

Implemented in this audit:

- Review creation now invalidates:
  - `reviews:critics-corner:movies:*`
  - `reviews:critics-corner:tv:*`
  - `reviews:community-picks:*`
- Invalidation uses `SCAN` via `RedisService.deleteByPrefix`, not `KEYS`.

Still recommended:

- Invalidate `achievements:{userId}` after review/watchlist/like/mood/quiz writes, or accept the current 60s eventual consistency.
- If media review list caching is added later, invalidate exact media keys after review create/edit/delete/reaction/reply.
- Prefer key versioning for broad public list changes.

## Redis Configuration Review

Found:

- `server/.env.example` includes `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`.
- `server/.env` has the same names, but values were not documented here.
- `docker-compose.yml` does not include a Redis service.
- `REDIS_HOST` and `REDIS_PORT` are optional in Joi validation, but the old Redis service tried to connect unconditionally. This is now fixed.
- No local `maxmemory` / `maxmemory-policy` Redis config exists in repo.

Recommended production settings for cache-only Redis plus refresh tokens:

- Set `maxmemory`.
- Prefer `volatile-lfu` or `volatile-lru` if all app cache/session keys have TTLs.
- Prefer `allkeys-lfu` only if every key is safely evictable. Because refresh tokens are stored in Redis, eviction can log users out; keep enough headroom.
- Enable TLS and password/ACLs for remote Redis.
- Do not expose Redis publicly.
- Monitor `evicted_keys`, `used_memory`, `keyspace_hits`, and `keyspace_misses`.

## Observability

Implemented:

- `RedisService.getSummary(match, sampleLimit)` using `SCAN`, `MEMORY USAGE`, `TTL`, and `INFO`.
- Existing endpoints now return real summaries:
  - `GET /movies/cache/status`
  - `GET /tv/cache/status`
  - `GET /all/cache/status`

Sample fields:

```txt
connected
sampled
namespaces[].keys
namespaces[].sampledBytes
namespaces[].expiring
namespaces[].persistent
namespaces[].minTtl
memory.used_memory_human
memory.maxmemory_policy
stats.keyspace_hits
stats.keyspace_misses
stats.evicted_keys
```

Recommended next step:

- Restrict these endpoints to admin/internal access before exposing production dashboards.

## Recommended Improvements

### Priority 1: Standardize cache keys

- Problem: mixed key styles and root keys.
- Current behavior: keys like `featured`, `trending-30`, `smart-rec-v2-movie-1-10`, and `tmdb:{url}` coexist.
- Recommended change: add central `cacheKeys` builder and version new keys under `moodies:*`.
- Expected benefit: easier invalidation, diagnostics, and migrations.
- Risk: low if old keys expire naturally.
- Files affected: `server/src/redis`, media services.

### Priority 2: Reduce dynamic public-list TTLs

- Problem: several current/trending/category/feed source caches hold data for 24h.
- Current behavior: `CACHE_TTL.BASIC_DATA` is 24h and reused broadly.
- Recommended change: split TTL constants into `TRENDING`, `CATEGORY`, `DETAIL`, `TRAILER`, `GENRE`, `FEED_SOURCE`.
- Expected benefit: fresher UI and lower stale memory pressure.
- Risk: low to medium; may increase TMDB calls slightly.
- Files affected: `server/src/media/all/utils/helpers.ts`, category/feed/trending services.

### Priority 3: Stop caching large image lists in PeopleService

- Problem: `people:tagged-images:*` may cache large low-value image payloads.
- Current behavior: PeopleService caches tagged images for 6h.
- Recommended change: slim tagged image payloads or bypass Redis for tagged images.
- Expected benefit: lower Redis memory usage.
- Risk: low.
- Files affected: `server/src/media/people/people.service.ts`.

### Priority 4: Cap or shorten viewed trailer history

- Problem: `video-feed-viewed:{viewerId}` stores 200 entries for 45d.
- Current behavior: good UX, but user-specific Redis memory grows with users.
- Recommended change: 14-30d TTL or move durable history to PostgreSQL if needed.
- Expected benefit: predictable memory cost.
- Risk: medium UX impact if users revisit feeds after long gaps.
- Files affected: `server/src/media/all/feed/feed-utils.service.ts`.

### Priority 5: Admin-only cache diagnostics

- Problem: diagnostics now exist but are on public media routes.
- Current behavior: `cache/status` endpoints return Redis summary.
- Recommended change: protect with admin guard or move to internal controller.
- Expected benefit: safer production observability.
- Risk: low.
- Files affected: media controllers or a new admin module.

## Changes Implemented

- `RedisService` now treats missing/failed Redis configuration as unavailable instead of crashing the app at boot.
- `RedisService.getOrSet` now fails open to the fetcher on Redis read failure.
- Added Redis `SCAN` diagnostics and prefix deletion helpers.
- Existing cache status endpoints now return real Redis summaries.
- Public review carousel caches are invalidated after review creation.
- Refresh-token Redis keys now use `sha256(token)` instead of raw token values, with fallback for legacy raw-token keys.

## Risk Assessment

- Redis outage: read-only browsing should continue for `getOrSet` cache paths; rate limiting fails open. Auth refresh/session flows still require Redis.
- Legacy sessions: preserved through fallback lookup/delete of old raw-token keys.
- Cache invalidation: targeted to review discovery keys only.
- Diagnostics: useful, but should be protected before production exposure.
- Performance claims: no numeric improvement is claimed until live Redis summaries and endpoint timings are captured.

## Acceptance Criteria

- Redis usage has been inventoried.
- Key patterns and TTLs have been reviewed.
- Sensitive raw refresh-token key exposure has been fixed.
- Missing observability has been addressed with `SCAN`-based diagnostics.
- Public review cache invalidation has been added.
- Redis failure fallback behavior has been improved.
- PostgreSQL remains the durable source of truth; Redis remains a temporary hot layer.
