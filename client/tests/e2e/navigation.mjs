import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3000";
const output = process.env.NAV_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
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
  const checkLabelHover = async (link) => {
    const getStyle = (element) => {
      const { backgroundColor, borderTopWidth } = getComputedStyle(element);
      const label = element.querySelector(".ui-text-reveal");
      return { backgroundColor, borderTopWidth, position: getComputedStyle(label).backgroundPositionX, underlineWidth: parseFloat(getComputedStyle(label, "::after").width) };
    };
    await page.mouse.move(0, 0);
    const before = await link.evaluate(getStyle);
    await link.hover();
    const after = await link.evaluate(getStyle);
    assert.equal(after.backgroundColor, before.backgroundColor);
    assert.equal(after.borderTopWidth, "0px");
    assert.equal(before.underlineWidth, 0);
    assert.ok(after.underlineWidth > 0);
    assert.equal(before.position, "100%");
    assert.equal(parseFloat(after.position), 0);
  };
  const openMenu = async width => {
    await page.getByRole("button", { name: width >= 1024 ? "More" : "Open menu", exact: true }).click();
    const trigger = page.locator('button[aria-controls="site-menu"]').filter({ visible: true });
    const dialog = page.getByRole("dialog", { name: "Navigation menu", exact: true });
    await dialog.waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    return { trigger, dialog };
  };
  const checkHomepageBackground = async () => {
    const background = await page.locator(".homepage-browse").evaluate((section) => {
      const pageStyle = getComputedStyle(section.parentElement);
      const sectionStyle = getComputedStyle(section);
      return { pageColor: pageStyle.backgroundColor, sectionColor: sectionStyle.backgroundColor, image: sectionStyle.backgroundImage };
    });
    assert.equal(background.sectionColor, background.pageColor);
    assert.equal(background.image, "none");
    assert.equal(await page.getByRole("navigation", { name: "Browse this page" }).count(), 0);
  };
  const checkPopulatedHero = async (title, nextTitle) => {
    const hero = page.getByRole("region", { name: title, exact: true });
    await hero.getByRole("button", { name: "Next featured title" }).click();
    await hero.getByRole("heading", { name: nextTitle, exact: true }).waitFor();
    const posters = hero.getByRole("group", { name: "Featured posters" });
    assert.equal(await posters.getByRole("button").first().getAttribute("aria-pressed"), "false");
    assert.equal(await posters.getByRole("button").nth(1).getAttribute("aria-pressed"), "true");
    await hero.getByRole("button", { name: "Previous featured title" }).click();
  };
  const checkUpcoming = async (title, route) => {
    const section = page.getByRole("region", { name: title, exact: true });
    await section.getByRole("heading", { name: "Featured releases" }).waitFor();
    const featured = section.locator(`a.aspect-video[href^="${route}/"]`);
    assert.equal(await featured.count(), 3);
    const card = await featured.first().boundingBox();
    assert.ok(card.width > card.height);
    const month = section.getByRole("button", { name: "January 2027" });
    assert.equal(await month.getAttribute("aria-pressed"), "true");
    await section.getByRole("heading", { name: "Release schedule" }).waitFor();
    const week = section.locator("details").first();
    await week.locator("article").first().waitFor();
    await week.locator("summary").click();
    await week.locator("article").first().waitFor({ state: "hidden" });
    await week.locator("summary").click();
    await week.getByRole("button", { name: /Add .* to My List/ }).first().waitFor();
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base, { waitUntil: "load" });
    await checkHomepageBackground();
    if (width >= 1024) {
      await checkLabelHover(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Movies" }));
    }
    const { trigger, dialog } = await openMenu(width);
    if (width >= 1024) {
      const mask = await trigger.evaluate((button) => getComputedStyle(button.closest(".z-\\[999\\]")).maskImage);
      assert.equal(mask, "none", "The landing navbar should fade the artwork without masking the controls");
      await checkLabelHover(dialog.getByRole("link", { name: "Movies", exact: true }));
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 1024 ? 740 : 900 });
    await page.goto(`${base}/terms`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("link", { name: /^Sign in(?: to Moodies)?$/ }).filter({ visible: true }).waitFor();
    const { trigger, dialog } = await openMenu(width);
    const shortcuts = dialog.getByRole("list", { name: "Main destinations" });
    assert.deepEqual(await shortcuts.getByRole("link").allTextContents(), ["Movies", "TV shows", "Explore moods", "Video feed"]);
    const library = dialog.getByRole("region", { name: "Your library" });
    assert.deepEqual(await library.getByRole("link").allTextContents(), ["Collection", "Watchlist", "Liked titles"]);
    assert.equal(await dialog.getByRole("region", { name: "People & community" }).getByRole("link", { name: "Discussions" }).getAttribute("href"), "/community");
    if (width < 1024) assert.equal((await trigger.textContent()).trim(), "Menu");
    for (const href of ["/", "/movies", "/tv", "/moods/explore", "/feed", "/trending", "/fresh-off-the-screen", "/coming-soon", "/korean-hits", "/celeb", "/community", "/moods", "/quiz", "/collection", "/watchlist", "/liked"]) {
      assert.equal(await dialog.locator(`a[href="${href}"]`).filter({ visible: true }).count(), 1, `Expected one direct link to ${href} at ${width}px`);
    }
    assert.equal(await dialog.locator("button[aria-expanded]").count(), 0, "Navigation links must remain flat");
    const geometry = await dialog.evaluate(element => ({
      left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
      top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom,
      pageWidth: document.documentElement.scrollWidth, nativeModal: element.matches(":modal"),
    }));
    assert.ok(geometry.nativeModal, "Background is not inert behind the navigation dialog");
    assert.ok(geometry.left >= -1 && geometry.right <= width + 1, `Menu overflow at ${width}px`);
    assert.ok(geometry.top >= -1 && geometry.bottom <= page.viewportSize().height + 1, `Menu exceeds viewport at ${width}px`);
    if (width >= 1024) {
      assert.ok(geometry.bottom - geometry.top < 500, "Desktop menu should fit its links");
    }
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
    if (output && [390, 1440].includes(width)) {
      await page.evaluate(() => document.fonts.ready);
      await dialog.evaluate(element => {
        for (const child of element.querySelectorAll('*')) if (child.scrollHeight > child.clientHeight) child.scrollTop = 0;
      });
      await page.screenshot({ path: `${output}/navigation-${width}.png` });
    }
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
    const lastDestination = shortDialog.getByRole("link", { name: "Create account", exact: true });
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
    await page.getByRole("heading", { name: "Movies", exact: true, level: 1 }).waitFor();
    await checkHomepageBackground();
    if (process.env.HOMEPAGE_FIXTURES) {
      for (const id of ["new-release-movies", "popular-movies", "trending-movies", "korean-movies", "action-movies", "award-winners", "animated-movies", "indie-movies"]) {
        await page.locator(`#${id} a[href^="/movies/"]`).first().waitFor();
      }
      await checkPopulatedHero("Movies", "Movie 2");
      await checkUpcoming("Coming to Theaters", "/movies");
    }
    const { dialog: tvMenu } = await openMenu(width);
    assert.equal(await tvMenu.locator('a[href="/movies"]').filter({ visible: true }).getAttribute("aria-current"), "page");
    if (output) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/navigation-${width}.png` });
    }
    await tvMenu.locator('a[href="/tv"]').filter({ visible: true }).click();
    await page.waitForURL("**/tv", { timeout: 120000 });
    await tvMenu.waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "TV shows", exact: true, level: 1 }).waitFor();
    await checkHomepageBackground();
    if (process.env.HOMEPAGE_FIXTURES) {
      await page.locator("#trending-tv article").first().waitFor();
      await checkPopulatedHero("TV shows", "Series 2");
      await checkUpcoming("Premiering soon", "/tv");
    }
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
  await account.click();
  await accountLinks.getByText("Movie explorer", { exact: true }).waitFor();
  await accountLinks.getByRole("button", { name: "Sign out", exact: true }).waitFor();
  const mobileAccountBounds = await accountLinks.boundingBox();
  assert.ok(mobileAccountBounds.x >= 0 && mobileAccountBounds.x + mobileAccountBounds.width <= 390);
  await page.keyboard.press("Escape");
  await accountLinks.waitFor({ state: "hidden" });
  assert.ok(await account.evaluate(element => element === document.activeElement));
  await page.setViewportSize({ width: 1440, height: 900 });
  await account.click();
  await accountLinks.waitFor();
  await page.setViewportSize({ width: 1100, height: 900 });
  await accountLinks.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 900 });
  failLogout = true;
  await account.click();
  await accountLinks.getByRole("button", { name: "Sign out", exact: true }).click();
  await accountLinks.waitFor({ state: "hidden" });
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
