import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Real homepage composition, visibility boundaries and request pool; heavy leaf
// visuals/providers are fixtures so this checks scheduling independently of APIs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const result = await build({
  stdin: {
    resolveDir: root, loader: "tsx",
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import Movies from './client/app/movies/MovieHomePageClient';import TV from './client/app/tv/TVHomePageClient';
      const isTV=location.pathname==='/tv';const items=Array.from({length:25},(_,i)=>({id:i+1,title:'Fixture '+(i+1),name:'Fixture '+(i+1),type:isTV?'tv':'movie',release_date:'2027-01-15',first_air_date:'2027-01-15',vote_average:8,poster_path:null}));
      createRoot(document.getElementById('root')).render(isTV?<TV popularTV={items} trendingTV={[]}/>:<Movies trendingMovies={items} popularMovies={[]}/>);`,
  },
  bundle: true, write: false, outfile: "fixture.js", jsx: "automatic",
  alias: { "@": resolve(root, "client") },
  define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_API_URL": '"/api"', "process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE": "undefined" },
  plugins: [{
    name: "homepage-leaf-fixtures",
    setup(api) {
      api.onResolve({ filter: /^next\/(link|image|navigation)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      api.onResolve({ filter: /\/(HomepageMediaHero|MediaShelf|MoodRecommendationSection|CommunityPicks|CommunityPulseSection|ComingSoon|PageSkeleton|rating-badge|TmdbImage)$/ }, args => ({ path: args.path.split("/").at(-1), namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
        const source = {
          "next/link": `export default function Link({onNavigate,prefetch,...props}){return <a {...props}/>;}`,
          "next/image": `export default function Image({fill,unoptimized,priority,sizes,...props}){return <img {...props}/>;}`,
          "next/navigation": `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:()=>{}});`,
          HomepageMediaHero: `export function HomepageMediaHero({items,title}){return <section data-fixture-hero data-count={items.length} style={{height:'100svh',display:'grid',placeItems:'center'}}><h1>{title}</h1></section>;}`,
          MediaShelf: `export function MediaShelf({id,title,items}){if(!items.length)return null;return <section id={id} aria-label={title} style={{minHeight:360}}><h2>{title}</h2><div style={{display:'flex',overflow:'hidden',gap:12}}>{items.map(item=><article key={item.id} style={{minWidth:120,height:280,background:'var(--surface-1)'}}>{item.title||item.name}</article>)}</div></section>;}`,
          MoodRecommendationSection: `export default function Mood(){return <section id='moods' data-mood-mounted aria-label='Mood matcher' style={{minHeight:360}}><h2>Mood matcher</h2></section>;}`,
          CommunityPicks: `export default function Reviews({title,data}){return <section id='community' aria-label={title} style={{minHeight:360}}><h2>{title}</h2>{data.map(item=><article key={item.tmdbId}>{item.title}</article>)}</section>;}`,
          CommunityPulseSection: `export function CommunityPulseSection({mediaType,data,isLoading,error,onRetry}){return <section id={mediaType+'-community-pulse'} aria-label='Community pulse' style={{minHeight:360}}><h2>Community pulse</h2>{isLoading?'Loading':error?<button onClick={onRetry}>Try again</button>:data?'Activity ready':''}</section>;}`,
          ComingSoon: `export function ComingSoonSection({title,items,isLoading,error,onRetry}){return <section id='upcoming' aria-label={title} style={{minHeight:360}}><h2>{title}</h2>{isLoading?'Loading':error?<button onClick={onRetry}>Try again</button>:items.length+' releases ready'}</section>;}`,
          PageSkeleton: `export function RailSkeleton(){return <div data-fixture-skeleton style={{height:340,background:'var(--surface-1)'}}/>;}`,
          "rating-badge": `export default function Rating({rating}){return <span>{rating}</span>;}`,
          TmdbImage: `export function TmdbImage({fill,priority,sizes,...props}){return <img {...props}/>;}`,
        }[path];
        if (!source) throw new Error("Unknown fixture " + path);
        return { contents: "import React from 'react';" + source, loader: "jsx", resolveDir: root };
      });
    },
  }],
});
const bundle = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = (await postcss([tailwind({ base: resolve(root, "client") })]).process(
  await readFile(resolve(root, "client/app/globals.css"), "utf8"), { from: resolve(root, "client/app/globals.css") },
)).css;
const counts = new Map();
const failures = new Map();
let active = 0;
let peak = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://fixture.test");
  if (url.pathname === "/app.js") { response.setHeader("content-type", "text/javascript"); response.end(bundle); return; }
  if (url.pathname === "/app.css") { response.setHeader("content-type", "text/css"); response.end(css); return; }
  if (url.pathname.startsWith("/api/")) {
    const path = url.pathname.slice(4);
    counts.set(path, (counts.get(path) || 0) + 1);
    active++;
    peak = Math.max(peak, active);
    setTimeout(() => {
      active--;
      const remaining = failures.get(path) || 0;
      response.setHeader("content-type", "application/json");
      if (remaining) { failures.set(path, remaining - 1); response.statusCode = 503; response.end("{}"); return; }
      const isTV = path.startsWith("/tv/") || path.includes("/tv?");
      const items = Array.from({ length: 20 }, (_, index) => ({ id: index + 101, title: "Loaded " + (index + 1), name: "Loaded " + (index + 1), type: isTV ? "tv" : "movie", release_date: "2027-01-15", first_air_date: "2027-01-15", vote_average: 8, poster_path: null }));
      const data = path.includes("community-pulse") ? { mostLiked: [], mostReviewed: [], mostSaved: [] }
        : path.includes("critics-corner") ? [{ tmdbId: 101, content: "A thoughtful story.", movie: { title: "Movie review" }, tv: { title: "Series review" }, user: { id: "u", username: "Reviewer" } }]
          : items;
      response.end(JSON.stringify(data));
    }, 200);
    return;
  }
  if (url.pathname.startsWith("/placeholder-")) { response.setHeader("content-type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); return; }
  response.setHeader("content-type", "text/html");
  response.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  for (const width of [390, 1440]) {
    for (const route of ["movies", "tv"]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      counts.clear(); failures.clear(); peak = 0;
      await page.goto(`${base}/${route}`);
      await page.locator("[data-fixture-hero]").waitFor();
      assert.equal(await page.locator("[data-fixture-hero]").getAttribute("data-count"), "25");
      await page.waitForTimeout(500);
      assert.equal(counts.get(`/${route}/koreaTrending`) || 0, 0, "Far lower shelves do not fetch on entry");
      assert.equal(counts.get("/reviews/critics-corner/" + (route === "tv" ? "tv" : "movies")) || 0, 0, "Reviews wait for their section");
      assert.equal(counts.get(route === "movies" ? "/movies/featured" : "/tv/trending") || 0, 0, "SSR hero data is not fetched again by the client");
      const firstId = route === "movies" ? "new-release-movies" : "trending-tv";
      const firstPath = route === "movies" ? "/movies/new-releases" : "/tv/featured";
      const first = page.locator(`[data-deferred-section="${firstId}"]`);
      await first.scrollIntoViewIfNeeded();
      await first.locator("article").first().waitFor();
      assert.equal(counts.get(firstPath), 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await first.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      assert.equal(counts.get(firstPath), 1, "A loaded shelf stays mounted and does not refetch on back-scroll");

      const koreaId = route === "movies" ? "korean-movies" : "korean-tv";
      const koreaPath = `/${route}/koreaTrending`;
      failures.set(koreaPath, 2);
      const korea = page.locator(`[data-deferred-section="${koreaId}"]`);
      await korea.scrollIntoViewIfNeeded();
      await korea.getByRole("button", { name: "Try again", exact: true }).waitFor();
      assert.equal(counts.get(koreaPath), 2, "Recovery retries once, then exposes an explicit retry");
      await korea.getByRole("button", { name: "Try again", exact: true }).click();
      await korea.locator("article").first().waitFor();
      assert.equal(counts.get(koreaPath), 3);

      await page.evaluate(() => { location.hash = "moods"; });
      await page.locator("[data-mood-mounted]").waitFor();
      assert.equal(await page.locator("#moods").count(), 1, "Hash destinations do not duplicate IDs when mounted");
      const ids = await page.locator("[data-deferred-section]").evaluateAll(nodes => nodes.map(node => node.dataset.deferredSection));
      // Activate many deferred boundaries together to exercise the shared pool.
      await page.evaluate(ids => {
        for (const id of ids) {
          history.replaceState(null, "", "#" + id);
          dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }, ids);
      await page.waitForFunction(() => !document.querySelector('[data-deferred-section][aria-busy="true"]'));
      await page.waitForTimeout(1800);
      assert.ok(peak <= 3, `Public section concurrency exceeded three: ${peak}`);
      const duplicateIds = await page.locator("[id]").evaluateAll(nodes => nodes.map(node => node.id).filter((id, index, all) => all.indexOf(id) !== index));
      assert.deepEqual(duplicateIds, [], "Deferred placeholders hand IDs over to loaded content");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Homepage sections fit the viewport");
      assert.deepEqual(errors, []);
      console.log(`${route} section scheduling passed at ${width}px: deferred fetch, one-time load, retry, hash, IDs, and peak ${peak}.`);
      await page.close();
      while (active) await new Promise(done => setTimeout(done, 50));
    }
  }
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
