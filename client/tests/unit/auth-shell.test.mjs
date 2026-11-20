import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
async function shell() {
  let cookieReads = 0;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "next/headers") return { cookies: async () => { cookieReads++; return { get() {} }; } };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === "@/lib/fonts") return { bodyFont: {}, displayFont: {} };
      return {};
    },
  });
  const tree = await mod.exports.default({ children: "public content" });
  const head = tree.props.children.find(child => child?.type === "head");
  return { cookieReads, script: head?.props.children.props.dangerouslySetInnerHTML.__html };
}
test("the shared shell renders without request cookies", async () => {
  assert.equal((await shell()).cookieReads, 0);
});
for (const [label, cookie, marker, search, hidden] of [
  ["guest", "", null, "", false],
  ["cookie-only member", "other=1; mood_session=1", null, "", true],
  ["storage-only member", "", "1", "", true],
  ["Google return", "", null, "?google_login=true", true],
  ["unrelated cookie", "other_mood_session=1", null, "", false],
  ["cookie member with storage blocked", "mood_session=1", new Error("Storage blocked"), "", true],
]) {
  test(`${label}: the pre-hydration hint protects against a guest flash`, async () => {
    const styles = [];
    vm.runInNewContext((await shell()).script, {
      URLSearchParams,
      window: { location: { search }, localStorage: { getItem() { if (marker instanceof Error) throw marker; return marker; } } },
      document: { cookie, createElement: () => ({}), head: { appendChild: style => styles.push(style) } },
    });
    assert.equal(styles.length, hidden ? 1 : 0);
  });
}
