import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mod = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL("../lib/media-release.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { module: mod, exports: mod.exports });
const { isMediaReleased } = mod.exports;
const today = "2026-11-24";

test("released and premiere-day movies/TV can be marked watched", () => {
  for (const releaseDate of ["2001-01-01", today])
    assert.equal(isMediaReleased({ releaseDate }, today), true);
});
test("future dates hide watched even when status says released", () => {
  assert.equal(isMediaReleased({ releaseDate: "2026-11-25", status: "Released" }, today), false);
  assert.equal(isMediaReleased({ releaseDate: "2027-01-01", status: "Returning Series" }, today), false);
});
test("unknown dates require a known released status", () => {
  for (const status of ["Released", "Returning Series", "Ended", "Canceled"])
    assert.equal(isMediaReleased({ status }, today), true);
  for (const status of [undefined, "", "Planned", "In Production", "Pilot", "Rumored"])
    assert.equal(isMediaReleased({ status }, today), false);
});
test("malformed and partial release dates do not imply a release", () => {
  for (const releaseDate of ["2026", "2026-02-30", "not a date", "", null, undefined])
    assert.equal(isMediaReleased({ releaseDate }, today), false);
});
