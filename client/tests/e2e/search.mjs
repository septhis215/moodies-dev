import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputDir = process.env.SEARCH_SCREENSHOT_DIR;
if (outputDir) await mkdir(outputDir, { recursive: true });
const fixtures = [
  { id: 810, type: "movie", title: "The extraordinarily long title of an unexpected journey", overview: "Two strangers find themselves far from home, following a trail of letters through a city that never sleeps. An intimate story of friendship, unexpected turns, and finding a place to call home.", release_date: "2025-01-01", vote_average: 8.2, genres: ["Drama"], poster_path: null },
  { id: 811, type: "tv", title: "A series about the things we leave behind", overview: "An ordinary family begins an extraordinary adventure together.", first_air_date: "2024-04-01", vote_average: 7.6, genres: ["Comedy"], poster_path: null },
  { id: 812, type: "person", name: "A person with an unusually long display name", known_for_department: "Acting", profile_path: null, known_for: [{ id: 810, title: "The extraordinarily long title of an unexpected journey" }, { id: 811, title: "A series about the things we leave behind" }] },
  { id: 813, type: "movie", title: "Coming soon", vote_average: 0, genres: ["Drama"], poster_path: null },
  { id: 814, type: "person", name: "May", known_for_department: "Acting", profile_path: null },
];
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext();
  let searches = 0;
  let failSearch = false;
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/auth/bootstrap")) return route.fulfill({ json: { user: null, watchlist: { movieId: [], seriesId: [] }, liked: { movieId: [], seriesId: [] } } });
    if (path.endsWith("/security/status")) return route.fulfill({ json: { verified: true } });
    if (path.endsWith("/search/genres")) return route.fulfill({ json: { genres: ["Drama", "Comedy"] } });
    if (path.endsWith("/search/countries")) return route.fulfill({ json: { countries: [{ code: "US", name: "United States" }] } });
    if (path.endsWith("/search")) {
      searches++;
      if (failSearch) return route.fulfill({ status: 500, json: { message: "Test failure" } });
      const type = url.searchParams.get("type");
      const results = url.searchParams.get("q") === "no matches" ? [] : fixtures.filter((item) => type === "all" || item.type === type);
      return route.fulfill({ json: { results, total_results: results.length ? 42 : 0, total_pages: results.length ? 3 : 0, status: results.length ? "success" : "empty" } });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${baseUrl}/search?q=journey`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const cards = page.locator('main a[aria-label^="View "]');
    await cards.first().waitFor();
    const before = searches;
    await page.getByRole("button", { name: "List view", exact: true }).click();
    await page.waitForURL(/view=list/);
    await cards.first().locator('span').filter({ hasText: "View details" }).waitFor();
    assert.equal(searches, before, "Changing layout refetched the search");
    const layout = await page.evaluate(() => {
      const rect = (element) => {
        const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
        return { top, bottom, left, right, width, height };
      };
      const main = document.querySelector("main");
      const nav = document.querySelector('nav[aria-label="Primary navigation"]')?.parentElement;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        header: rect(main.querySelector("header")),
        nav: nav ? rect(nav) : null,
        cards: [...main.querySelectorAll('a[aria-label^="View "]')].map((card) => ({
          card: rect(card), poster: rect(card.firstElementChild), body: rect(card.lastElementChild),
          children: [...card.lastElementChild.children].map(rect),
        })),
      };
    });
    assert.ok(layout.scrollWidth <= width + 1, `Page overflow at ${width}px`);
    assert.ok(layout.nav && layout.header.top >= layout.nav.bottom + 16, `Missing navbar gap at ${width}px`);
    for (const item of layout.cards) {
      assert.ok(item.card.right <= width && item.card.left >= 0, `Card overflow at ${width}px`);
      assert.ok(Math.abs(item.poster.height / item.poster.width - 1.5) < 0.03, "Poster stretched in list view");
      assert.ok(item.children.every((child) => child.right <= item.body.right + 1 && child.bottom <= item.card.bottom), `Content escaped card at ${width}px`);
    }
    assert.equal(await cards.nth(0).getAttribute("href"), "/movies/810");
    assert.equal(await cards.nth(1).getAttribute("href"), "/tv/811");
    assert.equal(await cards.nth(2).getAttribute("href"), "/celeb/812");
    assert.ok((await cards.nth(2).textContent()).includes("Known for"));
    assert.equal(await cards.nth(0).getByText(fixtures[0].overview, { exact: true }).isVisible(), width >= 768, "Descriptions should only appear in desktop list view");
    assert.equal(await cards.nth(2).getByText(/Known for/).isVisible(), width >= 768, "Person descriptions should only appear in desktop list view");
    assert.equal(await cards.nth(3).locator('[aria-label^="TMDB rating"]').count(), 0);
    if (outputDir && [375, 1440].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${outputDir}/search-list-${width}.png` });
      await page.getByRole("button", { name: "Grid view", exact: true }).click();
      await page.waitForURL((url) => !url.searchParams.has("view"));
      await page.locator('main button[aria-label="Grid view"][aria-pressed="true"]').waitFor();
      await page.screenshot({ path: `${outputDir}/search-grid-${width}.png` });
      await page.getByRole("button", { name: "List view", exact: true }).click();
      await page.waitForURL(/view=list/);
    }
  }
  await page.getByRole("button", { name: "Sort results: Most relevant", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await page.getByRole("option", { name: "Most relevant", exact: true }).waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL(/sort=rating/);
  assert.ok(new URL(page.url()).searchParams.get("view") === "list");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filters", exact: true });
  await dialog.getByRole("checkbox", { name: "Drama", exact: true }).check();
  await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL(/genres=Drama/);
  await page.getByRole("button", { name: "Remove filter: Drama", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "list");
  await page.getByRole("button", { name: "Clear all filters", exact: true }).click();
  await page.waitForURL((url) => !url.searchParams.has("genres"));
  await page.getByRole("button", { name: "Go to page 2", exact: true }).click();
  await page.waitForURL(/page=2/);
  assert.equal(new URL(page.url()).searchParams.get("view"), "list");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('main a[aria-label^="View "]').first().waitFor();
  assert.equal(await page.getByRole("button", { name: "List view", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.waitForURL(/type=person/);
  await page.getByRole("heading", { name: "2 results on this page", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("page"), "1");
  await page.getByRole("searchbox", { name: "Search movies, TV and people", exact: true }).fill("no matches");
  await page.getByRole("search", { exact: true }).getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("heading", { name: "No results found", exact: true }).waitFor();
  failSearch = true;
  await page.goto(`${baseUrl}/search?q=journey&view=list`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Couldn’t load your search", exact: true }).waitFor();
  failSearch = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.locator('main a[aria-label^="View "]').first().waitFor();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "Comedy", exact: true }).check();
  await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL(/genres=Comedy/);
  await page.getByRole("heading", { name: "3 results on this page", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.goto(`${baseUrl}/search`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Find your next watch", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "People", exact: true }).isDisabled(), true);
  assert.deepEqual(errors, [], "Search raised browser errors");
  console.log("Search passed at 320, 375, 390, 768, 1024 and 1440px; layout persistence, sorting, filters, paging, empty state and retry passed.");
  await context.close();
} finally {
  await browser.close();
}
