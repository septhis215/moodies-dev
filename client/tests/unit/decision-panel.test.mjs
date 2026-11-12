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
      if (name === "../AudienceMood") return { AudienceMood: "AudienceMood" };
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

test("decision panel passes its votes to the shared audience distribution and links to full reviews", () => {
  const moods = [{ emoji: "/images/review-icons/amazing.png", count: 2 }, { emoji: "/images/review-icons/loved-it.png", count: 1 }];
  const nodes = render(moods);
  const distribution = nodes.find(node => node.type === 'AudienceMood');
  assert.equal(distribution.props.moods, moods);
  assert.equal(distribution.props.showAll, undefined, 'Title summaries retain the top-three view');
  assert.ok(nodes.some(node => node.type === 'Link' && node.props.href === '/movies/123/reviews'));
});

test("empty decision panels let the shared distribution render its honest empty state", () => {
  assert.equal(render([]).find(node => node.type === 'AudienceMood').props.moods.length, 0);
});
