import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputDir = process.env.AUTH_SCREENSHOT_DIR;
if (outputDir) await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const user = { id: "auth-flow-test-user", username: "Moodies_member", email: "member@example.com" };
let authenticated = false;
let failSignup = false;
let failLogin = false;
let failReset = false;
const submissions = [];
const errors = [];
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const payload = route.request().postDataJSON();
  if (path.endsWith("/security/turnstile/status")) return route.fulfill({ json: { verified: true } });
  if (path.endsWith("/auth/bootstrap")) return route.fulfill({ json: { user: authenticated ? user : null, watchlist: { movieId: [], seriesId: [] }, liked: { movieId: [], seriesId: [] } } });
  if (path.endsWith("/auth/signup")) {
    submissions.push({ path, payload });
    if (failSignup) return route.fulfill({ status: 409, json: { message: "This email is already registered." } });
    authenticated = true;
    return route.fulfill({ status: 201, json: { user } });
  }
  if (path.endsWith("/auth/signin")) {
    submissions.push({ path, payload });
    if (failLogin) return route.fulfill({ status: 401, json: { message: "Email or password is incorrect." } });
    authenticated = true;
    return route.fulfill({ json: { user } });
  }
  if (path.endsWith("/auth/request-reset")) {
    submissions.push({ path, payload });
    return route.fulfill({ status: failReset ? 500 : 200, json: { message: failReset ? "Unable to send a recovery code right now." : "If an account exists, a reset code has been sent." } });
  }
  if (path.endsWith("/auth/me/preferences")) {
    submissions.push({ path, payload });
    return route.fulfill({ json: { success: true } });
  }
  if (path.endsWith("/all/batch/trailers")) return route.fulfill({ json: {} });
  return route.fulfill({ json: [] });
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
async function navigate(path) {
  const bootstrap = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/auth/bootstrap"));
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await bootstrap;
  return response;
}
try {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ["signup", "login", "forgot-password"]) {
      const response = await navigate(`/auth/${route}`);
      assert.equal(response.status(), 200);
      await page.getByLabel("Email address", { exact: true }).waitFor();
      const layout = await page.locator(".auth-frame").evaluate((frame) => {
        const rect = frame.getBoundingClientRect();
        return { left: rect.left, right: rect.right, viewport: innerWidth, inputs: [...frame.querySelectorAll("input:not([type=checkbox])")].map((input) => ({ id: input.id, labels: input.labels.length, height: input.getBoundingClientRect().height, fontSize: getComputedStyle(input).fontSize })) };
      });
      assert.ok(layout.left >= 0 && layout.right <= width + 1, `Form overflows at ${width}px`);
      assert.ok(layout.inputs.every((input) => input.id && input.labels > 0 && input.height >= 44 && parseFloat(input.fontSize) >= 16), "Inputs need associated labels and usable mobile sizes");
      assert.equal(await page.locator('.auth-frame [style*="font-family"]').count(), 0);
      if (route !== "forgot-password") {
        await page.getByRole("button", { name: "Show password", exact: true }).click();
        await page.getByRole("button", { name: "Hide password", exact: true }).waitFor();
        assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "text");
        await page.getByRole("button", { name: "Hide password", exact: true }).click();
        await page.getByRole("button", { name: "Show password", exact: true }).waitFor();
        assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "password");
      }
      await page.getByRole("button", { name: route === "signup" ? "Create account" : route === "login" ? "Log in" : "Send reset code", exact: true }).scrollIntoViewIfNeeded();
      if (outputDir && [375, 1440].includes(width)) {
        await page.evaluate(() => document.fonts.ready);
        await page.locator(".auth-brand img").evaluate((img) => img.decode());
        await page.screenshot({ path: `${outputDir}/${route}-${width}.png` });
      }
    }
  }
  console.log("Auth form layouts and password visibility passed at 320, 375, 768 and 1440px.");

  await page.setViewportSize({ width: 375, height: 800 });
  await navigate("/auth/signup");
  await page.getByLabel("Username", { exact: true }).fill("Moodies_member");
  await page.getByLabel("Email address", { exact: true }).fill("Member@Example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-test-password");
  const terms = page.getByRole("link", { name: "Terms and Conditions (opens in a new tab)" });
  const popupPromise = page.waitForEvent("popup");
  await terms.click();
  const termsPage = await popupPromise;
  await termsPage.waitForURL("**/terms");
  assert.ok(termsPage.url().endsWith("/terms"));
  await termsPage.close();
  assert.ok(page.url().endsWith("/auth/signup"));
  assert.equal(await page.getByLabel("Username", { exact: true }).inputValue(), "Moodies_member");
  await page.getByRole("checkbox", { name: "I agree to the Terms & Conditions." }).check();
  failSignup = true;
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "This email is already registered." }).waitFor();
  assert.ok(page.url().endsWith("/auth/signup"));
  failSignup = false;
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL("**/auth/intro");
  await page.getByRole("heading", { name: "Welcome to Moodies", exact: true }).waitFor();
  if (outputDir) await page.screenshot({ path: `${outputDir}/intro-375.png` });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Set up my preferences" }).click();
  await page.waitForURL("**/auth/onboarding");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Comedy", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Finish Setup", exact: true }).click();
  await page.waitForURL(`${baseUrl}/`);
  const signup = submissions.find((submission) => submission.path.endsWith("/signup") && submission.payload);
  assert.equal(signup.payload.email, "member@example.com");
  const preferences = submissions.find((submission) => submission.path.endsWith("/preferences"));
  assert.deepEqual(preferences.payload, { age: 18, preferredGenres: ["Comedy"], preferredLanguages: ["English"] });
  const storedCredentials = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) => value.includes("example-test-password")));
  assert.equal(storedCredentials, false);
  console.log("Email signup → Moodies intro → onboarding → home passed, including Terms navigation and reload.");

  authenticated = false;
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await navigate("/auth/login");
  await page.getByLabel("Email address", { exact: true }).fill("Member@Example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-test-password");
  failLogin = true;
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.locator(".auth-frame").getByRole("alert").waitFor();
  assert.ok(page.url().endsWith("/auth/login"));
  failLogin = false;
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(`${baseUrl}/`);

  await navigate("/auth/forgot-password");
  await page.getByLabel("Email address", { exact: true }).fill("Member@Example.com");
  failReset = true;
  await page.getByRole("button", { name: "Send reset code", exact: true }).click();
  await page.locator(".auth-frame").getByRole("alert").waitFor();
  failReset = false;
  await page.getByRole("button", { name: "Send reset code", exact: true }).click();
  await page.waitForURL("**/auth/verify-code?email=member%40example.com");
  assert.deepEqual(errors, []);
  console.log("Login and password recovery success/error flows passed.");
} finally {
  if (errors.length) console.error("Browser errors:", errors);
  await context.close();
  await browser.close();
}
