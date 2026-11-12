import assert from "node:assert/strict";
import { chromium, expect } from "playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const member = { id: "profile-member", username: "Profile member", email: "member@example.test" };
const watchlist = { movieId: ["12"], seriesId: ["34"] };

try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let json = {};
    if (pathname.endsWith("/auth/bootstrap")) {
      json = { user: member, watchlist, liked: { movieId: [], seriesId: [] } };
    } else if (pathname.endsWith("/auth/me")) {
      json = member;
    } else if (pathname.endsWith("/watchlist")) {
      json = watchlist;
    } else if (pathname.endsWith("/movies/details/12")) {
      json = { info: { id: 12, title: "Zebra Crossing", release_date: "2023-06-01", vote_average: 7.1 } };
    } else if (pathname.endsWith("/tv/details/34")) {
      json = { info: { id: 34, name: "A Quiet Orbit", first_air_date: "2024-02-01", vote_average: 8.3 } };
    } else if (pathname.endsWith("/reviews/me")) {
      json = { reviews: [{
        id: "review-1", tmdbId: 34, mediaType: "TV", rating: 8,
        content: "The cast makes every episode worth watching.",
        moodEmojis: ["/images/review-icons/amazing.png", "/images/review-icons/loved-it.png"],
        status: "PUBLISHED", createdAt: "2026-10-15T12:00:00Z",
      }] };
    }
    return route.fulfill({ json });
  });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/profile");
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(page.getByRole("heading", { name: "A Quiet Orbit" })).toBeVisible();
    const search = page.getByPlaceholder("Search your watchlist...");
    await search.fill("quiet orbit");
    await expect(page.getByRole("heading", { name: "Zebra Crossing" })).toHaveCount(0);
    await page.getByRole("button", { name: "List view" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: "A Quiet Orbit" })).toBeVisible();
    await expect(page.getByRole("link", { name: /A Quiet Orbit/ })).toHaveAttribute("href", "/tv/34");

    await page.getByRole("button", { name: "Reviews", exact: true }).click();
    const artwork = page.getByRole("img", { name: "Amazing", exact: true });
    await expect(artwork).toBeVisible();
    assert.ok((await artwork.boundingBox()).width >= 40, "Review mascot should be at least 40px");
    await page.getByRole("button", { name: /^Movies/ }).click();
    await expect(page.getByRole("heading", { name: "No movie reviews yet" })).toBeVisible();
    const emptyArtwork = page.locator('img[src*="conversation-starter"]');
    assert.ok((await emptyArtwork.boundingBox()).width >= 144, "The empty state should have a prominent mascot");

    const edit = page.getByRole("button", { name: "Edit profile", exact: true });
    await edit.click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Display name" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close edit profile" })).toHaveCSS("border-radius", "10px");
    await expect(dialog.getByRole("button", { name: "Save changes" })).toHaveCSS("border-radius", "10px");
    assert.equal(await dialog.evaluate((element) => element.matches(":modal")), true);
    assert.equal(await dialog.evaluate((element) => element.contains(document.elementFromPoint(20, 20))), true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(edit).toBeFocused();
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  }
  console.log("Profile watchlist titles, review artwork, and edit modal passed at 390px and 1440px.");
} finally {
  await browser.close();
}
