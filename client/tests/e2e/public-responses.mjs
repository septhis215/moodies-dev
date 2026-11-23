import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8787";
const status = response => response.headers.get("x-opennext-cache") ?? response.headers.get("x-nextjs-cache");
async function home(cookie = "") {
  const response = await fetch(baseUrl, { headers: { cookie }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null, "Public HTML must not set a visitor's session");
  const body = await response.text();
  assert.ok(body.includes("homepage-browse"));
  assert.notEqual(status(response), "HIT", "Storage-free deployment must not rely on ISR cache hits");
  assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
  return body;
}
await home();
const returning = await home("mood_session=1; mood_at=synthetic-session-hint");
assert.ok(!returning.includes("synthetic-session-hint"));
const dynamic = await fetch(new URL("/movies/550", baseUrl), { signal: AbortSignal.timeout(30000) });
await dynamic.arrayBuffer();
assert.equal(dynamic.status, 200);
assert.notEqual(status(dynamic), "HIT", "Live title pages must retain their dynamic rendering");
assert.match(dynamic.headers.get("cache-control") ?? "", /private.*no-store/);
console.log("Guest/member hints render safely; homepage and title responses remain private/no-store without R2.");
