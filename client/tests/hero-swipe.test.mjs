import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../hooks/useHeroSwipe.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("require", "exports", compiled)(require, exports);

function setup() {
  let handlers;
  const calls = [];
  function Probe() {
    handlers = exports.useHeroSwipe({
      onSwipe: direction => calls.push(direction),
      pause: () => calls.push("pause"),
      resume: () => calls.push("resume"),
    });
    return null;
  }
  renderToString(React.createElement(Probe));
  return { handlers, calls };
}
const touch = (x, y, id = 1) => ({ clientX: x, clientY: y, identifier: id });
const start = (touches, control = false) => ({ touches, target: { closest: () => control ? {} : null } });

test("left and right swipes change one slide and restart the paused timer", () => {
  const { handlers, calls } = setup();
  handlers.onTouchStart(start([touch(200, 100)]));
  handlers.onTouchEnd({ changedTouches: [touch(100, 105)] });
  handlers.onTouchStart(start([touch(100, 100)]));
  handlers.onTouchEnd({ changedTouches: [touch(200, 105)] });
  assert.deepEqual(calls, ["pause", 1, "resume", "pause", -1, "resume"]);
});

test("scrolling, diagonal gestures and short taps do not change the title", () => {
  for (const end of [touch(190, 250), touch(100, 210), touch(175, 105)]) {
    const { handlers, calls } = setup();
    handlers.onTouchStart(start([touch(200, 100)]));
    handlers.onTouchEnd({ changedTouches: [end] });
    assert.deepEqual(calls, ["pause", "resume"]);
  }
});

test("controls, native poster rails, and multi-touch do not trigger swipes", () => {
  const { handlers, calls } = setup();
  handlers.onTouchStart(start([touch(200, 100)], true));
  handlers.onTouchEnd({ changedTouches: [touch(100, 100)] });
  handlers.onTouchStart(start([touch(200, 100), touch(210, 110, 2)]));
  handlers.onTouchEnd({ changedTouches: [touch(100, 100)] });
  assert.deepEqual(calls, []);
});

test("cancelled or unrelated touches do not leave autoplay paused or advance a slide", () => {
  const { handlers, calls } = setup();
  handlers.onTouchStart(start([touch(200, 100)]));
  handlers.onTouchCancel();
  handlers.onTouchEnd({ changedTouches: [touch(100, 100)] });
  handlers.onTouchStart(start([touch(200, 100)]));
  handlers.onTouchEnd({ changedTouches: [touch(100, 100, 2)] });
  assert.deepEqual(calls, ["pause", "resume", "pause", "resume"]);
});
