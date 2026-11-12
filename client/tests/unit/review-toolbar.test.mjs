import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../../components/selected-content/sections/reviews.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function render(reviews, reducedMotion = false) {
  const testModule = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, process: { env: {} }, console,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "react") return {
        useMemo: (callback) => callback(), useState: (initial) => [initial, () => {}],
        useEffect() {}, useRef: (initial) => ({ current: initial }),
      };
      if (name === "next/link") return { default: "Link" };
      if (name === "framer-motion") return { motion: { div: "motion.div" }, AnimatePresence: "AnimatePresence", useReducedMotion: () => reducedMotion };
      if (name === "../ReviewPreviewCard") return { ReviewPreviewCard: "ReviewPreviewCard" };
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

test("review cards receive full text for local expansion and links to their details", () => {
  const fullText = "A longer review. ".repeat(100);
  const nodes = render([
    { id: "short", content: "A thoughtful watch", createdAt: "2026-10-10" },
    { id: "long", content: fullText, createdAt: "2026-10-09", moodEmojis: ["/images/review-icons/amazing.png"] },
  ]);
  const cards = nodes.filter((node) => node.type === "ReviewPreviewCard");
  assert.equal(cards.length, 2);
  assert.equal(cards[1].props.content, fullText);
  assert.equal(cards[1].props.href, "/tv/123/reviews?highlight=long");
  assert.equal(cards[1].props.mood, "/images/review-icons/amazing.png");
});

test("owner sharing and the five-star rating remain available on previews", () => {
  const nodes = render([{ id: "mine", userId: "me", rating: 10, content: "Loved it", createdAt: "2026-10-10" }]);
  const card = nodes.find((node) => node.type === "ReviewPreviewCard");
  assert.equal(card.props.rating, 5);
  assert.equal(typeof card.props.onShare, "function");
  assert.equal(card.props.authorHref, "/profile/me");
});

test("reduced motion disables review layout and entrance animations", () => {
  const nodes = render([{ id: "one", content: "A thoughtful watch", createdAt: "2026-10-10" }], true);
  const wrapper = nodes.find((node) => node.type === "motion.div");
  assert.equal(wrapper.props.layout, false);
  assert.equal(wrapper.props.initial, false);
  assert.equal(wrapper.props.transition.duration, 0);
});
