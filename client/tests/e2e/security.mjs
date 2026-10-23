import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { installMockTurnstile } from "./fixtures/turnstile.mjs";

const base = process.env.BASE_URL || "http://localhost:3107";
const screenshotDir = process.env.SECURITY_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const context = await browser.newContext({
  viewport: { width: 320, height: 800 },
  reducedMotion: "reduce",
});
const sdk = await installMockTurnstile(context);
const submissions = [];
let providerUnavailable = false;
await context.route("**/api/**", async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path.endsWith("/auth/bootstrap"))
    return route.fulfill({ json: { user: null, canRefresh: false } });
  if (path.endsWith("/auth/request-reset")) {
    submissions.push(request.headers()["x-turnstile-token"]);
    assert.match(submissions.at(-1), /^fixture:password_reset:/);
    return route.fulfill({
      status: providerUnavailable ? 503 : 200,
      json: {
        code: providerUnavailable ? "CAPTCHA_UNAVAILABLE" : undefined,
        message: providerUnavailable
          ? "Security verification is temporarily unavailable."
          : "Reset requested.",
      },
    });
  }
  return route.fulfill({ json: [] });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function openForm() {
  await page.goto(base + "/auth/forgot-password", {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForFunction(
    () => !document.querySelector("[inert], [data-loading-screen]"),
  );
  await page
    .getByLabel("Email address", { exact: true })
    .fill("fixture@example.test");
}
const submit = () =>
  page.getByRole("button", { name: "Send reset code", exact: true }).click();
try {
  await openForm();
  assert.equal(
    sdk.scriptRequests(),
    0,
    "ordinary browsing must not load or wait on CAPTCHA",
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.evaluate(() => {
    window.__turnstileTestMode = "hang";
  });
  await submit();
  const dialog = page.getByRole("dialog", { name: "Quick security check" });
  await dialog.waitFor();
  await page.locator("[data-turnstile-fixture]").waitFor();
  if (screenshotDir)
    await page.screenshot({ path: `${screenshotDir}/captcha-320.png` });
  assert.equal(submissions.length, 0);
  const layout = await dialog.evaluate((element) => ({
    width: element.scrollWidth,
    viewport: innerWidth,
    right: element.getBoundingClientRect().right,
  }));
  assert.ok(
    layout.width <= layout.viewport && layout.right <= layout.viewport,
    "CAPTCHA must fit a 320px viewport",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(submissions.length, 0, "cancelling must not send a mutation");
  await page
    .locator(".auth-frame")
    .getByRole("alert")
    .filter({ hasText: "cancelled" })
    .waitFor();

  await page.clock.install();
  await submit();
  await page.locator("[data-turnstile-fixture]").waitFor();
  await page.clock.fastForward(16_000);
  await page
    .getByRole("status")
    .filter({ hasText: "taking longer than expected" })
    .waitFor();
  await page.evaluate(() => {
    window.__turnstileTestMode = "success";
  });
  await page
    .getByRole("button", { name: "Try security check again", exact: true })
    .click();
  await page.clock.resume();
  await page.waitForURL("**/auth/verify-code?email=fixture%40example.test");
  assert.equal(submissions.length, 1);

  await openForm();
  await page.evaluate(() => {
    window.__turnstileTestMode = "error";
  });
  await submit();
  await dialog
    .getByRole("alert")
    .filter({ hasText: "could not load" })
    .waitFor();
  assert.equal(submissions.length, 1);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.evaluate(() => {
    window.__turnstileTestMode = "success";
  });
  providerUnavailable = true;
  await submit();
  await page.locator(".auth-frame").getByRole("alert").waitFor();
  assert.match(
    await page.locator(".auth-frame").getByRole("alert").innerText(),
    /Security verification is temporarily unavailable/,
  );
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "provider errors must return to a usable form",
  );
  providerUnavailable = false;
  await submit();
  await page.waitForURL("**/auth/verify-code?email=fixture%40example.test");
  assert.equal(submissions.length, 3);
  assert.equal(
    new Set(submissions).size,
    3,
    "each operation must use fresh proof",
  );
  assert.deepEqual(errors, []);

  // A failed SDK download must be recoverable without reloading the whole page.
  const retryContext = await browser.newContext();
  await installMockTurnstile(retryContext, { failFirstScript: true });
  await retryContext.route("**/api/**", (route) =>
    route.fulfill({ json: { user: null, canRefresh: false } }),
  );
  const retryPage = await retryContext.newPage();
  await retryPage.goto(base + "/auth/forgot-password", {
    waitUntil: "networkidle",
  });
  await retryPage.waitForFunction(
    () => !document.querySelector("[inert], [data-loading-screen]"),
  );
  await retryPage
    .getByLabel("Email address", { exact: true })
    .fill("fixture@example.test");
  await retryPage
    .getByRole("button", { name: "Send reset code", exact: true })
    .click();
  await retryPage.getByRole("dialog").getByRole("alert").waitFor();
  await retryPage
    .getByRole("button", { name: "Try security check again", exact: true })
    .click();
  await retryPage.waitForURL(
    "**/auth/verify-code?email=fixture%40example.test",
  );
  await retryContext.close();
  console.log(
    "CAPTCHA browser checks passed: public browsing, 320px layout, cancellation, slow checks, widget errors, server errors, fresh proof and SDK-download recovery.",
  );
} finally {
  await context.close();
  await browser.close();
}
