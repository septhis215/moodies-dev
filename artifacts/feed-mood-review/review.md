# Feed and Mood Matcher review

Reviewed 30 October 2026. Baseline: ea4e30caf02bea7cfb0b32a9ce2633bde6df46b0. Changes are local and have not been deployed.

The Feed now uses a shared candidate pool and stable session ordering. Mood recommendations prioritize emotional fit, retain feedback on refresh, and show a reason for each match. No dependencies, migrations, or machine-learning services were added.

## Existing mechanisms and root causes

### Video Feed

The previous [VideoFeedService](../../server/src/media/all/feed/video-feed.service.ts) fetched 13 overlapping sources for each mixed-feed page, scored candidates with large popularity/market bonuses, enriched up to 35 titles, then returned 18. Ordering depended on the page, a 15-minute clock window, a salt restricted to 500 values, and a changing viewed-history hash. Each page was a new selection rather than a slice of one ordered pool. Cross-source duplicates could therefore recur or disappear during scrolling. Claimed total_pages=100 was unrelated to actual coverage.

The separate [UpcomingFeedService](../../server/src/media/all/trailers/upcoming-feed.service.ts) also mixed history-dependent ordering, per-page discovery, detail enrichment, and recycling. Its controller parsed the requested limit using radix 30. The client labeled any zero-rated title Upcoming, even after release.

[FeedUtilsService](../../server/src/media/all/feed/feed-utils.service.ts) could choose any of the top four videos, including a weaker clip over an official trailer. It probed five YouTube oEmbed URLs per title even when the best trailer worked. Its cache-key sanitizer collapsed punctuation, making genre OR and AND queries collide. The country allow-list and English-only video lookup also limited international coverage.

### Mood Matcher

