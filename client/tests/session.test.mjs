import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/auth/session.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const base = "https://api.example.test/api";
const json = (body, status = 200) => Response.json(body, { status });
function setup(handler, extras = {}) {
  const mod = { exports: {} }, calls = [], events = [];
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_API_URL: base } },
    Request, Response, URL, AbortSignal, console, ...extras,
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      calls.push(request);
      return handler(request);
    },
    require: () => ({ createAppError: (error) => ({ isOperational: true, ...error }) }),
  });
  mod.exports.subscribeSession((event) => events.push(event));
  return { ...mod.exports, calls, events };
}

test("concurrent rejected requests share one refresh and replay their bodies once", async () => {
  let refreshed = false, mutations = 0, refreshCalls = 0;
  const bodies = [];
  const session = setup(async (request) => {
    if (request.url.endsWith("/bootstrap")) return json({ user: null });
    if (request.url.endsWith("/refresh")) {
      refreshCalls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      refreshed = true;
      return json({ ok: true });
    }
    if (!refreshed) return json({}, 401);
    mutations++;
    bodies.push(await request.json());
    return json({ ok: true });
  });
  const responses = await Promise.all(Array.from({ length: 5 }, (_, id) => session.sessionFetch(base + "/watchlist/toggle", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
  })));
  assert.ok(responses.every((response) => response.ok));
  assert.equal(refreshCalls, 1);
  assert.equal(mutations, 5);
  assert.deepEqual(bodies.map((body) => body.id).sort(), [0, 1, 2, 3, 4]);
  assert.ok(session.calls.every((request) => request.credentials === "include"));
});

for (const status of [429, 500, 503]) test(`refresh ${status} preserves login instead of publishing expiry`, async () => {
  const session = setup((request) => request.url.endsWith("/bootstrap") ? json({ user: null }) : json({}, request.url.endsWith("/refresh") ? status : 401));
  await assert.rejects(session.sessionFetch(base + "/liked"), (error) => error.code === "AUTH_TEMPORARILY_UNAVAILABLE");
  assert.deepEqual(session.events, []);
});

test("offline refresh preserves the session", async () => {
  const session = setup((request) => {
    if (request.url.endsWith("/bootstrap")) throw new TypeError("Failed to fetch");
    return json({}, 401);
  });
  await assert.rejects(session.sessionFetch(base + "/liked"), (error) => error.type === "NETWORK");
  assert.deepEqual(session.events, []);
});

test("confirmed expired refresh publishes expiry once", async () => {
  const session = setup((request) => request.url.endsWith("/bootstrap") ? json({ user: null }) : json({}, 401));
  assert.equal((await session.sessionFetch(base + "/liked")).status, 401);
  assert.equal((await session.sessionFetch(base + "/liked")).status, 401);
  assert.deepEqual(session.events, ["expired"]);
});

test("bootstrap recovers from cookies without any local-storage marker", async () => {
  let authenticated = false;
  const session = setup((request) => {
    if (request.url.endsWith("/refresh")) { authenticated = true; return json({ ok: true }); }
    return json({ user: authenticated ? { id: "member" } : null });
  });
  const boot = await (await session.fetchSessionBootstrap()).json();
  assert.equal(boot.user.id, "member");
  assert.deepEqual(session.events, ["recovered"]);
});

test("a tab rechecks cookies after acquiring the shared browser lock", async () => {
  let locked = false;
  const session = setup((request) => {
    assert.equal(locked, true);
    assert.ok(request.url.endsWith("/bootstrap"));
    return json({ user: { id: "member" } });
  }, { navigator: { locks: { request: async (_name, run) => { locked = true; try { return await run(); } finally { locked = false; } } } } });
  assert.equal((await session.refreshSession()).status, "refreshed");
  assert.equal(session.calls.length, 1);
  assert.deepEqual(session.events, ["recovered"]);
});

test("a route-specific 401 with valid cookies never expires the session or loops", async () => {
  const session = setup((request) => request.url.endsWith("/bootstrap") ? json({ user: { id: "member" } }) : json({}, 401));
  assert.equal((await session.sessionFetch(base + "/auth/change-password")).status, 401);
  assert.ok(!session.events.includes("expired"));
  assert.equal(session.calls.filter((request) => request.url.endsWith("/change-password")).length, 2);
  assert.ok(!session.calls.some((request) => request.url.endsWith("/refresh")));
});

