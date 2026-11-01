import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
import { createRequire } from "node:module";
import { startDetailApi } from "./fixtures/detail-api.mjs";

// Use the existing local detail fixture; no staging accounts or databases are touched.
const require = createRequire(import.meta.url);
require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const {
  achievementSeeds,
} = require("../../../server/src/achievements/achievement-catalog.ts");
const api = await startDetailApi();
const base = process.env.BASE_URL || "http://localhost:3000";
const output = "../output/achievements/browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const errors = [],
  activity = [],
  completions = [];
let mode = "ready",
  watched = false,
  claimed = false,
  acknowledgements = 0,
  failCompletion = true;
const rows = achievementSeeds.map((seed, i) => ({
  achievement: {
    ...seed,
    id: seed.key,
    requiredCount: seed.requiredCount || (seed.key === "all-moods" ? 21 : 1),
    ruleVersion: 1,
  },
  badge: {
    badgeName: seed.badgeName,
    icon: seed.icon,
    rarity: seed.rarity,
    displayOrder: i,
  },
  progress: {
    currentProgress: i === 0 ? 1 : i === 1 ? 4 : 0,
    completionPercentage: i === 0 ? 100 : i === 1 ? 80 : 0,
    unlocked: i === 0,
    unlockedAt: i === 0 ? "2026-11-01T00:00:00Z" : null,
  },
}));
await context.route("https://image.tmdb.org/**", async (route) =>
  route.fulfill({
    contentType: "image/jpeg",
    body: await readFile("public/images/ironmanposter.jpeg"),
  }),
);
await context.route("**/api/achievements/**", async (route) => {
  const req = route.request(),
    path = new URL(req.url()).pathname;
  if (path.endsWith("/me"))
    return route.fulfill(
      mode === "error"
        ? { status: 503, json: { message: "Fixture outage" } }
        : {
            json: {
              status: mode,
              revision: 1,
              pending: false,
              achievements: mode === "ready" ? rows : [],
              totalCount: mode === "ready" ? 40 : 0,
              unlockedCount: 1,
            },
          },
    );
  if (path.endsWith("/notifications/claim")) {
    const notifications = claimed
      ? []
      : [
          {
            id: "fixture-award",
            title: "Mood Starter",
            description: "Your first mood discovery.",
            action: "grant",
          },
        ];
    claimed = true;
    return route.fulfill({
      json: { enabled: true, token: "fixture-token", notifications },
    });
  }
  if (path.endsWith("/acknowledge")) {
    acknowledgements++;
    return route.fulfill({ json: { acknowledged: true } });
  }
  if (path.endsWith("/activity")) {
    activity.push(req.postDataJSON());
    return route.fulfill({ json: { accepted: true } });
  }
  if (path.endsWith("/quiz-completions")) {
    completions.push(req.postDataJSON());
    return route.fulfill(
      failCompletion
        ? { status: 503, json: { message: "Fixture progress outage" } }
        : { json: { counted: true } },
    );
  }
  if (path.includes("/watched/")) {
    if (req.method() === "PUT") watched = req.postDataJSON().active;
    return route.fulfill({ json: { enabled: true, watched } });
  }
  throw new Error(`Unexpected achievement request ${path}`);
});
await context.route("**/api/quiz/recommendations", (route) =>
  route.fulfill({
    json: {
      completionReceipt: "fixture-signed-receipt",
      results: [
        {
          id: 550,
          media_type: "movie",
          title: "Fixture match",
          vote_average: 8,
        },
      ],
    },
  }),
);
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/achievements`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Small discoveries. Big milestones.",
    );
    await expect(page.getByRole("article")).toHaveCount(40);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `No overflow at ${width}`,
    );
    await page
      .getByRole("button", { name: "Nearly there", exact: true })
      .click();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Mood Explorer", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Earned", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.getByRole("button", { name: "All goals", exact: true }).click();
    const category = page.getByRole("button", { name: /Achievement category/ });
    await category.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("article")).toHaveCount(10);
    await expect
      .poll(() =>
        page
          .getByRole("article")
          .first()
          .locator("img")
          .evaluate((image) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${output}/catalogue-${width}.png`,
      fullPage: width === 1440,
    });
  }
  await expect.poll(() => acknowledgements).toBe(1);
  mode = "error";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Progress couldn’t load" }),
  ).toBeVisible();
  mode = "ready";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("article")).toHaveCount(40);
  mode = "disabled";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Achievements are getting ready" }),
  ).toBeVisible();
  mode = "ready";
  await page.goto(`${base}/movies/550`);
  await expect(
    page.getByRole("button", { name: "Mark as watched", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Mark as watched", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Marked as watched", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => activity.filter((entry) => entry.kind === "detail").length, {
      timeout: 10000,
    })
    .toBe(1);
  await page
    .getByRole("button", { name: "Marked as watched", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as watched", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.goto(`${base}/quiz`);
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("group", { name: "Answer choices" })
      .getByRole("button")
      .first()
      .click();
    await page
      .getByRole("button", {
        name: i === 4 ? "Find my matches" : "Continue",
        exact: true,
      })
      .click();
  }
  await expect.poll(() => completions.length).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Your next watch starts here." }),
  ).toBeVisible();
  failCompletion = false;
  await page
    .getByRole("button", { name: "Save quiz progress", exact: true })
    .click();
  await expect.poll(() => completions.length).toBe(2);
  assert.equal(completions[1].attemptId, completions[0].attemptId);
  assert.equal(completions[0].answers.length, 5);
  assert.equal(completions[0].receipt, "fixture-signed-receipt");
  assert.match(completions[0].attemptId, /^[0-9a-f-]{36}$/);
  assert.equal(completions[0].version, "signal-reel-v2");
  api.state.anonymous = true;
  await page.goto(`${base}/achievements`);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS achievement catalogue, responsive layout, filters, failures, watched status, signed quiz completion, notification acknowledgement and guest privacy",
  );
} finally {
  await context.close();
  await browser.close();
  await api.close();
}
