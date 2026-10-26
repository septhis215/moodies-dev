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
let authenticated = false;
let failRead = false;
let failWrite = false;
let empty = false;
const submissions = [];
const originalPostId = "00000000-0000-4000-8000-000000000001";
const summary = () => ({ reactionCounts: [], myReaction: null });
const posts = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title:
    index === 0
      ? "Could we have more ways to explore our moods?"
      : `A little feedback about Moodies ${index + 1}`,
  content:
    index === 1
      ? `A long link should stay readable: https://example.test/${"long".repeat(70)}`
      : "I love finding films through the mood wheel. It would be helpful to filter the recommendations by language too. What does everyone think?",
  user:
    index === 1
      ? { ...member, id: "other", username: "longusername".repeat(5) }
      : { ...member, id: "other", username: "Sam" },
  createdAt: "2026-10-26T07:30:00Z",
  replyCount: index === 0 ? 11 : 0,
  ...summary(),
}));
const replies = new Map([
  [
    originalPostId,
    Array.from({ length: 11 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      postId: originalPostId,
      content: `I would find this helpful too. Reply ${index + 1}`,
      user: { ...member, id: "other", username: "Charlie" },
      createdAt: "2026-10-26T07:40:00Z",
      ...summary(),
    })),
  ],
]);
function paginate(items, url, key) {
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 10);
  return {
    [key]: items.slice((page - 1) * limit, page * limit).map((item) => ({
      ...item,
      myReaction: authenticated ? item.myReaction : null,
    })),
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  };
}
await context.route("**/api/**", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const method = req.method();
  if (path.endsWith("/auth/bootstrap") || path.endsWith("/auth/me"))
    return route.fulfill({
      json: {
        user: authenticated ? member : null,
        canRefresh: false,
        watchlist: { movieId: [], seriesId: [] },
        liked: { movieId: [], seriesId: [] },
      },
    });
  const communityPath = path.split("/community/")[1];
  if (!communityPath) return route.fulfill({ json: [] });
  if (
    method === "POST" &&
    (communityPath === "posts" || communityPath.endsWith("/replies"))
  ) {
    const token = req.headers()["x-turnstile-token"];
    assert.match(
      token,
      communityPath === "posts" ? /^fixture:review:/ : /^fixture:reply:/,
    );
    submissions.push(token);
    if (failWrite)
      return route.fulfill({
        status: 400,
        json: {
          message: "Please keep your feedback constructive and respectful.",
        },
      });
    const body = req.postDataJSON();
    const record = {
      ...body,
      id: crypto.randomUUID(),
      user: member,
      createdAt: new Date().toISOString(),
      ...summary(),
    };
    if (communityPath === "posts") {
      record.replyCount = 0;
      posts.unshift(record);
    } else {
      const postId = communityPath.split("/")[1];
      record.postId = postId;
      replies.set(postId, [...(replies.get(postId) || []), record]);
      posts.find((post) => post.id === postId).replyCount++;
    }
    return route.fulfill({ status: 201, json: record });
  }
  if (communityPath.endsWith("/reactions")) {
    const [kind, id] = communityPath.split("/");
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
  if (communityPath === "posts")
    return route.fulfill({ json: paginate(empty ? [] : posts, url, "posts") });
  const postId = communityPath.split("/")[1];
  return route.fulfill({
    json: paginate(replies.get(postId) || [], url, "replies"),
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function open() {
  await page.goto(`${base}/community`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByRole("heading", { name: "Community conversations", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector("[inert], [data-loading-screen]"),
  );
  await page
    .getByRole("status", {
      name: "Loading community conversations",
      exact: true,
    })
    .waitFor({ state: "hidden" });
}
try {
  await open();
  let thread = page.locator(`#post-${originalPostId}`);
  await thread.waitFor();
  assert.equal(sdk.scriptRequests(), 0, "reading must not load CAPTCHA");
  await thread.getByRole("button", { name: "11 replies", exact: true }).click();
  await thread
    .getByText("I would find this helpful too. Reply 1", { exact: true })
    .waitFor();
  await thread
    .getByRole("button", { name: "Next replies", exact: true })
    .click();
  await thread
    .getByText("I would find this helpful too. Reply 11", { exact: true })
    .waitFor();
  await thread.getByRole("button", { name: "Reply", exact: true }).click();
  await thread.getByText("to add your reply.", { exact: false }).waitFor();
  await thread
    .getByRole("button", { name: "React", exact: true })
    .first()
    .click();
  await thread
    .getByText("to react to the conversation.", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Share feedback", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Sign in to post", exact: true })
    .waitFor();

  failRead = true;
  await open();
  await page
    .getByRole("heading", { name: "Couldn't load the community", exact: true })
    .waitFor();
  failRead = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await thread.waitFor();
  empty = true;
  await open();
  await page
    .getByRole("heading", { name: "Start the first conversation", exact: true })
    .waitFor();
  empty = false;
  authenticated = true;
  await open();
  await page
    .getByRole("button", { name: "Share feedback", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Share website feedback" });
  await form
    .getByLabel("Title", { exact: true })
    .fill("  A useful community idea  ");
  await form
    .getByLabel("Your feedback", { exact: true })
    .fill("  Please add a language filter to the mood recommendations.  ");
  await page.evaluate(() => {
    window.__turnstileTestMode = "hang";
  });
  await form
    .getByRole("button", { name: "Post feedback", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Quick security check" });
  await dialog.waitFor();
  await page.locator("[data-turnstile-fixture]").waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await form.getByRole("alert").filter({ hasText: "cancelled" }).waitFor();
  assert.equal(submissions.length, 0);
  assert.match(
    await form.getByLabel("Your feedback", { exact: true }).inputValue(),
    /language filter/,
  );
  await page.evaluate(() => {
    window.__turnstileTestMode = "success";
  });
  failWrite = true;
  await form
    .getByRole("button", { name: "Post feedback", exact: true })
    .click();
  await form.getByRole("alert").filter({ hasText: "constructive" }).waitFor();
  assert.match(
    await form.getByLabel("Title", { exact: true }).inputValue(),
    /useful community/,
  );
  failWrite = false;
  await form
    .getByRole("button", { name: "Post feedback", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A useful community idea", exact: true })
    .waitFor();
  const newId = posts[0].id;
  thread = page.locator(`#post-${newId}`);
  assert.equal(
    posts[0].content,
    "Please add a language filter to the mood recommendations.",
  );
  await thread.getByRole("button", { name: "React", exact: true }).click();
  await thread.getByRole("button", { name: "Like", exact: true }).click();
  await thread.getByRole("button", { name: "Like", exact: true }).waitFor();
  await open();
  await thread.getByRole("button", { name: "Like", exact: true }).waitFor();
  await thread.getByRole("button", { name: "Like", exact: true }).click();
  await thread.getByRole("button", { name: "Love", exact: true }).click();
  await thread.getByRole("button", { name: "Love", exact: true }).click();
  await thread
    .getByRole("group", { name: "Choose a reaction" })
    .getByRole("button", { name: "Love", exact: true })
    .click();
  await thread.getByRole("button", { name: "React", exact: true }).waitFor();
  await thread.getByRole("button", { name: "Reply", exact: true }).click();
  await thread
    .getByLabel("Your reply", { exact: true })
    .fill("I would enjoy this feature too.");
  await thread.getByRole("button", { name: "Post reply", exact: true }).click();
  const reply = thread.getByRole("article", {
    name: "Reply by Alex",
    exact: true,
  });
  await reply.waitFor();
  await reply.getByRole("button", { name: "React", exact: true }).click();
  await reply.getByRole("button", { name: "Love", exact: true }).click();
  await reply.getByRole("button", { name: "Love", exact: true }).waitFor();
  await open();
  await thread.getByRole("button", { name: "1 reply", exact: true }).click();
  await reply.getByRole("button", { name: "Love", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "Community pages", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();

  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await open();
    await page.locator(`#post-${newId}`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `horizontal overflow at ${width}px`,
    );
    assert.ok(
      await page.locator("header .ui-kicker").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return topmost === element || element.contains(topmost);
      }),
      `navigation obscures the hero at ${width}px`,
    );
    if (output && [375, 1440].includes(width))
      await page.screenshot({ path: `${output}/community-${width}.png` });
  }
  const fonts = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector("h1")).fontFamily,
    h2: getComputedStyle(document.querySelector("#community-heading"))
      .fontFamily,
    body: getComputedStyle(document.querySelector("article p")).fontFamily,
    weight: getComputedStyle(document.querySelector("h1")).fontWeight,
  }));
  assert.match(fonts.h1, /Barlow/i);
  assert.match(fonts.h2, /Barlow/i);
  assert.match(fonts.body, /Source Sans 3|Source_Sans_3/i);
  assert.equal(fonts.weight, "700");
  await page
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("link", { name: "Community", exact: true })
    .waitFor();
  assert.equal(
    new Set(submissions).size,
    submissions.length,
    "post and reply writes require fresh proof",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Community passed: guest browsing, sign-in prompts, posts, replies, reaction changes/removal/persistence, pagination, retry, draft preservation, fresh CAPTCHA proof, typography, and 320/375/768/1024/1440px layouts.",
  );
} finally {
  await context.close();
  await browser.close();
}
