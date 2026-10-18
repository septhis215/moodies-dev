# Session reliability and rollout

The access cookie `mood_at` and access JWT share `JWT_ACCESS_EXPIRES` (default 15m).
The HttpOnly refresh cookie `mood_rt` is set and cleared at `/api/auth`, including
Nest's public prefix. Cookie writes also remove the obsolete `/auth` variant.
`REFRESH_EXPIRES_DAYS` (default 30) is an absolute session lifetime from creation;
refresh never extends that deadline. Cookie lifetimes are capped at that deadline.
Keep `JWT_SECRET` stable and identical across backend replicas and restarts.
Prefer host-only API cookies (`COOKIE_DOMAIN` unset). Sharing a broad parent-domain
cookie across staging and production can cause one environment to overwrite the
other's tokens; cross-origin fetches do not require sharing cookies with the frontend.

## Storage and rotation

`AuthSession` is the PostgreSQL authority; new sessions do not depend on Redis.
Only SHA-256 refresh-token hashes are stored. Each session has a current hash,
previous hash, a bounded retry window, absolute expiry, and revocation timestamp.
Access JWTs identify the session and the user's `authVersion`; guarded requests
and bootstrap check both. Password changes/reset increment that version and
revoke all durable sessions in the same transaction as the password update.

Rotation locks the session row with `SELECT ... FOR UPDATE` in a Prisma 6
interactive transaction. A 30-second grace period lets duplicate refreshes and
retries after lost responses converge on the same successor. The successor is
derived with a domain-separated HMAC using `JWT_SECRET`, so no recoverable raw
token needs storing. The successor is not rotated again during that window,
preventing delayed responses from overwriting it with an older generation.
A recognized previous token reused after the window revokes that session;
unknown tokens are rejected. The grace period is a deliberate, bounded replay
tolerance. Expired rows are cleaned daily after seven days of audit retention.

Refresh failure never clears HttpOnly cookies: a delayed failure must not erase
a newer login/refresh. Explicit successful logout clears both current and legacy
cookie paths. Logout accepts the refresh cookie even after access expiry.
Refresh/logout validate browser Origin against the existing CORS allowlist.

## Client behavior

Protected browser requests use `client/lib/auth/session.ts`. It shares one pending
refresh per tab; Web Locks serialize refresh, sign-in/signup, and logout cookie
mutations across same-origin tabs. Account changes cancel stale request retries
so an old action cannot be replayed under a different signed-in account.
After acquiring the lock it rechecks bootstrap, since another tab may already
have refreshed. Server row locks and the retry window also protect browsers
without Web Locks. Cross-tab storage events contain only UI signals, never tokens.
Blocked browser storage cannot prevent cookie recovery. Bootstrap advertises
`canRefresh: false` when no refresh cookie exists, avoiding extra guest requests;
clients also support older bootstrap payloads without that additive field.
The first AuthProvider render uses only the server-provided blocking hint. Browser
storage hints are applied after hydration, keeping server/client markup consistent
and avoiding replacement of forms while users type.

- A protected 401/498 triggers session verification and at most one request retry.
- Only a refresh 401/498 confirms expiry; it clears account UI and shows a toast
  for an existing session. A route-specific 401 cannot independently log users out.
- Offline, timeout, 429, and 5xx refresh failures preserve current account state
  and surface a recoverable error. Requests never bypass server authorization.
- Ambiguous network failures never automatically retry state-changing requests.
- Abort of one request does not cancel the shared refresh needed by others.
- Returning to the tab or reconnecting retries bootstrap when a session is expected.
- Failed explicit logout reports failure and retains state so the user can retry.

## Deployment order

1. Back up as usual and deploy the additive migration first:
   `npm run migrate:deploy --workspace server`. It adds `User.authVersion` with a
   default and a new indexed table, without deleting existing data. Schedule the
   short `ALTER TABLE User` lock appropriately for your database traffic.
2. Generate/build the backend: `npm run build --workspace server`.
3. Replace/drain old backend instances before directing refresh traffic to the new
   version. Old code does not understand new database-backed refresh tokens;
   do not run mixed old/new refresh implementations behind a load balancer.
4. Deploy the frontend using the shared coordinator. Verify actual HTTPS origins,
   cookie attributes, CORS allowlist, and frontend/API `/api` URL configuration.
5. Keep legacy Redis available for the remainder of the old token lifetime.

A still-valid access cookie with no correctly scoped refresh cookie is upgraded
by bootstrap. A correctly scoped legacy Redis token is imported with its remaining
TTL, under a user-row lock that serializes with password revocation. Existing
hashed and raw Redis key formats remain readable. Imported rows are upserted by a
stable ID, so a leftover Redis key cannot resurrect a revoked durable session.

If both the old access token is expired and its refresh cookie has the broken
`/auth` path, the browser cannot send it to `/api/auth/refresh`: one new sign-in is
unavoidable. Never solve this by putting credentials back into browser storage.

Rollback should retain a backend that can read durable sessions. Rolling all the
way back to Redis-only code requires affected users to sign in again. Leave the
additive database schema in place; dropping it would destroy live sessions.

## Validation and diagnostics

- `npm run test:session --workspace client` exercises coalescing, request replay,
  outages, expiry, missing markers, Web Lock behavior, aborts, and logout.
  The regular client test command includes this suite.
- `npm test --workspace server -- --runInBand --testPathPatterns=auth` runs cookie
  serialization/path tests and service regression tests.
- Set `AUTH_SESSION_TEST_DATABASE_URL` explicitly to a PostgreSQL test connection,
  then run `npm test --workspace server -- --runInBand --testPathPatterns=auth-session.integration`.
  This creates a uniquely named `auth_session_test_*` schema, applies the actual
  additive migration to an existing-user fixture, tests concurrent rotation,
  rollback, and revocation, then drops only its own temporary schema. It is skipped
  when the variable is absent; do not point it at production.
- In staging, expire only `mood_at`, then load profile/library and submit a protected
  action in two tabs. Confirm renewal succeeds and logout reaches both tabs.
  Simulate offline and refresh 429/503 responses, then reconnect and retry.

Session logs use reasons such as `session_unknown`, `session_expired_or_revoked`,
`refresh_token_reused`, and `session_store_unavailable`; never token values or
cookie headers. Alert on unexpected increases in refresh failures and check
database health, legacy Redis health, API routing, and browser cookie exclusions.

Context7 verified NestJS cookie/configuration guidance and Prisma interactive
transactions. Implementation uses the installed Prisma 6 API (`$transaction`,
tagged `$queryRaw`), not newer Prisma or Nest authentication APIs.
