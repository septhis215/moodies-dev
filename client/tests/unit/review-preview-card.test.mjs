import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props) => ({ type, props });
const helpers = { exports: {} };
vm.runInNewContext(compile("../../components/selected-content/AudienceMood.tsx"), {
  module: helpers, exports: helpers.exports, require: () => ({}),
});
const compiled = compile("../../components/selected-content/ReviewPreviewCard.tsx");

function card(content) {
  let expanded = false;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "react") return {
        useId: () => "review-text",
        useState: () => [expanded, value => { expanded = typeof value === "function" ? value(expanded) : value; }],
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "next/link") return { default: "Link" };
      if (name === "./AudienceMood") return helpers.exports;
      if (name === "@/components/ui/TmdbImage") return { TmdbImage: "Image" };
      if (name.endsWith(".module.css")) return { default: {} };
      return {};
    },
  });
  return () => {
    const tree = mod.exports.ReviewPreviewCard({ author: "Alex", avatar: "Avatar", date: "2026-11-11", rating: 4.5, content, mood: "😍", href: "/movies/550/reviews?highlight=one" });
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      [node.props?.children].flat(Infinity).forEach(visit);
    }
    visit(tree);
    return {
      text: nodes.find(node => node.props?.id === "review-text").props.children,
      toggle: nodes.find(node => node.type === "button" && node.props["aria-controls"] === "review-text"),
      arrow: nodes.find(node => node.type === "Link" && node.props["aria-label"] === "Read full review by Alex"),
      moodImage: nodes.find(node => node.type === "Image"),
    };
  };
}

test("short reviews use their natural text without an expand action", () => {
  const preview = card("A thoughtful story.")();
  assert.equal(preview.text, "A thoughtful story.");
  assert.equal(preview.toggle, undefined);
});

test("collapsed review text has at most 220 characters including its ellipsis", () => {
  const preview = card("A longer review. ".repeat(40))();
  assert.ok(Array.from(preview.text).length <= 220);
  assert.ok(preview.text.endsWith("…"));
  assert.equal(preview.toggle.props["aria-expanded"], false);
});

test("the character limit preserves whole Unicode characters", () => {
  const preview = card("🙂".repeat(230))();
  assert.equal(Array.from(preview.text).length, 220);
  assert.equal(preview.text, "🙂".repeat(219) + "…");
});

test("reviews expand and collapse locally while the detail arrow preserves its destination", () => {
  const content = "A longer review. ".repeat(40);
  const render = card(content);
  render().toggle.props.onClick();
  assert.equal(render().text, content);
  assert.equal(render().toggle.props["aria-expanded"], true);
  assert.equal(render().arrow.props.href, "/movies/550/reviews?highlight=one");
  render().toggle.props.onClick();
  assert.ok(Array.from(render().text).length <= 220);
});

test("selected moods use large recognizable artwork", () => {
  const image = card("A thoughtful story.")().moodImage;
  assert.equal(image.props.src, "/images/review-icons/loved-it.png");
  assert.ok(image.props.width >= 80 && image.props.height >= 80);
});
