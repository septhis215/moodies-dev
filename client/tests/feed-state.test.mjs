import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../app/feed/feed-state.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { getReleaseStatus, getSwipeDirection, normalizeWheelDelta } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );

test("release status comes from calendar dates, not ratings", () => {
  const today = new Date(2026, 9, 4, 23, 30);
  assert.equal(getReleaseStatus("2026-10-05", today), "upcoming");
  assert.equal(getReleaseStatus("2026-10-04", today), "released");
  assert.equal(getReleaseStatus("2024-01-01", today), "released");
  assert.equal(getReleaseStatus(undefined, today), "unknown");
  assert.equal(getReleaseStatus("not-a-date", today), "unknown");
});

test("swipes reject taps and horizontal or ambiguous gestures", () => {
  assert.equal(getSwipeDirection(0, -59), 0);
  assert.equal(getSwipeDirection(100, -90), 0);
  assert.equal(getSwipeDirection(10, -90), 1);
  assert.equal(getSwipeDirection(-10, 90), -1);
});

test("wheel inputs normalize pixels, lines and pages", () => {
  assert.equal(normalizeWheelDelta(4, 0, 812), 4);
  assert.equal(normalizeWheelDelta(4, 1, 812), 64);
  assert.equal(normalizeWheelDelta(-1, 2, 812), -812);
});
