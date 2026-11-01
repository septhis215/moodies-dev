import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Real App Router, deterministic publishers and official IFrame API event contract.
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
    imageUrl: "https://variety.com/wp-content/festival.jpg",
  },
  {
    id: "2",
    title: "Zendaya shares a new project",
    url: "https://www.hollywoodreporter.com/2026/film/story/",
    source: "thr",
    publisher: "The Hollywood Reporter",
    publishedAt: now,
    topic: "projects",
    imageUrl: "https://www.hollywoodreporter.com/wp-content/project.jpg",
  },
];
const work = {
  id: 101,
  title: "A film",
  media_type: "movie",
  release_date: "2026-10-01",
};
const people = [
  {
    id: 31,
    name: "Tom Hanks",
    profile_path: "/tom.jpg",
    known_for_department: "Acting",
    known_for: [work],
  },
  {
    id: 505710,
    name: "Zendaya",
    profile_path: "/zendaya.jpg",
    known_for_department: "Acting",
    known_for: [work],
  },
];
const videos = Array.from({ length: 12 }, (_, i) => ({
  id: `video${String(i).padStart(6, "0")}`,
  title: `Tom Hanks ${i % 2 ? "trailer" : "interview"} ${i + 1}`,
  thumbnail: "/placeholder-backdrop.svg",
  channel: "Example channel",
  publishedAt: now,
  duration: "PT3M20S",
  category: i % 2 ? "trailer" : "interview",
  source: "youtube",
  url: `https://www.youtube.com/watch?v=video${String(i).padStart(6, "0")}`,
  official: false,
  canEmbed: i !== 9,
  content: { id: 101, title: "A film", mediaType: "movie" },
}));
const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#35292a"/><circle cx="400" cy="200" r="110" fill="#b9aca7"/><path d="M130 600c0-300 540-300 540 0" fill="#f0644b"/></svg>';
let newsFails = false;
let videosFail = false;
let newsCalls = 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__yt = {
      created: 0,
      destroyed: 0,
      plays: 0,
      pauses: 0,
      muted: true,
      current: null,
    };
    window.YT = {
      Player: class {
        constructor(mount, options) {
          this.options = options;
          this.frame = document.createElement("iframe");
          this.frame.title = "Test video";
          this.frame.style.background = "#20191a";
          mount.replaceWith(this.frame);
          window.__yt.created++;
          window.__yt.current = this;
          queueMicrotask(() => options.events.onReady({ target: this }));
        }
        getIframe() {
          return this.frame;
        }
        playVideo() {
          window.__yt.plays++;
          this.options.events.onStateChange({ data: 1 });
        }
        pauseVideo() {
          window.__yt.pauses++;
          this.options.events.onStateChange({ data: 2 });
        }
        mute() {
          window.__yt.muted = true;
        }
        unMute() {
          window.__yt.muted = false;
        }
        destroy() {
          window.__yt.destroyed++;
          this.frame.remove();
        }
      },
    };
  });
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname.endsWith("/people/hub/videos")) {
      if (videosFail) return route.fulfill({ status: 503, json: {} });
      body = {
        videos,
        status: "ready",
        updatedAt: now,
        sources: { tmdb: "ready", youtube: "ready" },
      };
    } else if (url.pathname.endsWith("/people/hub"))
      body = { people, status: "ready", updatedAt: now };
    else if (/\/people\/(?:\d+\/)?news$/.test(url.pathname)) {
      newsCalls++;
      if (newsFails) return route.fulfill({ status: 503, json: {} });
      body = { articles, sources, windowDays: 30, person: null };
    } else if (url.pathname.endsWith("/people/discover"))
      body = {
        results: people,
        total_pages: 2,
        total_results: 48,
        has_more: true,
      };
    else if (/\/people\/\d+$/.test(url.pathname))
      body = { ...people[0], combined_credits: { cast: [work] } };
    else if (/\/(latest-videos|media)$/.test(url.pathname))
      body = {
        photos: [],
        videos: [videos[9]],
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
  for (const pattern of [
    "https://image.tmdb.org/**",
    "https://variety.com/wp-content/**",
    "https://www.hollywoodreporter.com/wp-content/**",
  ])
    await context.route(pattern, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: image }),
    );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of [
      "/celeb",
      "/celeb/news",
      "/celeb/videos",
      "/celeb/explore",
    ]) {
      const response = await page.goto(`${base}${path}`, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${path} overflow at ${width}`,
      );
      const nav = page.getByRole("navigation", {
        name: "Celebrity hub",
        exact: true,
      });
      assert.equal(await nav.getByRole("link").count(), 4);
      assert.equal(
        await nav.locator('[aria-current="page"]').getAttribute("href"),
        path,
      );
      if (path === "/celeb" || path === "/celeb/videos") {
        assert.equal(
          await page
            .getByRole("group", { name: "Choose featured video" })
            .getByRole("button")
            .count(),
          10,
        );
        assert.equal(
          await page.locator("iframe").count(),
          1,
          "Only one player may be mounted",
        );
        const before = await page.evaluate(() => window.__yt.created);
        await page
          .getByRole("button", { name: "Turn sound on", exact: true })
          .click();
        assert.equal(await page.evaluate(() => window.__yt.muted), false);
        assert.equal(
          await page.evaluate(() => window.__yt.created),
          before,
          "Sound must not recreate the player",
        );
        await page
          .getByRole("button", { name: "Next video", exact: true })
          .click();
        await page
          .getByRole("heading", { name: videos[1].title, exact: true })
          .first()
          .waitFor();
        assert.equal(await page.locator("iframe").count(), 1);
        await page
          .getByRole("button", { name: "Previous video", exact: true })
          .click();
      }
      if (output)
        await page.screenshot({
          path: resolve(output, `${path.split("/").at(-1)}-${width}.png`),
          fullPage: true,
        });
    }
  }

  await page.goto(`${base}/celeb/news`);
  await page
    .getByRole("button", { name: "Publisher: All publishers", exact: true })
    .click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: articles[1].title }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: articles[0].title }).count(),
    0,
  );
  assert.equal(
    await page.locator(`a[href="${articles[1].url}"] img`).count(),
    1,
  );
  await page.getByText("Sources & freshness", { exact: false }).click();
  await page.getByText(/Saved snapshot/).waitFor();
  await page
    .getByRole("button", { name: "Interviews & stories", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "No recent stories in this view" })
    .waitFor();
  await page.goto(`${base}/celeb/happenings`);
  await page.waitForURL(`${base}/celeb/news`);
  await page.getByRole("heading", { name: articles[0].title }).waitFor();
  await page.getByRole("heading", { name: articles[1].title }).waitFor();

  await page.goto(`${base}/celeb/explore`);
  const card = page
    .getByRole("region", { name: "Celebrity directory" })
    .locator("article")
    .first();
  await card.hover();
  const workLink = card.getByRole("link", { name: "A film", exact: true });
  await workLink.waitFor();
  assert.equal(await workLink.getAttribute("href"), "/movies/101");
  await card
    .getByRole("link", { name: "Tom Hanks", exact: true })
    .first()
    .focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await workLink.evaluate((element) => element === document.activeElement),
    true,
  );
  await page.getByRole("textbox", { name: "Search celebrities" }).fill("Tom");
  await page.waitForURL(/q=Tom/);
  await page
    .getByRole("button", { name: "People category:", exact: false })
    .click();
  await page.getByRole("option", { name: "Directors", exact: true }).click();
  await page.waitForURL(/category=directors/);

  for (const section of ["news", "videos", "photos"]) {
    await page.goto(`${base}/celeb/31/${section}`);
    await page.getByRole("navigation", { name: "Celebrity content" }).waitFor();
    if (section === "videos") {
      await page
        .getByRole("button", { name: `Play ${videos[9].title}`, exact: true })
        .first()
        .click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Watch on YouTube", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(), false);
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }

  await page.goto(`${base}/celeb/videos`);
  await page
    .getByRole("heading", { name: videos[0].title, exact: true })
    .first()
    .waitFor();
  await page.evaluate(() =>
    window.__yt.current.options.events.onError({ data: 150 }),
  );
  await page
    .getByRole("link", { name: "Watch on YouTube", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Next video", exact: true }).click();
  await page.evaluate(() =>
    window.__yt.current.options.events.onAutoplayBlocked(),
  );
  await page
    .getByRole("region", { name: "Featured videos", exact: true })
    .getByRole("button", { name: `Play ${videos[1].title}`, exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.__yt.muted), false);
  const beforePause = await page.evaluate(() => window.__yt.pauses);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForFunction(
    (count) => window.__yt.pauses > count,
    beforePause,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/celeb`);
  await page
    .getByRole("button", { name: `Play ${videos[0].title}`, exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => window.__yt.plays),
    0,
    "Reduced motion disables autoplay",
  );
  await page
    .getByRole("button", { name: `Play ${videos[0].title}`, exact: true })
    .click();
  await page.evaluate(() =>
    window.__yt.current.options.events.onStateChange({ data: 0 }),
  );
  await page
    .getByRole("heading", { name: videos[0].title, exact: true })
    .waitFor();
  newsFails = true;
  videosFail = true;
  await page.goto(`${base}/celeb`);
  await page
    .getByRole("heading", { name: "News is taking a moment" })
    .waitFor();
  await page
    .getByRole("heading", { name: "The next moment is on its way" })
    .waitFor();
  assert.ok(await page.locator('a[href="/celeb/31"]').count());
  const before = newsCalls;
  newsFails = false;
  videosFail = false;
  await page
    .getByRole("heading", { name: "News is taking a moment" })
    .locator("..")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await page.getByRole("heading", { name: articles[0].title }).waitFor();
  assert.ok(newsCalls > before);
  await page.goto(`${base}/celeb?category=actors&page=1`);
  await page.waitForURL(/\/celeb\/explore\?category=actors&page=1/);
  const missing = await page.goto(`${base}/celeb/31/nonsense`);
  assert.ok([200, 404].includes(missing.status()));
  await page.locator('[data-error-status="404"]').waitFor();
  assert.ok(
    await page.locator('meta[name="robots"][content*="noindex"]').count(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Celebrity hub passed: four pages at 320/390/768/1440px, ten-video cap, one player, sound, carousel, errors, reduced motion, offscreen pause, filters, linked images, keyboard work links, section routes, retry and redirects.",
  );
} finally {
  await browser.close();
}
