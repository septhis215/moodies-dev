# Selected content refresh

## Behavior and design

- Movie and TV detail pages share the audience mood, engagement, snapshot, and review components.
- Audience mood uses a segmented spectrum, a prominent leading mood, and a compact voting legend. The hero has a quieter inline treatment. Mood totals are aggregated across all reviews for the title, independently of review pagination; percentages include votes outside the displayed top three.
- Engagement counts come from the public, uncached `media-stats/batch` database read. No client click deltas are added. Counts refresh after library mutations, review submission, and window focus. Failed reads offer Retry instead of displaying a false zero.
- Providers initially show four entries; studios initially show three. Both expand and collapse with reduced-motion support. Provider search searches the entire list.
- The shared review composer serves detail pages and full review pages. Mobile uses a bottom sheet dragged from its header; desktop uses a centered dialog. Native dialog behavior handles modal focus and Escape. Drafts remain in memory on dismissal and reset when the account or title changes.
- Review cards now have readable 16px body copy and a quieter score/author/footer hierarchy. The composer uses poster context on desktop and an unboxed half-star control backed by ten native radio inputs. Scores from 0.5 to 5 stars map to the existing 1–10 database scale, with keyboard and pointer support. Existing moderation and 10–1,000 character validation remain in place.
- Snapshot studio offers four compositions: Premiere, The ticket, Editorial, and Full bleed. Each supports square, portrait, story, and landscape output. Design, Content, Image, and Finish panels expose artwork selection, crop, zoom, shade, title replacement, notes, metadata visibility, custom accent color, paper/warm/midnight surfaces, title size, alignment, grain, and borders. PNG/JPG download and PNG clipboard copy use the current design. Review quotations remain the original review text, with visible privacy disclosure.
- Mobile switches between Preview and Customize so the primary actions stay visible. Desktop shows the canvas alongside its editing controls. The accepted studio/provider disclosures are unchanged in this redesign.
- Snapshot and composer text use Moodies' existing typography and surface/accent tokens. Canvas exports load the current display and body fonts before drawing. Artwork failures fall back to an exportable card. Private review exports retain a visible disclosure.

## Library API contract

`POST /liked/toggle` and `POST /watchlist/toggle` retain their response shapes:

```json
{ "tmdbId": "550", "type": "movie", "active": true }
```

- `type` remains `movie` or `series`.
- `active: true` ensures membership; `active: false` ensures removal. Repeating the same requested state does not adjust counters again.
- Omitting `active` preserves legacy toggle behavior.
- Membership changes and the corresponding `MediaStat` increment/decrement commit together. Serializable transactions retry complete transactions on Prisma `P2034`/`P2002` conflicts, up to five attempts.
- The review listing response adds `totalMoodVotes`; existing response fields remain intact.
- No database schema change or migration is required. Deploy the API changes before the client that sends `active`.

## Verification

- Client/server type checks, focused ESLint checks, and production compilation pass (`build:local` for the client and `build` for the API). Full lint checks pass with six existing client navigation warnings.
- Server Jest suite: 272 passed; nine existing skips.
- Client session, Turnstile, and community state checks: 31 passed.
- Storybook browser suite: 29 passed. Its initial run hit a Vite dependency optimizer reload; the rerun passed.
- Redesign verification: the complete client suite passed (31 Node tests and 29 Storybook browser tests), production compilation passed, and focused TypeScript/ESLint checks passed. Full client lint retains six existing navigation warnings.
- Snapshot-specific browser checks verify all 16 template/format combinations, distinct compositions, visible effects from content/crop/color/finish controls, JPEG encoding and extension, PNG clipboard output, and private review snapshots. Half-star keyboard selection and submitted database rating values are checked through the review flow.
- Deterministic Playwright checks pass against both development and the compiled production client at 320×568, 390×844, 768×1024, and 1440×900. They cover movie/TV pages, no-scroll default dialogs, disclosures/search, count changes, rapid clicks, write failures, read recovery, review submission, guest redirect, modal focus, mobile drag dismissal, desktop drag behavior, exported PNG dimensions, and review footer positioning with a simulated mobile keyboard.
- Screenshots and an exported PNG are under `artifacts/selected-content-refresh/`. Their title data and artwork are test fixtures.
- Context7 documentation for React, Prisma, Motion, Playwright, and Vitest informed implementation and verification; the installed Next.js router/client-component guides were also consulted.

### Run the focused browser checks

1. Start the local client with `LOCAL_API_URL=http://localhost:4000/api` in the existing local environment configuration.
2. Leave port 4000 free; the test starts and stops its own fixture API and never writes to a live database.
3. Run `npm run test:e2e:selected-content --prefix client`.
4. Run `npm run test:e2e:snapshots --prefix client` for the full canvas/customization/export checks.

Live PostgreSQL concurrency was not exercised: local PostgreSQL was unavailable and the Docker engine was not running. Transaction/idempotency behavior is covered by Jest, and browser interactions use deterministic API fixtures.
