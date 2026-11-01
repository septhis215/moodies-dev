import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Real App Router pages with deterministic upstream responses. Live publisher
// ingestion is checked separately against the Nest endpoints.
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = process.env.CELEBRITY_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const now = new Date().toISOString();
const sources = [
  {
    id: "variety",
    name: "Variety",
    url: "https://variety.com",
    status: "stale",
    fetchedAt: now,
  },
  {
    id: "deadline",
    name: "Deadline",
    url: "https://deadline.com",
    status: "unavailable",
    fetchedAt: null,
  },
  {
    id: "thr",
    name: "The Hollywood Reporter",
    url: "https://www.hollywoodreporter.com",
    status: "ready",
    fetchedAt: now,
  },
];
const articles = [
  {
    id: "1",
    title: "Tom Hanks attends a film festival",
    url: "https://variety.com/2026/film/story/",
    source: "variety",
    publisher: "Variety",
    publishedAt: now,
    topic: "happenings",
  },
  {
    id: "2",
    title: "Zendaya shares a new project",
    url: "https://www.hollywoodreporter.com/2026/film/story/",
    source: "thr",
    publisher: "The Hollywood Reporter",
    publishedAt: now,
    topic: "projects",
  },
];
const people = [
  {
    id: 31,
    name: "Tom Hanks",
    profile_path: "/tom.jpg",
    known_for_department: "Acting",
  },
  {
    id: 505710,
    name: "Zendaya",
    profile_path: "/zendaya.jpg",
    known_for_department: "Acting",
  },
];
const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#35292a"/><circle cx="200" cy="200" r="95" fill="#b9aca7"/><path d="M30 600c0-300 340-300 340 0" fill="#f0644b"/></svg>';
let newsFails = false;
let newsCalls = 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname.endsWith("/people/hub"))
      body = { people, status: "ready", updatedAt: now };
    else if (/\/people\/(?:\d+\/)?news$/.test(url.pathname)) {
      newsCalls++;
      if (newsFails)
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      body = { articles, sources, windowDays: 30, person: null };
    } else if (url.pathname.endsWith("/people/discover"))
      body = {
        results: people,
        page: 1,
        total_pages: 1,
        total_results: 2,
        category: "trending",
        query: "",
        source: "trending",
        has_more: false,
      };
    else if (/\/people\/\d+$/.test(url.pathname)) body = people[0];
    else if (/\/(latest-videos|media)$/.test(url.pathname))
      body = {
        photos: [],
        videos: [
          {
            id: "abcdefghijk",
            title: "Tom Hanks interview",
            thumbnail: "/placeholder-backdrop.svg",
            channel: "Example channel",
            publishedAt: now,
            duration: "PT3M",
            category: "interview",
            source: "tmdb",
            url: "https://www.youtube.com/watch?v=abcdefghijk",
            official: false,
            canEmbed: false,
            context: "A film",
          },
        ],
        totalPhotos: 0,
        totalVideos: 1,
        updatedAt: now,
        sources: {
          tmdb: "ready",
          youtube: "disabled",
          wikimedia: "disabled",
          openverse: "disabled",
        },
      };
    else if (url.pathname.includes("auth/bootstrap"))
        body = { user: null, canRefresh: false };
    return route.fulfill({ json: body });
  });
  await context.route("https://image.tmdb.org/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: image }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    const response = await page.goto(`${base}/celeb`, {
      waitUntil: "networkidle",
    });
    assert.equal(response.status(), 200);
    await page
      .getByRole("heading", { name: "Celebrity hub", exact: true })
      .waitFor();
    await page.getByRole("heading", { name: articles[0].title }).waitFor();
    assert.equal((await page.locator('a[href="/celeb/31"]').count()) > 0, true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Hub overflow at ${width}`,
    );
    assert.equal(
      await page
        .getByRole("navigation", { name: "Celebrity hub", exact: true })
        .getByRole("link", { name: "Overview", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    if (output)
      await page.screenshot({
        path: resolve(output, `hub-${width}.png`),
        fullPage: true,
      });
  }
  await page
    .getByRole("navigation", { name: "Celebrity hub", exact: true })
    .getByRole("link", { name: "News digest", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your celebrity news digest" })
    .waitFor();
  await page.getByLabel("Publisher").selectOption("thr");
  assert.equal(
    await page.getByRole("heading", { name: articles[0].title }).count(),
    0,
  );
  await page.getByRole("heading", { name: articles[1].title }).waitFor();
  await page.getByText("Sources and freshness", { exact: true }).click();
  await page.getByText(/Saved snapshot/).waitFor();
  await page.getByLabel("Topic").selectOption("news");
  await page
    .getByRole("heading", { name: "No recent stories in this view" })
    .waitFor();
  await page.goto(`${base}/celeb/happenings`);
  await page.getByRole("heading", { name: articles[0].title }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: articles[1].title }).count(),
    0,
  );
  for (const section of ["news", "videos", "photos"]) {
    await page.goto(`${base}/celeb/31/${section}`);
    await page
      .getByRole("navigation", { name: "Celebrity content" })
      .getByRole("link", {
        name:
          section === "news"
            ? "News"
            : section === "videos"
              ? "Videos"
              : "Photos",
        exact: true,
      })
      .waitFor();
    if (section === "videos") {
      await page
        .getByRole("button", { name: "Play Tom Hanks interview" })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("link", { name: /Playback unavailable/ }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(), false);
      assert.equal(await page.locator("#gallery").count(), 0);
    }
    if (section === "photos")
      assert.equal(await page.locator("#on-screen-moments").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.goto(`${base}/celeb/videos`);
  await page.getByLabel("Choose a trending person").selectOption("505710");
  await page.getByRole("link", { name: "Open Zendaya’s videos" }).waitFor();
  newsFails = true;
  await page.goto(`${base}/celeb`);
  await page
    .getByRole("heading", { name: "News is taking a moment" })
    .waitFor();
  assert.equal((await page.locator('a[href="/celeb/31"]').count()) > 0, true);
  const before = newsCalls;
  newsFails = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: articles[0].title }).waitFor();
  assert.ok(newsCalls > before, "Retry must issue another request");
  await page.goto(`${base}/celeb?category=actors&page=1`);
  await page.waitForURL(/\/celeb\/explore\?category=actors&page=1/);
  await page
    .getByRole("textbox", { name: "Search actors, directors, writers" })
    .waitFor();
  const missing = await page.goto(`${base}/celeb/31/nonsense`);
  // App Router streaming may have sent a 200 before notFound resolves.
  assert.ok([200, 404].includes(missing.status()));
  await page.locator('[data-error-status="404"]').waitFor();
  assert.ok(
    (await page.locator('meta[name="robots"][content*="noindex"]').count()) > 0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Celebrity hub passed at 320, 390, 768 and 1440px: navigation, filters, source states, individual pages, video fallback, retry, redirect and invalid route.",
  );
} finally {
  await browser.close();
}
