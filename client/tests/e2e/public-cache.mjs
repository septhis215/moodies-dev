import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8787";
const status = response => response.headers.get("x-opennext-cache") ?? response.headers.get("x-nextjs-cache");
async function home(cookie = "") {
  const response = await fetch(baseUrl, { headers: { cookie }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null, "Public HTML must not set a visitor's session");
  const body = await response.text();
  assert.ok(body.includes("homepage-browse"));
  return { cache: status(response), body };
}
async function waitForHit() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await home();
    if (result.cache === "HIT") return result;
    await setTimeout(1000);
  }
  assert.fail("Homepage did not become a cache HIT; check bindings and the revalidation queue");
}
const guest = await waitForHit();
const returning = await home("mood_session=1; mood_at=synthetic-session-hint");
assert.equal(returning.cache, "HIT");
assert.equal(returning.body, guest.body, "Visitor hints must not change the shared public HTML");
assert.ok(!returning.body.includes("synthetic-session-hint"));
const dynamic = await fetch(new URL("/movies/550", baseUrl), { signal: AbortSignal.timeout(30000) });
await dynamic.arrayBuffer();
assert.equal(dynamic.status, 200);
assert.notEqual(status(dynamic), "HIT", "Live title pages must retain their dynamic rendering");
assert.match(dynamic.headers.get("cache-control") ?? "", /private.*no-store/);
console.log("Public HTML is shared across session hints; dynamic title responses remain private/no-store.");
if (process.argv.includes("--revalidate")) {
  console.log("Waiting 65 seconds for the existing one-minute homepage cache to expire...");
  await setTimeout(65000);
  const expired = await home();
  assert.equal(expired.cache, "STALE", "Expected time-based revalidation after the cache expires");
  await waitForHit();
  console.log("STALE → HIT: the Durable Object queue refreshed the homepage successfully.");
}
