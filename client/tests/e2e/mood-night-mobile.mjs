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
const output = process.env.MOOD_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const fixtureImage = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#1d1718"/><circle cx="360" cy="330" r="125" fill="#f0644b"/><path d="M130 860c0-350 460-350 460 0" fill="#e6b65c"/><text x="360" y="920" text-anchor="middle" fill="white" font-size="28">Test image</text></svg>`;
let bundle = "";
let css = "";
let componentCss = "";
const server = createServer((request, response) => {
  if ((request.url.startsWith("/fixture.svg") || request.url.startsWith("/placeholder-"))) {
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
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><body><main class="pb-10"><div id="root"></div></main><script src="/app.js"></script></body></html>',
    );
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const result = await build({
    stdin: {
      contents: `import React from "react";import {createRoot} from "react-dom/client";import MoodNightPreview from "./client/components/sections/MoodNightPreview";createRoot(document.getElementById("root")).render(<MoodNightPreview/>);`,
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
          api.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /^next\/image$/ }, () => ({
            path: "image",
            namespace: "fixture",
          }));
          api.onResolve({ filter: /^(lucide-react|@tabler\/icons-react)$/ }, () => ({
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
                      ? `import React from 'react';const Icon=(props)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>;export const ArrowRight=Icon,Play=Icon,Pause=Icon,Volume2=Icon,VolumeX=Icon;`
                      : `import React from 'react';export default function Image({fill,unoptimized,priority,loading,sizes,style,...props}){return <img {...props} loading={loading??(priority?'eager':'lazy')} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...style}}/>}`,
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
          api.onLoad(
            { filter: /\.module\.css$/, namespace: "readable" },
            async (args) => {
              const source = await readFile(args.path, "utf8");
              componentCss += source;
              const classes = [...source.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(
                (match) => match[1],
              );
              return {
                contents: `export default ${JSON.stringify(Object.fromEntries(classes.map((name) => [name, name])))};`,
                loader: "js",
              };
            },
          );
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
  css += componentCss + "\nbody{font-family:Arial,sans-serif}";
  if (output) {
    await writeFile(resolve(output, "harness.js"), bundle);
    await writeFile(resolve(output, "harness.css"), css);
  }
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/images/**", async route => route.fulfill({ contentType: "image/png", body: await readFile(resolve(root, "client/public", new URL(route.request().url()).pathname.slice(1))) }));
  await page.route("https://image.tmdb.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: fixtureImage }));
  await page.route("**/api/moods/night-preview/*", route => {
    const mood = route.request().url().split("/").at(-1);
    const items = Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, type: i % 2 ? "tv" : "movie", title: mood + " story " + (i + 1), poster: "/poster.jpg", backdrop: "/backdrop.jpg" })); return route.fulfill({ json: { items, trailers: [{ item: items[0], key: "abcdefghijk" }] } });
  });
  for (const width of [320, 390, 639, 640, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    const section = page.locator("#your-moods");
    await section.getByRole("button", { name: "Preview easy story 1 trailer" }).waitFor();
    const choices = section.getByRole("group", { name: "Choose a mood" });
    assert.equal(await choices.getByRole("button").count(), 5);
    const metrics = await section.evaluate(element => {
      const choices = element.querySelector('[aria-label="Choose a mood"]');
      const scene = element.querySelector(".scene");
      const recommendations = element.querySelector("#landing-mood-preview");
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, choices: [...choices.querySelectorAll("button")].map(button => ({ top: button.getBoundingClientRect().top, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })), sceneTop: scene.getBoundingClientRect().top, sceneBottom: scene.getBoundingClientRect().bottom, recommendationsTop: recommendations.getBoundingClientRect().top };
    });
    assert.equal(metrics.overflow, false, "No page overflow at " + width);
    assert.ok(metrics.choices.every(button => button.width >= 44 && button.height >= 44), "Mood controls retain touch targets");
    if (width < 640) {
      assert.ok(metrics.choices.every(button => Math.abs(button.top - metrics.choices[0].top) < 1), "All mobile moods are visible in one row");
      assert.ok(metrics.sceneBottom <= metrics.recommendationsTop, "Mobile scene precedes story choices");
      assert.equal(await section.getByRole("link", { name: "Explore the mood wheel" }).filter({ visible: true }).count(), 1);
    } else if (width < 1024) {
      assert.ok(metrics.recommendationsTop < metrics.sceneTop, "Tablet layout preserved");
    }
    await choices.getByRole("button", { name: "Electric", exact: true }).click();
    await section.getByRole("button", { name: "Preview electric story 3 artwork" }).waitFor();
    assert.equal(await choices.getByRole("button", { name: "Electric", exact: true }).getAttribute("aria-pressed"), "true");
    await section.getByRole("button", { name: "Preview electric story 3 artwork" }).click();
    assert.equal(await section.getByRole("link", { name: "Explore movie", exact: true }).getAttribute("href"), "/movies/102");
    if (output && [390, 1024].includes(width)) await section.screenshot({ path: resolve(output, "mood-night-" + width + ".png") });
    console.log("Mood night layout and selection passed at " + width + "px.");
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("https://www.youtube.com/**", route => route.abort());
  await page.goto(base);
  const section = page.locator("#your-moods");
  await section.getByRole("button", { name: "Pause preview" }).waitFor();
  await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
  const controls = await section.locator(".nowShowing").evaluate(element => [...element.querySelectorAll("a,button")].map(control => { const rect = control.getBoundingClientRect(); return { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top, width: rect.width, height: rect.height }; }));
  assert.ok(controls.every(control => control.left >= 0 && control.right <= 320 && control.height >= 44), "Enlarged text keeps scene controls inside mobile viewport: " + JSON.stringify(controls));
  for (let i = 1; i < controls.length; i++) assert.ok(controls[i].left >= controls[i-1].right || controls[i].top >= controls[i-1].bottom, "Scene controls do not overlap");
  await section.getByRole("button", { name: "Pause preview" }).click();
  assert.equal(await section.getByRole("button", { name: "Play preview" }).getAttribute("aria-pressed"), "true");
  await section.getByRole("button", { name: "Sound on" }).click();
  assert.equal(await section.getByRole("button", { name: "Sound off" }).getAttribute("aria-pressed"), "true");
  console.log("Mobile playback controls and enlarged text passed.");
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
