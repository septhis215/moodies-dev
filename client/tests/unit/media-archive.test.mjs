import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../../components/selected-content/sections/imageVideoCarousel.tsx", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const fixture = { posters: ["/p1.jpg", "/p2.jpg"], backdrops: ["/b1.jpg", "/b2.jpg"], videos: ["abc", { key: "def", name: "Featurette", site: "YouTube" }] };
function harness(props = fixture) {
  const mod = { exports: {} }, states = [], refs = [], effects = [], listeners = new Map();
  const document = { body: { style: { overflow: "auto" } } };
  let cursor = 0, refCursor = 0;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, document,
    window: { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type) => listeners.delete(type) },
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return {
        useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
        useRef(initial) { return refs[refCursor++] ??= { current: initial }; },
        useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
      };
      if (name === "@/components/ui/TmdbImage") return { TmdbImage: "Image" };
      if (name === "@/lib/tmdb") return { tmdbImage: (path) => `https://image.example${path}` };
      return {};
    },
  });
  return { refs, effects, document, listeners, render(nextProps = props) {
    cursor = refCursor = 0; effects.length = 0;
    const nodes = [];
    function walk(node) { if (!node || typeof node !== "object") return; nodes.push(node); [node.props?.children].flat(Infinity).forEach(walk); }
    walk(mod.exports.default(nextProps));
    return nodes;
  } };
}
const control = (nodes, label) => nodes.find((node) => node.props?.["aria-label"] === label);
function tab(app, label) { app.render().find((node) => node.type === "button" && node.props.children?.[0] === label).props.onClick(); return app.render(); }

test("posters use portrait previews and uncropped portrait thumbnails on both layouts", () => {
  const nodes = harness().render();
  assert.ok(nodes.some((node) => /lg:grid-cols-\[20rem_minmax/.test(node.props.className)));
  assert.ok(nodes.some((node) => /relative.*aspect-\[2\/3\]/.test(node.props.className)));
  const thumbnail = control(nodes, "Select poster 1");
  assert.match(thumbnail.props.className, /aspect-\[2\/3\].*w-20/);
  assert.equal(thumbnail.props["aria-pressed"], true);
  assert.equal(thumbnail.props.children[0].props.className, "object-contain");
  const rail = control(nodes, "Browse posters, scroll for more");
  assert.match(rail.props.className, /overflow-x-auto/);
  assert.match(rail.props.className, /lg:grid.*xl:grid-cols-4/);
  assert.doesNotMatch(rail.props.className, /ui-panel/);
});

test("backdrops and videos use landscape frames and trailer-style desktop sidebars", () => {
  const app = harness();
  let nodes = tab(app, "Backdrops");
  assert.ok(nodes.some((node) => /lg:grid-cols-\[16rem_minmax/.test(node.props.className)));
  assert.match(control(nodes, "Select backdrop 1").props.className, /aspect-video.*w-56/);
  assert.match(control(nodes, "Browse backdrops, scroll for more").props.className, /lg:block/);
  nodes = tab(app, "Videos");
  assert.match(nodes.find((node) => node.type === "iframe").props.src, /youtube-nocookie.*abc/);
  control(nodes, "Select video 2").props.onClick();
  nodes = app.render();
  assert.match(nodes.find((node) => node.type === "iframe").props.src, /def/);
  assert.equal(nodes.find((node) => node.type === "iframe").props.title, "Featurette");
});

test("previews omit captions and navigation while thumbnail selection and tab resets work", () => {
  const app = harness();
  for (const [tabName, label] of [["Posters", "poster"], ["Backdrops", "backdrop"], ["Videos", "video"]]) {
    const nodes = tab(app, tabName);
    assert.equal(control(nodes, `Previous ${label}`), undefined);
    assert.equal(control(nodes, `Next ${label}`), undefined);
    assert.equal(nodes.some((node) => node.props.role === "status"), false);
    assert.equal(nodes.some((node) => node.type === "span" && node.props.className === "min-w-0 truncate"), false);
    control(nodes, `Select ${label} 2`).props.onClick();
    assert.equal(control(app.render(), `Select ${label} 2`).props["aria-pressed"], true);
  }
  tab(app, "Posters");
  control(app.render(), "Select poster 2").props.onClick();
  assert.equal(control(tab(app, "Backdrops"), "Select backdrop 1").props["aria-pressed"], true);
});

test("image viewer opens modally, locks scrolling, handles Escape and restores scrolling", () => {
  const app = harness();
  control(app.render(), "Open poster 1").props.onClick();
  let nodes = app.render();
  const dialog = nodes.find((node) => node.type === "dialog");
  const element = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  app.refs[0].current = element;
  const cleanup = app.effects[1]();
  const keyCleanup = app.effects[2]();
  assert.equal(element.open, true);
  assert.equal(app.document.body.style.overflow, "hidden");
  app.listeners.get("keydown")({ key: "ArrowRight" });
  assert.equal(control(app.render(), "Select poster 2").props["aria-pressed"], true);
  control(app.render(), "Next image").props.onClick();
  assert.equal(control(app.render(), "Select poster 1").props["aria-pressed"], true);
  control(app.render(), "Previous image").props.onClick();
  assert.equal(control(app.render(), "Select poster 2").props["aria-pressed"], true);
  let prevented = false;
  dialog.props.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.render().some((node) => node.type === "dialog"), false);
  cleanup(); keyCleanup();
  assert.equal(app.document.body.style.overflow, "auto");
  assert.equal(element.open, false);
  assert.equal(app.listeners.size, 0);
});

test("empty archives stay hidden and single images omit unnecessary thumbnails", () => {
  assert.equal(harness({}).render().length, 0);
  const nodes = harness({ posters: ["/only.jpg"] }).render();
  assert.equal(control(nodes, "Browse posters, scroll for more"), undefined);
  assert.equal(control(nodes, "Next poster"), undefined);
  assert.ok(control(nodes, "Open poster 1"));
});
