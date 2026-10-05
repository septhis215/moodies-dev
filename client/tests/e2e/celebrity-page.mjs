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
  source: index % 2 ? "openverse" : "wikimedia",
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
  sources: {
    tmdb: "ready",
    youtube: "ready",
    wikimedia: "ready",
    openverse: "ready",
  },
  totalPhotos: photos.length,
  totalVideos: videos.length,
  updatedAt: "2026-10-05",
};
const person = {
  id: 123,
  name: "Woni",
  biography:
    "Woni is a member of RESCENE. " +
    "A biography with a longer sentence for reading on a small screen. ".repeat(
      12,
    ),
  birthday: "2004-05-25",
  place_of_birth: "South Korea",
  profile_path: "/portrait-a.jpg",
  images: {
    profiles: [
      { file_path: "/portrait-a.jpg", width: 600, height: 900 },
      { file_path: "/portrait-b.jpg", width: 600, height: 900 },
    ],
  },
  combined_credits: {
    cast: Array.from({ length: 26 }, (_, i) => ({
      id: i + 1,
      title: "A very long project title with words " + i,
      media_type: i % 2 ? "movie" : "tv",
      poster_path: "/poster.jpg",
      release_date: "2024-01-01",
      popularity: 30 - i,
      vote_average: 7.5,
      character: "Self",
    })),
  },
};
const related = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1,
  name: ["Minami", "Zena", "Liv", "May"][i],
  relationship: "RESCENE member",
  profile_path: "/member.jpg",
}));
let bundle = "";
let css = "";
let fail = false;
const server = createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    response.writeHead(fail ? 503 : 200, {
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify(
        request.url.endsWith("/similar")
          ? related
          : request.url.endsWith("/collaborations")
            ? [
                {
                  id: 2,
                  name: "Minami",
                  profile_path: "/member.jpg",
                  count: 3,
                  projects: ["Shared project"],
                },
              ]
            : request.url.endsWith("/upcoming")
              ? { movies: [], tv: [] }
              : request.url.endsWith("/media")
                ? fixture
                : person,
      ),
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
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><body><main><div id="root"></div></main><script src="/app.js"></script></body></html>',
    );
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import { createRoot } from 'react-dom/client';import Page from './client/app/celeb/[id]/page';const params=Promise.resolve({id:'123'});createRoot(document.getElementById('root')).render(<React.Suspense fallback="Loading"><Page params={params}/></React.Suspense>);`,
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
          api.onResolve(
            {
              filter:
                /^(next\/link|next\/navigation|@\/hooks\/useWatchlist|@\/components\/ui\/AppLoading)$/,
            },
            (args) => ({ path: args.path, namespace: "page-fixture" }),
          );
          api.onLoad({ filter: /.*/, namespace: "page-fixture" }, (args) => ({
            contents:
              args.path === "next/link"
                ? "import React from 'react';export default function Link(props){return <a {...props}/>}"
                : args.path === "next/navigation"
                  ? "export const useRouter=()=>({push:()=>{}})"
                  : args.path.includes("useWatchlist")
                    ? "export const useWatchlist=()=>({ready:false,isInWatchlist:()=>false,add:async()=>{},remove:async()=>{}})"
                    : "import React from 'react';export default function Loading(){return <p>Loading</p>}",
            loader: "jsx",
            resolveDir: root,
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
              args.path === "icons"
                ? `import React from 'react';const Icon=(props)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>;export const ArrowUpRight=Icon,ChevronLeft=Icon,ChevronRight=Icon,Play=Icon,X=Icon,Shuffle=Icon,ArrowLeft=Icon,Bookmark=Icon,BookmarkCheck=Icon,Search=Icon,Star=Icon;`
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
    await page.getByRole("heading", { name: "Woni", exact: true }).waitFor();
    const rail = page.locator("#related-people-rail");
    await rail.waitFor();
    await page.waitForFunction(
      () =>
        !!document
          .querySelector('[aria-label="View Woni\'s portrait"] img')
          ?.src.includes("portrait-"),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Page overflow at " + width,
    );
    const previous = page.getByRole("button", {
        name: "Previous related celebrities",
      }),
      next = page.getByRole("button", { name: "Next related celebrities" });
    assert.equal(await previous.isDisabled(), true);
    if (width < 640) {
      assert.equal(await next.isEnabled(), true);
      await next.click();
      await page.waitForFunction(
        () => document.querySelector("#related-people-rail").scrollLeft > 2,
      );
      await page.waitForTimeout(500);
      assert.equal(await previous.isEnabled(), true);
      await rail.evaluate((el) =>
        el.scrollTo({ left: el.scrollWidth, behavior: "instant" }),
      );
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Next related celebrities"]')
            .disabled,
      );
      await previous.click();
      await page.waitForTimeout(500);
    } else {
      assert.equal(await next.isDisabled(), true);
    }
    const portrait = page
      .getByRole("button", { name: "View Woni's portrait" })
      .locator("img");
    const first = await portrait.getAttribute("src");
    await page
      .getByRole("button", { name: "Shuffle Woni's profile photo" })
      .click();
    assert.notEqual(await portrait.getAttribute("src"), first);
    const second = await portrait.getAttribute("src");
    await page
      .getByRole("region", { name: "Filmography" })
      .getByRole("button", { name: /Movies/ })
      .click();
    assert.equal(
      await portrait.getAttribute("src"),
      second,
      "Filter changed portrait",
    );
    await page.getByRole("button", { name: "View Woni's portrait" }).click();
    const dialog = page.getByRole("dialog", { name: "Woni portrait" });
    await dialog.waitFor();
    assert.ok((await dialog.boundingBox()).width <= width);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("heading", { name: "Woni", exact: true }).waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector('[aria-label="View Woni\'s portrait"] img')
        ?.src.includes("portrait-"),
    );
    assert.notEqual(
      await portrait.getAttribute("src"),
      second,
      "Repeat portrait on next visit",
    );
    await page
      .getByRole("region", { name: "On-Screen Moments" })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("button", {
        name: "Play Woni RESCENE performance 1",
        exact: true,
      })
      .waitFor();
    if (output)
      await page.screenshot({
        path: resolve(output, "celeb-page-" + width + ".png"),
        fullPage: true,
      });
    console.log(
      "Whole celebrity page, portrait rotation and rail passed at " +
        width +
        "px.",
    );
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Next related celebrities"]')
        .disabled,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Next related celebrities"]')
        .disabled,
  );
  const filmography = page.getByRole("region", { name: "Filmography" });
  await filmography.getByRole("button", { name: "Show more credits" }).click();
  assert.equal(await filmography.locator("article").count(), 24);
  await filmography
    .getByRole("searchbox", { name: "Search filmography" })
    .fill("no matching work");
  await filmography.getByText("No credits match this search.").waitFor();
  related.push(
    ...Array.from({ length: 14 }, (_, i) => ({
      id: i + 20,
      name: "Related person " + i,
      profile_path: "/member.jpg",
    })),
  );
  await page.reload();
  await page.locator("#related-people-rail").waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Next related celebrities"]')
        .disabled,
  );
  await page
    .locator("#related-people-rail")
    .evaluate((el) =>
      el.scrollTo({ left: el.scrollWidth, behavior: "instant" }),
    );
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Next related celebrities"]')
        .disabled,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Previous related celebrities" })
      .isEnabled(),
    true,
  );
  await page.route("**/portrait-*.jpg", (route) => route.abort());
  await page.reload();
  await page.getByRole("heading", { name: "Woni", exact: true }).waitFor();
  await page
    .getByRole("region", { name: "On-Screen Moments" })
    .scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="View Woni\'s portrait"] img')
      ?.src.includes("/fixture.svg"),
  );
  console.log(
    "Desktop overflowing rail, credit search and failed portrait fallback passed.",
  );
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
