# Celebrity hub

## Objective and scope

Public film and TV discovery at `/celeb`, with news, happenings, videos, a searchable
TMDB directory, and individual news/video/photo pages. The existing profile and
filmography remain available. A newsletter means an on-site news digest here;
email subscriptions are outside this change. No database migration is needed.

## Contract and implementation

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
