import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the frontend deployment requires no R2 subscription or cache Durable Objects", () => {
  const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.r2_buckets?.length ?? 0, 0);
  assert.equal(config.durable_objects?.bindings?.length ?? 0, 0);
  assert.equal(config.migrations?.length ?? 0, 0);
  assert.equal(config.services?.length ?? 0, 0);
});
