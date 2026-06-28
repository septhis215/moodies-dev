# Error Handling Inventory

Context7 was used before implementation:

- `/vercel/next.js`: App Router `error.tsx`, `global-error.tsx`, and `not-found.tsx` conventions.
- `/nestjs/docs.nestjs.com`: global exception filter patterns and validation response behavior.
- `/tanstack/query`: v5 default options, mutation cache callbacks, and query callback removal notes. TanStack Query is installed but no `QueryClientProvider`, `useQuery`, or `useMutation` usage exists in the app yet.

| Area | File | Current Handling | Problem | Recommendation |
|---|---|---|---|---|
| Root client providers | `client/app/layout.tsx` | `ToastProvider` and `AuthProvider` only | No root-level app error registration | Added `AppErrorProvider` under auth so shared handlers can publish toasts and clear expired sessions |
| Toasts | `client/app/context/ToastContext.tsx` | Every call created a new toast | Repeated failures could show duplicate toasts | Added message/title/variant dedupe window |
| Shared error model | `client/lib/errors/*` | Did not exist | Components threw/displayed raw `Error.message` values | Added `AppError`, response normalization, API request helpers, and `handleAppError` |
| Auth/session fetch | `client/utils/apiFetch.ts` | Refreshes session and returns raw `Response` | Callers still needed per-call response parsing | Kept compatible `apiFetch`; added `apiFetchJson` that throws normalized `AppError` |
| Watchlist API | `client/utils/watchlistClient.ts` | Raw `fetch`, `NO_TOKEN`, and status text errors | Auth and backend errors were encoded as strings | Normalize fetch/HTTP failures to `AppError`; preserve empty list behavior for guest reads |
| Watchlist hook | `client/hooks/useWatchlist.ts` | Local error parser, repeated auth toast, `console.error` | Duplicates liked-hook behavior and leaks raw backend text | Keep optimistic rollback local; delegate shared display/logging to `handleAppError` |
| Liked API | `client/utils/likedClient.ts` | Raw `fetch`, `NO_TOKEN`, and status text errors | Same duplication as watchlist | Normalize fetch/HTTP failures to `AppError` |
| Liked hook | `client/hooks/useLiked.ts` | Local console logging after rollback | Failed actions were silent to users | Keep rollback local; delegate user messaging/logging to `handleAppError` |
| Media stats API | `client/utils/mediaStatsClient.ts` | Throws raw status/text | Shared client called by many cards could leak backend details | Normalize failures with safe fallback message |
| Login hook | `client/hooks/useAuth.ts` | Parses backend message and toasts locally | Raw backend message could become user-facing | Normalize response; keep branded login toast UI local |
| Password reset forms | `client/app/auth/forgot-password/page.tsx`, `client/app/auth/verify-code/page.tsx`, `client/app/auth/change-password/page.tsx` | `throw new Error(data.message)` and local `setMsg` | Form messages were raw backend strings | Keep form-level state local; normalize API/network errors before display |
| Next route errors | `client/app/search/error.tsx` | Static fallback without reset/log signature | Did not follow App Router error boundary contract | Added `error/reset` props, safe logging, and retry action |
| Next root route errors | `client/app/error.tsx` | Missing | Route render/runtime crashes could bubble to generic framework UI | Added app-level friendly fallback with reset/home actions |
| Next critical root errors | `client/app/global-error.tsx` | Missing | Root layout crashes had no branded safe fallback | Added global error boundary with required `html`/`body` tags |
| Not found | `client/app/not-found.tsx` | Custom 404 exists | Mostly local UI; not an API error | Leave local; future cleanup can simplify heavy inline visual code |
| Search page | `client/app/search/page.tsx` | Local `setError`, raw `"Search failed"` fallback, console logs | Search-specific empty/error state is local but fetch parsing is duplicated | Keep page state local; later route through `apiRequest`/`normalizeResponseError` |
| Reviews submit/reactions | `client/components/selected-content/sections/reviews.tsx`, `client/components/selected-content/extended/allReviews.tsx` | Form validation mixed with fetch errors and toast calls | Validation should stay local; API failures should normalize | Keep field validation local; migrate submit/reaction fetches to shared errors next |
| Auth onboarding | `client/app/auth/onboarding/page.tsx` | Manual status checks and auth toasts | 401 and save failures duplicate root behavior | Move API failures to `handleAppError`; keep step/form validation local |
| Profile page | `client/app/profile/page.tsx` | Repeated `status === 401` logout handling | Auth expiry logic duplicated | Replace with `useApiFetch`/shared unauthorized handling |
| Client background/section fetches | `client/components/ui/searchbar.tsx`, `client/app/celeb/[id]/page.tsx`, `client/app/moods/page.tsx`, `client/app/quiz/page.tsx` | Local `try/catch` and console logging | Mostly background or section-level failures | Keep silent for background fetches; normalize user-triggered actions |
| Server global filter | `server/src/common/filters/all-exceptions.filter.ts` | Passed `HttpException` responses through and only hid unknown 500s | Backend response shape varied by exception type | Standardized error envelope and mapped Prisma P2002/P2025 safely |
| Server bootstrap | `server/src/main.ts` | Global `ValidationPipe` and `AllExceptionsFilter` registered | Good root placement | Leave root integration in `main.ts` |
| Media controllers | `server/src/media/all/all.controller.ts`, `server/src/media/movies/movies.controller.ts`, `server/src/media/tv/tv.controller.ts` | Validation used `throw new Error` | User input errors became 500s | Replaced with `BadRequestException` |
| Backend auth/review services | `server/src/auth/auth.service.ts`, `server/src/routes/review/review.service.ts` | Uses Nest HTTP exceptions and targeted Prisma handling | Mostly appropriate; response envelope was inconsistent before filter change | Leave service-local domain validation; global filter now normalizes response shape |
| Backend external API/cache utilities | `server/src/external-apis/**`, `server/src/utils/mailer.ts`, `server/src/utils/storage.ts` | Logs/catches provider/cache failures locally | These are integration-specific failures | Keep local fallback/retry behavior; use HTTP exceptions at controller/service boundaries |
