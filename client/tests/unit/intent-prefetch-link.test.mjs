import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../../components/ui/IntentPrefetchLink.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function setup(initialProps = {}) {
  let state = null;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "react") return {
        useState: () => [state, value => { state = value; }],
      };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      if (name === "next/link") return { default: "Link" };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return props => mod.exports.default({ href: "/movies/550", children: "Fight Club", ...initialProps, ...props });
}

test("rendering a shelf does not enable prefetch for untouched links", () => {
  for (let id = 1; id <= 30; id++) {
    const link = setup({ href: `/movies/${id}` })();
    assert.equal(link.type, "Link");
    assert.equal(link.props.prefetch, false);
  }
});

for (const event of ["onMouseEnter", "onFocus"]) {
  test(`${event} warms only the intended destination and preserves link props`, () => {
    let calls = 0;
    const ref = { current: null };
    const render = setup({ [event]: () => calls++, ref, className: "poster", "aria-label": "View title" });
    render().props[event]({ defaultPrevented: false });
    const link = render();
    assert.equal(link.props.prefetch, null);
    assert.equal(calls, 1);
    assert.equal(link.props.href, "/movies/550");
    assert.equal(link.props.children, "Fight Club");
    assert.equal(link.props.ref, ref);
    assert.equal(link.props.className, "poster");
    assert.equal(link.props["aria-label"], "View title");
    assert.equal(render({ href: "/tv/1399" }).props.prefetch, false);
  });

  test(`${event} respects a caller that prevents the interaction`, () => {
    const render = setup({ [event]: event => { event.defaultPrevented = true; } });
    render().props[event]({ defaultPrevented: false });
    assert.equal(render().props.prefetch, false);
  });
}

test("warming one card does not warm other cards", () => {
  const first = setup();
  const second = setup({ href: "/tv/1399" });
  first().props.onMouseEnter({ defaultPrevented: false });
  assert.equal(first().props.prefetch, null);
  assert.equal(second().props.prefetch, false);
});
