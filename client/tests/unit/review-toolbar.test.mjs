import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../../components/selected-content/sections/reviews.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function render(reviews, expandedIds = []) {
  const testModule = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, process: { env: {} }, console,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "react") return {
        useMemo: (callback) => callback(), useState: (initial) => [typeof initial?.has === "function" ? new Set(expandedIds) : initial, () => {}],
        useEffect() {}, useRef: (initial) => ({ current: initial }),
      };
      if (name === "next/link") return { default: "Link" };
      if (name === "framer-motion") return { motion: { div: "motion.div" }, AnimatePresence: "AnimatePresence" };
      if (name === "@/app/context/AuthProvider") return { useAuth: () => ({ isAuthenticated: true, user: { id: "me" } }) };
      if (name === "@/app/context/ToastContext") return { useToast: () => ({ toast() {} }) };
      return {};
    },
  });
  const tree = testModule.exports.default({ reviews, contentId: "123", contentType: "tv" });
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    [node.props?.children].flat(Infinity).forEach(visit);
  };
  visit(tree);
  return nodes;
}

test("empty reviews show one write action and no redundant subtitle or sorting", () => {
  const nodes = render([]);
  const writes = nodes.filter((node) => node.type === "button" && node.props["aria-label"] === "Write a review");
  assert.equal(writes.length, 1);
  assert.match(writes[0].props.className, /ui-secondary-action/);
  assert.equal(nodes.filter((node) => node.type === "select").length, 0);
  assert.equal(nodes.filter((node) => node.type === "p" && node.props.children === "No reviews yet").length, 1);
});

test("populated reviews have one sort control and concise actions", () => {
  const nodes = render([{ id: "one", userId: "other", rating: 8, content: "A thoughtful watch", createdAt: "2026-10-10" }]);
  assert.equal(nodes.filter((node) => node.type === "select").length, 1);
  const write = nodes.find((node) => node.type === "button" && node.props["aria-label"] === "Write a review");
  assert.match(write.props.className, /ui-primary-action/);
  assert.equal(write.props.children[0], "Write");
  const view = nodes.find((node) => node.type === "Link" && node.props["aria-label"] === "View all reviews");
  assert.equal(view.props.children[0], "Reviews");
  assert.equal(view.props.href, "/tv/123/reviews");
});

test("short and long previews keep equal fixed heights and bottom footers", () => {
  const nodes = render([
    { id: "short", content: "A thoughtful watch", createdAt: "2026-10-10" },
    { id: "long", content: "A longer review. ".repeat(100), createdAt: "2026-10-09" },
  ]);
  const cards = nodes.filter((node) => node.type === "motion.div" && node.props.className?.includes("group flex"));
  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.match(card.props.className, /h-80/);
    const children = card.props.children;
    assert.match(children[1].props.className, /min-h-0 flex-1/);
    assert.match(children[2].props.className, /min-h-12 shrink-0/);
  }
});

test("expanding text scrolls inside the card without changing height or column layout", () => {
  const nodes = render([{ id: "long", content: "A longer review. ".repeat(100), createdAt: "2026-10-10" }], ["long"]);
  assert.ok(nodes.some((node) => node.props.className === "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"));
  const text = nodes.find((node) => node.props.id === "review-preview-long");
  assert.match(text.props.className, /overflow-y-auto/);
  assert.equal(text.props.tabIndex, 0);
  assert.equal(text.props.role, "region");
  const toggle = nodes.find((node) => node.type === "button" && node.props["aria-controls"] === "review-preview-long");
  assert.equal(toggle.props["aria-expanded"], true);
});
