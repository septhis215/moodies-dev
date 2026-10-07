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
const output = process.env.TRAILER_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const fixtureImage = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#1d1718"/><circle cx="360" cy="330" r="125" fill="#f0644b"/><path d="M130 860c0-350 460-350 460 0" fill="#e6b65c"/><text x="360" y="920" text-anchor="middle" fill="white" font-size="28">Test image</text></svg>`;
let bundle = "";
let css = "";
const server = createServer(async (request, response) => {
  if (
    ["/placeholder-poster.svg", "/placeholder-backdrop.svg"].includes(
      request.url,
    )
  ) {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    response.end(
      await readFile(resolve(root, "client/public", request.url.slice(1))),
    );
  } else if (request.url.startsWith("/fixture.svg")) {
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
      contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Modal from './client/components/sections/TrailerModal';import {Carousel} from './client/components/ui/Carousel';const next={id:2,title:'The next trailer',trailer_key:'next1234567',overview:'A new story.',type:'tv'};const first={id:1,title:'A very long movie title for a full screen trailer experience',trailer_key:'first123456',overview:'An expansive story of friendship and finding a place to call home. '.repeat(10),recommendations:new URLSearchParams(location.search).has('single')?[next]:[next,{...next,id:3,title:'Another recommendation'},{...next,id:4,title:'One more recommendation'}],type:'movie',genres:['Drama'],runtime:120,vote_average:8.2};const cards=Array.from({length:6},(_,i)=>({...first,id:i+10,title:'Card '+i}));const Card=({show})=><article className='aspect-[2/3] w-full bg-black'>{show.title}</article>;function App(){const[open,setOpen]=useState(false);const[item,setItem]=useState(first);return <><div id='carousel-fixture'><Carousel items={cards} CardComponent={Card}/></div><button onClick={()=>{setItem(first);setOpen(true)}}>Open trailer</button>{open&&<Modal trailer={item} onClose={()=>setOpen(false)} onSelectTrailer={async(next)=>setItem(next)}/>}</>}createRoot(document.getElementById('root')).render(<App/>);`,
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
                      ? `import React from 'react';const Icon=(props)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>;export const ArrowUpRight=Icon,ChevronLeft=Icon,ChevronRight=Icon,Play=Icon,X=Icon,Bookmark=Icon,BookmarkCheck=Icon,Film=Icon,Info=Icon,Tv=Icon,Star=Icon,Calendar=Icon,ChevronDown=Icon,Clock=Icon,ExternalLink=Icon,Loader2=Icon;`
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
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    if (width < 640) {
      const rail = page.locator('#carousel-fixture [class*="overflow-x-auto"]');
      const first = await rail.locator(":scope > div").nth(0).boundingBox();
      const second = await rail.locator(":scope > div").nth(1).boundingBox();
      assert.ok(
        Math.abs(first.x - (width - second.x - second.width)) < 2,
        "Shared carousel has equal mobile gutters",
      );
      assert.ok(first.x >= 15, "Shared carousel keeps its left gutter");
    }
    const opener = page.getByRole("button", {
      name: "Open trailer",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const close = dialog.getByRole("button", {
      name: "Close trailer",
      exact: true,
    });
    const closeBox = await close.boundingBox();
    const playerBox = await dialog.locator("iframe").boundingBox();
    const dialogBox = await dialog.boundingBox();
    assert.ok(
      closeBox.y + closeBox.height <= playerBox.y,
      "Close button overlaps player at " + width,
    );
    assert.ok(closeBox.width >= 44 && closeBox.height >= 44);
    assert.equal(dialogBox.x, 0);
    assert.equal(dialogBox.y, 0);
    assert.equal(dialogBox.width, width);
    assert.equal(dialogBox.height, height);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    assert.equal(
      await close.evaluate((element) => document.activeElement === element),
      true,
    );
    const recommendation = dialog.getByRole("button", {
      name: /The next trailer/,
    });
    await recommendation.scrollIntoViewIfNeeded();
    const recommendations = recommendation.locator("..");
    if (width < 640) {
      const first = await recommendation.boundingBox();
      const second = await dialog
        .getByRole("button", { name: /Another recommendation/ })
        .boundingBox();
      assert.ok(
        Math.abs(first.x - (width - second.x - second.width)) < 2,
        "Trailer recommendations have equal mobile gutters",
      );
      assert.ok(
        first.x >= 15,
        "Trailer recommendation does not stick to the left edge",
      );
      await recommendations.evaluate((element) =>
        element.scrollTo({ left: element.scrollWidth, behavior: "instant" }),
      );
      await page.waitForTimeout(200);
      const last = await dialog
        .getByRole("button", { name: /One more recommendation/ })
        .boundingBox();
      assert.ok(
        Math.abs(width - last.x - last.width - 16) < 2,
        "Trailer rail keeps its right gutter after scrolling",
      );
      await recommendations.evaluate((element) =>
        element.scrollTo({ left: 0, behavior: "instant" }),
      );
    }
    if (output && [390, 1366].includes(width))
      await dialog.screenshot({
        path: resolve(output, "modal-" + width + ".png"),
      });
    await dialog.getByRole("button", { name: /The next trailer/ }).click();
    await dialog
      .getByRole("heading", { name: "The next trailer", exact: true })
      .waitFor();
    assert.ok(
      (await dialog.locator("iframe").getAttribute("src")).includes(
        "next1234567",
      ),
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    if (width < 640) {
      await page.goto(base + "?single=1");
      await page
        .getByRole("button", { name: "Open trailer", exact: true })
        .click();
      const single = page
        .getByRole("dialog")
        .getByRole("button", { name: /The next trailer/ });
      await single.scrollIntoViewIfNeeded();
      const box = await single.boundingBox();
      assert.ok(
        Math.abs(box.x + box.width / 2 - width / 2) < 2,
        "Single trailer recommendation is centered",
      );
      await page
        .getByRole("button", { name: "Close trailer", exact: true })
        .click();
    }
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.equal(
      await opener.evaluate((element) => document.activeElement === element),
      true,
    );
    await opener.click();
    await close.click();
    await dialog.waitFor({ state: "hidden" });
    console.log(
      "Fullscreen trailer modal and mobile close controls passed at " +
        width +
        "x" +
        height +
        ".",
    );
  }
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
