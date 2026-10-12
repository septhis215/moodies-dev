import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/selected-content/sections/TrailerBackground.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function setup(reducedMotion = false) {
  let playing = false;
  let effect;
  let notify;
  let motionChanged;
  let disconnected = false;
  const motion = {
    matches: reducedMotion,
    addEventListener(_event, callback) { motionChanged = callback; },
    removeEventListener() {},
  };
  const jsx = (type, props) => ({ type, props });
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports,
    window: { matchMedia: () => motion },
    IntersectionObserver: class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return {
        useRef: () => ({ current: {} }),
        useState: () => [playing, (value) => { playing = value; }],
        useEffect: (callback) => { effect ??= callback; },
      };
      if (name === "@/lib/youtube-player") return {};
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const render = () => testModule.exports.default({ videoKey: "first-trailer" });
  render();
  const cleanup = effect();
  return {
    render,
    visible(value) { notify([{ isIntersecting: value }]); },
    reduceMotion(value) { motion.matches = value; motionChanged(); },
    cleanup,
    get disconnected() { return disconnected; },
  };
}

test("background mounts only its selected trailer while visible", () => {
  const background = setup();
  background.visible(true);
  assert.equal(background.render().props.children.props.videoKey, "first-trailer");
  background.cleanup();
  assert.equal(background.disconnected, true);
});

test("offscreen and reduced-motion backgrounds do not mount a video", () => {
  const background = setup();
  assert.equal(background.render().props.children, null);
  background.visible(true);
  background.reduceMotion(true);
  assert.equal(background.render().props.children, null);
  background.reduceMotion(false);
  assert.equal(background.render().props.children.props.videoKey, "first-trailer");
  background.visible(false);
  assert.equal(background.render().props.children, null);
  background.cleanup();
});

test("background stays hidden until playing and hides paused or blocked play overlays", async () => {
  let effect;
  let options;
  let muted = false;
  let requestedPlay = false;
  let destroyed = false;
  let reveal;
  let currentState = 1;
  const host = { style: {}, appendChild() {} };
  const frame = { remove() {} };
  const player = {
    mute() { muted = true; },
    playVideo() { requestedPlay = true; },
    destroy() { destroyed = true; },
    getPlayerState() { return currentState; },
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled + "\nmodule.exports.BackgroundVideo = BackgroundVideo;", {
    module: testModule, exports: testModule.exports, console,
    window: {
      location: { origin: "https://moodies.test" },
      setTimeout(callback) { reveal = callback; return 1; },
      clearTimeout() { reveal = undefined; },
    },
    document: { createElement: () => frame },
    require(name) {
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      if (name === "react") return {
        useRef: () => ({ current: host }), useEffect: (callback) => { effect = callback; },
      };
      if (name === "@/lib/youtube-player") return {
        YT_PLAYER_STATE: { PLAYING: 1 },
        loadYouTubeApi: async () => ({ Player: function (_frame, config) { options = config; return player; } }),
      };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  testModule.exports.BackgroundVideo({ videoKey: "first-trailer" });
  const cleanup = effect();
  assert.equal(host.style.opacity, "0");
  const url = new URL(frame.src);
  for (const [name, value] of Object.entries({ playlist: "first-trailer", loop: "1", mute: "1", autoplay: "1", controls: "0" })) {
    assert.equal(url.searchParams.get(name), value);
  }
  assert.equal(frame.tabIndex, -1);
  await Promise.resolve();
  options.events.onReady({ target: player });
  assert.equal(muted, true);
  assert.equal(requestedPlay, true);
  options.events.onStateChange({ data: 1 });
  assert.equal(host.style.opacity, "0");
  reveal();
  assert.equal(host.style.opacity, "1");
  options.events.onStateChange({ data: 2 });
  assert.equal(host.style.opacity, "0");
  options.events.onStateChange({ data: 1 });
  options.events.onAutoplayBlocked();
  assert.equal(host.style.opacity, "0");
  assert.equal(reveal, undefined);
  options.events.onStateChange({ data: 1 });
  currentState = 2;
  reveal();
  assert.equal(host.style.opacity, "0");
  cleanup();
  assert.equal(destroyed, true);
});
