import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../components/sections/CommunityPicks.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const empty = () => null;
const imports = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "next/link": { __esModule: true, default: "a" },
  "@/components/ui/IntentPrefetchLink": { __esModule: true, default: "a" },
  "@/hooks/useCarouselScroll": { useCarouselScroll: () => ({ containerRef: { current: null }, canScrollLeft: false, canScrollRight: false, scroll: empty }) },
  "@/components/ui/CarouselNavButton": { CarouselNavButton: empty },
  "@/components/ui/SectionHeader": { __esModule: true, default: empty },
  "lucide-react": { ArrowUpRight: empty, MessageCircle: empty },
  "@/components/ui/rating-badge": { RatingBadge: empty },
  "@/components/ui/TmdbImage": { TmdbImage: empty },
  "@/lib/tmdb": { tmdbImage: path => path },
  "./CommunityPicks.module.css": { __esModule: true, default: new Proxy({}, { get: (_target, key) => key }) },
};
const module = { exports: {} };
new Function("require", "exports", source)(id => {
  assert.ok(id in imports, `Unexpected CommunityPicks import: ${id}`);
  return imports[id];
}, module.exports);

for (const count of [3, 20, 25]) {
  test(`community section renders ${Math.min(count, 20)} of ${count} available reviews`, () => {
    const data = Array.from({ length: count }, (_, i) => ({
      quote: `Member review ${i + 1}`, name: `Member ${i + 1}`, title: `Movie ${i + 1}`,
      avatar: "", tmdbId: i + 1, rating: 8, mediaType: "MOVIE",
    }));
    const html = renderToStaticMarkup(React.createElement(module.exports.default, { data }));
    const visible = Math.min(count, 20);
    assert.match(html, new RegExp(`${visible} featured reviews`));
    assert.equal((html.match(/aria-label="Review \d+ of /g) || []).length, visible);
    assert.equal((html.match(/aria-label="Explore Movie /g) || []).length, visible);
    assert.equal((html.match(/aria-roledescription="carousel"/g) || []).length, 1);
    assert.ok((html.match(/aria-label="Show review /g) || []).length <= 5, "Mobile review navigation fits without 20 overflowing dots");
  });
}
