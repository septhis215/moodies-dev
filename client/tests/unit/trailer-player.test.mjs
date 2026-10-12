import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/selected-content/sections/heroTop.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function setup(keys, { delayApi = false } = {}) {
  let activeRunner;
  let options;
  const loaded = [];
  let destroyed = 0;
  const frames = [];
  let resolveApi;
  const apiPromise = new Promise((resolve) => { resolveApi = resolve; });
  const frame = {};
  const player = {
    loadVideoById: (key) => loaded.push(key),
    getIframe: () => frame,
    destroy: () => destroyed++,
  };
  const hooks = {
    useState(initial) {
      const runner = activeRunner;
      const index = runner.index++;
      if (!(index in runner.values)) runner.values[index] = initial;
      return [runner.values[index], (value) => {
        runner.values[index] = typeof value === "function" ? value(runner.values[index]) : value;
      }];
    },
    useRef(initial) {
      const runner = activeRunner;
      const index = runner.index++;
      return runner.values[index] ??= { current: initial };
    },
    useEffect(callback, deps) {
      const runner = activeRunner;
      const index = runner.index++;
      const previous = runner.effects[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        runner.pending.push(() => {
          previous?.cleanup?.();
          runner.effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const testModule = { exports: {} };
  vm.runInNewContext(compiled + "\nmodule.exports.testComponents = { TrailerPlayer, TrailerVideoPlayer };", {
    module: testModule, exports: testModule.exports, console,
    window: { location: { origin: "https://moodies.test" } },
    document: {
      createElement() {
        const iframe = { removed: false, remove() { this.removed = true; } };
        frames.push(iframe);
        return iframe;
      },
    },
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "@/lib/youtube-player") return {
        YT_PLAYER_STATE: { ENDED: 0 },
        loadYouTubeApi: () => apiPromise,
      };
      return {};
    },
  });
  const { TrailerPlayer, TrailerVideoPlayer } = testModule.exports.testComponents;
  const makeRunner = () => ({ values: [], effects: [], pending: [], index: 0 });
  const parent = makeRunner();
  const child = makeRunner();
  const render = (runner, component, props) => {
    activeRunner = runner;
    runner.index = 0;
    const tree = component(props);
    // Assign the DOM host ref before effects, as React does during commit.
    if (tree.props.ref) tree.props.ref.current ??= {
      getAttribute: () => "Trailer", appendChild() {},
    };
    runner.pending.splice(0).forEach((effect) => effect());
    return tree;
  };
  const findPlayer = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === TrailerVideoPlayer) return node;
    const children = [node.props?.children].flat(Infinity);
    return children.map(findPlayer).find(Boolean);
  };
  const update = () => {
    const tree = render(parent, TrailerPlayer, {
      trailers: keys.map((key) => ({ key, site: "YouTube" })), title: "Movie", poster: "poster",
    });
    const childNode = findPlayer(tree);
    render(child, TrailerVideoPlayer, childNode.props);
  };
  update();
  const finishApi = async () => {
    resolveApi({ Player: function (_frame, config) { options = config; return player; } });
    await Promise.resolve();
    options?.events.onReady({ target: player });
  };
  if (!delayApi) await finishApi();
  return {
    loaded,
    frames,
    finishApi,
    get initialized() { return Boolean(options); },
    state(data) { options.events.onStateChange({ data }); update(); },
    cleanup() { child.effects.forEach((effect) => effect?.cleanup?.()); },
    get destroyed() { return destroyed; },
  };
}

test("ended trailers advance in order and wrap to the first repeatedly", async () => {
  const playback = await setup(["first", "second", "third"]);
  for (let i = 0; i < 6; i++) playback.state(0);
  assert.deepEqual(playback.loaded, ["second", "third", "first", "second", "third", "first"]);
  assert.equal(playback.destroyed, 0);
  playback.cleanup();
});

test("pause, buffering and playing events do not advance trailers", async () => {
  const playback = await setup(["first", "second"]);
  for (const state of [1, 2, 3, 2]) playback.state(state);
  assert.deepEqual(playback.loaded, []);
  playback.cleanup();
});

test("one trailer restarts without replacing its player", async () => {
  const playback = await setup(["only"]);
  playback.state(0);
  playback.state(0);
  assert.deepEqual(playback.loaded, ["only", "only"]);
  assert.equal(playback.destroyed, 0);
  playback.cleanup();
  assert.equal(playback.destroyed, 1);
});

test("the YouTube embed exists before the API finishes loading", async () => {
  const playback = await setup(["first", "second"], { delayApi: true });
  assert.equal(playback.initialized, false);
  assert.equal(playback.frames.length, 1);
  assert.match(playback.frames[0].src, /youtube-nocookie.com\/embed\/first\?/);
  assert.match(playback.frames[0].src, /enablejsapi=1/);
  assert.equal(playback.frames[0].removed, false);
  await playback.finishApi();
  assert.equal(playback.initialized, true);
  playback.cleanup();
});

test("cleanup before API readiness prevents mounting an abandoned player", async () => {
  const playback = await setup(["first"], { delayApi: true });
  playback.cleanup();
  await playback.finishApi();
  assert.equal(playback.initialized, false);
  assert.equal(playback.frames[0].removed, true);
});
