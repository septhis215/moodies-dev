import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/selected-content/AudienceMood.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const testModule = { exports: {} };
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(compiled, {
  module: testModule, exports: testModule.exports,
  require(name) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name.endsWith(".module.css")) return { default: {} };
    return {};
  },
});
const { audienceMoodImage, audienceMoodColor, getAudienceMoodSummary } = testModule.exports;

test("audience mood images support stored paths and legacy emoji values", () => {
  assert.equal(audienceMoodImage("/images/review-icons/loved-it.png"), "/images/review-icons/loved-it.png");
  assert.equal(audienceMoodImage("😍"), "/images/review-icons/loved-it.png");
  assert.equal(audienceMoodImage("🤩"), "/images/review-icons/amazing.png");
  assert.equal(audienceMoodImage("unknown"), "/images/moodies-mascot.png");
  assert.equal(audienceMoodImage("https://other.example/image.png"), "/images/moodies-mascot.png");
});

test("each mood has its own color shared by image paths and legacy emoji", () => {
  const colors = ["😍", "🤩", "😊", "🙂", "😐", "👎"].map(audienceMoodColor);
  assert.equal(new Set(colors).size, 6);
  assert.equal(audienceMoodColor("😍"), audienceMoodColor("/images/review-icons/loved-it.png"));
  assert.equal(audienceMoodColor("🤩"), audienceMoodColor("/images/review-icons/amazing.png"));
  assert.notEqual(audienceMoodColor("unknown"), audienceMoodColor("😍"));
});

test("mood legend colors stay consistent when vote rankings change", () => {
  function legendColors(moods) {
    const tree = testModule.exports.AudienceMood({ moods });
    const list = tree.props.children.find(node => node?.type === "ul");
    return Object.fromEntries(list.props.children.map(item => {
      const heading = item.props.children[1].props.children[0];
      return [textContent(heading), heading.props.children[0].props.style.background];
    }));
  }
  const first = legendColors([{ emoji: "😍", count: 8 }, { emoji: "🤩", count: 5 }]);
  const second = legendColors([{ emoji: "😍", count: 5 }, { emoji: "🤩", count: 8 }]);
  assert.equal(first["Loved it"], second["Loved it"]);
  assert.equal(first.Amazing, second.Amazing);
  assert.notEqual(first.Amazing, first["Loved it"]);
});

test("audience summary finds the leader without changing vote order", () => {
  const moods = [{ emoji: "🙂", count: 2 }, { emoji: "😍", count: 8 }, { emoji: "🤩", count: 5 }, { emoji: "😐", count: 1 }];
  const summary = getAudienceMoodSummary(moods);
  assert.equal(summary.total, 16);
  assert.equal(summary.leaders[0].emoji, "😍");
  assert.equal(summary.percent, 50);
  assert.equal(summary.other, 1);
  assert.equal(moods[0].emoji, "🙂");
});

test("audience summary includes votes outside the top moods", () => {
  const summary = getAudienceMoodSummary([{ emoji: "😍", count: 8 }], 20);
  assert.equal(summary.percent, 40);
  assert.equal(summary.other, 12);
});

test("empty and zero-vote audiences have no mood reveal", () => {
  assert.equal(getAudienceMoodSummary([]), null);
  assert.equal(getAudienceMoodSummary([{ emoji: "😍", count: 0 }]), null);
  assert.equal(getAudienceMoodSummary([{ emoji: "😍", count: 2 }], 0), null);
});

function poster({ reducedMotion = false } = {}) {
  let state;
  const jsx = (type, props) => ({ type, props });
  const componentModule = { exports: {} };
  const componentSource = readFileSync(new URL("../../components/selected-content/AudienceMoodPoster.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(componentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: componentModule,
    exports: componentModule.exports,
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    require(name) {
      if (name === "react") return {
        useId: () => "mood-caption",
        useState: (initial) => {
          state ??= initial;
          return [state, (value) => { state = typeof value === "function" ? value(state) : value; }];
        },
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "./AudienceMood") return testModule.exports;
      if (name.endsWith(".module.css")) return { default: {} };
      return {};
    },
  });
  return () => componentModule.exports.AudienceMoodPoster({
    title: "Example", poster: "/poster.jpg",
    moods: [{ emoji: "/images/review-icons/amazing.png", count: 8 }],
  });
}

