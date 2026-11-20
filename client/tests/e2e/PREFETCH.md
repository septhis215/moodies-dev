# Measuring title-page prefetch requests

This benchmark measures unnecessary title-page HTTP requests. It does not measure
Cloudflare Worker CPU time or prove that real renders fit its free CPU allowance.
It uses twelve fixed trending titles and a fresh guest browser context for each
hover and keyboard-focus sample. Browser API responses are intercepted; no account
or watchlist data is changed. Server-rendered content still uses the configured API.

Run all commands below from the repository root in PowerShell.

## Capture a baseline before deploying the change

While the deployed UI still uses the old links:

```powershell
npm.cmd run benchmark:prefetch --workspace=client -- --base-url https://dev.moodies.tech --output output/prefetch/before.json
```

The file is saved under `client/output/prefetch/`, which is gitignored. Preserve it
for comparison. If both baseline and updated versions have already been deployed,
the benchmark cannot reconstruct the old measurements.

## Build and run locally

Do not use `npm run dev` for this check: Next.js disables production prefetching in
development mode. The normal project `.env` should contain `STAGING_API_URL` and
the public frontend settings you use for staging.

```powershell
npm.cmd run build:staging --workspace=client
$env:MOODIES_ENV = 'staging'
npm.cmd run start:staging --workspace=client -- --hostname 127.0.0.1 --port 3011
```

Keep this terminal running. In a second terminal:

```powershell
npm.cmd run benchmark:prefetch --workspace=client -- --base-url http://127.0.0.1:3011 --output output/prefetch/after.json --compare output/prefetch/before.json
$env:BASE_URL = 'http://127.0.0.1:3011'
npm.cmd run test:e2e:prefetch --workspace=client
```

Playwright Chromium must already be installed. If it is missing, use the existing
project dependency to install it: `npm.cmd exec --workspace=client -- playwright install chromium`.

## Read the report

- `viewportRequests`: title requests made without hovering or focusing a card.
- `viewportTitles`: unique titles requested in that period.
- `additionalRequestsOnIntent`: requests after hovering/focusing the first title.

The updated links should make zero automatic title requests, then warm only the
intended title. Next.js may request more than one RSC segment for that title; those
requests are not necessarily duplicate page renders.

The strict test also checks keyboard navigation and that a guest save action shows
the existing sign-in message without navigating to the title. It must fail against
the old viewport-prefetch behavior. The measurement command accepts either behavior
and prints the before/after percentage only when the baseline is nonzero.

The benchmark covers the trending shelf through the shared carousel. Unit tests
cover the shared link policy used by the other changed shelves. It does not measure
every link or route across the application.

To compare on the same platform after deployment, run the measurement again against
`https://dev.moodies.tech`, changing the output name. Repeated samples are more useful
than one run because Next.js scheduling and streaming can affect counts. Do not
interpret the request-count reduction as the same percentage reduction in CPU.

Check the same deployed Worker version's CPU-time percentiles and `exceededCpu`
errors over comparable traffic windows in Cloudflare for the actual CPU outcome.
