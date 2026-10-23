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
  const clips = ["abcdefghijk", "lmnopqrstuv"].map((key, index) => ({
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
  assert.equal(await page.evaluate(() => window.feedPlayers.at(-1).muted), true);
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await page.getByRole("button", { name: "Sound", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => window.feedPlayers.at(-1).calls.some(call => call.method === "unmute" && call.gesture)));

  await page.locator('div[class*="overscroll-none"]').first().evaluate(element => {
    for (const [type, property, y] of [["touchstart", "touches", 600], ["touchend", "changedTouches", 200]]) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, property, { value: [{ clientY: y }] });
      element.dispatchEvent(event);
    }
  });
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
  console.log("WebKit iPhone Feed passed: muted startup, gesture audio, swipe autoplay, blocked recovery (mock YouTube API).");
} finally {
  await browser.close();
}
