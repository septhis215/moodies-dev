import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/trailer-reveal.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createTrailerReveal } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("reveals after four seconds, without resetting on repeated playing signals", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const reveal = createTrailerReveal(value => changes.push(value), () => true);
  reveal.update(true);
  t.mock.timers.tick(2000);
  reveal.update(true);
  t.mock.timers.tick(1999);
  assert.deepEqual(changes, []);
  t.mock.timers.tick(1);
  assert.deepEqual(changes, [true]);
  reveal.dispose();
});
test("buffering or pause covers the player and resume gets a fresh four seconds", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const reveal = createTrailerReveal(value => changes.push(value), () => true);
  reveal.update(true);
  t.mock.timers.tick(3000);
  reveal.update(false);
  reveal.update(true);
  t.mock.timers.tick(3999);
  assert.deepEqual(changes, [false]);
  t.mock.timers.tick(1);
  reveal.update(false);
  assert.deepEqual(changes, [false, true, false]);
  reveal.dispose();
});
test("unmount or trailer replacement cancels pending reveals", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const reveal = createTrailerReveal(value => changes.push(value), () => true);
  reveal.update(true);
  reveal.dispose();
  reveal.update(true);
  t.mock.timers.tick(5000);
  assert.deepEqual(changes, []);
});
test("blocked or stopped playback cannot reveal on a stale playing signal", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const reveal = createTrailerReveal(value => changes.push(value), () => false);
  reveal.update(true);
  t.mock.timers.tick(4000);
  assert.deepEqual(changes, []);
  reveal.dispose();
});
