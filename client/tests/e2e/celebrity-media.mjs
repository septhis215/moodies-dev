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
const output = process.env.CELEBRITY_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const fixtureImage = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#1d1718"/><circle cx="360" cy="330" r="125" fill="#f0644b"/><path d="M130 860c0-350 460-350 460 0" fill="#e6b65c"/><text x="360" y="920" text-anchor="middle" fill="white" font-size="28">Test image</text></svg>`;
const photos = Array.from({ length: 18 }, (_, index) => ({
  id: `photo-${index}`,
  title: `Celebrity portrait ${index + 1}`,
  url: `/fixture.svg?original=${index}`,
  thumbnail: `/fixture.svg?thumb=${index}`,
  width: 720,
  height: index % 3 ? 960 : 600,
  source: "wikimedia",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
  attribution: "Example photographer",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  relevanceScore: 0.95,
}));
const videos = Array.from({ length: 15 }, (_, index) => ({
  id: `video${String(index).padStart(6, "0")}`,
  title: `Woni RESCENE ${index % 2 ? "interview" : "performance"} ${index + 1}`,
  thumbnail: `/fixture.svg?video=${index}`,
  channel: "Example official channel",
  publishedAt: "2025-01-01",
  duration: "PT3M20S",
  category: index % 2 ? "interview" : "performance",
  source: "youtube",
  url: `https://www.youtube.com/watch?v=video${String(index).padStart(6, "0")}`,
  official: true,
  canEmbed: true,
}));
const fixture = {
  photos,
  videos,
  sources: { tmdb: "ready", youtube: "ready", wikimedia: "ready" },
  totalPhotos: photos.length,
  totalVideos: videos.length,
  updatedAt: "2026-10-05",
};
let bundle = "";
let css = "";
let fail = false;
let requests = 0;
const server = createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    requests++;
    response.writeHead(fail ? 503 : 200, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify(fail ? {} : fixture));
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
      contents: `import React from 'react';import { createRoot } from 'react-dom/client';import Sections from './client/components/celeb/CelebrityMediaSections';createRoot(document.getElementById('root')).render(<Sections person={{id:123,name:'Woni',profile_path:'/fallback.jpg'}}/>);`,
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
              args.path === "icons"
                ? `import React from 'react';const Icon=(props)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>;export const ArrowUpRight=Icon,ChevronLeft=Icon,ChevronRight=Icon,Play=Icon,X=Icon;`
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
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    const moments = page.getByRole("region", { name: "On-Screen Moments" });
    const gallery = page.getByRole("region", { name: "Photo Gallery" });
    await moments
      .getByRole("button", {
        name: "Play Woni RESCENE performance 1",
        exact: true,
      })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overflow at ${width}`,
    );
    await moments
      .getByRole("button", { name: "Interviews", exact: true })
      .click();
    await moments
      .getByRole("button", {
        name: "Play Woni RESCENE interview 2",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await moments.getByRole("button", { name: /Play.*performance/ }).count(),
      0,
    );
    await moments
      .getByRole("button", { name: "All moments", exact: true })
      .click();
    await moments.getByRole("button", { name: /View more moments/ }).click();
    assert.equal(
      await moments.getByRole("button", { name: /^Play / }).count(),
      15,
    );
    await moments
      .getByRole("button", {
        name: "Play Woni RESCENE performance 1",
        exact: true,
      })
      .click();
    const viewer = page.getByRole("dialog");
    await viewer.waitFor();
    assert.ok(
      (await viewer.locator("iframe").getAttribute("src")).startsWith(
        "https://www.youtube.com/embed/",
      ),
    );
    const bounds = await viewer.boundingBox();
    assert.ok(bounds.width <= width);
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert.equal(
      await gallery.getByRole("button", { name: /^Open photo/ }).count(),
      12,
    );
    await gallery.getByRole("button", { name: /Load more photos/ }).click();
    assert.equal(
      await gallery.getByRole("button", { name: /^Open photo/ }).count(),
      18,
    );
    await gallery
      .getByRole("button", {
        name: "Open photo 1: Celebrity portrait 1",
        exact: true,
      })
      .click();
    await viewer.waitFor();
    assert.equal(
      await viewer
        .getByRole("link", { name: /Source: Wikimedia Commons/ })
        .getAttribute("href"),
      photos[0].sourceUrl,
    );
    await page.keyboard.press("ArrowRight");
    await viewer
      .getByRole("heading", { name: "Celebrity portrait 2", exact: true })
      .waitFor();
    await viewer.getByRole("button", { name: "Close media viewer" }).click();
    await viewer.waitFor({ state: "hidden" });
    if (output && [390, 1440].includes(width)) {
      await moments.screenshot({
        path: resolve(output, `moments-${width}.png`),
      });
      await gallery.screenshot({
        path: resolve(output, `gallery-${width}.png`),
      });
    }
    console.log(`Celebrity media controls and layout passed at ${width}px.`);
  }
  fail = true;
  await page.goto(base);
  await page
    .getByText("Some additional media is temporarily unavailable.", {
      exact: false,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Open photo 1: Woni portrait", exact: true })
    .waitFor();
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Play Woni RESCENE performance 1",
      exact: true,
    })
    .waitFor();
  assert.deepEqual(errors, []);
  assert.equal(requests, 6, "Unexpected repeated media requests");
  console.log("Media outage fallback and retry passed.");
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
