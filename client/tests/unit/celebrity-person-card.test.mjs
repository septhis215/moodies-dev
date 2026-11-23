import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const jsx = (type, props) => ({ type, props });
function load(path, imports) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: name => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return module.exports.default;
}

for (const knownFor of [[], [{ id: 10, title: "A film", media_type: "movie" }, { id: 11, name: "A series", media_type: "tv" }]]) {
  test(`celebrity ${knownFor.length ? "work" : "filmography"} links avoid viewport and passing-hover prefetch while retaining keyboard intent`, () => {
    const intentType = Symbol("IntentPrefetchLink");
    let stateIndex = 0;
    const Card = load("../../components/celeb/CelebrityPersonCard.tsx", {
      react: { useRef: () => ({ current: undefined }), useEffect: () => {}, useState: value => [stateIndex++ === 2 ? true : value, () => {}] },
      "@/components/ui/IntentPrefetchLink": { default: intentType },
      "lucide-react": { ArrowUpRight: "svg", Info: "svg" },
      "@/components/ui/TmdbImage": { TmdbImage: "img" },
      "@/lib/tmdb": { tmdbImage: () => "/portrait.jpg" },
      "./celebrity-hub.module.css": { default: {} },
    });
    const links = [];
    function walk(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === intentType) links.push(node.props);
      walk(node.props?.children);
    }
    walk(Card({ person: { id: 1, name: "Person", known_for: knownFor } }));
    assert.equal(links.length, knownFor.length ? 4 : 3);
    for (const props of links) {
      let intent = null;
      const Link = load("../../components/ui/IntentPrefetchLink.tsx", {
        react: { useState: () => [intent, value => { intent = value; }] },
        "next/link": { default: "Link" },
      });
      assert.equal(Link(props).props.prefetch, false, `${props.href}: no viewport prefetch`);
      Link(props).props.onMouseEnter({ defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
      assert.equal(Link(props).props.prefetch, false, `${props.href}: no passing-hover prefetch`);
      Link(props).props.onFocus({ defaultPrevented: false });
      assert.equal(Link(props).props.prefetch, null, `${props.href}: keyboard intent can warm the selected link`);
    }
  });
}
