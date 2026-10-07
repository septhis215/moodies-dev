import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const outputDir = process.env.QUIZ_SCREENSHOT_DIR;
if (outputDir) await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const fixture = {
  analysis: { rankingVersion: "genre-proxy-v1" },
  results: Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    title: `Quiz fixture ${index + 1}`,
    media_type: "movie",
    vote_average: 8,
    overview: "A story from the test catalogue. ".repeat(20),
    matchScore: 90 - index,
    matchReasons: ["Shares your comedy genre choices."],
    release_date: "2024-01-01",
  })),
};

try {
  for (const width of [320, 375, 768, 1024, 1280, 1440]) {
    const height = width >= 1024 ? 720 : 844;
    const context = await browser.newContext({
      viewport: { width, height },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let calls = 0;
    const submitted = [];
    // Stub unrelated shell requests too; this is a local quiz UI test, not a live-service test.
    await page.route("**/api/**", (route) => {
      const url = route.request().url();
      const body = url.includes("/security/turnstile/status")
        ? { verified: true }
        : url.includes("/auth/bootstrap")
          ? { user: null }
          : [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.route("**/quiz/recommendations", async (route) => {
      calls++;
      submitted.push(route.request().postDataJSON());
      await route.fulfill({
        status: calls === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          calls === 1 ? { message: "Service unavailable" } : fixture,
        ),
      });
    });
    const response = await page.goto(`${base}/quiz`, { waitUntil: "commit" });
    assert.equal(response.status(), 200);
    await page.getByRole("button", { name: "Start quiz", exact: true }).click();
    const answer = (index = 0) =>
      page
        .getByRole("group", { name: "Answer choices" })
        .getByRole("button")
        .nth(index)
        .click();
    await answer();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await answer(1);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.reload({ waitUntil: "commit" });
    await page
      .getByText("Your saved answers are here.", { exact: false })
      .waitFor();
    for (let i = 1; i < 5; i++) {
      await answer();
      await page
        .getByRole("button", {
          name: i === 4 ? "Find my matches" : "Continue",
          exact: true,
        })
        .click();
    }
    await page
      .getByRole("heading", { name: "We couldn’t load your matches" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "No titles in this shortlist yet" })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Retry matches" }).click();
    await page
      .getByRole("heading", { name: "Quiz fixture 1", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Quiz fixture 1", exact: true })
        .count(),
      1,
      "Top pick is not duplicated",
    );
    assert.equal(submitted[1].answers.length, 5);
    assert.deepEqual(
      submitted[1].answers.map((answer) => answer.category).sort(),
      ["commitment", "feeling", "format", "genre", "pace"],
      "Every randomized session retains all recommendation signals",
    );
    assert.deepEqual(submitted[0], submitted[1], "Retry preserves answers");
    const top = page.getByRole("button", { name: /Top match Quiz fixture 1/ });
    const topBox = await top.boundingBox();
    assert.ok(
      topBox && topBox.y >= 0 && topBox.y + topBox.height <= height,
      "Top recommendation is in the first viewport",
    );
    if (outputDir)
      await page.screenshot({ path: `${outputDir}/results-${width}.png` });
    await top.scrollIntoViewIfNeeded();
    const trigger = await top.elementHandle();
    await top.click();
    await page.getByRole("dialog").waitFor();
    const dialogBox = await page.getByRole("dialog").boundingBox();
    assert.ok(
      dialogBox && dialogBox.width <= width && dialogBox.height <= height,
      "Details dialog fits the viewport",
    );
    const dialogScroller = page
      .getByRole("dialog")
      .locator('[class*="overflow-y-auto"]');
    await dialogScroller.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    );
    assert.ok(
      await page.getByRole("link", { name: "Open full details" }).isVisible(),
    );
    if (outputDir)
      await page.screenshot({ path: `${outputDir}/details-${width}.png` });
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.ok(
      await trigger.evaluate((element) => document.activeElement === element),
      "Focus returns to the originating card",
    );
    assert.notEqual(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    if (width < 1024)
      await page
        .getByText("Your answers · edit your mix", { exact: true })
        .click();
    const answerPanel = page.locator(width < 1024 ? "details" : "aside");
    const answerBounds = await answerPanel.boundingBox();
    const editButtons = await answerPanel
      .getByRole("button", { name: /^Edit / })
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().right),
      );
    assert.ok(
      editButtons.every(
        (right) => right <= answerBounds.x + answerBounds.width + 1,
      ),
      "Answer controls fit inside the panel",
    );
    await page
      .getByRole("heading", { name: "How we matched this", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /^Edit Format:/ }).click();
    await answer(1);
    await page
      .getByRole("button", { name: "Update matches", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Quiz fixture 1", exact: true })
      .waitFor();
    assert.equal(
      submitted[2].answers.find((answer) => answer.category === "format")
        ?.mediaType,
      "tv",
      "One answer can be edited from results",
    );
    assert.deepEqual(
      submitted[2].answers.filter((answer) => answer.category !== "format"),
      submitted[1].answers.filter((answer) => answer.category !== "format"),
      "Unedited randomized answers remain intact",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "No horizontal page overflow",
    );
    assert.deepEqual(errors, [], "No runtime errors");
    await context.close();
    console.log(`Quiz flow passed at ${width}px`);
  }
} finally {
  await browser.close();
}
