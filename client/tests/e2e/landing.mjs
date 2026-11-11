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
  overview:
    "An intimate story of friendship, unexpected turns, and finding a place to call home.",
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
  content:
    "A beautifully told story that stays with you. The small moments make it worth watching, and the ending feels earned.",
  rating: 8 + index / 10,
  user: {
    id: `critic-${index}`,
    username: "A member with a very long display name",
  },
  media: {
    id: item.id,
    title: item.title,
    type: item.type,
    releaseDate: "2025-01-01",
  },
}));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
async function checkMobileRail(section, width) {
  const curated = await section.locator("[data-curated-rail]").count();
  const rail = section.locator(curated ? "[data-curated-rail]" : '[class*="overflow-x-auto"]').first();
  const cards = curated ? "button" : "article";
  await rail.locator(cards).first().waitFor();
  await rail.evaluate(element => { element.scrollTo({ left: 0, behavior: "instant" }); });
  const layout = await rail.evaluate((element, selector) => {
    const cards = [...element.querySelectorAll(selector)].map(card => card.getBoundingClientRect());
    return {
      leadingGutter: cards[0].left,
      singleRow: cards.every(card => Math.abs(card.top - cards[0].top) <= 1),
      peeks: cards.some(card => card.left < innerWidth && card.right > innerWidth),
      cardHeight: cards[0].height,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, cards);
  assert.ok(layout.leadingGutter >= 15, `Missing leading gutter at ${width}px`);
  assert.ok(layout.singleRow, "Shelf cards must remain in one horizontal row");
  if (!curated) assert.ok(layout.peeks, `The next poster should peek into view at ${width}px`);
  if (curated) {
    assert.ok(layout.cardHeight < 180, "Curated poster choices should stay compact");
    assert.ok((await section.boundingBox()).height < 680, "Curated shelf is too tall on mobile");
  }
  assert.equal(layout.pageOverflow, false, "The shelf must not overflow the page");
  await rail.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await rail.page().waitForTimeout(250);
  const endGutter = await rail.locator(cards).last().evaluate(card => innerWidth - card.getBoundingClientRect().right);
  assert.ok(Math.abs(endGutter - layout.leadingGutter) <= 1, `Missing trailing gutter at ${width}px: ${endGutter}`);
  await rail.evaluate(element => { element.scrollLeft = 0; });
}
try {
  for (const member of [false, true]) {
    const context = await browser.newContext();
    let favoritesRequests = 0;
    let favoriteStatus = 200;
    let refreshed = false;
    let accessRejected = false;
    let saved = false;
    let failSave = false;
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/bootstrap")) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return route.fulfill({
          json: {
            user:
              member && !(accessRejected && !refreshed)
                ? { id: "landing-test-user", username: "Test member" }
                : null,
            canRefresh: member,
            watchlist: { movieId: saved ? ["900"] : [], seriesId: [] },
            liked: { movieId: [], seriesId: [] },
          },
        });
      }
      if (path.endsWith("/all/favorites")) {
        favoritesRequests++;
        const status =
          favoriteStatus === 401 && refreshed ? 200 : favoriteStatus;
        if (status === 401) accessRejected = true;
        return route.fulfill({
          status,
          json:
            status === 200
              ? saved
                ? [
                    ...picks.slice(1),
                    { ...picks[0], id: 907, title: "Personal pick 8" },
                  ]
                : picks
              : { message: "Test failure" },
        });
      }
      if (path.endsWith("/auth/refresh")) {
        refreshed = true;
        return route.fulfill({ json: { success: true } });
      }
      if (path.endsWith("/watchlist/toggle")) {
        if (failSave)
          return route.fulfill({
            status: 503,
            json: { message: "Could not save this pick" },
          });
        saved = !saved;
        assert.deepEqual(route.request().postDataJSON(), {
          tmdbId: "900",
          type: "movie",
          active: true,
        });
        return route.fulfill({ json: { removed: !saved } });
      }
      if (path.endsWith("/reviews/community-picks"))
        return route.fulfill({ json: reviews });
      if (path.endsWith("/watchlist") || path.endsWith("/liked"))
        return route.fulfill({ json: { movieId: [], seriesId: [] } });
      return route.fulfill({ json: picks });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(baseUrl, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page
        .locator(member ? "#curated-picks-heading" : "#moodies-intro-heading")
        .waitFor();
      assert.equal(
        await page
          .locator(member ? "#moodies-intro-heading" : "#curated-picks-heading")
          .count(),
        0,
      );
      await page.locator("#community-heading").waitFor();
      if (width < 640) {
        await checkMobileRail(page.locator("#trending"), width);
      }
      await page.locator("#your-moods button", { hasText: "Electric" }).click();
      assert.equal(
        await page
          .locator(
            '#your-moods [aria-label="Choose a mood"] button[aria-pressed="true"]',
          )
          .textContent(),
        "Electric",
      );
      assert.ok(
        await page
          .locator("#landing-mood-preview")
          .textContent()
          .then((text) => text.includes("An electric night")),
      );
      await page.getByRole("button", { name: "Tender", exact: true }).hover();
      assert.equal(
        await page
          .getByRole("button", { name: "Electric", exact: true })
          .getAttribute("aria-pressed"),
        "true",
        "Hovering another mood replaced the chosen mood",
      );
      const layout = await page.evaluate(() => {
        const section = document.querySelector("#your-moods");
        const buttons = [
          ...section.querySelectorAll('[aria-label="Choose a mood"] button'),
        ].map((button) => button.getBoundingClientRect());
        const community = document.querySelector("#community");
        return {
          viewport: window.innerWidth,
          bodyWidth: document.documentElement.scrollWidth,
          buttons: buttons.map(({ top, right, width }) => ({
            top,
            right,
            width,
          })),
          communityRight: community.getBoundingClientRect().right,
        };
      });
      assert.ok(layout.bodyWidth <= width + 1, `Page overflows at ${width}px`);
      assert.ok(layout.communityRight <= width + 1);
      assert.ok(
        layout.buttons.every(
          (button) => button.right <= width && button.width > 40,
        ),
        `Mood choices wrap or overflow at ${width}px`,
      );
      if (member) {
        const curated = page.getByRole("region", { name: "Curated for you" });
        assert.equal(
          await curated
            .getByText("Picked for Test member", { exact: true })
            .count(),
          1,
        );
        const preview = (number) => curated.getByRole("button", { name: `Preview Personal pick ${number}`, exact: true });
        const posterStrip = curated.locator("[data-curated-rail]");
        await curated.getByRole("link", { name: "Details for Personal pick 1", exact: true }).waitFor();
        assert.equal(await curated.getByRole("link", { name: "Details for Personal pick 1" }).getAttribute("href"), "/movies/900");
        await preview(2).click();
        assert.equal(await preview(2).getAttribute("aria-pressed"), "true");
        assert.equal(await curated.getByRole("link", { name: "Details for Personal pick 2", exact: true }).getAttribute("href"), "/tv/901");
        await preview(1).click();
        if (width === 375) {
          failSave = true;
          const failed = page.waitForResponse((response) =>
            response.url().endsWith("/watchlist/toggle"),
          );
          await curated
            .getByRole("button", {
              name: "Save Personal pick 1 to watchlist",
              exact: true,
            })
            .click();
          await failed;
          await curated
            .getByRole("button", {
              name: "Save Personal pick 1 to watchlist",
              exact: true,
            })
            .waitFor();
          assert.equal(saved, false, "Failed save changed the watchlist");
          assert.equal(
            await posterStrip.getByRole("button").count(),
            7,
            "Failed save did not restore the pick",
          );
          failSave = false;
          await curated
            .getByRole("button", {
              name: "Save Personal pick 1 to watchlist",
              exact: true,
            })
            .click();
          await preview(8).waitFor({ state: "attached" });
          assert.equal(
            await preview(1).count(),
            0,
            "Saved pick remained in the mix",
          );
          assert.ok(saved);
          await page.reload({ waitUntil: "domcontentloaded" });
          await preview(8).waitFor({ state: "attached" });
          assert.equal(
            await preview(1).count(),
            0,
            "Reload brought the saved title back",
          );
          saved = false;
          await page.reload({ waitUntil: "domcontentloaded" });
          await curated
            .getByRole("button", {
              name: "Save Personal pick 1 to watchlist",
              exact: true,
            })
            .waitFor();
          assert.equal(saved, false);
        }
        assert.equal(await posterStrip.getByRole("button").count(), 7);
        assert.equal(await curated.getByRole("article").count(), 1, "The shelf should feature one pick");
        if (width < 640) await checkMobileRail(curated, width);
        await curated
          .getByRole("button", { name: "Series", exact: true })
          .click();
        assert.equal(await posterStrip.getByRole("button").count(), 3);
        assert.equal(
          await curated
            .getByRole("link", { name: "Details for Personal pick 1", exact: true })
            .count(),
          0,
        );
        await curated
          .getByRole("button", { name: "Movies", exact: true })
          .click();
        assert.equal(await posterStrip.getByRole("button").count(), 4);
        await curated
          .getByRole("button", { name: "All picks", exact: true })
          .click();
        assert.equal(
          await curated
            .getByRole("button", { name: "More picks", exact: true })
            .count(),
          0,
        );
        assert.equal(await posterStrip.getByRole("button").count(), 7);
        assert.equal(
          await curated
            .getByRole("link", { name: "Adjust your taste" })
            .getAttribute("href"),
          "/auth/onboarding",
        );
      }
      if (!member && width < 640) {
        const introHeight = await page
          .locator('[aria-labelledby="moodies-intro-heading"]')
          .evaluate((element) => element.getBoundingClientRect().height);
        assert.ok(introHeight < 350, "Guest intro too tall at " + width);
      }
      if (outputDir && [375, 1440].includes(width)) {
        await page
          .getByRole("button", { name: "Dismiss notification", exact: true })
          .evaluateAll((buttons) =>
            buttons.forEach((button) => button.click()),
          );
        if (member) await page.reload({ waitUntil: "domcontentloaded" });
        await page
          .locator(member ? "#curated-picks-heading" : "#moodies-intro-heading")
          .waitFor();
        for (const selector of [
          "#your-moods",
          "#community",
          member
            ? '[aria-labelledby="curated-picks-heading"]'
            : '[aria-labelledby="moodies-intro-heading"]',
        ]) {
          await page.locator(selector).screenshot({
            path: `${outputDir}/${member ? "member" : "guest"}-${width}-${selector.includes("curated") ? "curated" : selector.includes("intro") ? "intro" : selector.slice(1)}.png`,
          });
        }
      }
    }
    if (!member)
      assert.equal(
        favoritesRequests,
        0,
        "Guest requested private curated picks",
      );
    if (member) {
      for (const status of [400, 500, 401]) {
        console.log(`Checking curated response ${status}`);
        favoriteStatus = status;
        await page.reload({ waitUntil: "domcontentloaded" });
        if (status === 400)
          await page
            .getByRole("heading", { name: "Choose your tastes" })
            .waitFor();
        if (status === 500) {
          await page
            .getByRole("heading", { name: "Couldn’t load your picks" })
            .waitFor();
          favoriteStatus = 200;
          await page
            .getByRole("button", { name: "Try again", exact: true })
            .click();
        }
        if (status !== 400) {
          if (outputDir)
            await page.screenshot({
              path: `${outputDir}/curated-status-${status}.png`,
            });
          await page
            .getByRole("region", { name: "Curated for you" })
            .getByRole("link", { name: "Details for Personal pick 1", exact: true })
            .waitFor();
        }
      }
      assert.ok(refreshed, "Expired access cookie was not refreshed");
    }
    assert.deepEqual(errors, [], "Landing page raised browser errors");
    console.log(
      `${member ? "Member" : "Guest"} landing passed at 320, 375, 390, 768 and 1440px.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
