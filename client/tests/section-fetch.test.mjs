import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/section-fetch.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createSectionFetcher } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(t) {
  const calls = [];
  const releases = new Map();
  t.mock.method(globalThis, "fetch", (url, options) => new Promise((resolve, reject) => {
    calls.push({ url, options });
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    releases.set(url, (ok = true) => resolve({ ok, status: ok ? 200 : 503, json: async () => ({ url }) }));
  }));
  return { load: createSectionFetcher(), calls, releases };
}

test("public sections never exceed three active requests and queued work starts as slots free", async t => {
  const deadlines = [];
  t.mock.method(AbortSignal, "timeout", ms => { deadlines.push(ms); return new AbortController().signal; });
  const { load, calls, releases } = harness(t);
  const requests = Array.from({ length: 5 }, (_, index) => load(`/section/${index}`));
  assert.equal(calls.length, 3);
  assert.deepEqual(deadlines, [30000, 30000, 30000], "Only admitted requests start their deadline");
  releases.get("/section/0")();
  releases.get("/section/1")();
  await tick();
  assert.equal(calls.length, 5);
  assert.equal(deadlines.length, 5);
  for (const release of releases.values()) release();
  assert.equal((await Promise.all(requests)).length, 5);
  assert.ok(calls.every(call => call.options.credentials === "omit" && call.options.cache === "no-store"));
});

test("identical pending sections share a request while subscribers cancel independently", async t => {
  const { load, calls, releases } = harness(t);
  const first = new AbortController();
  const left = load("/same", first.signal);
  const right = load("/same");
  assert.equal(calls.length, 1);
  const cancelled = assert.rejects(left, { name: "AbortError" });
  first.abort();
  await cancelled;
  assert.equal(calls[0].options.signal.aborted, false);
  releases.get("/same")();
  assert.deepEqual(await right, { url: "/same" });
});

test("abandoned queued sections are skipped without deleting a replacement subscriber", async t => {
  const { load, calls, releases } = harness(t);
  const active = [load("/a"), load("/b"), load("/c")];
  const controller = new AbortController();
  const queued = load("/later", controller.signal);
  const cancelled = assert.rejects(queued, { name: "AbortError" });
  controller.abort();
  await cancelled;
  const replacement = load("/later");
  for (const release of releases.values()) release();
  await tick();
  assert.equal(calls.filter(call => call.url === "/later").length, 1);
  releases.get("/later")();
  await Promise.all([...active, replacement]);
});

test("last-subscriber cancellation aborts active transport and frees the slot", async t => {
  const { load, calls, releases } = harness(t);
  const controller = new AbortController();
  const cancelled = assert.rejects(load("/cancel", controller.signal), { name: "AbortError" });
  const rest = [load("/b"), load("/c"), load("/d")];
  controller.abort();
  await cancelled;
  await tick();
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(calls.length, 4);
  for (const [url, release] of releases) if (url !== "/cancel") release();
  await Promise.all(rest);
});

test("failed sections are not retained and can be retried", async t => {
  const { load, calls, releases } = harness(t);
  const first = assert.rejects(load("/retry"), /HTTP 503/);
  releases.get("/retry")(false);
  await first;
  const next = load("/retry");
  assert.equal(calls.length, 2);
  releases.get("/retry")();
  assert.deepEqual(await next, { url: "/retry" });
});
