import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const routes = ["/", "/discover", "/collection", "/movies/550"];
const browser = await chromium.launch({ headless: process.env.HEADED !== "true" });

try {
  for (const route of routes) {
    const routePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    const apiFailures = [];
    routePage.on("pageerror", (error) => pageErrors.push(error.message));
    routePage.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown request failure";
      if (request.url().includes("localhost:4000") && failure !== "net::ERR_ABORTED") {
        apiFailures.push(`${request.method()} ${request.url()} (${failure})`);
      }
    });

    try {
      const response = await routePage.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert.ok(response && response.status() < 400, `${route} returned an HTTP error`);
      await routePage.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
      await routePage.locator("h1, h2").first().waitFor({ state: "visible", timeout: 15_000 });
      assert.equal(pageErrors.length, 0, `${route} raised page errors:\n${pageErrors.join("\n")}`);
      assert.equal(apiFailures.length, 0, `${route} had API request failures:\n${apiFailures.join("\n")}`);
    } finally {
      await routePage.close();
    }
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const apiFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown request failure";
    if (request.url().includes("localhost:4000") && failure !== "net::ERR_ABORTED") {
      apiFailures.push(`${request.method()} ${request.url()} (${failure})`);
    }
  });

  await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" });
  const securityGate = page.locator('[aria-labelledby="turnstile-gate-title"]');
  await page.waitForTimeout(1_500);
  if (await securityGate.isVisible({ timeout: 1_000 }).catch(() => false)) {
    console.log("Discover interaction skipped because Turnstile is active in this environment.");
  } else {
    await page.getByPlaceholder("Search titles, people, or keywords").fill("dune");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/\/discover\?.*q=dune/, { timeout: 15_000 });
    assert.match(page.url(), /q=dune/);
  }

  assert.equal(pageErrors.length, 0, `Discover raised page errors:\n${pageErrors.join("\n")}`);
  assert.equal(apiFailures.length, 0, `Discover had API request failures:\n${apiFailures.join("\n")}`);

  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry ? { duration: entry.duration, transferSize: entry.transferSize } : null;
  });
  if (navigation && navigation.duration > 12_000) {
    throw new Error(`Navigation exceeded the 12 second smoke-test budget: ${navigation.duration}ms`);
  }

  console.log(`Browser smoke passed for ${routes.length} routes at ${baseUrl}.`);
  if (navigation) console.log(`Navigation: ${Math.round(navigation.duration)}ms.`);
} finally {
  await browser.close();
}
