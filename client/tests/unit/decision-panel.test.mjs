import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  readFileSync(new URL("../../components/selected-content/sections/DecisionPanel.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function render(topMoods) {
  const mod = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "next/link") return { default: "Link" };
      return {};
    },
  });
  const tree = mod.exports.default({
    data: { info: { id: 123, genres: [], content_type: "movie", runtime: 90, vote_average: 8 } },
    topMoods,
  });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    [node.props?.children].flat(Infinity).forEach(visit);
  }
  visit(tree);
  return nodes;
}

test("audience mood has a separate heading above a wrapping row of values", () => {
  const nodes = render([{ emoji: "/images/review-icons/amazing.png", count: 2 }, { emoji: "/images/review-icons/loved-it.png", count: 1 }]);
  const group = nodes.find((node) => node.props["aria-labelledby"] === "audience-mood-heading");
  const [heading, values] = group.props.children;
  assert.equal(heading.type, "h3");
  assert.equal(heading.props.children, "Audience mood");
  assert.match(values.props.className, /mt-3 flex flex-wrap/);
  assert.equal(values.props.children.length, 2);
});

test("no audience mood heading is shown without values", () => {
  assert.equal(render([]).some((node) => node.props.id === "audience-mood-heading"), false);
});
