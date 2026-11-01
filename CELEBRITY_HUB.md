# Celebrity hub

## Objective and scope

### November 2026 redesign contract

The landing page leads with up to ten recent film/TV videos, with YouTube metadata
and playback checks taking priority. One player is active at a time; sound follows
a viewer gesture. Next/previous, swipe, reduced motion and playback failures have
explicit behavior. Exact TMDB credit IDs supply film and series links.

Four hub destinations: Home, News, Videos and People. The old happenings route
redirects to News. News uses publisher story photographs and linked headlines in
an editorial lead/story grid inspired by Tudum. Videos use landscape thumbnails,
clear titles and channel/date metadata inspired by YouTube. Moodies typography,
warm surfaces and existing selected-content people cards remain canonical.

People cards share a 4:5 portrait, rounded-xl corners, border-bottom and existing
cast typography. A short dark overlay reveals recent credited work on hover,
keyboard focus or a touch control. Work links remain separate from profile links.
Use the existing accessible custom select. Motion uses opacity/transform and
respects reduced motion. Keep provider provenance available without repetitive
instructions or decorative action labels.

No database changes. News images come from bounded, allowlisted publisher feeds
or article metadata; no invented story imagery. Server caches coalesce requests,
retain bounded stale results and isolate provider failures. YouTube configuration
changes invalidate failed cached data and quota cooldowns are credential scoped.

Public film and TV discovery at `/celeb`, with news, videos, a searchable
TMDB directory, and individual news/video/photo pages. The existing profile and
filmography remain available. A newsletter means an on-site news digest here;
email subscriptions are outside this change. No database migration is needed.

## Contract and implementation

- `GET /api/people/hub/videos`: at most ten distinct videos published within 90
  days, with exact film/TV references. Search discoveries take priority only when
  a credited work is named and the channel is established by that title's
  TMDB-linked official videos. Current YouTube metadata validates public status,
  processing, embeddability, child-directed status and configured region before
  embedding. Missing/blocked players retain an original YouTube link.
- The global video snapshot refreshes hourly (five minutes with a failed source),
  uses at most two searches per refresh and retains a saved snapshot for six
  hours. Exact-ID checks use `videos.list`, without a search request. Redis and
  bounded process memory coalesce requests. The application daily search cap
  remains shared across credentials; rotating a key is not a quota reset.
- YouTube key/region fingerprints scope media caches and quota cooldowns. Only
  quota/rate failures create an hourly cooldown. Backend diagnostic event
  `celebrity_youtube_request_failed` includes operation, HTTP status and a safe
  Google reason such as `ipRefererBlocked` or `accessNotConfigured`, never the
  URL, key or raw upstream message. Configure `YOUTUBE_API_KEY` on the Nest
  backend; HTTP referrer restrictions are unsuitable for this server-to-server
  request. Use the deployment's backend configuration and restart it after a key
  change. No frontend YouTube API key is needed.
- Images are extracted from the actual story's RSS media attributes. Missing
  images use bounded, cached Open Graph metadata requests to canonical publisher
  article URLs, with fixed HTTPS image hosts and no redirects. A failed image
  never removes the headline. No article body is republished.

- `GET /api/people/hub`: credited cast from at most four TMDB weekly trending films
  and series, using the directory's existing person/title safety checks, with source status. The shared
  TMDB layer can retain weekly trends for 12 hours; the hub cache refreshes after
  15 minutes and does not claim a real-time social ranking.
- `GET /api/people/news` and `GET /api/people/:id/news`: publisher headlines, links,
  publication dates and per-source fetch times/status. Person IDs are positive integers.
- `GET /api/people/:id/latest-videos`: recent TMDB videos and YouTube date-ordered
  discovery, using the existing identity and quota controls.
- News comes directly from the RSS feeds of Variety, Deadline and The Hollywood
  Reporter. Person topic feeds use their canonical TMDB name, followed by a strict
  identity match. Short names and names shared by multiple TMDB people require a
  known work or group in the headline. A failed ambiguity lookup also requires
  this context. These three
  publications share a parent company; multiple links are not independent verification.
