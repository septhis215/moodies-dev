import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const makeBuckets = () => ({
  movieId: Array.from({ length: 14 }, (_, index) => String(index + 1)),
  seriesId: ["100", "101", "102", "103"],
});

async function setup(width, mode = "normal") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const lists = { watchlist: makeBuckets(), liked: makeBuckets() };
  const calls = { details: 0, list: 0, deletes: 0 };
  let detailsFail = true;
  let listFail = mode === "error";
  let releaseDetails;
  const detailsGate =
    mode === "loading"
      ? new Promise((resolve) => {
          releaseDetails = resolve;
        })
      : Promise.resolve();
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body = [];
    if (path.endsWith("/auth/bootstrap"))
      body = {
        user:
          mode === "guest"
            ? null
            : { id: "library-test", name: "Library reader" },
        watchlist: lists.watchlist,
        liked: lists.liked,
      };
    else if (path.endsWith("/security/turnstile/status"))
      body = { verified: true };
    else if (/\/details\/\d+$/.test(path)) {
      await detailsGate;
      calls.details++;
      const id = Number(path.split("/").at(-1));
      if (id === 4 && detailsFail)
        return route.fulfill({
          status: 503,
          json: { message: "Detail failure" },
        });
      body = {
        info: {
          id,
          title: "Fixture " + (id >= 100 ? "series " : "movie ") + id,
          poster_path: null,
          release_date: "2024-01-01",
          vote_average: id === 3 ? 0 : 8,
        },
      };
    } else if (/\/api\/(watchlist|liked)$/.test(path)) {
      calls.list++;
      if (listFail)
        return route.fulfill({
          status: 503,
          body: "PRIVATE INTERNAL ERROR TEXT",
        });
      body =
        mode === "empty"
          ? { movieId: [], seriesId: [] }
          : lists[path.split("/").at(-1)];
    } else if (request.method() === "DELETE") {
      calls.deletes++;
      const [, kind, media, id] =
        path.match(/\/api\/(watchlist|liked)\/(movie|tv)\/(\d+)$/) ?? [];
      assert.ok(kind, "Only explicit collection DELETE endpoints are allowed");
      if (id === "1") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return route.fulfill({
          status: 503,
          json: { message: "Removal failed" },
        });
      }
      const bucket = media === "movie" ? "movieId" : "seriesId";
      lists[kind][bucket] = lists[kind][bucket].filter((item) => item !== id);
      body = { removed: true };
    }
    return route.fulfill({ status: 200, json: body });
  });
  return {
    context,
    page,
    errors,
    calls,
    releaseDetails,
    recoverDetails: () => {
      detailsFail = false;
    },
    recoverList: () => {
      listFail = false;
    },
  };
}

try {
  for (const width of [320, 390, 768, 1440]) {
    for (const kind of ["watchlist", "liked"]) {
      const fixture = await setup(width);
      const { page, calls } = fixture;
      await page.goto(base + "/" + kind, { waitUntil: "load" });
      const first = page.getByRole("article", {
        name: "Fixture movie 1",
        exact: true,
      });
      await first.waitFor();
      assert.equal(await page.locator("a button").count(), 0);
      assert.equal(await first.getByRole("button").isVisible(), true);
      assert.ok((await first.getByRole("button").boundingBox()).height >= 44);
      await first.getByRole("button").focus();
      assert.equal(
        await first
          .getByRole("button")
          .evaluate((button) => button === document.activeElement),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByRole("button", { name: "Series", exact: true }).click();
      assert.equal(await page.getByRole("article").count(), 4);
      await page
        .getByRole("searchbox", { name: "Search titles" })
        .fill("  Fixture series 100  ");
      assert.equal(await page.getByRole("article").count(), 1);
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .click();
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.locator("#year-0").fill("2050");
      await page.locator("#year-1").fill("2000");
      await page
        .getByRole("heading", { name: "Check your filter ranges" })
        .waitFor();
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      assert.equal(await page.getByRole("article").count(), 12);
      await page.getByRole("button", { name: "View 6 more titles" }).click();
      assert.equal(await page.getByRole("article").count(), 18);
      if (process.env.SCREENSHOT_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: process.env.SCREENSHOT_DIR + "/" + kind + "-" + width + ".png",
        });
      }

      const detailsBefore = calls.details,
        listsBefore = calls.list;
      await first.getByRole("button").click();
      await page
        .getByRole("article", { name: "Fixture movie 2", exact: true })
        .getByRole("button")
        .click();
      await first.waitFor();
      assert.equal(
        await page
          .getByRole("article", { name: "Fixture movie 2", exact: true })
          .count(),
        0,
        "Failed removal must not restore another removed item",
      );
      assert.equal(
        calls.details,
        detailsBefore,
        "Removal must not refetch title details",
      );
      assert.equal(
        calls.list,
        listsBefore,
        "Removal must not refetch the whole list",
      );
      fixture.recoverDetails();
      await page.getByRole("button", { name: "Retry details" }).click();
      await page
        .getByRole("article", { name: "Fixture movie 4", exact: true })
        .waitFor();
      assert.equal(
        calls.details,
        detailsBefore + 1,
        "Retry should reuse successful detail summaries",
      );
      assert.equal(fixture.errors.length, 0, fixture.errors.join("\n"));
      console.log(
        "PASS " +
          kind +
          " at " +
          width +
          "px: filters, partial failure, safe removal, retry",
      );
      await fixture.context.close();
    }
  }
  for (const mode of ["guest", "empty", "error"]) {
    const fixture = await setup(390, mode);
    await fixture.page.goto(base + "/watchlist", { waitUntil: "load" });
    if (mode === "guest") {
      await fixture.page
        .getByRole("heading", { name: "Sign in for your watchlist" })
        .waitFor();
      assert.equal(fixture.calls.list, 0);
    } else if (mode === "empty")
      await fixture.page
        .getByRole("link", { name: "Find your next watch" })
        .waitFor();
    else {
      await fixture.page
        .getByRole("button", { name: "Retry library" })
        .waitFor();
      assert.equal(
        await fixture.page.getByText("PRIVATE INTERNAL ERROR TEXT").count(),
        0,
      );
      fixture.recoverList();
      await fixture.page.getByRole("button", { name: "Retry library" }).click();
      await fixture.page
        .getByRole("article", { name: "Fixture movie 1", exact: true })
        .waitFor();
    }
    console.log("PASS " + mode + " state");
    await fixture.context.close();
  }
  const loadingFixture = await setup(390, "loading");
  await loadingFixture.page.goto(base + "/watchlist", { waitUntil: "load" });
  await loadingFixture.page
    .getByRole("status")
    .filter({ hasText: "Loading title details:" })
    .waitFor();
  assert.equal(
    await loadingFixture.page
      .getByRole("heading", { name: "Your watchlist is empty" })
      .count(),
    0,
  );
  loadingFixture.releaseDetails();
  await loadingFixture.page
    .getByRole("article", { name: "Fixture movie 1", exact: true })
    .waitFor();
  await loadingFixture.page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  assert.equal(
    await loadingFixture.page
      .locator('section[aria-labelledby="library-heading"]')
      .evaluate((main) => main.scrollWidth > main.clientWidth),
    false,
    "The library must reflow at enlarged text sizes",
  );
  console.log("PASS detail-loading state and enlarged text reflow");
  await loadingFixture.context.close();
} finally {
  await browser.close();
}
