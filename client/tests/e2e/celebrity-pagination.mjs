import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const people = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1, name: `Trending person ${index + 1}`, profile_path: null,
  known_for_department: "Acting", trending_title: "A featured film",
  known_for: [{ id: 900, title: "Known title", media_type: "movie", release_date: "2025-01-01" }],
}));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ hasTouch: true });
  const requests = [];
  const detailRequests = [];
  let failDirectory = false;
  let slowDirectory = false;
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/bootstrap")) return route.fulfill({ json: { user: null, canRefresh: false } });
    if (url.pathname.endsWith("/people/hub")) return route.fulfill({ json: { people, status: "ready" } });
    if (url.pathname.endsWith("/people/hub/videos")) return route.fulfill({ json: { videos: [], status: "ready" } });
    if (url.pathname.endsWith("/people/news")) return route.fulfill({ json: { articles: [], sources: [], windowDays: 30 } });
    if (/\/people\/\d+$/.test(url.pathname)) {
      const id = Number(url.pathname.split("/").at(-1));
      detailRequests.push(id);
      if (id === 9 && detailRequests.filter(value => value === 9).length === 1) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: { combined_credits: { cast: [{ id: 901, title: "Latest title", media_type: "movie", release_date: "2026-01-01" }] } } });
    }
    if (url.pathname.endsWith("/people/discover")) {
      const page = Number(url.searchParams.get("page"));
      requests.push(Object.fromEntries(url.searchParams));
      if (failDirectory) return route.fulfill({ status: 503, json: {} });
      if (slowDirectory) await new Promise(resolve => setTimeout(resolve, 22000));
      const lastPage = page === 500 ? 500 : 12;
      return route.fulfill({ json: {
        results: page === 10 ? [] : Array.from({ length: page === lastPage ? 1 : 20 }, (_, index) => ({
          id: page * 100 + index, name: `Page ${page} person ${index + 1}`, profile_path: null, known_for_department: "Acting",
        })),
        page, total_pages: lastPage, total_results: 240, has_more: page < lastPage,
      } });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/celeb`);
  const trending = page.getByRole("region", { name: "Trending people", exact: true });
  await trending.getByText("Trending person 1", { exact: true }).first().waitFor();
  assert.equal(await trending.locator("article").count(), 24, "The hub displays all available trending people instead of truncating the shelf");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(350);
  assert.equal(detailRequests.length, 0, "Visible people must not request full credits");
  for (let index = 0; index < 6; index++) {
    await trending.locator("article").nth(index).hover({ position: { x: 15, y: 15 } });
    await page.mouse.move(0, 0);
  }
  await page.waitForTimeout(350);
  console.log(`Celebrity card rapid-pass detail requests: ${detailRequests.length} for six cards.`);
  if (!process.env.CELEBRITY_CARD_MEASURE) {
    assert.equal(detailRequests.length, 0, "Passing over cards briefly must not fan out credit requests");
    await trending.locator("article").first().hover({ position: { x: 15, y: 15 } });
    await page.waitForFunction(() => document.querySelector('[aria-label="Trending person 1"]').closest("article").textContent.includes("Latest title"));
    assert.deepEqual(detailRequests, [1], "Dwelling loads only the intended person's latest work");
    await page.mouse.move(0, 0);
    await trending.locator("article").first().hover({ position: { x: 15, y: 15 } });
    await page.waitForTimeout(350);
    assert.deepEqual(detailRequests, [1], "Repeated hover reuses loaded credits");
    const focused = trending.getByRole("link", { name: "Trending person 7", exact: true }).first();
    await focused.focus();
    await page.waitForFunction(() => document.querySelector('[aria-label="Trending person 7"]').closest("article").textContent.includes("Latest title"));
    assert.ok(detailRequests.includes(7), "Keyboard intent loads work immediately");
    const retry = trending.getByRole("link", { name: "Trending person 9", exact: true }).first();
    await retry.focus();
    await page.waitForTimeout(100);
    await retry.evaluate(element => element.blur());
    await retry.focus();
    await page.waitForFunction(() => document.querySelector('[aria-label="Trending person 9"]').closest("article").textContent.includes("Latest title"));
    assert.equal(detailRequests.filter(value => value === 9).length, 2, "Failed credits can retry on new intent");
    await page.setViewportSize({ width: 390, height: 900 });
    await trending.getByRole("button", { name: "Show Trending person 8's work", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Trending person 8"]').closest("article").textContent.includes("Latest title"));
    assert.equal(detailRequests.filter(value => value === 8).length, 1, "Touch info loads only the selected card");
  }
  if (!process.env.CELEBRITY_CARD_ONLY) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/celeb/explore?page=9`);
    const directory = page.getByRole("region", { name: "Celebrity directory", exact: true });
    const next = page.getByRole("button", { name: "Next page", exact: true });
    const previous = page.getByRole("button", { name: "Previous page", exact: true });
    await directory.getByText("Page 9 person 1", { exact: true }).first().waitFor();
    assert.equal(requests.at(-1).page, "9", "Pages beyond eight fetch their own results");
    assert.equal(requests.at(-1).limit, "20", "The directory uses the upstream page size");
    assert.equal(await directory.locator("article").count(), 20);
    await next.click();
    await page.waitForURL(/page=10/);
    await directory.getByRole("heading", { name: "No people found", exact: true }).waitFor();
    assert.equal(await next.isEnabled(), true, "An empty filtered page does not hide later pages");
    assert.equal(await previous.isEnabled(), true);
    await next.click();
    await directory.getByText("Page 11 person 1", { exact: true }).first().waitFor();
    assert.equal(await directory.getByText("Page 9 person 1", { exact: true }).count(), 0, "Next page replaces the previous results");
    await next.click();
    await directory.getByText("Page 12 person 1", { exact: true }).first().waitFor();
    assert.equal(await next.isDisabled(), true, "The final page cannot request another page");
    await previous.click();
    await directory.getByText("Page 11 person 1", { exact: true }).first().waitFor();
    await page.getByRole("textbox", { name: "Search celebrities" }).fill("Tom");
    await page.waitForURL(/q=Tom/);
    await directory.getByText("Page 1 person 1", { exact: true }).first().waitFor();
    assert.equal(requests.at(-1).page, "1", "Searching resets pagination");
    assert.equal(requests.at(-1).query, "Tom");
    await page.getByRole("button", { name: "Popular", exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("category") === "popular");
    await directory.getByText("Page 1 person 1", { exact: true }).first().waitFor();
    assert.equal(requests.at(-1).category, "popular");
    assert.equal(requests.at(-1).page, "1", "Changing category resets pagination");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Directory pagination fits the viewport");
  }
  await page.goto(`${base}/celeb/explore?page=500`);
  await page.getByText("Page 500 person 1", { exact: true }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Next page", exact: true }).isDisabled(), true);
  failDirectory = true;
  await page.goto(`${base}/celeb/explore?page=2`);
  await page.getByRole("heading", { name: "People couldn’t load", exact: true }).waitFor();
  failDirectory = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("Page 2 person 1", { exact: true }).first().waitFor();
  assert.equal(requests.at(-1).page, "2", "Retry preserves the failed page");
  slowDirectory = true;
  await page.goto(`${base}/celeb/explore?page=3`);
  await Promise.race([
    page.getByText("Page 3 person 1", { exact: true }).first().waitFor({ timeout: 30000 }),
    page.getByRole("heading", { name: "People couldn’t load", exact: true }).waitFor({ timeout: 30000 }).then(() => {
      throw new Error("The directory aborted a valid slow page before enrichment could finish");
    }),
  ]);
  }
  assert.deepEqual(errors, []);
  console.log(process.env.CELEBRITY_CARD_ONLY
    ? "Celebrity card performance passed: rapid hover budget, dwell, cache reuse, keyboard, touch and failed-request retry."
    : "Celebrity pagination passed: full trending shelf, page-specific requests, empty pages, limits, filters, search, retry and card request budgets.");
} finally {
  await browser.close();
}