[MoodsService](../../server/src/routes/moods/moods.service.ts) made eight random genre-discovery page requests per media type, followed by five title searches per type. Selected moods also added 54 translated title-search requests; Romantic added another four. These searches did not retrieve thematic keyword matches. TMDB documents title search as matching original, translated, and alternative titles; response language does not restrict original language. See [TMDB Search](https://developer.themoviedb.org/reference/search-movie) and [Discover filters](https://developer.themoviedb.org/reference/discover-movie).

Popularity and quality carried 34% of the old score. Mood aliases replaced several specific profiles: Funny used Happy, Cozy/Serenity/Chill/Nostalgic used Relaxed, and Epic/Chaos/Thrilling used Excited. Broad Drama matches could count as evidence for sadness, calm, or inspiration. Substring matching could find fun in funeral or love in glove. Western TV used Action & Adventure/Crime instead of Western.

Cached recommendations were reshuffled independently for every request. The selected pool was truncated to limit*page before pagination, so page one commonly reported total=limit and totalPages=1 despite having a larger pool. Anonymous database reads were not scoped to the anonymous bucket. Refresh deleted stored rows, including viewed/liked/rated feedback; createMany(skipDuplicates) did not update old records or return actionable recommendation IDs. The feedback endpoint also lacked authenticated ownership enforcement.

## Implemented changes

### Pooling, ranking, and pagination

- Both Feed modes now use VideoFeedService. Mixed discovery combines trending pages 1–3, well-supported highly rated discovery pages 1–3, current releases/on-air, popular, upcoming movies, and recent discovery. Upcoming uses three discovery pages for each media type within six months.
- Candidate pools are shared for an hour. Feed snapshots freeze ordering and viewed history for an hour; page caches include the snapshot creation time. Full uint32 session seeds replace the 500-value salt. Pagination slices disjoint title identities and reports the real candidate-page boundary. A page without a playable video can advance to later candidates.
- [rankRecommendations](../../server/src/utils/recommendation-ranking.ts) uses deterministic media-key hashing and diversity-aware selection within relevance bands. Genre overlap, language, media type, release decade, and known collection IDs affect tie selection. Mood bands are 0.05; Feed bands are 12 quality points. Weak relevance bands cannot overtake stronger bands merely through randomization.
- Feed history deprioritizes whole titles across new sessions. Mood refresh sends a new seed and up to 100 recently displayed media keys; relevant unseen titles come first, with seen matches retained when the pool is exhausted. Per-mood browser history survives blocked storage in memory. Signed-in requests can also exclude viewed recommendations.
- Mood discovery uses primary-focused and broader genre OR queries, quality sorting, rotating deeper pages, recent discovery (older discovery for Nostalgic), and real TMDB keyword IDs. Exact keyword matches are attached as scoring evidence and merged across duplicate sources. Initial mixed-mode fan-out is 8 genre Discover calls + 2 keyword lookups + up to 4 keyword Discover calls. A second pass expands coverage when fewer than ten candidates qualify, without loosening eligibility.

### Relevance and video selection

The versioned mood-scored-v6 weights are mood genre 40%, valence 11%, arousal 8%, thematic keyword evidence 11%, quality 10%, popularity 9%, recency 6%, profile preferred genres 3%, and profile preferred languages 2%. Emotional evidence totals 70%. Popularity remains capped/log-normalized. Nostalgic reverses the recency preference. Requested language and rating filters apply to every source and fallback.

Signed-in ranking reads the authoritative User.preferredGenres and User.preferredLanguages fields. Genre names or IDs and language names or codes are supported. Missing preferences are neutral; there is no hard-coded preferred-language list. Profile boosts are applied to copies of the shared eligible pool and to fallback rows. Session keys include normalized current preferences, so editing a profile changes the ranking without leaking personal boosts into another user's pool or requiring new TMDB requests. Preferences do not override mood eligibility or explicit request filters.

Specific mood profiles now survive generic aliases. Explicit conflicting genres are rejected. Sad, Bittersweet, Serenity, Chill, and Inspirational need thematic evidence beyond broad genres; Nostalgic requires that evidence or an older release. Western, Documentary, Sci-Fi, Funny, and Horror require a primary anchor. TV Horror additionally requires scary-story evidence. Existing seed records are unchanged: runtime profile precedence was the faulty layer.

Official status and trailer type have stronger video weights. Fan concepts/reactions/reviews/leaks, malformed YouTube keys, and duplicate keys are excluded. Primary rotation stays within three video-score points of the best available unviewed candidate. Availability probes check two top videos, then three more only if both fail. Original-language videos are fetched only when the English choices produce no usable candidates. Feed video eligibility no longer treats a video's country metadata as a playback-availability restriction. oEmbed checks are retained; they cannot guarantee embedding permissions or regional playback on every device.

### Caching, persistence, and errors

- Mood relevance pools are cached for an hour, independently of 30-minute session selections. User, media, rating, adult/language filters, seed, viewed mode, and recent keys isolate sessions. Refresh varies ordering without deleting feedback or forcing fresh upstream discovery. Up to 96 eligible candidates are retained.
- [RedisService.getOrSet](../../server/src/redis/redis.service.ts) coalesces concurrent cache misses within one API process and releases failures for retry. Existing TMDB caching, deduplication, and rate limiting remain in use. No direct TMDB calls were added outside that client.
- Only displayed mood results are persisted, in bounded batches. Compound-key upserts refresh catalogue/scoring fields while preserving viewed/liked/saved/rating. Responses include persisted IDs. Database fallback is scoped to the requesting user or anonymous bucket and applies compatible filters. [Cleanup](../../server/src/jobs/recommendation-cleanup.service.ts) retains feedback-bearing rows and uses last update time for cache-only retention.
- [Feedback](../../server/src/routes/moods/moods.controller.ts) now requires authentication and ownership. This intentionally tightens the previous public mutation contract. There are no in-repository client callers to migrate.
- Complete upstream outages produce retryable errors rather than pretending the feed ended or the selected mood has no matches. Partial source failures retain usable candidates.

### Result presentation

[Mood results](../../client/app/moods/page.tsx) request ten matches and display the server's reason, year, genres, media type, and rating. No probability-like match percentage was introduced. Refresh has an accessible name, a 44px target, visible focus, and a disabled busy state. Empty matches and request failures have different messages. Superseded fetches are aborted and stale responses ignored; initial requests now carry the same session credentials as refresh.

[Feed presentation](../../client/app/feed/page.tsx) keeps the existing player, lazy mounting, and bounded retained list. Both rating badges use release dates for Upcoming; unrated released titles say Not rated. Genre labels are resolved from two shared cached genre lists, without per-title detail calls. Reused pooling also removes Upcoming's redundant detail-enrichment pass.

## Measurements

These are separate measurements with different scopes, not interchangeable claims about production latency. The recorded live/fixture comparisons below were measured with v5 before the profile-personalization follow-up; they have not been rerun as a v6 live relevance study. The v6 follow-up passed 46 focused Feed, Mood, and ranking regression tests, including profile changes, shared-pool isolation, fallback constraints, popularity capping, and Nostalgic recency reversal.

| Check | Before | After |
|---|---:|---:|
| Repeated titles across two independently requested pages, deterministic 30-title fixture | 5 | 0 |
| Reported first-page total for that 30-title fixture | 10 | 30 |
| Representative positive mood fixtures accepted | See raw comparison | 21/21 |
| Typical oEmbed probes per title when a top video works | 5 | 2 |
| Mixed Feed discovery calls over two cold, distinct pages | 26 | 19 shared source calls + 2 shared genre lists |
| Feed warm-pool source requests, measured in-process cache harness | Not measured | 0 |

Live read-only TMDB sampling found 287 mixed-feed candidates across 20 languages, with genre labels on all 287. Upcoming had 21 eligible candidates across four languages. Mixed-pool acquisition took 1,323ms and Upcoming 460ms in that run; cached acquisition rounded to 0ms. These timings exclude video availability/enrichment, database writes, network Redis, and browser rendering. They are single-run pool timings, not HTTP response percentiles or before/after speedups.

All 21 moods were evaluated against the same freshly retrieved candidate pool in both scoring engines. The table reports eligibility, not independently labeled precision. Smaller after counts often reflect rejection of broad, conflicting, unreleased, or poorly evidenced matches. Every mood still had at least 24 qualifying titles before the adaptive extra pass was needed.

| Mood | Unique candidates | Qualified before | Qualified after |
|---|---:|---:|---:|
| Happy | 186 | 124 | 143 |
| Funny | 219 | 179 | 166 |
| Cozy | 177 | 103 | 88 |
| Whimsy | 212 | 139 | 145 |
| Romantic | 207 | 51 | 57 |
| Serenity | 184 | 80 | 24 |
| Chill | 210 | 109 | 37 |
| Inspirational | 208 | 138 | 52 |
| Nostalgic | 212 | 137 | 100 |
| Bittersweet | 197 | 109 | 35 |
| Sad | 228 | 150 | 51 |
| Thrilling | 223 | 131 | 175 |
| Epic | 192 | 112 | 139 |
| Chaos | 171 | 76 | 133 |
| Horror | 159 | 82 | 50 |
| Dark | 214 | 122 | 131 |
| Gritty | 211 | 147 | 184 |
| Mind-Bending | 208 | 117 | 126 |
| Sci-Fi | 178 | 87 | 85 |
| Western | 192 | 79 | 60 |
| Documentary | 222 | 42 | 57 |

Examples from score-ordered lists on that shared pool: Western changed from Reacher to Dances with Wolves after correcting the TV genre anchor; Serenity changed from Hoppers to David Attenborough: A Life on Our Planet after requiring calming themes. Sad changed from The Summer I Turned Pretty to Hamnet. These illustrate rule effects; they do not establish that every ranked title matches every viewer's emotional intention. Raw top-ten lists are retained for each mood.

Reproduce from server/:

~~~powershell
node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/review-recommendations.cjs
node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/review-recommendations.cjs --live
node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/review-recommendations.cjs --feed
~~~

The comparison script reads seed definitions and optional TMDB data only; it never connects to the application database. HEAD is the default baseline. After committing, add --baseline ea4e30caf02bea7cfb0b32a9ce2633bde6df46b0 to reproduce the recorded baseline.

Raw artifacts: [fixture comparison](./fixture-comparison.json), [all-mood live comparison](./live-comparison.json), [feed pool measurements](./feed-pool-comparison.json), [desktop preview](./wheel-1366.png), [mobile preview](./wheel-390.png).

## Verification and remaining limits

- Full backend suite: 257 passed, 9 skipped. All 45 focused recommendation, feed, video, and cache tests passed.
- Server ESLint and final server production build passed. Final client typecheck passed.
- Frontend production build completed and generated 45 pages. Its lint phase reported the existing eslint-config-next/core-web-vitals import-resolution error; standalone client lint remains blocked by the same configuration. No lint configuration was changed.
- Client session, security, and community-state checks passed. Storybook initially had a Vite dependency-optimization reload failure in three pre-existing custom-select cases; all three passed on a focused retry. The other 26 Storybook checks passed on the initial run.
- Mood wheel/result browser checks passed at 320, 390, 768, 1366, and 1920px, including keyboard selection, reduced motion, refresh seed changes, displayed explanation/year/genres, and blocked-storage history.
- WebKit iPhone feed autoplay/gesture recovery checks passed against a mock YouTube API. All five feed player/badge unit checks passed.
- Both changed UI regions received independent static review. Screenshots were inspected for mobile and desktop mood results. git diff --check passed.

Human relevance labeling and production p50/p95 latency are still needed. The live comparison uses seed-defined moods, the same new candidate pools, and two scoring implementations; it does not compare both historical discovery pipelines against logged user behavior or the production database configuration. The in-memory measurement cache does not measure Redis effectiveness under load.

Mood tone still uses genre proxies and literal thematic evidence. Romance TV lacks a dedicated Romance genre; Sci-Fi & Fantasy and Mystery remain broad TV labels. A limited synopsis may omit a valid emotional theme. Strict matching can return fewer than ten when evidence is scarce. There is no promise of ten results for every filter combination. Ranking is rule-based and does not yet learn taste weights from likes or ratings; account history is used for viewed suppression. No titles were hardcoded into ranking rules.

Franchise penalties work when collection IDs are available; standard Discover results usually omit them. Reliable franchise suppression would need reuse of cached collection metadata or selective enrichment. Popularity and mainstream discovery can still bias the pool despite broader language eligibility. Country balance is not explicitly quota-controlled.

Redis snapshots keep sessions stable within their TTL. Eviction, restart without Redis, or expiry can rebuild a pool and change ordering; pagination guarantees do not extend indefinitely. Session snapshots also duplicate candidate metadata per active seed. Measure real Redis memory/hit rates before increasing pool sizes or TTLs; compact shared-pool references are a possible next optimization. Anonymous viewed-trailer history is browsing convenience keyed by a client-supplied viewer ID, not an authenticated account preference store.

Live YouTube playback across all candidate titles, regional availability, full authenticated DB integration, long-scroll load tests, and a labeled precision/diversity study were not performed. Browser playback verification used a mocked YouTube API. The clean UI and score changes were independently reviewed statically. Existing unrelated community/select changes were left intact.

Current Prisma persistence and React request-cleanup guidance were fetched through Context7; TMDB primary documentation informed discovery versus title-search behavior. The premium design helper audit was unavailable because uv is not on this environment's PATH; project-owned checks and rendered screenshots were used instead.
