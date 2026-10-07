import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputDir = process.env.MOOD_SCREENSHOT_DIR;
if (outputDir) await mkdir(outputDir, { recursive: true });
const families = {
  Bright: ["Cozy", "Funny", "Happy", "Inspirational", "Nostalgic", "Whimsy"],
  Calm: ["Serenity", "Chill", "Romantic", "Bittersweet", "Sad", "Documentary"],
  Charged: ["Thrilling", "Epic", "Chaos", "Sci-Fi", "Western"],
  Shadow: ["Horror", "Dark", "Gritty", "Mind-Bending"],
};
const colors = [
  "#FFDEAD",
  "#FFB6C1",
  "#FFD700",
  "#32CD32",
  "#FFB347",
  "#BA55D3",
];
const moods = Object.values(families)
  .flat()
  .map((name, index) => ({
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    color: colors[index % colors.length],
    description: `Stories for a ${name.toLowerCase()} night.`,
    isActive: true,
  }));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/bootstrap"))
      return route.fulfill({
        json: {
          user: null,
          watchlist: { movieId: [], seriesId: [] },
          liked: { movieId: [], seriesId: [] },
        },
      });
    if (url.pathname.endsWith("/moods")) return route.fulfill({ json: moods });
    if (url.pathname.includes("/moods/recommendations")) {
      const moodId =
        url.searchParams.get("moodId") ||
        route.request().postDataJSON()?.moodId;
      return route.fulfill({
        json: {
          recommendations: [
            {
              tmdbId: 100,
              title: `A ${moodId} story`,
              mediaType: "movie",
              voteAverage: 8.1,
              overview: "A story to suit your night.",
            },
          ],
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/moods`, { waitUntil: "domcontentloaded" });
    const wheel = page.locator("[data-mood-wheel]");
    await wheel
      .getByRole("button", { name: "Select Cozy mood", exact: true })
      .waitFor();
    await page.getByRole("link", { name: /A cozy story/ }).waitFor();
    const layout = await wheel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const header = document
        .querySelector("main h1")
        .parentElement.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        pageWidth: document.documentElement.scrollWidth,
        headerTop: header.top,
      };
    });
    assert.ok(layout.pageWidth <= width + 1, `Page overflow at ${width}px`);
    assert.ok(layout.left >= 0 && layout.right <= width + 1);
    if (width < 640) {
      assert.ok(layout.headerTop < 90, `Extra navbar gap at ${width}px`);
      assert.ok(
        layout.bottom < height - 30,
        `Wheel below first view at ${width}px`,
      );
      assert.equal(
        await page.getByText("Pick directly", { exact: true }).isVisible(),
        false,
      );
    }
    for (const [family, names] of Object.entries(families)) {
      await page
        .getByRole("group", { name: "Mood families" })
        .getByRole("button", { name: new RegExp(`^${family}`) })
        .click();
      assert.equal(
        await wheel.getByRole("button", { name: /^Select/ }).count(),
        names.length,
      );
      const chosen = names.at(-1);
      const button = wheel.getByRole("button", {
        name: `Select ${chosen} mood`,
        exact: true,
      });
      await button.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("link", {
          name: new RegExp(`A ${chosen.toLowerCase()} story`),
        })
        .waitFor();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      const alignment = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const wheelRect = element
          .closest("[data-mood-wheel]")
          .getBoundingClientRect();
        return {
          center: rect.x + rect.width / 2,
          wheelCenter: wheelRect.x + wheelRect.width / 2,
          top: rect.y,
          wheelMiddle: wheelRect.y + wheelRect.height / 2,
        };
      });
      assert.ok(
        Math.abs(alignment.center - alignment.wheelCenter) < 2 &&
          alignment.top < alignment.wheelMiddle,
        "Selected mood is not beneath the pointer",
      );
    }
    await page
      .getByRole("group", { name: "Mood families" })
      .getByRole("button", { name: /^Bright/ })
      .click();
    if (outputDir && [390, 1366].includes(width)) {
      await page
        .getByText("Tonight’s mood", { exact: true })
        .locator("..")
        .getByText("Cozy", { exact: true })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${outputDir}/wheel-${width}.png` });
    }
    await wheel
      .getByRole("button", { name: "Spin the mood wheel", exact: true })
      .click();
    await wheel
      .getByRole("button", { name: "Spin the mood wheel", exact: true })
      .waitFor();
    assert.equal(
      await wheel
        .getByRole("button", { name: /^Select/, pressed: true })
        .count(),
      1,
    );
    console.log(
      `Mood wheel layout, families, keyboard selection and reduced-motion spin passed at ${width}px.`,
    );
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await wheelSpin(page);
  assert.deepEqual(errors, []);
  await context.close();
} finally {
  await browser.close();
}

async function wheelSpin(page) {
  const wheel = page.locator("[data-mood-wheel]");
  await wheel
    .getByRole("button", { name: "Spin the mood wheel", exact: true })
    .click();
  assert.equal(
    await wheel
      .getByRole("button", { name: "Choosing your mood", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await wheel
      .getByRole("button", { name: /^Select/ })
      .first()
      .isDisabled(),
    true,
  );
  await wheel
    .getByRole("button", { name: "Spin the mood wheel", exact: true })
    .waitFor({ timeout: 5000 });
  assert.equal(
    await wheel.getByRole("button", { name: /^Select/, pressed: true }).count(),
    1,
  );
  console.log("Animated spin completes and prevents conflicting selections.");
}
