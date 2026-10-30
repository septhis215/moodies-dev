import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3000";
const output = process.env.NAV_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  let signedIn = false;
  let logoutRequests = 0;
  let failLogout = false;
  await context.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/bootstrap")) return route.fulfill({ json: {
      user: signedIn ? { id: "navigation-member", username: "Movie explorer", email: "member@example.test" } : null,
      canRefresh: false, watchlist: { movieId: [], seriesId: [] }, liked: { movieId: [], seriesId: [] },
    } });
    if (path.endsWith("/auth/logout")) {
      logoutRequests++;
      if (failLogout) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      signedIn = false;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const openMenu = async width => {
    await page.getByRole("button", { name: width >= 1024 ? "More" : "Open menu", exact: true }).click();
    const trigger = page.locator('button[aria-controls="site-menu"]').filter({ visible: true });
    const dialog = page.getByRole("dialog", { name: "Navigation menu", exact: true });
    await dialog.waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    return { trigger, dialog };
  };
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 1024 ? 740 : 900 });
    await page.goto(`${base}/terms`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("link", { name: /^Sign in(?: to Moodies)?$/ }).filter({ visible: true }).waitFor();
    const { trigger, dialog } = await openMenu(width);
    if (width < 1024) {
      await dialog.getByRole("heading", { name: "Where to next?", exact: true }).waitFor();
      const mobile = dialog.getByRole("navigation", { name: "Mobile navigation", exact: true });
      for (const href of ["/", "/movies", "/tv", "/celeb", "/moods/explore", "/feed", "/community"]) {
        assert.equal(await mobile.locator(`a[href="${href}"]`).filter({ visible: true }).count(), 1);
      }
      assert.equal(await mobile.locator("button[aria-expanded]").count(), 7);
      await mobile.getByRole("button", { name: "Show Movies quick links", exact: true }).click();
      await mobile.getByRole("link", { name: "Box Office Hits", exact: true }).waitFor();
      await mobile.getByRole("button", { name: "Hide Movies quick links", exact: true }).click();
      assert.equal(await mobile.getByRole("link", { name: "Box Office Hits", exact: true }).isVisible(), false);
      assert.equal(await dialog.getByText("Let your mood lead", { exact: true }).isVisible(), false);
    } else {
      for (const href of ["/movies", "/tv", "/", "/trending", "/fresh-off-the-screen", "/coming-soon", "/korean-hits", "/celeb", "/community", "/moods", "/quiz", "/collection", "/watchlist", "/liked"]) {
        assert.ok(await dialog.locator(`a[href="${href}"]`).filter({ visible: true }).count(), `Missing direct destination ${href} at ${width}px`);
      }
      assert.equal(await dialog.locator("button[aria-expanded]").filter({ visible: true }).count(), 0, "Desktop navigation must remain flat");
    }
    const geometry = await dialog.evaluate(element => ({
      left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
      top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom,
      pageWidth: document.documentElement.scrollWidth, nativeModal: element.matches(":modal"),
    }));
    assert.ok(geometry.nativeModal, "Background is not inert behind the navigation dialog");
    assert.ok(geometry.left >= -1 && geometry.right <= width + 1, `Menu overflow at ${width}px`);
    assert.ok(geometry.top >= -1 && geometry.bottom <= page.viewportSize().height + 1, `Menu exceeds viewport at ${width}px`);
    assert.ok(geometry.pageWidth <= width + 1, `Page overflow at ${width}px`);
    for (let index = 0; index < 30; index++) {
      await page.keyboard.press("Tab");
      const focus = await dialog.evaluate(element => ({ inside: element.contains(document.activeElement), active: document.activeElement?.outerHTML.slice(0, 250), open: element.open }));
      assert.equal(focus.inside, true, `Keyboard focus escaped the menu: ${JSON.stringify(focus)}`);
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate(element => document.activeElement === element), true, "Focus did not return to menu trigger");
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden", "Scroll stayed locked");
    await trigger.click();
    await dialog.waitFor();
    if (width >= 1024) {
      const mascot = dialog.locator('img[src*="moodies-mascot"]');
      await mascot.waitFor();
      await page.waitForFunction(() => {
      const image = document.querySelector('#site-menu img[src*="moodies-mascot"]');
      return image?.complete && image.naturalWidth > 0;
      });
    }
    if (output && [390, 1440].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await dialog.evaluate(element => {
        for (const child of element.querySelectorAll('*')) if (child.scrollHeight > child.clientHeight) child.scrollTop = 0;
      });
      await page.screenshot({ path: `${output}/navigation-${width}.png` });
    }
    if (width < 1024) await dialog.getByRole("button", { name: "Show Moods quick links", exact: true }).click();
    await dialog.getByRole("link", { name: "Mood wheel", exact: true }).click();
    await page.waitForURL("**/moods");
    await dialog.waitFor({ state: "hidden" });
    if (width >= 1024) {
      const primary = page.getByRole("navigation", { name: "Primary navigation", exact: true });
      assert.equal(await primary.getByRole("link", { name: "Moods", exact: true }).getAttribute("aria-current"), "location");
      assert.equal(await primary.getByRole("link").count(), 4);
    }
    console.log(`Navigation direct links, responsive geometry, modal keyboard and route dismissal passed at ${width}px.`);
  }
  await page.getByRole("button", { name: "More", exact: true }).click();
  const samePageDialog = page.getByRole("dialog", { name: "Navigation menu", exact: true });
  await samePageDialog.getByRole("link", { name: "Mood wheel", exact: true }).click();
  await samePageDialog.waitFor({ state: "hidden" });

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 420 });
    const { dialog: shortDialog } = await openMenu(width);
    const lastDestination = shortDialog.locator(width < 1024 ? 'a[href="/community"]' : 'a[href="/liked"]').filter({ visible: true });
    await lastDestination.scrollIntoViewIfNeeded();
    const menuBounds = await shortDialog.boundingBox();
    const linkBounds = await lastDestination.boundingBox();
    assert.ok(linkBounds.y >= menuBounds.y && linkBounds.y + linkBounds.height <= menuBounds.y + menuBounds.height, "Lower destinations are unreachable in a short viewport");
    await page.keyboard.press("Escape");
    await shortDialog.waitFor({ state: "hidden" });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/terms`);
  const { dialog } = await openMenu(1440);
  await page.setViewportSize({ width: 390, height: 740 });
  await dialog.waitFor({ state: "hidden" });
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Open search", exact: true }).click();
    const search = page.getByRole(width < 768 ? "searchbox" : "combobox", { name: "Search movies and series", exact: true });
    await search.waitFor();
    await search.fill("journey");
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    assert.equal(await search.inputValue(), "");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open search", exact: true }).waitFor();
  }

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const { dialog: movieMenu } = await openMenu(width);
    await movieMenu.locator('a[href="/movies"]').filter({ visible: true }).click();
    await page.waitForURL("**/movies", { timeout: 120000 });
    await movieMenu.waitFor({ state: "hidden" });
    const { dialog: tvMenu } = await openMenu(width);
    assert.equal(await tvMenu.locator('a[href="/movies"]').filter({ visible: true }).getAttribute("aria-current"), "page");
    if (output) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/navigation-${width}.png` });
    }
    await tvMenu.locator('a[href="/tv"]').filter({ visible: true }).click();
    await page.waitForURL("**/tv", { timeout: 120000 });
    await tvMenu.waitFor({ state: "hidden" });
    const { dialog: currentMenu } = await openMenu(width);
    assert.equal(await currentMenu.locator('a[href="/tv"]').filter({ visible: true }).getAttribute("aria-current"), "page");
    await currentMenu.locator('a[href="/movies"]').filter({ visible: true }).click();
    await page.waitForURL("**/movies", { timeout: 120000 });
    await currentMenu.waitFor({ state: "hidden" });
    console.log(`Movie and TV homepage switching passed at ${width}px.`);
  }
  await page.goto(`${base}/terms`);
  signedIn = true;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const account = page.getByRole("button", { name: "Account", exact: true });
  await account.click();
  const accountLinks = page.getByRole("navigation", { name: "Account", exact: true });
  await accountLinks.waitFor();
  for (const href of ["/profile", "/watchlist", "/liked"]) assert.ok(await accountLinks.locator(`a[href="${href}"]`).count());
  await page.keyboard.press("Escape");
  await accountLinks.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 390, height: 900 });
  const { dialog: memberMobileMenu } = await openMenu(390);
  await memberMobileMenu.getByText("member@example.test", { exact: true }).waitFor();
  await memberMobileMenu.getByRole("button", { name: "Sign out of Moodies", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await memberMobileMenu.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await account.click();
  await accountLinks.waitFor();
  await page.setViewportSize({ width: 1100, height: 900 });
  await accountLinks.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 900 });
  failLogout = true;
  const { dialog: logoutDialog } = await openMenu(1440);
  await logoutDialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await logoutDialog.waitFor({ state: "hidden" });
  await page.getByText("Could not sign out. Please try again.", { exact: true }).waitFor();
  await account.waitFor();
  failLogout = false;
  await account.click();
  await accountLinks.waitFor();
  await accountLinks.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).filter({ visible: true }).waitFor();
  assert.equal(logoutRequests, 2);
  assert.deepEqual(errors, []);
  console.log("Account navigation, logout, and breakpoint cleanup passed.");
} finally { await browser.close(); }
