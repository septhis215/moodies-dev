# Worker rendering and CPU checks

## Current deployment: no R2 subscription

The frontend uses only its existing Workers Static Assets binding. R2, the
revalidation Durable Object, its migration, and the self-reference service binding
were removed after deployment failed with Cloudflare error 10042 because R2 was
not enabled. This deployment does not require enabling a storage subscription.

The root layout uses `force-dynamic` while persistent storage is disabled. This
avoids a prerendered ISR route missing its unavailable cache and rebuilding on
every request. Responses stay fresh and private/no-store. API caching remains the
responsibility of the existing Nest backend.

The earlier intent-prefetch improvement remains: shelves request a title only on
hover or keyboard focus. Browser session hints still protect against guest-copy
flashes; the API remains the authority for authentication and personal data.

The previous **64–71% sampled CPU reduction required R2**. It is historical
evidence for a configuration that is no longer enabled, not a claim about this
storage-free recovery deployment. Removing the R2 bindings alone retained ISR
cache misses and measured 85.67 ms locally, so the recovery also disables ISR.

## Build and preview locally

Run from the repository root in PowerShell, with the project's staging `.env`:

```powershell
$env:MOODIES_ENV = 'staging'
npm.cmd run build:cloudflare --workspace=client
npm.cmd run preview:cloudflare --workspace=client -- --port 8787 --inspector-port 9230
```

Keep that terminal running. In another terminal, close browser tabs and tests
using this Worker before measuring:

```powershell
npm.cmd run benchmark:worker-cpu --workspace=client -- --output output/worker-cpu/recovery.json --compare output/worker-cpu/before.json
```

Omit `--compare` if there is no saved baseline. Rebuild and restart the preview
between versions. The benchmark warms the homepage and profiles three batches of
20 sequential requests. JSON results and `.cpuprofile` files are saved under
gitignored `client/output/worker-cpu/`. The inspector connection uses `ws`, already
installed with Wrangler. The profiler accepts local URLs only.

Compare `medianSampledCpuMs` and variation across batches. `cacheHits: 0` is expected
for this storage-free deployment. These are local workerd CPU samples, including
runtime/profiler overhead, not Cloudflare production CPU or proof of compliance
with the Free CPU allowance. `firstRequest.wallMs` is not a repeatable cold-start
CPU measurement.

## Regression checks

Run after profiling so browser traffic does not contaminate the measurements:

```powershell
$env:BASE_URL = 'http://127.0.0.1:8787'
npm.cmd run test:deployment --workspace=client
npm.cmd run test:e2e:auth-shell --workspace=client
npm.cmd run test:e2e:public-responses --workspace=client
npm.cmd run test:e2e:landing --workspace=client
npm.cmd run test:e2e:prefetch --workspace=client
```

The deployment check guards against reintroducing R2 and cache Durable Object
bindings. Browser checks cover cookie/storage-only hints, disabled storage, Google
return, expired sessions, an unavailable API, and bootstrap without a browser hint.
API replies are mocked; no account is modified. The HTTP check verifies homepage
and title responses remain private/no-store and do not echo a synthetic cookie.

The old `test:e2e:public-cache -- --revalidate` command was replaced by
`test:e2e:public-responses`: this deployment has no persistent ISR cache to refresh.

## Redeploy staging

Push the corrected code and use the existing Cloudflare staging pipeline. From
`client`, the commands remain:

```powershell
$env:MOODIES_ENV = 'staging'
npm.cmd run build:cloudflare
npm.cmd run deploy:cloudflare
```

The deploy log should say the incremental cache does not need populating. It
should not attempt remote R2 provisioning. Existing API URLs and domains are
unchanged. For browser/HTTP checks against staging, use
`$env:BASE_URL = 'https://dev.moodies.tech'` from the repository root.

Cloudflare CLI credentials were unavailable during implementation, so no live
deployment was performed here. Verify CPU-limit outcomes on the newly deployed
version. The original Free CPU limit still applies to server rendering.

## Historical experiments (2026-11-20)

| Configuration | Median sampled local CPU/request | Outcome |
| --- | ---: | --- |
| Cookie-dependent layout, dummy cache | 57.18 ms | Original baseline |
| Public shell, regional R2 cache with per-hit R2 reread | 72.84 ms | Rejected; slower |
| Public shell, one-minute regional R2 cache without per-hit reread | 20.66 ms | 60/60 hits; removed to avoid an R2 subscription |
| Same R2 configuration, repeat | 16.33 ms | 60/60 hits; historical only |
| R2 removed while prerendered ISR remained enabled | 85.67 ms | Rejected; cache misses on every request |
| Storage-free recovery with ordinary server rendering | 54.83 ms | Deployment restored; within variation of the original baseline |

Recovery validation passed: Cloudflare build, upload-free deployment dry run,
176 Node tests, all 39 Storybook tests, public-response checks, all eight auth-shell
scenarios, guest/member landing layouts, and intent-prefetch checks. Changed files
pass lint. No live deployment was performed.

A future storage-free optimization can serve public pages as static content and
fetch live catalogue data from the existing API. This requires separately
verifying first paint, search metadata, content freshness, and private sessions;
it is not implemented by the recovery change.

References checked through Context7: [OpenNext caching](https://opennext.js.org/cloudflare/caching)
and [Cloudflare CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).