test("an ambiguous network failure never retries a mutation", async () => {
  const session = setup(() => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(session.sessionFetch(base + "/reviews", { method: "POST", body: "review" }));
  assert.equal(session.calls.length, 1);
});

test("aborting one request does not cancel another request's shared refresh", async () => {
  const controller = new AbortController();
  let refreshed = false;
  const session = setup(async (request) => {
    if (request.url.endsWith("/bootstrap")) return json({ user: null });
    if (request.url.endsWith("/refresh")) {
      controller.abort();
      refreshed = true;
      return json({ ok: true });
    }
    return json({}, refreshed ? 200 : 401);
  });
  const results = await Promise.allSettled([
    session.sessionFetch(base + "/liked", { signal: controller.signal }),
    session.sessionFetch(base + "/watchlist"),
  ]);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "fulfilled");
  assert.equal(results[1].value.status, 200);
});

test("failed logout preserves state; successful logout signals other tabs", async () => {
  let status = 503;
  const session = setup(() => json({}, status));
  await assert.rejects(session.endSession());
  assert.deepEqual(session.events, []);
  status = 200;
  await session.endSession();
  assert.deepEqual(session.events, ["signed-out"]);
});

test("external URLs never receive extra credentials or refresh handling", async () => {
  const session = setup(() => json({}, 401));
  await session.sessionFetch("https://external.example.test/resource");
  assert.equal(session.calls.length, 1);
  assert.equal(session.calls[0].credentials, "same-origin");
  assert.deepEqual(session.events, []);
});

test("independent tabs coordinate one refresh through a shared browser lock", async () => {
  let queue = Promise.resolve(), authenticated = false, refreshes = 0;
  const navigator = { locks: { request(_name, run) {
    const current = queue.then(run);
    queue = current.catch(() => {});
    return current;
  } } };
  const handler = async (request) => {
    if (request.url.endsWith("/bootstrap")) return json({ user: authenticated ? { id: "member" } : null });
    if (request.url.endsWith("/refresh")) { refreshes++; authenticated = true; return json({ ok: true }); }
    return json({}, authenticated ? 200 : 401);
  };
  const first = setup(handler, { navigator }), second = setup(handler, { navigator });
  const responses = await Promise.all([first.sessionFetch(base + "/liked"), second.sessionFetch(base + "/watchlist")]);
  assert.ok(responses.every((response) => response.ok));
  assert.equal(refreshes, 1);
});

test("account changes cancel an old action before it can be retried as another user", async () => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const session = setup(async (request) => {
    if (request.url.endsWith("/signin")) return json({ ok: true });
    await waiting;
    return json({}, 401);
  });
  const action = session.sessionFetch(base + "/watchlist/toggle", { method: "POST", body: "old-account-action" });
  await session.authenticateSession(base + "/auth/signin", { method: "POST", body: "synthetic-credentials" });
  release();
  await assert.rejects(action, (error) => error.code === "AUTH_SESSION_CHANGED");
  assert.equal(session.calls.filter((request) => request.url.endsWith("/toggle")).length, 1);
  assert.ok(!session.calls.some((request) => request.url.endsWith("/refresh")));
});

test("disabled browser storage cannot prevent cookie renewal", async () => {
  const session = setup((request) => request.url.endsWith("/bootstrap") ? json({ user: null }) : json({ ok: true }), {
    window: { addEventListener() {}, removeEventListener() {}, localStorage: { setItem() { throw new Error("Storage blocked"); } } },
  });
  assert.equal((await session.refreshSession()).status, "refreshed");
  assert.deepEqual(session.events, ["recovered"]);
});

test("an explicit cookie-free guest bootstrap needs no refresh request", async () => {
  const session = setup(() => json({ user: null, canRefresh: false }));
  assert.equal((await (await session.fetchSessionBootstrap()).json()).user, null);
  assert.equal(session.calls.length, 1);
  assert.deepEqual(session.events, []);
});

test("storage markers cannot change the initial server/client render", () => {
  const providerCode = ts.transpileModule(readFileSync(new URL("../app/context/AuthProvider.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  function initialRender(browser) {
    const mod = { exports: {} };
    const react = {
      createContext: () => ({ Provider: "provider" }), useCallback: (fn) => fn,
      useEffect() {}, useMemo: (fn) => fn(),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    };
    vm.runInNewContext(providerCode, {
      module: mod, exports: mod.exports, process: { env: {} }, URLSearchParams,
      ...(browser ? {
        window: { localStorage: { getItem: (key) => key === "moodies:session" ? "1" : null }, location: { search: "" } },
        document: { cookie: "mood_session=1" },
      } : {}),
      require(name) {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
        return {};
      },
    });
    return mod.exports.AuthProvider({ children: "page-content", initialBlockSessionBootstrap: false }).props.children;
  }
  assert.equal(initialRender(false), "page-content");
  assert.equal(initialRender(true), "page-content");
});
