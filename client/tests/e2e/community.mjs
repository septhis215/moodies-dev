import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { installMockTurnstile } from "./fixtures/turnstile.mjs";

const base = process.env.BASE_URL || "http://localhost:3000";
const output = process.env.COMMUNITY_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const context = await browser.newContext({ reducedMotion: "reduce" });
const sdk = await installMockTurnstile(context);
const member = { id: "member", username: "Alex", avatarUrl: null };
let authenticated = false,
  failRead = false,
  failWrite = false,
  empty = false;
const submissions = [];
const firstId = "00000000-0000-4000-8000-000000000001";
const firstTitle = "Could we have more ways to explore our moods?";
const summary = () => ({ reactionCounts: [], myReaction: null });
const posts = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title:
    index === 0
      ? firstTitle
      : [
          "A small idea for the watchlist",
          "The mood wheel helped me find something new",
          "What would make recommendations better for you?",
          "A thought about searching for TV shows",
        ][index % 4],
  content:
    index === 1
      ? `A long link should stay readable: https://example.test/${"long".repeat(70)}`
      : "I love finding films through the mood wheel. It would be helpful to filter the recommendations by language too. What does everyone think?",
  user: {
    ...member,
    id: "other",
    username: index === 1 ? "longusername".repeat(5) : "Sam",
  },
  createdAt: "2026-10-26T07:30:00Z",
  replyCount: index === 0 ? 11 : 0,
  ...summary(),
}));
const replies = new Map([
  [
    firstId,
    Array.from({ length: 11 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      postId: firstId,
      content: `I would find this helpful too. Reply ${index + 1}`,
      user: { ...member, id: "other", username: "Charlie" },
      createdAt: "2026-10-26T08:40:00Z",
      ...summary(),
    })),
  ],
]);
const present = (record) => ({
  ...record,
  myReaction: authenticated ? record.myReaction : null,
});
function paginate(items, url, key) {
  const page = Number(url.searchParams.get("page") || 1),
    limit = Number(url.searchParams.get("limit") || 10);
  return {
    [key]: items.slice((page - 1) * limit, page * limit).map(present),
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  };
}
const routeApi = async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    method = req.method();
  if (url.pathname.endsWith("/auth/signin")) {
    authenticated = true;
    return route.fulfill({ json: { user: member } });
  }
  if (
    url.pathname.endsWith("/auth/bootstrap") ||
    url.pathname.endsWith("/auth/me")
  )
    return route.fulfill({
      json: {
        user: authenticated ? member : null,
        canRefresh: false,
        watchlist: { movieId: [], seriesId: [] },
        liked: { movieId: [], seriesId: [] },
      },
    });
  const path = url.pathname.split("/community/")[1];
  if (!path) return route.fulfill({ json: [] });
  if (method === "POST" && (path === "posts" || path.endsWith("/replies"))) {
    const token = req.headers()["x-turnstile-token"];
    assert.match(
      token,
      path === "posts" ? /^fixture:review:/ : /^fixture:reply:/,
    );
    submissions.push(token);
    if (failWrite)
      return route.fulfill({
        status: 400,
        json: {
          message: "Please keep your feedback constructive and respectful.",
        },
      });
    const record = {
      ...req.postDataJSON(),
      id: crypto.randomUUID(),
      user: member,
      createdAt: new Date().toISOString(),
      ...summary(),
    };
    if (path === "posts") {
      record.replyCount = 0;
      posts.unshift(record);
    } else {
      record.postId = path.split("/")[1];
      replies.set(record.postId, [
        ...(replies.get(record.postId) || []),
        record,
      ]);
      posts.find((post) => post.id === record.postId).replyCount++;
    }
    return route.fulfill({ status: 201, json: record });
  }
  if (path.endsWith("/reactions")) {
    const [kind, id] = path.split("/");
    const item =
      kind === "posts"
        ? posts.find((post) => post.id === id)
        : [...replies.values()].flat().find((reply) => reply.id === id);
    item.myReaction = method === "DELETE" ? null : req.postDataJSON().type;
    item.reactionCounts = item.myReaction
      ? [{ type: item.myReaction, count: 1 }]
      : [];
    return route.fulfill({
      json: {
        myReaction: item.myReaction,
        reactionCounts: item.reactionCounts,
      },
    });
  }
  if (failRead)
    return route.fulfill({
      status: 503,
      json: { message: "Fixture unavailable" },
    });
  if (path === "posts") {
    const search = (url.searchParams.get("search") || "").toLowerCase(),
      filter = url.searchParams.get("filter");
    const matching = (empty ? [] : posts).filter(
      (post) =>
        `${post.title} ${post.content}`.toLowerCase().includes(search) &&
        (filter !== "unanswered" || post.replyCount === 0) &&
        (filter !== "mine" || post.user.id === member.id),
    );
    if (url.searchParams.get("sort") === "most-replies")
      matching.sort((a, b) => b.replyCount - a.replyCount);
    return route.fulfill({
      json: paginate(
        matching.map((post) => ({
          ...post,
          latestReply: replies.get(post.id)?.at(-1) ?? null,
        })),
        url,
        "posts",
      ),
    });
  }
  const postId = path.split("/")[1],
    post = posts.find((item) => item.id === postId);
  if (!post)
    return route.fulfill({
      status: 404,
      json: { message: "Discussion not found" },
    });
  return route.fulfill({
    json: path.endsWith("/replies")
      ? paginate(replies.get(postId) || [], url, "replies")
      : present(post),
  });
};
await context.route("**/api/**", routeApi);
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function openIndex(suffix = "") {
  await page.goto(`${base}/community${suffix}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByRole("heading", { name: "Community", exact: true }).waitFor();
  await page
    .getByRole("status", { name: "Loading discussions", exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => !document.querySelector("[inert], [data-loading-screen]"),
  );
}
async function openTopic(id, title) {
  await page.goto(`${base}/community/${id}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
}
try {
  await openIndex();
  const topics = page.getByRole("list", {
    name: "Community topics",
    exact: true,
  });
  await topics.waitFor();
  assert.equal(await topics.locator(":scope > li").count(), 10);
  assert.equal(
    await topics.getByRole("button", { name: "React", exact: true }).count(),
    0,
  );
  assert.equal(
    await topics
      .locator(":scope > li")
      .first()
      .getByText(posts[0].content, { exact: true })
      .count(),
    1,
  );
  assert.equal(sdk.scriptRequests(), 0);
  await topics.getByRole("link", { name: firstTitle, exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/community/${firstId}`);
  assert.equal(new URL(page.url()).searchParams.get("from"), `/community#topic-${firstId}`);
  await page.getByRole("heading", { name: firstTitle, exact: true }).waitFor();
  await page
    .getByText("I would find this helpful too. Reply 1", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Next replies", exact: true }).click();
  await page
    .getByText("I would find this helpful too. Reply 11", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByText("I would find this helpful too. Reply 11", { exact: true })
    .waitFor();
  const original = page.getByRole("article", {
    name: "Original post by Sam",
    exact: true,
  });
  await original.getByRole("button", { name: "React", exact: true }).click();
  await original
    .getByText("to react to the conversation.", { exact: false })
    .waitFor();
  const reactionSignIn = new URL(await original.getByRole("link", { name: "Sign in", exact: true }).getAttribute("href"), base);
  assert.match(reactionSignIn.searchParams.get("returnTo"), new RegExp(`/community/${firstId}`));
  await page
    .getByRole("button", { name: "Reply to topic", exact: true })
    .click();
  await page.getByText("to add your reply.", { exact: false }).waitFor();
  await page
    .getByRole("link", { name: "Back to discussions", exact: true })
    .click();
  await topics.waitFor();
  await page
    .getByRole("navigation", { name: "Discussion views", exact: true })
    .getByRole("link", { name: "Awaiting replies", exact: true })
    .click();
  await topics
    .getByRole("link", { name: firstTitle, exact: true })
    .waitFor({ state: "hidden" });
  await page.getByText("11 topics", { exact: true }).waitFor();
  await openIndex();
  await page
    .getByLabel("Search discussions", { exact: true })
    .fill("long link");
  await page
    .getByRole("search", { name: "Search community discussions" })
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await page
    .getByText('1 topic matching "long link"', { exact: true })
    .waitFor();
  assert.equal(await topics.locator(":scope > li").count(), 1);
  const filteredTitle = await topics.getByRole("heading").first().innerText();
  const filteredLink = topics.getByRole("link", { name: filteredTitle, exact: true });
  const filteredDestination = new URL(await filteredLink.getAttribute("href"), base);
  const listReturn = filteredDestination.searchParams.get("from");
  assert.match(listReturn, /^\/community\?search=long\+link#topic-/);
  await filteredLink.click();
  await page.getByRole("heading", { name: filteredTitle, exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to discussions", exact: true }).last().click();
  await topics.waitFor();
  assert.equal(`${new URL(page.url()).pathname}${new URL(page.url()).search}${new URL(page.url()).hash}`, listReturn);
  assert.equal(await page.getByLabel("Search discussions", { exact: true }).inputValue(), "long link");
  await openIndex();
  const sortTrigger = page.getByRole("button", { name: /^Sort discussions:/ });
  const sortMenu = page.getByRole("listbox", { name: "Sort discussions", exact: true });
  await sortTrigger.click();
  await sortMenu.waitFor();
  const triggerBox = await sortTrigger.boundingBox();
  const menuBox = await sortMenu.boundingBox();
  assert.ok(Math.abs(triggerBox.width - menuBox.width) <= 1, "Sort popup must match trigger width");
  assert.ok(Math.abs(triggerBox.x - menuBox.x) <= 1, "Sort popup must align to its trigger");
  await page.keyboard.press("Escape");
  await sortMenu.waitFor({ state: "hidden" });
  assert.ok(await sortTrigger.evaluate((element) => document.activeElement === element));
  await sortTrigger.press("ArrowDown");
  await page.keyboard.press("m");
  assert.ok(await sortMenu.getByRole("option", { name: "Most replies", exact: true }).evaluate((element) => document.activeElement === element));
  await page.keyboard.press("Enter");
  await page.waitForURL(/sort=most-replies/);
  await page
    .getByRole("navigation", { name: "Discussion pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  await openIndex("?filter=mine");
  await page
    .getByText("Sign in to see the discussions you have started.", {
      exact: true,
    })
    .waitFor();
  failRead = true;
  await openIndex();
  await page
    .getByRole("heading", { name: "Couldn't load discussions", exact: true })
    .waitFor();
  failRead = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await topics.waitFor();
  empty = true;
  await openIndex();
  await page
    .getByRole("heading", {
      name: "The first topic could be yours",
      exact: true,
    })
    .waitFor();
  await page
    .locator("main > header")
    .getByRole("button", { name: "Start a discussion", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Sign in to post", exact: true })
    .waitFor();
  const postSignIn = new URL(await page.getByRole("link", { name: "Sign in to post", exact: true }).getAttribute("href"), base);
  assert.equal(postSignIn.searchParams.get("returnTo"), "/community?compose=1");
  empty = false;
  authenticated = true;
  await openIndex();
  await topics.waitFor();
  await page.getByRole("button", { name: /What's your comfort rewatch/ }).click();
  const form = page.getByRole("form", { name: "Start a discussion" });
  assert.equal(await form.getByLabel("Discussion title", { exact: true }).inputValue(), "What's your comfort rewatch?");
  await form
    .getByLabel("Discussion title", { exact: true })
    .fill("  A useful community idea  ");
  await form
    .getByLabel("Your thoughts", { exact: true })
    .fill("  Please add a language filter to the mood recommendations.  ");
  const postDraftKey = "moodies:community-draft:member:new";
  await page.waitForFunction((key) => sessionStorage.getItem(key)?.includes("language filter"), postDraftKey);
  await form.getByRole("button", { name: "Save for later", exact: true }).click();
  await page.getByRole("button", { name: /What did you watch that stayed with you/ }).click();
  assert.equal(await form.getByLabel("Discussion title", { exact: true }).inputValue(), "  A useful community idea  ");
  assert.match(await form.getByLabel("Your thoughts", { exact: true }).inputValue(), /language filter/);
  await page.reload();
  await form.waitFor();
  assert.equal(await form.getByLabel("Discussion title", { exact: true }).inputValue(), "  A useful community idea  ");
  assert.match(await form.getByLabel("Your thoughts", { exact: true }).inputValue(), /language filter/);
  await page.evaluate(() => {
    window.__turnstileTestMode = "hang";
  });
  await form.getByRole("button", { name: "Post discussion", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Quick security check" });
  await dialog.waitFor();
  await page.locator("[data-turnstile-fixture]").waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await form.getByRole("alert").filter({ hasText: "cancelled" }).waitFor();
  assert.equal(submissions.length, 0);
  assert.match(
    await form.getByLabel("Your thoughts", { exact: true }).inputValue(),
    /language filter/,
  );
  await page.evaluate(() => {
    window.__turnstileTestMode = "success";
  });
  failWrite = true;
  await form.getByRole("button", { name: "Post discussion", exact: true }).click();
  await form.getByRole("alert").filter({ hasText: "constructive" }).waitFor();
  assert.match(await form.getByLabel("Your thoughts", { exact: true }).inputValue(), /language filter/);
  failWrite = false;
  await form.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page
    .getByRole("heading", { name: "A useful community idea", exact: true })
    .waitFor();
  const newId = posts[0].id;
  await page.waitForURL((url) => url.pathname === `/community/${newId}`);
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), postDraftKey), null);
  const newPost = page.getByRole("article", {
    name: "Original post by Alex",
    exact: true,
  });
  const reactionPicker = newPost.getByRole("group", {
    name: "Choose a reaction",
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole("heading", { name: "A useful community idea", exact: true }).click();
  const activeBeforeHover = await page.evaluateHandle(() => document.activeElement);
  await newPost.getByRole("button", { name: "React", exact: true }).hover();
  await reactionPicker.waitFor();
  assert.equal(await page.evaluate((element) => document.activeElement === element, activeBeforeHover), true, "Hover must not move keyboard focus");
  await activeBeforeHover.dispose();
  assert.equal(await reactionPicker.getByRole("button").count(), 6);
  await page.getByRole("heading", { name: "A useful community idea", exact: true }).hover();
  await reactionPicker.waitFor({ state: "hidden" });
  await newPost.getByRole("button", { name: "React", exact: true }).click();
  await reactionPicker.waitFor();
  assert.equal(
    await reactionPicker
      .getByRole("button", { name: "Like", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await reactionPicker.waitFor({ state: "hidden" });
  assert.equal(
    await newPost
      .getByRole("button", { name: "React", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await newPost.getByRole("button", { name: "React", exact: true }).click();
  await page
    .getByRole("heading", { name: "A useful community idea", exact: true })
    .click();
  await reactionPicker.waitFor({ state: "hidden" });
  await newPost.getByRole("button", { name: "React", exact: true }).click();
  await newPost.getByRole("button", { name: "Like", exact: true }).click();
  await newPost.locator('[aria-label="Like: 1"]').waitFor();
  await openTopic(newId, "A useful community idea");
  await newPost.getByRole("button", { name: "Like", exact: true }).click();
  await newPost.getByRole("button", { name: "Love", exact: true }).click();
  await newPost.getByRole("button", { name: "Love", exact: true }).click();
  await newPost
    .getByRole("group", { name: "Choose a reaction" })
    .getByRole("button", { name: "Love", exact: true })
    .click();
  await newPost.getByRole("button", { name: "React", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Reply to topic", exact: true })
    .click();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("I would enjoy this feature too.");
  await page.waitForFunction((key) => sessionStorage.getItem(key)?.includes("I would enjoy this feature too."), `moodies:community-draft:member:${newId}`);
  await page.reload();
  await page.getByLabel("Your reply", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Your reply", { exact: true }).inputValue(), "I would enjoy this feature too.");
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  const reply = page.getByRole("article", {
    name: "Reply by Alex",
    exact: true,
  });
  await reply.waitFor();
  await reply.getByRole("button", { name: "React", exact: true }).click();
  await reply.getByRole("button", { name: "Love", exact: true }).click();
  await openTopic(newId, "A useful community idea");
  await reply.getByRole("button", { name: "Love", exact: true }).waitFor();
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), `moodies:community-draft:member:${newId}`), null);
  const touchContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    await touchContext.route("**/api/**", routeApi);
    const touchPage = await touchContext.newPage();
    await touchPage.goto(`${base}/community/${newId}`, { waitUntil: "domcontentloaded" });
    const touchPost = touchPage.getByRole("article", { name: "Original post by Alex", exact: true });
    const touchTrigger = touchPost.getByRole("button", { name: "React", exact: true });
    await touchTrigger.waitFor();
    await touchPage.waitForFunction(() => !document.querySelector("[inert], [data-loading-screen]"));
    await touchTrigger.tap();
    const touchPicker = touchPost.getByRole("group", { name: "Choose a reaction" });
    await touchPicker.waitFor();
    assert.equal(await touchPicker.getByRole("button").count(), 6);
    assert.ok(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await touchPicker.getByRole("button", { name: "Love", exact: true }).tap();
    await touchPost.locator('[aria-label="Love: 1"]').waitFor();
    await touchPicker.waitFor({ state: "hidden" });
    await touchPage.goto(`${base}/community`, { waitUntil: "domcontentloaded" });
    await touchPage.getByRole("button", { name: /^Sort discussions:/ }).tap();
    await touchPage.getByRole("option", { name: "Most replies", exact: true }).tap();
    await touchPage.waitForURL(/sort=most-replies/);
  } finally {
    await touchContext.close();
  }
  if (output) {
    for (const width of [375, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await reply.getByRole("button", { name: "Love", exact: true }).click();
      const picker = reply.getByRole("group", { name: "Choose a reaction" });
      await picker.waitFor();
      await picker.screenshot({ path: `${output}/reaction-picker-${width}.png` });
      assert.equal(
        await picker
          .getByRole("button", { name: "Love", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page
        .locator("main")
        .last()
        .screenshot({ path: `${output}/discussion-reactions-${width}.png` });
      await page.keyboard.press("Escape");
    }
  }
  await openIndex("?compose=1");
  await form.waitFor();
  await form.getByLabel("Discussion title", { exact: true }).fill("A draft to discard");
  await form.getByRole("button", { name: "Discard draft", exact: true }).click();
  await form.getByRole("group", { name: "Discard draft?", exact: true })
    .getByRole("button", { name: "Discard draft", exact: true }).click();
  assert.equal(await form.getByLabel("Discussion title", { exact: true }).inputValue(), "");
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), postDraftKey), null);
  await openIndex("?filter=mine");
  await page.getByText("1 topic", { exact: true }).waitFor();
  await page.goto(`${base}/community/00000000-0000-4000-8000-000000000099`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Discussion unavailable", exact: true })
    .waitFor();
  authenticated = false;
  await openTopic(newId, "A useful community idea");
  await page.getByRole("link", { name: "Sign in to reply", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector("[inert], [data-loading-screen]"));
  await page.getByLabel("Email address", { exact: true }).fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/community/${newId}` && url.hash === "#join-discussion");
  await page.getByLabel("Your reply", { exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA");
  for (const width of [320, 375, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1000 });
    await openIndex();
    await topics.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await sortTrigger.click();
    await sortMenu.waitFor();
    const popup = await sortMenu.boundingBox();
    const control = await sortTrigger.boundingBox();
    assert.ok(Math.abs(popup.width - control.width) <= 1);
    assert.ok(popup.x >= 0 && popup.x + popup.width <= width + 1, `sort popup overflow at ${width}px`);
    if (output && [375, 1366].includes(width)) await page.screenshot({ path: `${output}/forum-sort-${width}.png` });
    await page.keyboard.press("Escape");
    if (width <= 375) {
      assert.ok(
        (await page.locator("main > header").boundingBox()).height < 350,
        `Community introduction is too tall at ${width}px`,
      );
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `index overflow at ${width}px`,
    );
    if (output && [375, 1366, 1440].includes(width))
      await page.screenshot({ path: `${output}/forum-index-${width}.png` });
    await openTopic(posts[2].id, posts[2].title);
    await page.getByRole("article").first().waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `discussion overflow at ${width}px`,
    );
    if (output && [375, 1366, 1440].includes(width))
      await page.screenshot({ path: `${output}/forum-topic-${width}.png` });
  }
  const fonts = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector("h1")).fontFamily,
    body: getComputedStyle(document.querySelector("article p")).fontFamily,
    weight: getComputedStyle(document.querySelector("h1")).fontWeight,
  }));
  assert.match(fonts.title, /Barlow/i);
  assert.match(fonts.body, /Source Sans 3|Source_Sans_3/i);
  assert.equal(fonts.weight, "700");
  assert.equal(new Set(submissions).size, submissions.length);
  assert.deepEqual(errors, []);
  console.log(
    "Forum passed: discussion cards, dedicated links, search, unanswered/personal views, sorting, pagination, posts, replies, reactions, drafts, CAPTCHA, typography and index/discussion layouts at 320/375/768/1024/1366/1440px.",
  );
} catch (error) {
  if (output) await page.screenshot({ path: `${output}/forum-failure.png` });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
