import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../app/feed/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function setup(initialProps = {}) {
  let index = 0;
  let config;
  let state = -1;
  const values = [], effects = [], pending = [], calls = [], statuses = [];
  const timers = new Map();
  const attributes = new Map();
  const player = {
    mute: () => calls.push("mute"), unMute: () => calls.push("unmute"),
    setVolume: () => calls.push("volume"), playVideo: () => calls.push("play"),
    pauseVideo: () => calls.push("pause"), destroy: () => calls.push("destroy"),
    getPlayerState: () => state,
    getIframe: () => ({ setAttribute: (key, value) => attributes.set(key, value) }),
  };
  const hooks = {
    useRef(initial) { return values[index++] ??= { current: initial }; },
    useEffect(callback, deps) {
      const slot = index++;
      const previous = effects[slot];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        pending.push(() => {
          previous?.cleanup?.();
          effects[slot] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const mod = { exports: {} };
  vm.runInNewContext(compiled + "\nmodule.exports.player = FeedVideoPlayer;", {
    module: mod, exports: mod.exports,
    window: {
      location: { origin: "https://moodies.test" },
      setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/lib/utils") return { cn: (...args) => args.join(" ") };
      if (name === "@/lib/youtube-player") return {
        YT_PLAYER_STATE: { PLAYING: 1, PAUSED: 2, BUFFERING: 3 },
        createYouTubePlayer: async (_host, options) => { config = options; return player; },
      };
      return {};
    },
  });
  let props = {
    videoKey: "abcdefghijk", reloadKey: 0, muted: false, playbackAllowed: true,
    title: "Feed trailer", onStatus: status => statuses.push(status), attachPlayer() {}, ...initialProps,
  };
  const render = (changes = {}) => {
    props = { ...props, ...changes };
    index = 0;
    const tree = mod.exports.player(props);
    tree.props.ref.current ??= { replaceChildren() {} };
    pending.splice(0).forEach(effect => effect());
  };
  render();
  await new Promise(resolve => setImmediate(resolve));
  return {
    config, player, calls, statuses, attributes, render,
    ready() { config.events.onReady({ target: player }); },
    state(value) { state = value; config.events.onStateChange({ data: value }); },
    blocked() { config.events.onAutoplayBlocked(); },
    tick() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    cleanup() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

test("new clips stay muted through readiness even after sound was enabled on the previous clip", async () => {
  const feed = await setup({ muted: false });
  feed.ready();
  assert.deepEqual(feed.calls, ["mute", "play"]);
  assert.deepEqual(feed.statuses, ["muted"]);
  assert.equal(feed.config.playerVars.mute, 1);
  assert.equal(feed.config.playerVars.playsinline, 1);
  assert.equal(feed.config.playerVars.origin, "https://moodies.test");
  assert.match(feed.attributes.get("allow"), /autoplay/);
  feed.state(1);
  assert.equal(feed.statuses.at(-1), "playing");
  feed.cleanup();
});

test("blocked autoplay retries muted once, then requests a user gesture", async () => {
  const feed = await setup();
  feed.ready();
  feed.blocked();
  assert.deepEqual(feed.calls, ["mute", "play", "mute", "play"]);
  assert.ok(!feed.statuses.includes("playing"));
  feed.blocked();
  assert.equal(feed.statuses.at(-1), "blocked");
  assert.equal(feed.calls.filter(call => call === "play").length, 2);
  feed.cleanup();
});

test("buffering and intentionally paused players are not reported as autoplay failures", async () => {
  const feed = await setup();
  feed.ready();
  feed.state(3);
  feed.tick();
  assert.ok(!feed.statuses.includes("blocked"));
  feed.render({ playbackAllowed: false });
  feed.blocked();
  assert.ok(!feed.statuses.includes("blocked"));
  feed.cleanup();

  const paused = await setup({ playbackAllowed: false });
  paused.ready();
  assert.deepEqual(paused.calls, ["mute", "pause"]);
  paused.tick();
  assert.ok(!paused.statuses.includes("blocked"));
  paused.cleanup();
});

test("stalled playback offers a gesture and teardown cancels the playback check", async () => {
  const feed = await setup();
  feed.ready();
  feed.tick();
  assert.equal(feed.statuses.at(-1), "blocked");
  feed.cleanup();
  const removed = await setup();
  removed.ready();
  removed.cleanup();
  removed.tick();
  assert.deepEqual(removed.statuses, ["muted"]);
});
