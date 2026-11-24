import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../../components/achievements/WatchedTitleButton.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const releaseModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../lib/media-release.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: releaseModule, exports: releaseModule.exports });
function render({ auth = true, watched = false, ready = true, enabled = true, error = "", ...props } = {}) {
  const mod = { exports: {} }, timers = [], activities = [], calls = [], toasts = [], routes = [];
  let toggles = 0, refreshes = 0;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, AbortController,
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    window: { setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {} },
    require(name) {
      if (name === "react") return { useEffect: effect => effect() };
      if (name === "next/navigation") return { useRouter: () => ({ push: path => routes.push(path) }) };
      if (name.includes("/lib/toast")) return { appToast: { warning: (message, options) => toasts.push({ message, ...options }) } };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "lucide-react") return { Check: "Check", Eye: "Eye", RefreshCw: "RefreshCw" };
      if (name.includes("AuthProvider")) return { useAuth: () => ({ isAuthenticated: auth, user: auth ? { id: "fixture" } : null }) };
      if (name.includes("media-release")) return { isMediaReleased: input => {
        calls.push(input); return releaseModule.exports.isMediaReleased(input, "2026-11-24");
      } };
      if (name.includes("useWatched")) return { useWatched: (id, type) => {
        calls.push({ id, type });
        return { watched, ready, enabled, busy: false, error,
          toggle: async () => { toggles++; return true; }, refresh: async () => { refreshes++; } };
      } };
      if (name.includes("achievements")) return { recordAchievementActivity: async activity => activities.push(activity) };
      return {};
    },
  });
  const tree = mod.exports.default({ id: 1399, type: "tv", releaseDate: "2011-04-17", status: "Ended", ...props });
  return { tree, timers, activities, calls, toasts, routes, toggles: () => toggles, refreshes: () => refreshes };
}
function nodes(tree) {
  const found = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    found.push(node);
    [node.props?.children].flat(Infinity).forEach(visit);
  }
  visit(tree);
  return found;
}
test("released TV details show a labelled watched toggle at mobile sizes", async () => {
  const view = render();
  assert.equal(view.tree.type, "button");
  assert.equal(view.tree.props["aria-label"], "Mark as watched");
  assert.equal(view.tree.props["aria-pressed"], false);
  const label = nodes(view.tree).find(node => node.type === "span");
  assert.equal(label.props.children, "Mark watched");
  assert.doesNotMatch(label.props.className || "", /sr-only/);
  assert.ok(view.calls.some(input => input.id === 1399 && input.type === "tv"));
  await view.tree.props.onClick();
  assert.equal(view.toggles(), 1);
});
test("released movies and watched TV retain the shared toggle state", () => {
  const movie = render({ type: "movie" });
  assert.equal(movie.tree.type, "button");
  assert.ok(movie.calls.some(input => input.type === "movie"));
  const watched = render({ watched: true });
  assert.equal(watched.tree.props["aria-pressed"], true);
  assert.equal(nodes(watched.tree).find(node => node.type === "span").props.children, "Watched");
});
test("unreleased and unknown-release detail buttons hide without losing detail activity", async () => {
  for (const releaseDate of ["2099-01-01", null, undefined]) {
    const view = render({ releaseDate, status: "Planned" });
    assert.equal(view.tree, null);
    assert.ok(view.calls.some(input => input.releaseDate === releaseDate && input.status === "Planned"));
    assert.equal(view.timers.length, 1);
    await view.timers[0]();
    assert.equal(view.activities[0].kind, "detail");
    assert.equal(view.activities[0].type, "tv");
  }
});
test("feature-disabled details stay hidden and do not record activity", () => {
  const view = render({ enabled: false });
  assert.equal(view.tree, null);
  assert.equal(view.timers.length, 0);
});
test("guests see a released TV watched action that offers sign-in without mutating", () => {
  const view = render({ auth: false });
  assert.equal(view.tree.type, "button");
  view.tree.props.onClick();
  assert.equal(view.toasts[0].message, "Sign in to mark this title as watched.");
  assert.equal(view.toasts[0].action.label, "Sign in");
  view.toasts[0].action.onClick();
  assert.deepEqual(view.routes, ["/auth/login"]);
  assert.equal(view.toggles(), 0);
  assert.equal(view.refreshes(), 0);
  assert.equal(view.timers.length, 0);
});
test("unreleased titles stay hidden even when membership already says watched", () => {
  assert.equal(render({ watched: true, releaseDate: "2099-01-01", status: "Released" }).tree, null);
});
test("failed membership loads expose retry without a false mutation", async () => {
  const view = render({ ready: false, error: "Could not load watched status" });
  assert.equal(view.tree.props.disabled, false);
  assert.equal(view.tree.props["aria-label"], "Retry watched status");
  await view.tree.props.onClick();
  assert.equal(view.refreshes(), 1);
  assert.equal(view.toggles(), 0);
});
