import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const base = "https://api.example.test/api";
const source = ts.transpileModule(
  readFileSync(new URL("../lib/turnstile.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function setup() {
  const testModule = { exports: {} },
    calls = [];
  vm.runInNewContext(source, {
    module: testModule,
    exports: testModule.exports,
    Request,
    Response,
    URL,
    Headers,
    AbortSignal,
    process: { env: { NEXT_PUBLIC_API_URL: base } },
    require: () => ({
      createAppError: (value) => ({ isOperational: true, ...value }),
    }),
    fetch: async (input, init) => {
      calls.push(new Request(input, init));
      return Response.json({ ok: true });
    },
  });
  return { ...testModule.exports, calls };
}

test("route/action policy covers all protected endpoints, never GETs or third parties", () => {
  const { humanActionFor } = setup();
  for (const [path, expected] of [
    ["/auth/signup", "signup"],
    ["/auth/signin", "signin"],
    ["/auth/request-reset", "password_reset"],
    ["/reviews", "review"],
    ["/reviews/id/replies", "reply"],
    ["/community/posts", "review"],
    ["/community/posts/id/replies", "reply"],
    ["/reviews/id/snapshot", "snapshot"],
    ["/content/movie/1/snapshot", "snapshot"],
  ]) {
    assert.equal(humanActionFor(base + path, "POST"), expected);
    assert.equal(humanActionFor(base + path, "GET"), null);
    assert.equal(
      humanActionFor("https://third-party.example/api" + path, "POST"),
      null,
    );
  }
  for (const path of [
    "/auth/refresh",
    "/auth/logout",
    "/auth/bootstrap",
    "/watchlist/toggle",
    "/community/posts/id/reactions",
    "/community/replies/id/reactions",
  ])
    assert.equal(humanActionFor(base + path, "POST"), null);
});

test("public browsing does not wait on or request CAPTCHA", async () => {
  const client = setup();
  await client.captchaFetch(base + "/movies/details/1");
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].headers.has("x-turnstile-token"), false);
});

test("sensitive actions fail closed when the challenge provider is unavailable", async () => {
  const client = setup();
  await assert.rejects(
    client.captchaFetch(base + "/auth/signup", { method: "POST" }),
    (error) => error.code === "CAPTCHA_REQUIRED",
  );
  assert.equal(client.calls.length, 0);
});

test("concurrent protected operations get separate tokens in sequence", async () => {
  const client = setup();
  const actions = [];
  let sequence = 0;
  client.registerHumanChallenge(async (action) => {
    actions.push(action);
    return `fixture-token-${++sequence}`;
  });
  await Promise.all([
    client.captchaFetch(base + "/auth/signup", {
      method: "POST",
      body: "signup-body",
    }),
    client.captchaFetch(base + "/reviews", {
      method: "POST",
      body: "review-body",
    }),
  ]);
  assert.deepEqual(actions, ["signup", "review"]);
  assert.equal(
    new Set(
      client.calls.map((request) => request.headers.get("x-turnstile-token")),
    ).size,
    2,
  );
  assert.deepEqual(
    await Promise.all(client.calls.map((request) => request.text())),
    ["signup-body", "review-body"],
  );
});

test("cancelled challenges send no mutation and do not poison the next attempt", async () => {
  const client = setup();
  let cancelled = true;
  client.registerHumanChallenge(async () => {
    if (cancelled) throw client.captchaError("Cancelled");
    return "fresh-token";
  });
  await assert.rejects(
    client.captchaFetch(base + "/auth/signup", { method: "POST" }),
  );
  assert.equal(client.calls.length, 0);
  cancelled = false;
  await client.captchaFetch(base + "/auth/signup", { method: "POST" });
  assert.equal(client.calls.length, 1);
});

test("an aborted request never sends a mutation after a late challenge completion", async () => {
  const client = setup();
  const controller = new AbortController();
  client.registerHumanChallenge(async () => {
    controller.abort();
    return "too-late";
  });
  await assert.rejects(
    client.captchaFetch(base + "/reviews", {
      method: "POST",
      signal: controller.signal,
    }),
  );
  assert.equal(client.calls.length, 0);
});

test("unregistering a provider disables protected requests without bypassing verification", async () => {
  const client = setup();
  const remove = client.registerHumanChallenge(async () => "token");
  remove();
  await assert.rejects(
    client.captchaFetch(base + "/reviews", { method: "POST" }),
  );
  assert.equal(client.calls.length, 0);
});

test("security errors stay actionable through response normalization and form fallbacks", async () => {
  const transpile = (path) =>
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
  const appModule = { exports: {} };
  vm.runInNewContext(transpile("../lib/errors/app-error.ts"), {
    module: appModule,
    exports: appModule.exports,
  });
  const testModule = { exports: {} };
  vm.runInNewContext(transpile("../lib/errors/normalize-api-error.ts"), {
    module: testModule,
    exports: testModule.exports,
    Response,
    Error,
    TypeError,
    require: () => appModule.exports,
  });
  const normalized = await testModule.exports.normalizeResponseError(
    Response.json(
      {
        code: "CAPTCHA_UNAVAILABLE",
        message: "private provider detail must not be shown",
      },
      { status: 503 },
    ),
    "Generic form error",
  );
  assert.match(
    normalized.userMessage,
    /Security verification is temporarily unavailable/,
  );
  assert.ok(!normalized.userMessage.includes("private"));
  assert.equal(
    testModule.exports.normalizeApiError(normalized, "Wrong password")
      .userMessage,
    normalized.userMessage,
  );
  const cancelled = setup().captchaError(
    "Security check cancelled. Please try again.",
  );
  assert.equal(
    testModule.exports.normalizeApiError(cancelled, "Generic form error")
      .userMessage,
    cancelled.userMessage,
  );
});
