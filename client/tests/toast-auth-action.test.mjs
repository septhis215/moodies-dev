import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

for (const [hook, operations] of [["useWatchlist", ["add", "remove"]], ["useLiked", ["like", "unlike"]]]) {
  for (const operation of operations) test(`${hook}.${operation} offers Sign in without attempting a protected mutation`, async () => {
    const warnings = [];
    const destinations = [];
    const mod = { exports: {} };
    const state = { movieIds: new Set(), seriesIds: new Set() };
    const imports = {
      react: { useCallback: callback => callback, useMemo: callback => callback(), useState: value => [value, () => {}] },
      "next/navigation": { useRouter: () => ({ push: path => destinations.push(path) }) },
      "@/app/context/AuthProvider": { useAuth: () => ({ isAuthenticated: false, watchlist: state, liked: state }) },
      "@/lib/toast": { appToast: { warning: (...args) => warnings.push(args) }, TOAST_IDS: {} },
      "@/lib/errors": { handleAppError: () => assert.fail("Authentication guidance is not an API failure") },
      "@/utils/watchlistClient": { toggleWatchlist: () => assert.fail("Must not send a guest watchlist mutation") },
      "@/utils/likedClient": { toggleLiked: () => assert.fail("Must not send a guest favorites mutation") },
    };
    const code = ts.transpileModule(readFileSync(new URL(`../hooks/${hook}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => {
      assert.ok(name in imports, `Unexpected hook import: ${name}`);
      return imports[name];
    } });
    await mod.exports[hook]()[operation](1, "movie");
    assert.equal(warnings.length, 1);
    const [message, options] = warnings[0];
    assert.match(message, /Sign in/);
    assert.equal(options.title, undefined, "The title should not repeat the sign-in instruction");
    assert.equal(options.action.label, "Sign in");
    options.action.onClick();
    assert.equal(destinations.join(","), "/auth/login");
  });
}
