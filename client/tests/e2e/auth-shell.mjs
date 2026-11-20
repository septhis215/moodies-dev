import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8787";
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const hint of ["guest", "cookie", "storage", "google", "blocked-storage", "expired", "unavailable", "no-hint"]) {
    const context = await browser.newContext();
    const member = !["guest", "expired", "unavailable"].includes(hint);
    const hidden = !["guest", "no-hint"].includes(hint);
    const errors = [];
    let releaseScripts, releaseBootstrap;
    const scripts = new Promise(resolve => { releaseScripts = resolve; });
    const bootstrap = new Promise(resolve => { releaseBootstrap = resolve; });
    if (["cookie", "blocked-storage", "expired", "unavailable"].includes(hint)) {
      await context.addCookies([{ name: "mood_session", value: "1", url: baseUrl }]);
    }
    await context.addInitScript(hint => {
      if (hint === "storage") localStorage.setItem("moodies:session", "1");
      if (hint === "blocked-storage") Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } });
    }, hint);
    await context.route("**/_next/static/**/*.js", async route => { await scripts; await route.continue(); });
    await context.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/bootstrap")) {
        await bootstrap;
        return route.fulfill({ status: hint === "unavailable" ? 503 : 200, json: {
          user: member ? { id: `shell-${hint}`, username: `Member ${hint}` } : null,
          canRefresh: false, watchlist: { movieId: [], seriesId: [] }, liked: { movieId: [], seriesId: [] },
        } });
      }
      return route.fulfill({ json: [] });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/${hint === "google" ? "?google_login=true" : ""}`, { waitUntil: "commit" });
      await page.waitForFunction(() => Boolean(document.body));
      assert.equal(await page.locator("#moodies-auth-prehide").count(), hidden ? 1 : 0, `${hint}: pre-hydration hint`);
      if (hidden) assert.equal(await page.locator("body > *").first().evaluate(element => getComputedStyle(element).visibility), "hidden");
      const started = page.waitForRequest(request => new URL(request.url()).pathname.endsWith("/auth/bootstrap"));
      releaseScripts();
      await started;
      assert.equal(await page.locator("#moodies-intro-heading").isVisible(), false, `${hint}: guest copy before bootstrap`);
      releaseBootstrap();
      await page.locator(member ? "#curated-picks-heading" : "#moodies-intro-heading").waitFor();
      await page.waitForFunction(() => !document.getElementById("moodies-auth-prehide"));
      if (hint === "google") await page.waitForURL(baseUrl + "/");
      assert.deepEqual(errors, [], `${hint}: browser errors`);
      console.log(`${hint}: static shell and private bootstrap passed`);
    } finally {
      releaseScripts(); releaseBootstrap(); await context.close();
    }
  }
} finally {
  await browser.close();
}
