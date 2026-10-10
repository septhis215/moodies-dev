import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
const reviewsCode = compile("../../components/selected-content/extended/allReviews.tsx");
const layoutCode = compile("../../app/client-layout.tsx");
const info = { id: 123, title: "Lanterns", release_date: "2026", content_type: "tv", genres: [], vote_average: 8.4, vote_count: 477 };
const review = (id, author, rating, date) => ({ id, author, author_details: { rating }, content: `${author}'s thoughtful review`, created_at: date, updated_at: date, url: "" });

function harness(code, { reviews = [], authenticated = true, pathname = "/tv/123/reviews" } = {}) {
  const mod = { exports: {} }, states = [], messages = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, process: { env: {} }, console,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "react") return {
        useMemo: (fn) => fn(), useEffect() {}, Suspense: "Suspense",
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
          return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
      };
      if (name === "next/link") return { default: "Link" };
      if (name === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ refresh() {} }) };
      if (name === "framer-motion") return { motion: { div: "motion.div" }, AnimatePresence: "AnimatePresence" };
      if (name === "@/app/context/AuthProvider") return { useAuth: () => ({ isAuthenticated: authenticated, user: { id: "me" } }) };
      if (name === "@/hooks/useReviewBanStatus") return { useReviewBanStatus: () => ({ banStatus: { banned: false } }) };
      if (name === "@/app/context/ToastContext") return { useToast: () => ({ toast: (...args) => messages.push(args) }) };
      if (name === "@/hooks/useScrollToHash") return { useScrollToHash() {} };
      if (name === "@/components/Navbar") return { NavbarComponent: "Navbar" };
      return {};
    },
  });
  return { states, messages, render(props = { reviews, info, id: "123" }) {
    cursor = 0;
    const nodes = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      [node.props?.children].flat(Infinity).forEach(walk);
    };
    walk(mod.exports.default(props));
    return nodes;
  } };
}

test("empty all-reviews page has one write action and contextual title navigation", () => {
  const nodes = harness(reviewsCode).render();
  assert.equal(nodes.filter((n) => n.props?.["aria-label"] === "Write a review").length, 1);
  assert.ok(nodes.some((n) => n.type === "nav" && n.props["aria-label"] === "Title navigation"));
  assert.ok(nodes.some((n) => n.type === "Link" && n.props.href === "/tv/123"));
  assert.ok(nodes.some((n) => n.props["aria-current"] === "page"));
});

test("toolbar preserves latest/highest sorting and author search with reset", () => {
  const app = harness(reviewsCode, { reviews: [review("older", "Alex", 10, "2026-01-01"), review("newer", "Sam", 6, "2026-02-01")] });
  const ids = (nodes) => nodes.filter((n) => n.props?.id?.startsWith("review-")).map((n) => n.props.id);
  let nodes = app.render();
  assert.deepEqual(ids(nodes), ["review-newer", "review-older"]);
  nodes.find((n) => n.type === "select").props.onChange({ target: { value: "highest" } });
  nodes = app.render();
  assert.deepEqual(ids(nodes), ["review-older", "review-newer"]);
  nodes.find((n) => n.type === "input").props.onChange({ target: { value: "Alex" } });
  nodes = app.render();
  assert.deepEqual(ids(nodes), ["review-older"]);
  nodes.find((n) => n.props["aria-label"] === "Clear search").props.onClick();
  assert.equal(ids(app.render()).length, 2);
});

test("write action retains sign-in protection", () => {
  const app = harness(reviewsCode, { authenticated: false });
  app.render().find((n) => n.props["aria-label"] === "Write a review").props.onClick();
  assert.equal(app.messages.length, 1);
  assert.equal(app.messages[0][0], "Sign in to write a review.");
});

test("shared navigation appears on movie and series reviews/credits but stays hidden on auth/feed", () => {
  for (const pathname of ["/movies/123/reviews", "/tv/123/reviews", "/movies/123/credits", "/tv/123/credits"]) {
    const navbar = harness(layoutCode, { pathname }).render({ children: "page" }).find((n) => n.type === "Navbar");
    assert.ok(navbar);
    assert.equal(navbar.props.transparent, true);
  }
  for (const pathname of ["/feed", "/auth/login"]) {
    assert.equal(harness(layoutCode, { pathname }).render({ children: "page" }).some((n) => n.type === "Navbar"), false);
  }
});

