import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  readFileSync(new URL("../../components/selected-content/sections/TvSeasonsEpisodes.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const episodes = (count) => Array.from({ length: count }, (_, index) => ({
  episode_number: index + 1, name: `Episode ${index + 1}`, overview: `Synopsis ${index + 1}`, air_date: "2026-01-01", runtime: 30,
}));
const fixtures = [
  { season_number: 0, name: "Specials", episodes: episodes(42) },
  { season_number: 1, name: "Season 1", episodes: episodes(12) },
  { season_number: 2, name: "Season 2", episodes: [] },
];

function harness(seasons = fixtures) {
  const mod = { exports: {} }, states = [], refs = [];
  const document = { body: { style: { overflow: "auto" } } };
  let stateIndex = 0, refIndex = 0, effect, cleanup;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, document,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return {
        useState(initial) {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initial;
          return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
        useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
        useEffect(callback) { effect = callback; },
      };
      if (name === "@/lib/tmdb") return { tmdbImage: (path) => `https://images.example${path}` };
      return {};
    },
  });
  return {
    refs, document,
    flushEffect() { cleanup?.(); cleanup = effect(); },
    cleanup() { cleanup?.(); },
    render(nextSeasons = seasons) {
      stateIndex = refIndex = 0;
      const nodes = [];
      function visit(node) {
        if (!node || typeof node !== "object") return;
        nodes.push(node);
        [node.props?.children].flat(Infinity).forEach(visit);
      }
      visit(mod.exports.default({ seasons: nextSeasons }));
      return nodes;
    },
  };
}
const control = (nodes, label) => nodes.find((node) => node.props["aria-label"] === label);
const allPreviews = (nodes) => nodes.filter((node) => node.props["aria-haspopup"] === "dialog");
const previews = (nodes) => allPreviews(nodes).filter((node) => !/(?:^|\s)hidden(?:\s|$)/.test(node.props.className));

test("desktop starts with twelve episodes while mobile starts with four and no visible synopsis", () => {
  const nodes = harness().render();
  assert.equal(control(nodes, "Choose season").props.value, 1);
  assert.equal(previews(nodes).length, 4);
  assert.equal(nodes.some((node) => node.props.children === "Synopsis 1"), false);
  assert.ok(nodes.some((node) => node.props.className?.includes("grid-cols-2") && node.props.className.includes("sm:grid-cols-3")));
  assert.equal(allPreviews(nodes).length, 12);
  assert.ok(allPreviews(nodes).slice(4).every((node) => node.props.className.includes("hidden lg:block")));
  assert.equal(control(nodes, "Show more episodes").props.disabled, false);
});

test("desktop reveals twelve at a time, caps the final batch, and resets independently", () => {
  const app = harness([{ season_number: 1, episodes: episodes(26) }, { season_number: 2, episodes: episodes(20) }]);
  const desktopPreviews = (nodes) => allPreviews(nodes).filter((node) => !node.props.className.includes("lg:hidden"));
  let nodes = app.render();
  assert.equal(desktopPreviews(nodes).length, 12);
  control(nodes, "Show more desktop episodes").props.onClick();
  nodes = app.render();
  assert.equal(desktopPreviews(nodes).length, 24);
  assert.equal(previews(nodes).length, 4);
  control(nodes, "Show more desktop episodes").props.onClick();
  nodes = app.render();
  assert.equal(desktopPreviews(nodes).length, 26);
  assert.equal(control(nodes, "Show more desktop episodes").props.disabled, true);
  control(nodes, "Show fewer desktop episodes").props.onClick();
  assert.equal(desktopPreviews(app.render()).length, 12);
  control(app.render(), "Show more desktop episodes").props.onClick();
  control(app.render(), "Choose season").props.onChange({ target: { value: "2" } });
  nodes = app.render();
  assert.equal(desktopPreviews(nodes).length, 12);
  assert.equal(previews(nodes).length, 4);
});

test("mobile reveals batches, can collapse them, and resets on season selection", () => {
  const app = harness();
  let nodes = app.render();
  control(nodes, "Show more episodes").props.onClick();
  nodes = app.render();
  assert.equal(previews(nodes).length, 8);
  control(nodes, "Show fewer episodes").props.onClick();
  assert.equal(previews(app.render()).length, 4);
  control(app.render(), "Show more episodes").props.onClick();
  nodes = app.render();
  control(nodes, "Choose season").props.onChange({ target: { value: "0" } });
  nodes = app.render();
  assert.equal(previews(nodes).length, 4);
  for (let index = 0; index < 10; index++) {
    control(nodes, "Show more episodes").props.onClick();
    nodes = app.render();
  }
  assert.equal(previews(nodes).length, 42);
  assert.match(previews(nodes)[41].props["aria-label"], /episode 42:/);
  assert.equal(control(nodes, "Show more episodes").props.disabled, true);
  assert.ok(nodes.some((node) => node.props.className?.includes("lg:hidden")));
});

