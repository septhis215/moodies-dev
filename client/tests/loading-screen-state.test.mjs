import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../components/loading/loading-screen-state.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createLoadingScreenState } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("waits for every page loader and a full 500ms after completion", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const state = createLoadingScreenState(value => changes.push(value));
  const first = state.register();
  const second = state.register();
  first();
  t.mock.timers.tick(1000);
  assert.equal(changes.at(-1), true);
  second();
  t.mock.timers.tick(499);
  assert.equal(changes.at(-1), true);
  t.mock.timers.tick(1);
  assert.equal(changes.at(-1), false);
  state.dispose();
});

test("a new load cancels dismissal and gets its own settling delay", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const state = createLoadingScreenState(value => changes.push(value));
  state.register()();
  t.mock.timers.tick(400);
  const finish = state.register();
  t.mock.timers.tick(2000);
  assert.ok(changes.every(Boolean));
  finish();
  finish(); // Duplicate cleanup must not create another timer.
  t.mock.timers.tick(500);
  assert.equal(changes.filter(value => !value).length, 1);
  state.dispose();
});

test("cleanup cancels timers and stale releases, then allows strict-mode remount", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [];
  const state = createLoadingScreenState(value => changes.push(value));
  const stale = state.register();
  state.dispose();
  stale();
  t.mock.timers.tick(1000);
  assert.deepEqual(changes, [true]);
  state.register()();
  state.dispose();
  t.mock.timers.tick(1000);
  assert.ok(changes.every(Boolean));
  state.register()();
  t.mock.timers.tick(500);
  assert.equal(changes.at(-1), false);
  state.dispose();
});
