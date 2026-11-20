import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

// Run against a production build: development mode disables Next.js prefetching.
const { values } = parseArgs({ options: {
  "base-url": { type: "string" },
  measure: { type: "boolean", default: false },
  output: { type: "string" },
  compare: { type: "string" },
} });
const baseUrl = values["base-url"] || process.env.BASE_URL || "http://localhost:3000";
const samples = [];
const picks = Array.from({ length: 12 }, (_, index) => ({
  id: 970001 + index,
  title: `Prefetch pick ${index + 1}`,
  type: "movie",
  poster_path: null,
  release_date: "2026-01-01",
  vote_average: 8,
}));
const paths = new Set(picks.map(item => `/movies/${item.id}`));
const browser = await chromium.launch({ headless: true });

try {
  for (const intent of ["hover", "focus"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/bootstrap")) {
        return route.fulfill({ json: {
          user: null, canRefresh: false,
          watchlist: { movieId: [], seriesId: [] },
          liked: { movieId: [], seriesId: [] },
        } });
      }
      return route.fulfill({ json: path.endsWith("/all/trending") ? picks : [] });
    });
    const page = await context.newPage();
    const requested = new Set();
    let requestCount = 0;
    const errors = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin && paths.has(url.pathname)) {
        requested.add(url.pathname);
        requestCount++;
      }
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.mouse.move(0, 0);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const card = page.locator('#trending a[aria-label="Explore Prefetch pick 1"]').first();
    await card.waitFor();
    await card.scrollIntoViewIfNeeded();
    // Give the production viewport scheduler time to discover the visible shelf.
    await page.waitForTimeout(1500);
    const viewportRequests = requestCount;
    const viewportTitles = requested.size;
    if (!values.measure) assert.equal(viewportTitles, 0, "Visible posters prefetched unselected title pages");

    const prefetched = values.measure ? null : page.waitForRequest(request => {
      const url = new URL(request.url());
      return url.pathname === "/movies/970001" && request.headers().rsc === "1";
    });
    if (intent === "hover") await card.hover();
    else await card.focus();
    if (prefetched) await prefetched;
    await page.waitForTimeout(1000);
    if (!values.measure) assert.deepEqual([...requested], ["/movies/970001"], "Intent warmed other titles");
    samples.push({ intent, viewportRequests, viewportTitles, additionalRequestsOnIntent: requestCount - viewportRequests });
    assert.equal(await card.getAttribute("href"), "/movies/970001");

    if (!values.measure && intent === "focus") {
      await Promise.all([
        page.waitForURL("**/movies/970001", { waitUntil: "commit" }),
        page.keyboard.press("Enter"),
      ]);
    } else if (!values.measure) {
      const save = page.locator('#trending article').first().getByRole("button", { name: "Add Prefetch pick 1 to My List", exact: true });
      await save.click();
      await page.getByText("Sign in to save this to your watchlist.", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/", "Save button followed the title link");
    }
    assert.deepEqual(errors, [], "Prefetch caused a browser error");
    console.log(`${intent}: ${viewportRequests} title requests before intent, ${samples.at(-1).additionalRequestsOnIntent} after intent.`);
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  measuredAt: new Date().toISOString(), baseUrl,
  metric: "Title-page HTTP requests, not Cloudflare Worker CPU time",
  fixtureTitles: picks.length, viewportWaitMs: 1500, samples,
};
console.table(samples);
if (values.compare) {
  const baseline = JSON.parse(await readFile(values.compare, "utf8"));
  const before = baseline.samples.reduce((sum, sample) => sum + sample.viewportRequests, 0);
  const after = samples.reduce((sum, sample) => sum + sample.viewportRequests, 0);
  console.log(before > 0
    ? `Automatic title requests: ${before} -> ${after} (${((before - after) / before * 100).toFixed(1)}% reduction).`
    : `Baseline had no automatic title requests; no reduction percentage can be established (${before} -> ${after}).`);
}
if (values.output) {
  await mkdir(dirname(values.output), { recursive: true });
  await writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report saved to ${values.output}`);
}
