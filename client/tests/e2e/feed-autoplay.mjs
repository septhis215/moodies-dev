import assert from "node:assert/strict";
import { devices, webkit } from "playwright";

const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.feedPlayers = [];
    window.blockFeedPlayback = false;
    let gesture = false;
    window.addEventListener("click", () => {
      gesture = true;
      setTimeout(() => { gesture = false; }, 0);
    }, true);
    window.YT = {
      Player: class {
        constructor(host, options) {
          this.options = options;
          this.muted = true;
          this.state = -1;
          this.calls = [];
          this.frame = document.createElement("iframe");
          this.frame.src = "about:blank";
          host.replaceWith(this.frame);
          window.feedPlayers.push(this);
          setTimeout(() => options.events.onReady({ target: this }), 20);
        }
        mute() { this.muted = true; }
        unMute() {
          this.calls.push({ method: "unmute", gesture });
          if (!gesture) throw new Error("Audio requires a user gesture");
          this.muted = false;
        }
        playVideo() {
          this.calls.push({ method: "play", muted: this.muted });
          if (window.blockFeedPlayback && !gesture) {
            setTimeout(() => this.options.events.onAutoplayBlocked(), 0);
            return;
          }
          if (gesture) window.blockFeedPlayback = false;
          this.state = 1;
          setTimeout(() => this.options.events.onStateChange({ data: 1 }), 0);
        }
        pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); }
        setVolume() {}
        getVolume() { return 100; }
        isMuted() { return this.muted; }
        getPlayerState() { return this.state; }
        getCurrentTime() { return 3; }
        getDuration() { return 60; }
        getIframe() { return this.frame; }
        destroy() { this.frame.remove(); }
      },
    };
  });
  const clips = ["abcdefghijk", "lmnopqrstuv", "12345678901"].map((key, index) => ({
    id: index + 1, title: `Feed fixture ${index + 1}`, overview: "A test clip.",
    media_type: "movie", vote_average: 8, videos: [],
    primary_video: { key, name: "Trailer", type: "Trailer", site: "YouTube" },
  }));
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: url.pathname.endsWith("/all/video-feed")
      ? { results: clips, hasMore: false }
      : url.pathname.endsWith("/auth/bootstrap") ? { user: null } : [] });
  });
  await page.goto(`${process.env.BASE_URL || "http://127.0.0.1:3000"}/feed`);
  await page.getByRole("button", { name: "Tap for sound", exact: true }).waitFor();
  console.log("Feed ready; checking mobile controls, captions and fullscreen.");
  const controls = page.locator("nav").getByRole("button").or(page.locator('nav a[href="/"]')).or(page.locator('nav a[href="/search"]'));
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      assert.equal(box.width, 44, "Feed navigation hit areas must be 44px wide");
      assert.equal(box.height, 44, "Feed navigation hit areas must be 44px high");
      assert.ok(box.x >= 0 && box.x + box.width <= width, "Feed navigation must fit narrow screens");
    }
  }
  const playerBox = await page.locator('iframe[title="Feed fixture 1"]').boundingBox();
  const titleBox = await page.getByRole("heading", { name: "Feed fixture 1", exact: true }).boundingBox();
  assert.ok(playerBox.y + playerBox.height <= titleBox.y, "Mobile metadata must remain outside the video caption area");
  await page.getByRole("button", { name: "Open landscape video fullscreen", exact: true }).click();
  await page.getByRole("dialog", { name: "Fullscreen video", exact: true }).waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).state), 2, "Inline player must remain paused while fullscreen is open");
  await page.getByRole("button", { name: "Exit fullscreen video", exact: true }).click();
  await page.waitForFunction(() => window.feedPlayers.at(-1).state === 1);
  console.log("Mobile controls, captions and fullscreen pause passed.");
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).muted), true);
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await page.getByRole("button", { name: "Sound", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => window.feedPlayers.at(-1).calls.some(call => call.method === "unmute" && call.gesture)));

  const feed = page.locator('div[class*="overscroll-none"]').first();
  const initialPlayerCount = await page.evaluate(() => window.feedPlayers.length);
  const touch = (type, property, x, y) => feed.evaluate((element, { type, property, x, y }) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, property, { value: [{ clientX: x, clientY: y }] });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, { type, property, x, y });
  await touch("touchstart", "touches", 120, 600);
  await touch("touchmove", "touches", 120, 520);
  await page.waitForFunction(() =>
    document.querySelector('iframe[title="Feed fixture 1"]')?.getBoundingClientRect().top < -10,
  );
  assert.equal(await page.evaluate(() => window.feedPlayers.length), initialPlayerCount, "Dragging must keep the active player mounted");
  assert.equal(await touch("touchend", "changedTouches", 120, 200), true);
  await page.waitForFunction(() => window.feedPlayers.at(-1)?.options.videoId === "lmnopqrstuv" && window.feedPlayers.at(-1).state === 1);
  await page.getByRole("button", { name: "Tap for sound", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).muted), true);
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).calls.filter(call => call.method === "unmute").length), 0);

  await page.evaluate(() => {
    window.blockFeedPlayback = true;
    window.feedPlayers.at(-1).state = -1;
    window.feedPlayers.at(-1).options.events.onAutoplayBlocked();
  });
  const recovery = page.getByRole("button", { name: "Play Feed fixture 2", exact: true });
  await recovery.waitFor();
  await recovery.click();
  await recovery.waitFor({ state: "detached" });
  await page.waitForFunction(() => window.feedPlayers.at(-1).state === 1);

  await touch("touchstart", "touches", 120, 600);
  assert.equal(await touch("touchend", "changedTouches", 270, 580), false);
  assert.equal(await page.getByRole("heading", { name: "Feed fixture 2", exact: true }).count(), 1);
  await page.keyboard.press("ArrowDown");
  await page.getByRole("heading", { name: "Feed fixture 3", exact: true }).waitFor();
  await page.getByRole("button", { name: "Previous video", exact: true }).click();
  await page.getByRole("heading", { name: "Feed fixture 2", exact: true }).waitFor();

  await feed.evaluate(element => {
    for (let index = 0; index < 9; index++) {
      element.dispatchEvent(new WheelEvent("wheel", { deltaY: -8, bubbles: true, cancelable: true }));
    }
  });
  await page.getByRole("heading", { name: "Feed fixture 1", exact: true }).waitFor();
  await page.waitForFunction(() => window.feedPlayers.at(-1)?.options.videoId === "abcdefghijk" && window.feedPlayers.at(-1).state === 1);
  await page.waitForTimeout(350);
  console.log("Feed gestures passed; checking external playback handoff.");
  await page.evaluate(() => window.feedPlayers.at(-1).options.events.onError({ data: 101 }));
  const externalPlayer = page.getByRole("link", { name: "Open YouTube", exact: true });
  // Keep this regression offline while exercising the real transition handler.
  await externalPlayer.evaluate(link => {
    link.addEventListener("click", event => event.preventDefault());
    link.click();
  });
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).state), 2, "Opening YouTube must leave inline playback paused");
  console.log("WebKit iPhone Feed passed: live drag, swipe autoplay, keyboard and wheel navigation, and gesture audio (mock YouTube API).");
} finally {
  await browser.close();
}