- Headline links point to publishers. No scraped articles, generated reporting,
  invented events, inferred social trends or automatic “fact checked” labels.
- News is eligible for 30 days. Reject missing/invalid dates, dates over five minutes
  ahead, unsafe URLs, malformed XML, declarations of entities and oversized feeds.
- Redis and the existing bounded process cache coalesce concurrent requests. News
  refreshes after ten minutes; outages can retain a clearly marked snapshot for at
  most six hours. Preserve the actual successful fetch time. A failed provider does
  not erase another provider's results. Do not cache a fabricated successful response.
- Keep TMDB discovery separate from news so an unavailable provider cannot block
  the whole page. Keep optional YouTube discovery off the main hub request.

New code belongs in `server/src/media/people/news/` and
`client/components/celeb/`; routes stay under `client/app/celeb/`. Reuse the
existing media viewer, identity resolver, rate-limited TMDB integration and cache.
Use the current constructor-injection, TypeScript and React component conventions.

## Verification and acceptance

1. Parser/service tests cover identity collisions, dates, deduplication, XML/URL
   safety, coalescing, outages and stale expiry.
2. Browser checks cover hub navigation, filters, individual content, empty/failure
   states and mobile/desktop overflow. Preserve existing celebrity tests.
3. Run `npm.cmd test --workspace server -- --runInBand`, `npm.cmd run lint`,
   `npm.cmd run typecheck` and production builds where the environment permits.
4. Verify live publisher samples against their linked original coverage; record
   actual results below. This is sampling, not proof of every reported claim.

## Boundaries

Preserve Moodies tokens, typography, validation, accessibility and existing routes.
Never expose credentials or fetch caller-supplied feed URLs. No production writes,
deployment or schema changes are required. Optional video discovery requires the
existing backend `YOUTUBE_API_KEY`; TMDB videos remain the fallback.

## Work slices

- [x] Publisher ingestion, safety and cache tests.
- [x] Hub and individual content routes, with accessible failure states.
- [x] Live source comparison, browser checks, repository checks and final review.

## Source checks

### Redesign verification, 2026-11-01

The supplied temporary key returned HTTP 200 for both YouTube search and video
metadata. The deployed staging endpoint for Zendaya also returned YouTube data.
A real browser opened her staging videos page, selected a video, and observed
the embedded player advancing with `paused=false`, `readyState=4` and no player
error. The reported key failure could not be reproduced during this check.
No deployment or staging configuration change was made.

