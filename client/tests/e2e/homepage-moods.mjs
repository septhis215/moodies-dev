import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});

try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/auth/bootstrap", (route) =>
      route.fulfill({ json: { user: null } }),
    );
    await page.route("**/api/security/turnstile/status", (route) =>
      route.fulfill({ json: { verified: true } }),
    );

    for (const path of ["/", "/movies", "/tv"]) {
      const response = await page.goto(`${base}${path}`, {
        waitUntil: "load",
        timeout: 120_000,
      });
      assert.equal(response.status(), 200);
      const guide = page.getByRole("complementary", {
        name: "Moodies mood discovery",
      });
      await guide.waitFor();
      await page.waitForFunction(() =>
        [
          ...document.querySelectorAll(
            'aside[aria-label="Moodies mood discovery"] img',
          ),
        ].every((image) => image.complete && image.naturalWidth > 0),
      );
      const cozy = guide.getByRole("link", { name: "Cozy", exact: true });
      const bounds = await cozy.boundingBox();
      assert.ok(
        bounds.height >= 44,
        "Mood shortcuts need comfortable touch targets",
      );
      assert.equal(await guide.getByRole("link").count(), 5);
      if (width < 1024) {
        const heading = page.locator("main section").first().locator("h1, h2").last();
        const headingBounds = await heading.boundingBox();
        const guideBounds = await guide.boundingBox();
        assert.ok(headingBounds.y < guideBounds.y, "The featured hero must lead on smaller screens");
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `${path} overflows at ${width}px`);
      if (path === "/") {
        assert.equal(await cozy.getAttribute("href"), "/moods?mood=Cozy");
      } else {
        await cozy.click();
        await page
          .locator("#moods")
          .getByText("Cozy Mode", { exact: true })
          .waitFor({ timeout: 30_000 });
        assert.equal(await page.locator("#moods").count(), 1);
        // A second shortcut must replace the previous selection.
        await guide.getByRole("link", { name: "Funny", exact: true }).click();
        await page
          .locator("#moods")
          .getByText("Funny Mode", { exact: true })
          .waitFor();
      }
      if (process.env.SCREENSHOT_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/${path === "/" ? "landing" : path.slice(1)}-${width}.png`,
        });
      }
      console.log(`PASS ${path} at ${width}px`);
    }

    await page.route("**/api/moods", (route) =>
      route.fulfill({
        json: [
          {
            id: "test-cozy",
            name: "Cozy",
            color: "#FFDEAD",
            icon: "mug-hot",
            description: "Comforting stories",
            isActive: true,
          },
          {
            id: "test-thrilling",
            name: "Thrilling",
            color: "#FF6B35",
            icon: "zap",
            description: "Gripping stories",
            isActive: true,
          },
        ],
      }),
    );
    await page.route("**/api/moods/recommendations?**", (route) =>
      route.fulfill({ json: { recommendations: [] } }),
    );
    await page.goto(`${base}/moods?mood=Thrilling`, {
      waitUntil: "domcontentloaded",
    });
    const selected = page.getByRole("button", {
      name: "Thrilling",
      exact: true,
    });
    await selected.waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button[aria-pressed="true"]')].some(
        (button) => button.textContent.trim() === "Thrilling",
      ),
    );
    assert.equal(
      await selected.getAttribute("aria-pressed"),
      "true",
      "The deep link must select the requested mood, not just show its button",
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    await context.close();
  }
} finally {
  await browser.close();
}
