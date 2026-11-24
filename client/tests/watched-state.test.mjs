import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../hooks/useWatched.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup(request) {
  let auth = { isAuthenticated: true, user: { id: "one" } }, epoch = 0;
  const effects = [], calls = [], events = [];
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, AbortController, Event,
    window: { dispatchEvent: event => events.push(event.type) },
    require: name => {
      if (name === "react") return {
        useEffect: effect => effects.push(effect),
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
        useCallback: callback => callback,
      };
      if (name.includes("AuthProvider")) return { useAuth: () => auth };
      if (name.includes("auth/session")) return { sessionEpoch: () => epoch };
      return { ACHIEVEMENTS_CHANGED: "changed", achievementRequest: async (path, init) => {
        calls.push({ path, ...init }); return request(path, init);
      } };
    },
  });
  return {
    read: (id = 1, type = "movie") => mod.exports.useWatched(id, type),
    mount: () => { effects.splice(0).forEach(effect => effect()); },
    account: id => { epoch++; auth = { isAuthenticated: !!id, user: id ? { id } : null }; },
    calls, events,
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test("a shelf shares one bulk read and distinguishes movie and TV IDs", async () => {
  const state = setup(async () => ({ enabled: true, titles: [{ tmdbId: 1, type: "movie" }] }));
  for (let id = 1; id <= 40; id++) state.read(id);
  state.mount(); await tick();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].path, "/watched");
  assert.equal(state.read().watched, true);
  assert.equal(state.read(1, "tv").watched, false);
  assert.equal(state.read().ready, true);
});
test("a mutation shares busy and confirmed membership across consumers", async () => {
  let resolve;
  const state = setup(async (path) => path === "/watched"
    ? { enabled: true, titles: [] }
    : new Promise(done => { resolve = done; }));
  state.read(); state.mount(); await tick();
  const first = state.read().toggle();
  assert.equal(state.read().busy, true);
  assert.equal(await state.read().toggle(), false);
  assert.equal(state.calls.length, 2);
  assert.equal(state.calls[1].method, "PUT");
  assert.equal(JSON.parse(state.calls[1].body).active, true);
  resolve({ enabled: true, watched: true }); assert.equal(await first, true);
  assert.equal(state.read().watched, true);
  assert.equal(state.read().busy, false);
  assert.deepEqual(state.events, ["changed"]);
});
test("failed reads can retry and failed mutations preserve confirmed state", async () => {
  let failRead = true;
  const state = setup(async path => {
    if (path !== "/watched") throw Error("offline");
    if (failRead) throw Error("offline");
    return { enabled: true, titles: [{ tmdbId: 1, type: "movie" }] };
  });
  state.read(); state.mount(); await tick();
  assert.ok(state.read().error); assert.equal(state.read().ready, false);
  for (let id = 2; id <= 40; id++) state.read(id);
  state.mount(); await tick();
  assert.equal(state.calls.length, 1, "new cards do not retry a failed account read");
  failRead = false; await state.read().toggle();
  assert.equal(state.read().watched, true);
  await assert.rejects(state.read().toggle());
  assert.equal(state.read().watched, true);
  assert.equal(state.read().busy, false);
  assert.ok(state.read().error);
});
test("switching accounts discards an old response and signing out clears membership", async () => {
  let resolveOld;
  const state = setup(async () => state.calls.length === 1
    ? new Promise(resolve => { resolveOld = resolve; })
    : { enabled: true, titles: [] });
  state.read(); state.mount();
  state.account("two"); assert.equal(state.read().watched, false); state.mount(); await tick();
  resolveOld({ enabled: true, titles: [{ tmdbId: 1, type: "movie" }] }); await tick();
  assert.equal(state.read().watched, false); assert.equal(state.calls.length, 2);
  state.account(null); assert.equal(state.read().watched, false); state.mount();
  assert.equal(state.calls.length, 2);
});
test("disabled achievements expose no watched actions or mutations", async () => {
  const state = setup(async () => ({ enabled: false, titles: [] }));
  state.read(); state.mount(); await tick();
  assert.equal(state.read().enabled, false); await state.read().toggle();
  assert.equal(state.calls.length, 1);
});
test("an old account mutation cannot change a new account or send achievement notifications", async () => {
  let resolveMutation;
  const state = setup(async path => path === "/watched"
    ? { enabled: true, titles: [] }
    : new Promise(resolve => { resolveMutation = resolve; }));
  state.read(); state.mount(); await tick();
  const mutation = state.read().toggle();
  state.account("two"); state.read(); state.mount(); await tick();
  resolveMutation({ enabled: true, watched: true }); assert.equal(await mutation, false);
  assert.equal(state.read().watched, false);
  assert.equal(state.read().busy, false);
  assert.deepEqual(state.events, []);
});
test("signing back into the same account reloads membership", async () => {
  let titles = [{ tmdbId: 1, type: "movie" }];
  const state = setup(async () => ({ enabled: true, titles }));
  state.read(); state.mount(); await tick();
  assert.equal(state.read().watched, true);
  state.account(null); state.read(); state.mount();
  titles = [];
  state.account("one"); assert.equal(state.read().watched, false); state.mount(); await tick();
  assert.equal(state.read().watched, false);
  assert.equal(state.calls.length, 2);
});