The final isolated API returned ten eligible embedded videos from the featured
titles, with studios including 20th Century Studios, Sony Pictures and Amazon MGM
Studios. Both upstream sources were available. Repeated cached responses took
24ms and 3ms locally; these timings are observations, not a production SLA.
Local Redis was unavailable, so these measurements exercised the bounded process
cache fallback. Distributed-cache behavior is covered by the mocked Redis tests.
All 22 returned news stories had publisher photographs. A fresh
[Variety story](https://variety.com/2026/tv/news/inde-navarrette-snl-halloween-the-inventors-wife-penis-robot-1236936629/)
matched the original headline and publication time (`2026-11-01T08:33:26Z`),
and its feed photograph matched the original Open Graph image before cropping.
Publisher attribution does not mean every reported claim is independently verified.

Production builds and typechecks passed for both workspaces. Lint has no errors
and six existing auth/profile navigation warnings. The full backend suite passed
295 tests with nine existing skips before the final three regression cases;
all 57 celebrity tests passed after those cases were added. A final sequel-link
regression also passed, ensuring a title such as Toy Story 5 links to the sequel
rather than the shorter matching original. Client checks passed
31 session/security/community tests and 29 Storybook tests. All four hub routes
passed real Next.js browser tests at 320, 390, 768 and 1440px, including one-player
enforcement, the ten-video cap, sound, next/previous, keyboard filters and work
links, blocked/error playback, reduced motion, offscreen pause, source failures,
retry and redirects. Existing profile and media harnesses also passed at all
four widths. Real-content desktop/mobile captures had no page exceptions or
horizontal overflow. No database migration is required.

Current Next.js, NestJS, YouTube and fast-xml-parser documentation was consulted
through Context7. Visual references were Netflix Tudum and YouTube, adapted to
Moodies' existing typography and selected-content cast pattern.

On 2026-11-01, live requests returned RSS XML for all three main feeds and their
Zendaya topic feeds, and for Deadline's Tom Hanks topic feed. Search URLs returned
HTML and are deliberately excluded. Current TMDB, Next.js, NestJS and XML parser
documentation informed the implementation through Context7 (Next.js, NestJS,
fast-xml-parser and YouTube Data API) and the official TMDB reference.

The new Nest endpoints returned 22 current headlines with all three publishers
available and three matching Tom Hanks stories. Two sampled originals returned
HTTP 200 and exactly matched the feed publication timestamps:

- [Deadline's Tom Hanks / SNL report](https://deadline.com/2026/10/saturday-night-live-open-tom-hanks-trump-halloween-1237210760/),
  `2026-11-01T03:52:52Z`. The original uses a shortened Open Graph title about
  the same appearance; its UTC timestamp agrees with the feed despite the
  article URL using October's publication path.
- [Variety's Broadway report](https://variety.com/2026/film/news/tom-hanks-broadway-this-world-of-tomorrow-1236921613/),
  `2026-10-22T17:47:48Z`, matching both headline and timestamp.

Publisher ownership was checked against [PMC's brand information](https://www.pmc.com/category/brands).
The implementation intentionally makes no independence or truth-verification claim.
The sampled SNL appearance was also corroborated by a separate
[USA TODAY report republished by AOL](https://www.aol.com/articles/trump-lets-katie-zacharia-botch-042021000.html),
which describes Hanks returning as David S. Pumpkins on October 31. This manual
sample does not turn the automated feed into a fact-checking service.

The cast-based trend endpoint returned six people linked to their actual credited
titles, including Dakota Johnson and Anne Hathaway in *Verity*, and Jacob Elordi
and Josh Brolin in *The Dog Stars*. This selection does not infer social popularity.

## Validation results and operations

- Server: 35 passing suites, 289 passing tests; nine existing skipped tests in
  three skipped suites. New checks include ambiguous names, unsafe XML/URLs,
  dates, deduplication, partial outages, cache coalescing and expiry.
- Client: all 31 session/security/community checks and 29 Storybook tests passed.
- New App Router browser test: navigation, filters, source statuses, empty states,
  retry, profile subpages, video link fallback, directory redirects and invalid
  routes passed at 320, 390, 768 and 1440 pixels. Existing celebrity page/media
  browser checks also passed. Run `npm.cmd run test:e2e:celebrity-hub --workspace client`
  against a running frontend; its provider fixtures are deterministic.
- Lint and type-check passed. Lint reports six existing navigation warnings in
  auth/profile pages. Both production builds passed.
- `npm audit --omit=dev` reported no advisory for the new XML parser; 22 existing
  production advisories across the monorepo remain outside this feature's scope.

Deploy the Nest API and frontend together; the old hosted API does not know the
new endpoints. No new secrets, database tables or SQL migrations are required.
Set the existing backend `YOUTUBE_API_KEY` for broader recent video discovery.
It was absent during live validation, so the live Tom Hanks recent-video request
correctly returned no recent matches and a disabled YouTube status. TMDB remains
available; older screen moments remain linked from the recent-video empty state.
YouTube discovery refreshes after 30 minutes and keeps the existing daily budget
and quota cooldown. Search indexing may lag new uploads. Existing TMDB title-video
caches can retain data for 12 hours. News refreshes independently after ten minutes.

News coverage is the publishers' bounded latest/topic RSS selection, not an
exhaustive index. Empty matches are preferable to unrelated or old stories.
