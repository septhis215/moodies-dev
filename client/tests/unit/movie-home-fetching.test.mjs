import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
}
const source = compile("../../app/movies/page.tsx");
const titles = { exports: {} };
vm.runInNewContext(compile("../../lib/homepage-sections.ts"), { module: titles, exports: titles.exports });

function setup(fetch) {
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports,
    process: { env: { NEST_API_URL: "https://nest.test/api" } },
    fetch, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
    require(name) {
      if (name === "react") return {};
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      if (name === "@/lib/homepage-sections") return titles.exports;
      if (name === "./MovieHomePageClient") return { __esModule: true, default: "MovieHomePageClient" };
      throw new Error(`Unexpected movie page import: ${name}`);
    },
  });
  return mod.exports.default;
}

test("movie homepage starts only its featured hero request and passes all 25 titles", async () => {
  const requests = [];
  let finish;
  const featured = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, title: `Movie ${index}` }));
  const page = setup(async url => {
    requests.push(url);
    return new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => featured }); });
  });
  const pending = page();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ["https://nest.test/api/movies/featured?limit=25"]);
  finish();
  const result = await pending;
  assert.equal(result.props.trendingMovies.length, 25);
  assert.equal(result.props.popularMovies.length, 0);
  assert.deepEqual(Object.keys(result.props).sort(), ["popularMovies", "trendingMovies"]);
  assert.equal(requests.length, 1, "Below-fold movie data must not be requested by the server page");
});

test("movie homepage requests trending only after an empty featured response", async () => {
  const requests = [];
  const fallback = [{ id: 9, title: "Trending fallback" }];
  const page = setup(async url => {
    requests.push(url);
    return { ok: true, json: async () => ({ data: requests.length === 1 ? [] : fallback }) };
  });
  const result = await page();
  assert.deepEqual(requests, [
    "https://nest.test/api/movies/featured?limit=25",
    "https://nest.test/api/movies/trending?limit=25",
  ]);
  assert.equal(result.props.trendingMovies.length, 0);
  assert.equal(result.props.popularMovies, fallback, "Reuse fallback hero data for the later ranking");
});

test("movie homepage tolerates a failed featured request without starting lower sections", async () => {
  const requests = [];
  const page = setup(async url => {
    requests.push(url);
    return { ok: requests.length > 1, status: 503, json: async () => [] };
  });
  const result = await page();
  assert.equal(requests.length, 2);
  assert.equal(result.props.trendingMovies.length, 0);
  assert.equal(result.props.popularMovies.length, 0);
});