test("episode details open on demand; closing and Escape restore the compact browser", () => {
  const app = harness();
  let nodes = app.render();
  previews(nodes)[0].props.onClick();
  nodes = app.render();
  assert.ok(nodes.some((node) => node.props.children === "Synopsis 1"));
  control(nodes, "Close episode details").props.onClick();
  assert.equal(app.render().some((node) => node.props.id === "episode-dialog-title"), false);
  previews(app.render())[1].props.onClick();
  nodes = app.render();
  let prevented = false;
  nodes.find((node) => node.type === "dialog").props.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.render().some((node) => node.props.id === "episode-dialog-title"), false);
});

test("dialog lifecycle opens modally and restores previous body scrolling on cleanup", () => {
  const app = harness();
  previews(app.render())[0].props.onClick();
  app.render();
  let opened = 0, closed = 0;
  app.refs[0].current = { showModal() { opened++; }, close() { closed++; } };
  app.flushEffect();
  assert.equal(opened, 1);
  assert.equal(app.document.body.style.overflow, "hidden");
  app.cleanup();
  assert.equal(closed, 1);
  assert.equal(app.document.body.style.overflow, "auto");
});

test("empty seasons and unavailable episode bundles show graceful fallbacks", () => {
  assert.ok(harness([]).render().some((node) => node.props.children === "No season information was returned for this title."));
  const app = harness();
  control(app.render(), "Choose season").props.onChange({ target: { value: "2" } });
  const nodes = app.render();
  assert.equal(previews(nodes).length, 0);
  assert.ok(nodes.some((node) => node.props.children === "Episode details are not available yet."));
  assert.equal(control(nodes, "Show more episodes"), undefined);
});

test("compact borderless shelf puts readable captions below unobscured thumbnail areas", () => {
  const nodes = harness().render();
  const card = previews(nodes)[0];
  assert.doesNotMatch(card.props.className, /border |bg-/);
  const [thumbnail, caption] = card.props.children;
  assert.match(thumbnail.props.className, /relative block aspect-video/);
  const [image] = thumbnail.props.children;
  assert.equal(image.props.fill, true);
  assert.match(image.props.className, /object-cover/);
  assert.match(caption.props.className, /mt-2.5/);
  assert.doesNotMatch(caption.props.className, /absolute|bg-black/);
  assert.equal(nodes.some((node) => node.props.className?.includes("15rem_minmax")), false);
});

test("episode numbering appears beside the title with responsive labels, not over artwork", () => {
  const card = previews(harness().render())[0];
  const [thumbnail, caption] = card.props.children;
  assert.equal(thumbnail.props.children.length, 2);
  const title = caption.props.children[0].props.children[0];
  const [mobile, desktop, name] = title.props.children;
  assert.equal(mobile.props.children.join(""), "EP1: ");
  assert.equal(mobile.props.className, "lg:hidden");
  assert.equal(desktop.props.children.join(""), "Episode 1: ");
  assert.equal(desktop.props.className, "hidden lg:inline");
  assert.equal(name, "Episode 1");
});

test("specials-only titles remain usable and props are not reordered in place", () => {
  const seasons = [{ season_number: 0, episodes: [...episodes(3)].reverse() }];
  const nodes = harness(seasons).render();
  assert.equal(control(nodes, "Choose season").props.value, 0);
  assert.match(previews(nodes)[0].props["aria-label"], /episode 1:/);
  assert.equal(seasons[0].episodes[0].episode_number, 3);
});

test("season artwork is prominent on both layouts without an enclosing panel", () => {
  const nodes = harness().render();
  const poster = nodes.find((node) => node.props.alt === "Season 1 poster");
  assert.equal(poster.props.fill, true);
  assert.equal(poster.props.sizes, "(min-width: 1024px) 224px, 128px");
  assert.ok(nodes.some((node) => node.props.className?.includes("grid-cols-[8rem_minmax(0,1fr)]")));
  const seasonSummary = nodes.find((node) => node.props.className?.includes("grid-cols-[8rem_minmax(0,1fr)]"));
  assert.match(seasonSummary.props.className, /items-start/);
  assert.doesNotMatch(seasonSummary.props.className, /items-center/);
  assert.ok(nodes.some((node) => node.props.className?.includes("lg:grid-cols-[14rem_minmax(0,1fr)]")));
  assert.equal(nodes.some((node) => node.props.className?.includes("ui-panel")), false);
});