test("review header gives the title its own hierarchy and groups real audience signals", () => {
  const topMoods = [
    { emoji: "/images/review-icons/enjoyed-it.png", count: 1 },
    { emoji: "/images/review-icons/loved-it.png", count: 3 },
  ];
  const nodes = harness(reviewsCode).render({
    reviews: [], info, id: "123", topMoods,
    reviewStats: { totalRatings: 1, averageRating: 10 },
  });
  assert.equal(nodes.find((n) => n.type === "h1").props.children, "Lanterns");
  assert.ok(nodes.some((n) => n.type === "section" && n.props["aria-labelledby"] === "audience-pulse-heading"));
  assert.ok(nodes.some((n) => n.type === "p" && n.props.children === "Loved It"));
  assert.ok(nodes.some((n) => n.type === "span" && n.props.children === "10.0"));
  assert.ok(nodes.some((n) => n.type === "span" && n.props.children === "1 rating"));
  assert.ok(nodes.some((n) => n.type === "span" && n.props.children === "477 votes"));
  assert.equal(nodes.filter((n) => n.type === "circle").length, 0);
  assert.equal(topMoods[0].count, 1, "Rendering must not mutate API mood ordering");
});

test("missing audience signals render honest empty summaries without a fabricated mood", () => {
  const nodes = harness(reviewsCode).render({ reviews: [], info: { ...info, vote_count: 0, vote_average: 0 } });
  assert.ok(nodes.some((n) => n.props.children === "Not rated yet"));
  assert.ok(nodes.some((n) => n.props.children === "No votes yet"));
  assert.equal(nodes.some((n) => n.props.children === "Most shared mood"), false);
});

test("movie header retains runtime and long title without series metadata", () => {
  const title = "A very long film title that needs to wrap naturally in the review header";
  const nodes = harness(reviewsCode).render({ reviews: [], info: { ...info, title, content_type: "movie", runtime: 142 } });
  const heading = nodes.find((n) => n.type === "h1");
  assert.equal(heading.props.children, title);
  assert.match(heading.props.className, /break-words/);
  assert.ok(nodes.some((n) => n.type === "Link" && n.props.href === "/movies/123"));
  assert.ok(nodes.some((n) => n.type === "span" && Array.isArray(n.props.children) && n.props.children[0] === 142));
});

test("review and reply utilities use compact, quiet styling without shrinking touch targets", () => {
  const item = {
    ...review("thread", "Alex", 8, "2026-01-01"),
    replies: [{ id: "reply", content: "I agree", created_at: "2026-01-02", user: { username: "Sam" } }],
  };
  const nodes = harness(reviewsCode, { reviews: [item] }).render();
  const replies = nodes.filter((n) => n.type === "button" && Array.isArray(n.props.children) && n.props.children[0]?.trim?.() === "Reply");
  assert.equal(replies.length, 2);
  const reactions = nodes.filter((n) => typeof n.props.onReact === "function");
  assert.equal(reactions.length, 2);
  const buttons = [...replies, ...reactions.map((node) => node.type(node.props).props.children[0])];
  for (const button of buttons) {
    assert.match(button.props.className, /min-h-8/);
    assert.match(button.props.className, /border-transparent bg-transparent/);
    assert.match(button.props.className, /font-semibold/);
    assert.match(button.props.className, /pointer-coarse:min-h-11/);
    assert.doesNotMatch(button.props.className, /min-h-10/);
  }
});

test("mood badge shows only its value centered beside the mascot", () => {
  const value = "/images/review-icons/amazing.png";
  const nodes = harness(reviewsCode, { reviews: [{ ...review("mood", "Alex", 10, "2026-01-01"), moodEmojis: [value] }] }).render();
  const chip = nodes.find((node) => node.props.value === value);
  const badge = chip.type(chip.props);
  assert.match(badge.props.className, /items-center/);
  const label = badge.props.children[1];
  assert.equal(label.props.children, "Amazing");
  assert.match(label.props.className, /leading-none/);
  assert.doesNotMatch(label.props.className, /uppercase/);
});
