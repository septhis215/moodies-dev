import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Real shared provider, store and toast controls without network/auth dependencies.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const output = process.env.TOAST_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const result = await build({
  stdin: {
    resolveDir: root,
    loader: "tsx",
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {AppToaster} from './client/components/providers/AppToaster';import {appToast} from './client/lib/toast';
      let sequence=0;window.toastActions=0;
      function show(kind,withAction=false){appToast.dismiss();const options={id:'fixture-'+(++sequence),duration:10000,...(withAction?{action:{label:'Continue',onClick:()=>{}}}:{})};
        if(kind==='loading')return appToast.loading('Saving your list…',{id:options.id,action:options.action});
        if(kind==='timed')return appToast.info('This notification closes automatically.',{...options,duration:600});
        if(kind==='action')return appToast.info('Removed from your watchlist.',{...options,action:{label:'Undo',onClick:()=>window.toastActions++}});
        if(kind==='poster')return appToast.success('Added to your watchlist.',{...options,title:'Iron Man',posterUrl:'/poster.jpg'});
        if(kind==='broken-poster')return appToast.success('Added to your watchlist.',{...options,title:'Dune',posterUrl:'/broken-poster.svg'});
        if(kind==='titled')return appToast.warning('Sign in to save this title.',{...options,title:'Watchlist not updated'});
        if(kind==='auth')return appToast.warning('Sign in to save this title.',{...options,action:{label:'Sign in',onClick:()=>window.toastActions++}});
        if(kind==='persistent')return appToast.error('This error needs your attention.',{id:options.id,duration:null});
        if(kind==='long')return appToast.warning('Your changes could not be saved while the connection was interrupted. Please try again when you are back online. '+ 'UnbrokenMessage'.repeat(10),{...options,title:'A longer notification title that stays readable on a narrow mobile screen'});
        return appToast[kind]({success:'Added to your watchlist.',error:'Could not save your changes. Please try again.',warning:'Sign in to save this title.',info:'Removed from your watchlist.'}[kind],options);
      }
      window.toastFixture={show,clear:()=>appToast.dismiss(),stack:()=>{appToast.dismiss();for(let i=0;i<4;i++)appToast.info('Queued notification '+i,{id:'queue-'+(++sequence),duration:10000});},heldQueue:()=>{appToast.dismiss();appToast.loading('Saving your list…',{id:'hold-loading'});appToast.error('Pinned error',{id:'hold-error',duration:null});appToast.info('Pinned information',{id:'hold-info',duration:null});appToast.info('Queued short update',{id:'queue-short',duration:600});}};
      createRoot(document.getElementById('root')).render(<><button id='background-action' className='ui-primary-action m-8'>Background action</button><AppToaster/></>);`,
  },
  bundle: true,
  write: false,
  outfile: "fixture.js",
  jsx: "automatic",
  alias: { "@": resolve(root, "client") },
  define: { "process.env.NODE_ENV": '"test"' },
});
const bundle = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const globalPath = resolve(root, "client/app/globals.css");
const css = (await postcss([tailwind({ base: resolve(root, "client") })]).process(
  await readFile(globalPath, "utf8"), { from: globalPath },
)).css + "\nbody{font-family:Arial,sans-serif}\n" + result.outputFiles.find(file => file.path.endsWith(".css")).text;
const posterImage = await readFile(resolve(root, "client/public/images/ironmanposter.jpeg"));
const server = createServer((request, response) => {
  if (request.url === "/app.js") { response.setHeader("content-type", "text/javascript"); response.end(bundle); }
  else if (request.url === "/app.css") { response.setHeader("content-type", "text/css"); response.end(css); }
  else if (request.url === "/poster.jpg") { response.setHeader("content-type", "image/jpeg"); response.end(posterImage); }
  else if (request.url === "/broken-poster.svg") { response.writeHead(404); response.end(); }
  else { response.setHeader("content-type", "text/html"); response.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await page.waitForFunction(() => !!window.toastFixture);
    for (const kind of ["success", "error", "warning", "info", "loading", "poster", "titled", "auth", "long"]) {
      await page.mouse.move(0, 0);
      await page.locator("#background-action").focus();
      await page.evaluate(kind => window.toastFixture.show(kind), kind);
      const toast = page.locator("[data-variant]");
      await toast.waitFor();
      await toast.evaluate(element => Promise.all(element.getAnimations().filter(animation => !animation.effect?.getTiming().iterations || animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished)));
      const box = await toast.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0, `${kind} fits at ${width}px`);
      if (width < 1024) assert.ok(box.y >= 73, "Notifications clear the mobile header");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Notifications never overflow the page");
      const close = toast.getByRole("button", { name: "Dismiss notification", exact: true });
      const target = await close.boundingBox();
      assert.ok(target.width >= 44 && target.height >= 44, "Dismiss keeps a 44px target");
      const iconBox = await toast.locator('[aria-hidden="true"]').first().boundingBox();
      assert.deepEqual([iconBox.width, iconBox.height], [16, 22], "Bare status icon aligns within a single text line");
      assert.equal(await toast.locator('[aria-hidden="true"]').first().evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)", "Status icon has no decorative tile");
      const firstLine = await toast.locator("[data-toast-title], [data-toast-message]").first().evaluate(element => ({ y: element.getBoundingClientRect().y, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
      assert.ok(Math.abs(iconBox.y + iconBox.height / 2 - firstLine.y - firstLine.lineHeight / 2) <= 2, "Status icon aligns with the first text line");
      const closeGlyph = await close.locator("svg").boundingBox();
      assert.ok(Math.abs(closeGlyph.y + closeGlyph.height / 2 - iconBox.y - iconBox.height / 2) <= 1, "Close glyph aligns with the status icon");
      assert.ok(target.x >= box.x && target.x + target.width <= box.x + box.width, "Dismiss target stays inside the card");
      if (await toast.locator("[data-toast-title]").count()) {
        const title = await toast.locator("[data-toast-title]").boundingBox();
        const message = await toast.locator("[data-toast-message]").boundingBox();
        assert.ok(message.y - title.y - title.height >= 3.9, "Title and supporting message have a clear gap");
        assert.ok(await toast.evaluate(element => Number(getComputedStyle(element.querySelector('[data-toast-title]')).fontWeight) > Number(getComputedStyle(element.querySelector('[data-toast-message]')).fontWeight)), "Title and message have distinct typographic emphasis");
      }
      assert.equal(await toast.evaluate(element => getComputedStyle(element).backgroundImage), "none", "Toast uses a quiet flat surface");
      const alert = ["error", "warning", "titled", "auth", "long"].includes(kind);
      assert.equal(await toast.getAttribute("role"), alert ? "alert" : "status");
      assert.equal(await toast.getAttribute("aria-live"), alert ? "assertive" : "polite");
      assert.equal(await page.locator('[role="status"], [role="alert"]').count(), 1, "Each notification owns exactly one live region");
      const semanticTokens = { success: "--color-emerald-400", error: "--brand-coral-strong", warning: "--brand-gold", info: "--color-sky-400", loading: "--ink-muted", poster: "--color-emerald-400", titled: "--brand-gold", auth: "--brand-gold", long: "--brand-gold" };
      const expectedAccent = await page.evaluate(token => {
        const probe = document.createElement("span");
        probe.style.color = `var(${token})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, semanticTokens[kind]);
      assert.equal(await toast.locator('[aria-hidden="true"]').first().evaluate(element => getComputedStyle(element).color), expectedAccent, `${kind} icon matches its semantic action color`);
      if (kind === "poster") {
        assert.equal(await toast.locator("img").getAttribute("alt"), "");
        await page.waitForFunction(() => { const image = document.querySelector('[data-variant] img'); return image?.complete && image.naturalWidth > 0; });
        const poster = await toast.locator("img").boundingBox();
        assert.deepEqual([poster.width, poster.height], [40, 60], "Saved-title poster preserves its portrait ratio");
        const copy = await toast.locator('[data-toast-title]').boundingBox();
        assert.ok(poster.x > copy.x + copy.width, "Poster sits beside the title and message");
      }
      const closeSurface = close.locator("span");
      assert.equal(await closeSurface.evaluate(element => getComputedStyle(element).borderTopWidth), "0px", "Close glyph has no permanent frame");
      assert.equal(await closeSurface.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)", "Close glyph is quiet at rest");
      if (output && ["success", "error", "warning", "info", "titled", "auth", "long", "poster"].includes(kind)) await toast.screenshot({ path: resolve(output, `toast-${kind}-${width}.png`) });
      await close.hover();
      assert.notEqual(await closeSurface.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)", "Close glyph shows a hover surface");
      await page.mouse.move(0, 0);
      await close.focus();
      assert.notEqual(await closeSurface.evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)", "Close glyph shows a keyboard-focus surface");
      await page.locator("#background-action").focus();
      if (["success", "error", "warning", "info", "loading"].includes(kind)) {
        await page.evaluate(kind => window.toastFixture.show(kind, true), kind);
        const semanticAction = toast.getByRole("button", { name: "Continue", exact: true });
        await semanticAction.waitFor();
        assert.equal(await semanticAction.evaluate(element => getComputedStyle(element).color), expectedAccent, `${kind} action matches the notification icon`);
        await semanticAction.focus();
        assert.equal(await semanticAction.evaluate(element => getComputedStyle(element).outlineColor), expectedAccent, `${kind} keyboard focus matches its action color`);
      }
    }
    await page.evaluate(() => window.toastFixture.show("action"));
    const action = page.getByRole("button", { name: "Undo", exact: true });
    const actionBox = await action.boundingBox();
    assert.ok(actionBox.height >= 43.9, `Action keeps a 44px target: ${actionBox.height}`);
    await action.focus();
    assert.equal(await action.evaluate(element => getComputedStyle(element).outlineWidth), "2px");
    await page.keyboard.press("Enter");
    await page.locator("[data-variant]").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.toastActions), 1, "Keyboard action remains functional");
    await page.evaluate(() => window.toastFixture.show("info"));
    await page.getByRole("button", { name: "Dismiss notification", exact: true }).focus();
    await page.keyboard.press("Escape");
    await page.locator("[data-variant]").waitFor({ state: "detached" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.toastFixture.show("loading"));
    assert.equal(await page.locator("[data-variant]").evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    console.log(`Minimal toast variants, long copy, poster, keyboard action/dismiss and reduced motion passed at ${width}x${height}.`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.toastFixture.show("broken-poster"));
  await page.waitForFunction(() => !document.querySelector('[data-variant] img'));
  assert.equal(await page.getByText('Added to your watchlist.', { exact: true }).count(), 1, "A failed poster leaves the save confirmation readable");
  await page.evaluate(() => window.toastFixture.show("poster"));
  await page.waitForFunction(() => { const image = document.querySelector('[data-variant] img'); return image?.complete && image.naturalWidth > 0; });
  await page.goto(base);
  await page.waitForFunction(() => !!window.toastFixture);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; window.toastFixture.show("auth"); });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Enlarged text does not overflow the page horizontally");
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await signIn.scrollIntoViewIfNeeded();
  await signIn.focus();
  await page.keyboard.press("Enter");
  await page.locator("[data-variant]").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => window.toastActions), 1, "Sign-in action remains reachable at 200% text size");
  await page.goto(base);
  await page.waitForFunction(() => !!window.toastFixture);
  await page.setViewportSize({ width: 320, height: 240 });
  await page.evaluate(() => window.toastFixture.stack());
  assert.equal(await page.locator("[data-variant]").count(), 3, "Existing queue limit stays unchanged");
  const viewport = page.locator("#root > div");
  assert.ok(await viewport.evaluate(element => element.scrollHeight > element.clientHeight), "Short screens can scroll the stack");
  await page.locator("[data-variant]").last().getByRole("button", { name: "Dismiss notification" }).scrollIntoViewIfNeeded();
  const last = await page.locator("[data-variant]").last().boundingBox();
  assert.ok(last.y + last.height <= 240, "The last queued notification stays reachable");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.toastFixture.show("timed"));
  const timed = page.locator("[data-variant]");
  await timed.hover();
  await page.waitForTimeout(750);
  assert.equal(await timed.count(), 1, "Pointer pauses automatic dismissal");
  await timed.getByRole("button", { name: "Dismiss notification" }).focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(750);
  assert.equal(await timed.count(), 1, "Focus keeps dismissal paused after pointer leaves");
  await page.locator("#background-action").focus();
  await timed.waitFor({ state: "detached", timeout: 1500 });
  await page.evaluate(() => window.toastFixture.show("loading"));
  await page.waitForTimeout(750);
  assert.equal(await page.locator("[data-variant]").count(), 1, "Loading remains persistent");
  await page.emulateMedia({ forcedColors: "active" });
  await page.evaluate(() => window.toastFixture.show("error"));
  const highContrast = page.locator("[data-variant]");
  const contrast = await highContrast.evaluate(element => ({ border: getComputedStyle(element).borderTopColor, surface: getComputedStyle(element).backgroundColor }));
  assert.notEqual(contrast.border, contrast.surface, "Forced colors retain a visible toast boundary");
  await highContrast.getByRole("button", { name: "Dismiss notification" }).focus();
  assert.equal(await highContrast.getByRole("button", { name: "Dismiss notification" }).evaluate(element => getComputedStyle(element).outlineWidth), "2px");
  await page.emulateMedia({ forcedColors: "none" });
  await page.clock.install();
  await page.goto(base);
  await page.waitForFunction(() => !!window.toastFixture);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page.evaluate(() => window.toastFixture.show("persistent"));
  await page.getByText("This error needs your attention.", { exact: true }).waitFor();
  await page.waitForTimeout(50);
  await page.clock.fastForward(9000);
  assert.equal(await page.getByText("This error needs your attention.", { exact: true }).count(), 1, "Explicit null duration keeps non-loading notifications open");
  await page.evaluate(() => window.toastFixture.heldQueue());
  await page.getByText("Pinned information", { exact: true }).waitFor();
  await page.waitForTimeout(50);
  await page.clock.fastForward(5000);
  assert.equal(await page.locator("[data-variant]").count(), 3);
  assert.equal(await page.getByText("Saving your list…", { exact: true }).count(), 1, "New notifications never evict active loading work");
  assert.equal(await page.getByText("Queued short update", { exact: true }).count(), 0, "Overflow notifications wait for an available slot");
  await page.locator('[data-variant]').filter({ hasText: "Pinned information" }).getByRole("button", { name: "Dismiss notification", exact: true }).evaluate(element => element.click());
  const queued = page.getByText("Queued short update", { exact: true });
  await queued.waitFor();
  await page.waitForTimeout(50);
  await page.clock.fastForward(500);
  assert.equal(await queued.count(), 1, "A queued notification receives its full duration after promotion");
  await page.clock.fastForward(101);
  await queued.waitFor({ state: "detached" });
  assert.equal(await page.getByText("Saving your list…", { exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log("Toast text zoom, stack scrolling, FIFO queue, pointer/focus timer pause, and explicit persistent durations passed.");
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
