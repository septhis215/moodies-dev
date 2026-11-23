import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Presentational component harness; loading lifecycle has its own state tests.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const publicRoot = resolve(root, "client/public");
const output = process.env.UI_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const moduleCss = await readFile(resolve(root, "client/components/loading/LoadingMascot.module.css"), "utf8");
const styles = Object.fromEntries([...moduleCss.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));

async function renderComponent(relativePath, props = {}, imports = {}) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name.endsWith(".module.css")) return { __esModule: true, default: styles };
      assert.ok(name in imports, `Unexpected fixture import: ${name}`);
      return imports[name];
    },
  });
  return renderToStaticMarkup(React.createElement(mod.exports.default, props));
}

const loadingMarkup = await renderComponent("client/components/loading/LoadingMascot.tsx");
const headerImports = {
  "next/link": { __esModule: true, default: "a" },
  "lucide-react": { ArrowRight: props => React.createElement("svg", props) },
  "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
};
const headerMarkup = `<main class="ui-shell space-y-10 py-10">${await renderComponent("client/components/ui/SectionHeader.tsx", {
  title: "Trending now", titleHref: "/trending", href: "/movies", description: "Discover the titles members are watching.",
}, headerImports)}${await renderComponent("client/components/ui/SectionHeader.tsx", {
  title: "A longer clickable section heading that wraps on a narrow mobile screen", titleHref: "/coming-soon",
}, headerImports)}<section id="static-heading">${await renderComponent("client/components/ui/SectionHeader.tsx", {
  title: "Community picks",
}, headerImports)}</section></main>`;
const globalPath = resolve(root, "client/app/globals.css");
const css = (await postcss([tailwind({ base: resolve(root, "client") })]).process(
  await readFile(globalPath, "utf8"), { from: globalPath },
)).css + moduleCss;
const imageRequests = new Set();
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/images/")) {
    const path = resolve(publicRoot, pathname.slice(1));
    if (!path.startsWith(publicRoot + sep)) { response.writeHead(404).end(); return; }
    try {
      imageRequests.add(pathname);
      response.writeHead(200, { "content-type": "image/png" });
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  } else {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${pathname === "/headers" ? headerMarkup : loadingMarkup}</body></html>`);
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  const page = await browser.newPage();
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [568, 320], [320, 240], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await page.waitForTimeout(450);
    assert.equal(await page.locator("[data-loading-screen]").getAttribute("aria-hidden"), "true", "The visual stays decorative; the loading provider owns announcements");
    for (const text of ["Loading Moodies", "Getting your page ready"]) {
      const box = await page.getByText(text, { exact: true }).boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${text} must fit at ${width}x${height}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Loader must not overflow horizontally");
    if (output) await page.screenshot({ path: resolve(output, `loading-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(base);
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  const screen = page.locator("[data-loading-screen]");
  await screen.evaluate(element => { element.scrollTop = 0; });
  assert.ok((await page.getByText("Loading Moodies", { exact: true }).boundingBox()).y >= 0, "Text zoom must not push the start of the loader out of reach");
  await page.getByText("Getting your page ready", { exact: true }).scrollIntoViewIfNeeded();
  const message = await page.getByText("Getting your page ready", { exact: true }).boundingBox();
  assert.ok(message.y >= 0 && message.y + message.height <= 568, "The loading message must remain reachable at 200% text size");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await screen.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0, "Reduced motion must stop decorative animation");
  assert.ok(imageRequests.size <= 5, "Loader should need only four mood images and its mascot");
  console.log("Loading screen passed: mobile, landscape, short height, text zoom, reduced motion, and five-image budget.");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "/headers");
    assert.equal(await page.locator("#static-heading a, #static-heading .ui-nav-label").count(), 0, "Static headings do not acquire link affordances");
    for (const link of await page.getByRole("link").all()) {
      await page.mouse.move(0, 0);
      const before = await link.boundingBox();
      await link.hover();
      await page.waitForTimeout(300);
      const hover = await link.locator(".ui-nav-label").evaluate(label => ({
        color: getComputedStyle(label).color,
        underline: parseFloat(getComputedStyle(label, "::after").width),
        width: label.getBoundingClientRect().width,
      }));
      assert.equal(hover.color, "rgb(255, 118, 95)", "Heading links use the navigation's coral hover color");
      assert.ok(Math.abs(hover.underline - hover.width) <= 1, "Heading links use the navigation's expanding underline");
      assert.deepEqual(await link.boundingBox(), before, "Hover does not move the heading or companion link");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Long heading links wrap within the viewport");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/headers");
    await page.keyboard.press("Tab");
    const focused = page.getByRole("link", { name: "Trending now", exact: true });
    assert.equal(await focused.evaluate(element => element.matches(":focus-visible")), true);
    const focus = await focused.locator(".ui-nav-label").evaluate(label => ({ color: getComputedStyle(label).color, underline: parseFloat(getComputedStyle(label, "::after").width), transition: getComputedStyle(label, "::after").transitionDuration }));
    assert.equal(focus.color, "rgb(255, 118, 95)");
    assert.ok(focus.underline > 0, "Keyboard focus reveals the underline");
    assert.equal(focus.transition, "0s", "Reduced motion disables the underline animation");
  }
  console.log("Section headers passed: navigation hover, keyboard focus, stable wrapping, static headings, and reduced motion.");
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
