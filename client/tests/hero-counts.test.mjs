import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../components/hero/HomepageMediaHero.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function renderHero(items, mediaType, index) {
  let count;
  let posters;
  const empty = () => null;
  const imports = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": { __esModule: true, default: "a" },
    "next/navigation": { useRouter: () => ({ push: empty }) },
    "framer-motion": { motion: { div: "div" }, useReducedMotion: () => true },
    "lucide-react": { Bookmark: empty, BookmarkCheck: empty, Info: empty },
    "@/lib/tmdb": { tmdbImage: path => path },
    "@/components/ui/rating-badge": { __esModule: true, default: empty },
    "@/hooks/useWatchlist": { useWatchlist: () => ({ isInWatchlist: () => false, ready: true }) },
    "@/hooks/useHeroSwipe": { useHeroSwipe: () => ({}) },
    "@/hooks/useCarousel": { __esModule: true, default: options => { count = options.length; return { index, setIndex: empty, pause: empty, resume: empty }; } },
    "./HeroBackdrop": { HeroBackdrop: empty },
    "./HeroEdgeNavigation": { HeroEdgeNavigation: empty },
    "./FeaturedPosterWave": { FeaturedPosterWave: props => { posters = props.items; return null; } },
  };
  const module = { exports: {} };
  new Function("require", "exports", source)(id => {
    assert.ok(id in imports, `Unexpected hero import: ${id}`);
    return imports[id];
  }, module.exports);
  const html = renderToString(React.createElement(module.exports.HomepageMediaHero, { items, mediaType, title: "Home", mediaLabel: mediaType }));
  return { html, count, posters };
}

for (const mediaType of ["movie", "tv"]) {
  test(`${mediaType} hero keeps 25 distinct slides and can render the 25th title`, () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, title: `Featured ${i + 1}`, type: mediaType }));
    const { html, count, posters } = renderHero(items, mediaType, 24);
    assert.equal(count, 25);
    assert.equal(posters.length, 25);
    assert.equal(new Set(posters.map(item => item.id)).size, 25);
    assert.match(html, /Featured 25/);
    assert.doesNotMatch(html, /Featured 26/);
  });

  test(`${mediaType} hero handles fewer available titles without padding`, () => {
    const items = [{ id: 1, title: "Only available title", type: mediaType }];
    const { html, count } = renderHero(items, mediaType, 0);
    assert.equal(count, 1);
    assert.match(html, /Only available title/);
  });
}
