import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Isolated component harness: no Next server, .next output or external providers.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const output = process.env.HERO_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const fixtureImage = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#1d1718"/><circle cx="360" cy="330" r="125" fill="#f0644b"/><path d="M130 860c0-350 460-350 460 0" fill="#e6b65c"/><text x="360" y="920" text-anchor="middle" fill="white" font-size="28">Test image</text></svg>`;
let bundle = "";
let css = "";
const server = createServer((request, response) => {
  if (request.url.startsWith("/fixture.svg")) {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    response.end(fixtureImage);
  } else if (request.url === "/app.js") {
    response.writeHead(200, { "content-type": "text/javascript" });
    response.end(bundle);
  } else if (request.url === "/app.css") {
    response.writeHead(200, { "content-type": "text/css" });
    response.end(css);
  } else {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><body><main class="ui-shell pb-10"><div id="root"></div></main><script src="/app.js"></script></body></html>',
    );
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import { createRoot } from 'react-dom/client';import LandingHero from './client/components/hero/heroCarousel';import { HomepageMediaHero } from './client/components/hero/HomepageMediaHero';const title=new URLSearchParams(location.search).get('title');const item={id:123,title,name:title,type:'movie',overview:'A story of friendship and finding a place to call home.',poster_path:null,backdrop_path:null,genres:['Drama'],vote_average:8.2,release_date:'2025-01-01',recommendations:[]};createRoot(document.getElementById('root')).render(<><div id="landing"><LandingHero all={[item]} /></div>{['movie','tv'].map(type=><div id={type} key={type}><HomepageMediaHero items={[{...item,type}]} mediaType={type} icon={null} eyebrow="Discover" title={type==='tv'?'TV shows':'Movies'} description="Find your next watch" spotlightLabel="Featured" mediaLabel={type==='tv'?'Series':'Movie'} /></div>)}</>);`,
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
    define: {
      "process.env.NODE_ENV": '"test"',
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(`${base}/api`),
      "process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE": "undefined",
    },
    alias: { "@": resolve(root, "client") },
    plugins: [
      {
        name: "native-image-fixture",
        setup(api) {
          api.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "router",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /useWatchlist$/ }, () => ({
            path: "watchlist",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /^next\/image$/ }, () => ({
            path: "image",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /^lucide-react$/ }, () => ({
            path: "icons",
            namespace: "fixture",
          }));
          api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "router"
                ? "export const useRouter=()=>({push:()=>{}});"
                : args.path === "watchlist"
                  ? "export const useWatchlist=()=>({add:async()=>{},remove:async()=>{},isInWatchlist:()=>false,ready:true});"
                  : args.path === "link"
                    ? "import React from 'react';export default function Link(props){return <a {...props}/>;}"
                    : args.path === "icons"
                      ? `import React from 'react';const Icon=(props)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>;export const ArrowUpRight=Icon,ChevronLeft=Icon,ChevronRight=Icon,Play=Icon,X=Icon,Bookmark=Icon,BookmarkCheck=Icon,Film=Icon,Info=Icon,Tv=Icon,Star=Icon;`
                      : `import React from 'react';export default function Image({fill,unoptimized,priority,sizes,style,...props}){return <img {...props} loading={priority?'eager':'lazy'} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...style}}/>}`,
            loader: "jsx",
            resolveDir: root,
          }));
          // Read through Node rather than asking the native bundler to traverse
          // protected ancestor directories in the Windows sandbox.
          api.onResolve({ filter: /.*/ }, (args) => {
            let path;
            if (args.path.startsWith("@/"))
              path = resolve(root, "client", args.path.slice(2));
            else if (args.path.startsWith("."))
              path = resolve(args.resolveDir || root, args.path);
            else
              path = require.resolve(args.path, {
                paths: [args.resolveDir || root],
              });
            if (!existsSync(path) || statSync(path).isDirectory()) {
              path = [
                "",
                ".tsx",
                ".ts",
                ".jsx",
                ".js",
                ".json",
                "/index.js",
                "/index.ts",
              ]
                .map((suffix) => path + suffix)
                .find(
                  (candidate) =>
                    existsSync(candidate) && statSync(candidate).isFile(),
                );
            }
            if (!path)
              throw new Error(`Unresolved harness import: ${args.path}`);
            return { path, namespace: "readable" };
          });
          api.onLoad({ filter: /.*/, namespace: "readable" }, async (args) => ({
            contents: await readFile(args.path, "utf8"),
            loader: args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".json")
                  ? "json"
                  : "jsx",
            resolveDir: dirname(args.path),
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
  const sourceCss = await readFile(
    resolve(root, "client/app/globals.css"),
    "utf8",
  );
  css = (
    await postcss([tailwind({ base: resolve(root, "client") })]).process(
      sourceCss,
      { from: resolve(root, "client/app/globals.css") },
    )
  ).css;
  css += "\nbody{font-family:Arial,sans-serif}";
  if (output) {
    await writeFile(resolve(output, "harness.js"), bundle);
    await writeFile(resolve(output, "harness.css"), css);
  }
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || undefined,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://image.tmdb.org/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: fixtureImage }),
  );
  await page.route("https://www.youtube.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Embedded player fixture</p>",
    }),
  );
  const titles = [
    "The Extraordinary Adventures of a Very Unlikely Hero Who Travelled Across the World to Find Their Way Back Home",
    "AnUnbrokenTitle".repeat(15),
    "세상에서 가장 아름다운 이야기를 찾아 떠나는 아주 특별하고 긴 여행".repeat(
      5,
    ),
  ];
  for (const width of [320, 390, 768, 1024, 1280, 1366, 1440]) {
    const height = width === 1024 ? 600 : width >= 1280 ? 720 : 900;
    await page.setViewportSize({ width, height });
    for (const [caseIndex, title] of titles.entries()) {
      await page.goto(base + "?title=" + encodeURIComponent(title));
      for (const id of ["landing", "movie", "tv"]) {
        const wrapper = page.locator("#" + id);
        const heading = wrapper.locator(id === "landing" ? "h1" : "h2");
        await heading.waitFor();
        assert.equal(await heading.getAttribute("aria-label"), title);
        const bounds = await heading.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(element).lineHeight),
          right: element.getBoundingClientRect().right,
          clamp: getComputedStyle(element).webkitLineClamp,
        }));
        assert.equal(bounds.clamp, "2");
        assert.ok(
          bounds.height <= bounds.lineHeight * 2 + 2,
          id + " exceeds two lines at " + width,
        );
        assert.ok(bounds.right <= width + 1, id + " heading overflows");
        const action = wrapper.getByRole(id === "landing" ? "button" : "link", {
          name: id === "landing" ? "Explore" : "View details",
          exact: true,
        });
        const actionBox = await action.boundingBox();
        const sectionBox = await wrapper.locator("section").boundingBox();
        assert.ok(
          actionBox.y >= sectionBox.y &&
            actionBox.y + actionBox.height <= sectionBox.y + sectionBox.height,
          id + " actions clipped",
        );
        if (id === "landing" && width >= 1024) {
          assert.ok(
            sectionBox.y + sectionBox.height <= height + 1,
            "Landing hero exceeds laptop viewport at " + width,
          );
        }
        if (output && caseIndex === 0 && [390, 1366, 1440].includes(width))
          await wrapper.screenshot({
            path: resolve(output, id + "-" + width + ".png"),
          });
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    console.log(
      "Hero title limits passed for landing, movies and TV at " + width + "px.",
    );
  }
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
