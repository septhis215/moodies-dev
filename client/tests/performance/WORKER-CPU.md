# Worker rendering and CPU checks

The root layout no longer reads request cookies for a loading-screen hint. Its
public HTML can be prerendered; the browser checks the session hint before paint
and the existing API bootstrap still decides who is signed in. User data is not
embedded in the shared page. Dynamic title routes retain `private, no-store`.

OpenNext uses R2 plus its Durable Object queue for the existing time-based
revalidation. Cache interception serves cached pages without rendering them again.
The regional cache lasts one minute and does not reread R2 on every hit. No
on-demand tag invalidation is used, so no D1 or tag-cache resources are required.

## Local measurement (PowerShell, repository root)

Use the project's staging `.env`. These commands use local R2 and Durable Object
emulation and do not require a Cloudflare login or create remote resources.

```powershell
$env:MOODIES_ENV = 'staging'
npm.cmd run build:cloudflare --workspace=client
npm.cmd run preview:cloudflare --workspace=client -- --port 8787 --inspector-port 9230
```

Keep that terminal running. Close other tabs/tests using this local Worker while
profiling, then use a second terminal:

```powershell
npm.cmd run benchmark:worker-cpu --workspace=client -- --output output/worker-cpu/after.json --compare output/worker-cpu/before.json
```

Omit `--compare` when no baseline exists. To capture one before applying the change,
run the same script against a build of the old version with `--output
output/worker-cpu/before.json`. Rebuild and restart preview for each version.

The script warms the homepage, profiles three batches of 20 sequential requests,
and saves both JSON results and `.cpuprofile` files under gitignored `client/output/`.
It uses the `ws` package already installed with Wrangler to connect to its inspector.
The files open in Chrome DevTools' Performance panel for function-level inspection.
`firstRequest.wallMs` describes the first request in that run; it is not a
reproducible cold-start CPU measurement.

Compare the median sampled active CPU across batches and their variation. These
are local workerd samples, including runtime/profiler overhead, not Cloudflare's
production CPU measurements. They cannot prove compliance with the Free CPU limit.

## Regression checks

Run after profiling, so browser traffic does not contaminate CPU samples:

```powershell
$env:BASE_URL = 'http://127.0.0.1:8787'
npm.cmd run test:e2e:auth-shell --workspace=client
npm.cmd run test:e2e:public-cache --workspace=client -- --revalidate
npm.cmd run test:e2e:landing --workspace=client
npm.cmd run test:e2e:prefetch --workspace=client
```

The auth check pauses browser scripts and session bootstrap separately. It checks
cookie-only/storage-only hints, disabled storage, Google return, expired sessions,
an unavailable API, and session recovery without a browser hint. API replies are
mocked and no account is modified. The cache check compares guest and session-hint
HTML, verifies dynamic title responses stay private, and waits 65 seconds to check
`STALE` followed by `HIT`. Run that check alone while waiting for revalidation.

## Staging setup before deploying

The CLI was not authenticated during implementation; no live resources or
deployments were changed. The committed configuration targets Worker `moodies-dev`.

1. Enable R2 in the Cloudflare account if needed and create the bucket once:

   ```powershell
   Set-Location client
   npx.cmd wrangler login
   npx.cmd wrangler r2 bucket create moodies-dev-next-cache
   ```

2. Use the normal Cloudflare build/deploy pipeline, with its existing staging
   variables. If deploying manually from `client`:

   ```powershell
   $env:MOODIES_ENV = 'staging'
   npm.cmd run build:cloudflare
   npm.cmd run deploy:cloudflare
   ```

   Use `opennextjs-cloudflare deploy`, as the npm script does, to populate the build
   cache. Deployment creates the SQLite Durable Object through the `next-cache-v1`
   migration. R2 and Durable Objects are subject to the account's usage allowances.
   Do not reuse this staging bucket for another environment.

3. From the repository root, run the auth and cache checks with
   `$env:BASE_URL = 'https://dev.moodies.tech'`. The CPU profiler is local only.
   In Cloudflare, filter the newly deployed version and compare CPU percentiles
   and CPU-limit outcomes over comparable traffic. Check dynamic title routes
   separately: this change does not remove their render cost. Revalidation itself
   still renders and may exceed the Free allowance; verify it on the deployed plan.

## Experiment ledger (2026-11-20)

| Configuration | Median sampled local CPU/request | Outcome |
| --- | ---: | --- |
| Cookie-dependent layout, dummy cache | 57.18 ms | Baseline; 0/60 cache hits |
| Public shell, regional cache with per-hit R2 reread | 72.84 ms | Rejected; slower than baseline |
| Public shell, one-minute regional cache without per-hit reread | 20.66 ms | Kept; 60/60 cache hits, 63.9% reduction |
| Same configuration, independent repeat | 16.33 ms | 60/60 cache hits, 71.4% reduction |

These warm-homepage samples do not measure every route, production cold starts,
or the CPU used by revalidation. Preserve the reports and collect production
measurements after staging deployment.

Validation passed: the Cloudflare build, TypeScript, 175 Node tests, all 39
Storybook tests, auth-shell/login/signup/recovery flows, guest/member landing
layouts, intent prefetch, and the cache's one-minute revalidation. Changed files
pass lint. Full-repo lint still reports existing `no-assign-module-variable`
errors in `tests/community-picks-count.test.mjs` and `tests/hero-counts.test.mjs`.

References checked through Context7: [Next.js cookies and rendering](https://nextjs.org/docs/app/api-reference/functions/cookies),
[OpenNext caching](https://opennext.js.org/cloudflare/caching),
and [Cloudflare CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).