test("hover and focus never reveal the mascot; click toggles it", () => {
  const render = poster();
  const button = render();
  assert.equal(button.props["aria-expanded"], false);
  button.props.onPointerEnter?.({ pointerType: "mouse" });
  assert.equal(render().props["aria-expanded"], false);
  button.props.onFocus?.({ currentTarget: { matches: () => true } });
  assert.equal(render().props["aria-expanded"], false);
  button.props.onClick();
  assert.equal(render().props["aria-expanded"], true);
  render().props.onPointerLeave?.({ pointerType: "mouse" });
  assert.equal(render().props["aria-expanded"], true);
  render().props.onClick();
  assert.equal(render().props["aria-expanded"], false);
});

test("speech bubble contains only the mood value and exclamation mark", () => {
  const render = poster();
  const caption = render().props.children.find((child) => child.props?.id === "mood-caption");
  function text(node) {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(text).join("");
    return node?.props ? text(node.props.children) : "";
  }
  assert.equal(text(caption), "Amazing!");
});

test("Escape closes a clicked mood reveal", () => {
  const render = poster();
  render().props.onClick();
  let prevented = false;
  render().props.onKeyDown({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(render().props["aria-expanded"], false);
  assert.equal(prevented, true);
});

test("a second click returns the mascot behind the poster before resetting", () => {
  const render = poster();
  render().props.onClick();
  render().props.onClick();
  assert.equal(render().props["aria-expanded"], false);
  assert.equal(render().props["data-closing"], true);
  const mascot = render().props.children.find((child) => child.props?.onAnimationEnd);
  mascot.props.onAnimationEnd();
  assert.equal(render().props["data-closing"], false);
});

test("reduced motion closes the mascot without waiting for an animation", () => {
  const render = poster({ reducedMotion: true });
  render().props.onClick();
  render().props.onClick();
  assert.equal(render().props["aria-expanded"], false);
  assert.equal(render().props["data-closing"], false);
});

function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return node?.props ? textContent(node.props.children) : "";
}

test("full audience distribution labels its vote source and accounts for other moods", () => {
  const distribution = testModule.exports.AudienceMood({
    moods: [{ emoji: "😍", count: 8 }, { emoji: "🤩", count: 5 }, { emoji: "🙂", count: 4 }], totalVotes: 20,
  });
  const text = textContent(distribution);
  assert.match(text, /Based on 20 mood votes/);
  assert.match(text, /Loved it/);
  assert.match(text, /40%/);
  assert.match(text, /Other moods/);
  assert.match(text, /3 votes/);
  assert.match(text, /15%/);
});

test("full audience distribution presents an honest empty state", () => {
  const distribution = testModule.exports.AudienceMood({ moods: [] });
  assert.match(textContent(distribution), /No mood votes yet/);
  assert.doesNotMatch(textContent(distribution), /0%/);
  assert.equal(testModule.exports.AudienceMood({ moods: [], compact: true }), null);
});

test("all-mood distribution displays every recorded mood and its proportional segment", () => {
  const moods = ['loved-it', 'amazing', 'enjoyed-it', 'its-okay', 'meh', 'skip-it'].map((name, index) => ({ emoji: `/images/review-icons/${name}.png`, count: 6 - index }));
  const tree = testModule.exports.AudienceMood({ moods, showAll: true });
  const list = tree.props.children.find(node => node?.type === 'ul');
  assert.equal(list.props['aria-label'], 'All audience moods');
  assert.equal(list.props.children.length, 6);
  assert.match(textContent(tree), /Disliked/);
  assert.doesNotMatch(textContent(tree), /Other moods/);
  const segments = tree.props.children[1].props.children[0];
  assert.equal(segments.length, 6);
  assert.ok(Math.abs(segments.reduce((sum, segment) => sum + parseFloat(segment.props.style.width), 0) - 100) < 0.01);
  assert.equal(moods[0].count, 6);
});
