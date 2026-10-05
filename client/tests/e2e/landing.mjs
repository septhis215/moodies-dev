import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputDir = process.env.LANDING_SCREENSHOT_DIR;
if (outputDir) await mkdir(outputDir, { recursive: true });
const picks = Array.from({ length: 7 }, (_, index) => ({
  id: 900 + index,
  type: index % 2 ? "tv" : "movie",
  title: `Personal pick ${index + 1}`,
  overview: "An intimate story of friendship, unexpected turns, and finding a place to call home.",
  genres: ["Drama", "Adventure"],
  vote_average: 8.2,
  release_date: "2025-01-01",
  poster_path: null,
  backdrop_path: null,
  recommendations: [],
}));
const reviews = picks.slice(0, 5).map((item, index) => ({
  tmdbId: item.id,
  mediaType: item.type === "tv" ? "TV" : "MOVIE",
  content: "A beautifully told story that stays with you. The small moments make it worth watching, and the ending feels earned.",
  rating: 8 + index / 10,
  user: { id: `critic-${index}`, username: "A member with a very long display name" },
  media: { id: item.id, title: item.title, type: item.type, releaseDate: "2025-01-01" },
}));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const member of [false, true]) {
    const context = await browser.newContext();
    let favoritesRequests = 0;
    let favoriteStatus = 200;
    let refreshed = false;
    let saved = false;
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/bootstrap")) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return route.fulfill({ json: { user: member ? { id: "landing-test-user", username: "Test member" } : null, watchlist: { movieId: [], seriesId: [] }, liked: { movieId: [], seriesId: [] } } });
      }
      if (path.endsWith("/all/favorites")) {
        favoritesRequests++;
        const status = favoriteStatus === 401 && refreshed ? 200 : favoriteStatus;
        return route.fulfill({ status, json: status === 200 ? picks : { message: "Test failure" } });
      }
      if (path.endsWith("/auth/refresh")) {
        refreshed = true;
        return route.fulfill({ json: { success: true } });
      }
      if (path.endsWith("/watchlist/toggle")) {
        saved = !saved;
        assert.deepEqual(route.request().postDataJSON(), { tmdbId: "900", type: "movie" });
        return route.fulfill({ json: { removed: !saved } });
      }
      if (path.endsWith("/reviews/community-picks")) return route.fulfill({ json: reviews });
      if (path.endsWith("/watchlist") || path.endsWith("/liked")) return route.fulfill({ json: { movieId: [], seriesId: [] } });
      return route.fulfill({ json: picks });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.locator(member ? "#curated-picks-heading" : "#moodies-intro-heading").waitFor();
      assert.equal(await page.locator(member ? "#moodies-intro-heading" : "#curated-picks-heading").count(), 0);
      await page.locator("#community-heading").waitFor();
      await page.locator('#your-moods button', { hasText: "Electric" }).click();
      assert.equal(await page.locator('#your-moods button[aria-pressed="true"]').textContent(), "Electric");
      assert.ok(await page.locator("#landing-mood-preview").textContent().then((text) => text.includes("An electric night")));
      const layout = await page.evaluate(() => {
        const section = document.querySelector("#your-moods");
        const buttons = [...section.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
        const community = document.querySelector("#community");
        return {
          viewport: window.innerWidth,
          bodyWidth: document.documentElement.scrollWidth,
          buttons: buttons.map(({ top, right, width }) => ({ top, right, width })),
          communityRight: community.getBoundingClientRect().right,
        };
      });
      assert.ok(layout.bodyWidth <= width + 1, `Page overflows at ${width}px`);
      assert.ok(layout.communityRight <= width + 1);
      assert.ok(layout.buttons.every((button) => button.top === layout.buttons[0].top && button.right <= width && button.width > 40), `Mood choices wrap or overflow at ${width}px`);
      if (member) {
        const curated = page.getByRole("region", { name: "Curated for you" });
        await curated.getByRole("link", { name: "Explore Personal pick 1", exact: true }).waitFor();
        assert.equal(await curated.getByRole("link", { name: "Explore Personal pick 2", exact: true }).getAttribute("href"), "/tv/901");
        if (width === 375) {
          await curated.getByRole("button", { name: "Save Personal pick 1 to your watchlist", exact: true }).click();
          await curated.getByRole("button", { name: "Remove Personal pick 1 from your watchlist", exact: true }).waitFor();
          assert.ok(saved);
          await curated.getByRole("button", { name: "Remove Personal pick 1 from your watchlist", exact: true }).click();
          await curated.getByRole("button", { name: "Save Personal pick 1 to your watchlist", exact: true }).waitFor();
          assert.equal(saved, false);
        }
        await curated.getByRole("button", { name: "Next picks" }).click();
        await curated.getByRole("link", { name: "Explore this pick" }).waitFor();
        assert.equal(await curated.getByRole("link", { name: "Explore this pick" }).getAttribute("href"), "/tv/901");
      }
      if (outputDir && [375, 1440].includes(width)) {
        for (const selector of ["#your-moods", "#community", member ? '[aria-labelledby="curated-picks-heading"]' : '[aria-labelledby="moodies-intro-heading"]']) {
          await page.locator(selector).screenshot({ path: `${outputDir}/${member ? "member" : "guest"}-${width}-${selector.includes("curated") ? "curated" : selector.includes("intro") ? "intro" : selector.slice(1)}.png` });
        }
      }
    }
    if (!member) assert.equal(favoritesRequests, 0, "Guest requested private curated picks");
    if (member) {
      for (const status of [400, 500, 401]) {
        favoriteStatus = status;
        await page.reload({ waitUntil: "domcontentloaded" });
        if (status === 400) await page.getByRole("heading", { name: "Make this mix yours" }).waitFor();
        if (status === 500) {
          await page.getByRole("heading", { name: "Couldn’t load your mix" }).waitFor();
          favoriteStatus = 200;
          await page.getByRole("button", { name: "Try again", exact: true }).click();
        }
        if (status !== 400) await page.getByRole("link", { name: "Explore Personal pick 1", exact: true }).waitFor();
      }
      assert.ok(refreshed, "Expired access cookie was not refreshed");
    }
    assert.deepEqual(errors, [], "Landing page raised browser errors");
    console.log(`${member ? "Member" : "Guest"} landing passed at 320, 375, 390, 768 and 1440px.`);
    await context.close();
  }
} finally {
  await browser.close();
}
