import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const output = process.env.POSTER_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
// Render the production card and action controls; isolate account/network state.
const mocks = `import React,{useSyncExternalStore} from 'react';
  let revision=0;const listeners=new Set();const state={save:false,like:false,watched:false,auth:true,ready:true,error:''};
  const notify=()=>{revision++;listeners.forEach(fn=>fn())};
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
  function useStore(){useSyncExternalStore(subscribe,()=>revision);return state}
  window.posterFixture={calls:[],fail:false,held:false,release:()=>{},retry(){state.ready=false;state.error='Load failed';notify()},auth(value){state.auth=value;notify()},reset(){state.save=state.like=state.watched=false;state.auth=true;this.calls=[];this.fail=false;notify()}};
  async function mutate(key,value){window.posterFixture.calls.push(key);if(window.posterFixture.held)await new Promise(done=>window.posterFixture.release=done);if(window.posterFixture.fail)throw Error('Fixture failure');state[key]=value;notify();return true}
  export function useAuth(){return{isAuthenticated:useStore().auth}}
  export function useWatchlist(){const s=useStore();return{ready:true,isInWatchlist:()=>s.save,add:()=>mutate('save',true),remove:()=>mutate('save',false)}}
  export function useLiked(){const s=useStore();return{ready:true,isLiked:()=>s.like,like:()=>mutate('like',true),unlike:()=>mutate('like',false)}}
  export function useWatched(){const s=useStore();return{watched:s.watched,ready:s.ready,error:s.error,enabled:true,busy:false,refresh:async()=>{state.ready=true;state.error='';notify()},toggle:()=>window.posterFixture.noop?Promise.resolve(false):mutate('watched',!s.watched)}}
  export function useRouter(){return{push:path=>{window.posterFixture.navigation=path}}}
  export function handleAppError(){window.posterFixture.errors=(window.posterFixture.errors||0)+1}
  export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}
  export function TmdbImage({fill,sizes,...props}){return <img {...props} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>}
  export function PosterSkeleton(){return null}
`;
const result = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: `import React from 'react';import{createRoot}from'react-dom/client';import{MediaCard}from'./client/components/ui/MediaCard';import{AppToaster}from'./client/components/providers/AppToaster';import{appToast}from'./client/lib/toast';window.clearToasts=()=>appToast.dismiss();
    const root=createRoot(document.getElementById('root'));
    window.releaseFixture=(item)=>root.render(<><MediaCard item={item}/><AppToaster/></>);
    root.render(<><div className='fixture-grid'>{[0,1].map(i=><MediaCard key={i} item={{id:42,title:'A title that wraps onto another line',poster_path:i?null:'/poster.jpg',release_date:'2000-01-01',vote_average:i?0:8.1}}/>)}</div><AppToaster/></>);` },
  bundle: true, write: false, outfile: "fixture.js", jsx: "automatic",
  alias: { "@": resolve(root, "client") }, define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE": '""', "process.env": "{}" },
  plugins: [{ name: "account-fixture", setup(builder) {
    builder.onResolve({ filter: /^(?:@\/(?:hooks\/use(?:Watchlist|Liked|Watched)|app\/context\/AuthProvider|lib\/errors|components\/(?:ui\/TmdbImage|loading\/PageSkeleton))|next\/(?:link|navigation))$/ }, () => ({ path: "mocks", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: mocks, loader: "tsx", resolveDir: root }));
  } }],
});
const bundle = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const globalPath = resolve(root, "client/app/globals.css");
const css = (await postcss([tailwind({ base: resolve(root, "client") })]).process(await readFile(globalPath, "utf8"), { from: globalPath })).css
  + result.outputFiles.find(file => file.path.endsWith(".css")).text
  + "body{font-family:Arial,sans-serif;padding:16px}.fixture-grid{display:grid;grid-template-columns:repeat(2,minmax(0,180px));gap:12px;max-width:372px}@media(max-width:320px){.fixture-grid{grid-template-columns:repeat(2,128px)}}";
const image = await readFile(resolve(root, "client/public/placeholder-poster.svg"));
const poster = await readFile(resolve(root, "client/public/images/ironmanposter.jpeg"));
const server = createServer((request, response) => {
  if (request.url === "/app.js") { response.setHeader("content-type", "text/javascript"); response.end(bundle); }
  else if (request.url === "/app.css") { response.setHeader("content-type", "text/css"); response.end(css); }
  else if (request.url === "/placeholder-poster.svg") { response.setHeader("content-type", "image/svg+xml"); response.end(image); }
  else if (request.url === "/poster.jpg" || request.url === "/w342/poster.jpg") { response.setHeader("content-type", "image/jpeg"); response.end(poster); }
  else { response.setHeader("content-type", "text/html"); response.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const cards = page.locator("article");
    const first = cards.first();
    const actions = first.getByRole("group");
    await actions.waitFor();
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.evaluate(() => window.clearToasts());
    await page.mouse.move(0, 0);
    if (output) await page.locator('.fixture-grid').screenshot({ path: resolve(output, `poster-actions-inactive-${width}.png`) });
    assert.equal(await page.locator("a button").count(), 0, "Navigation never contains action buttons");
    assert.equal(await actions.getByRole("button").count(), 2, "Only Save and More are visible on each card");
    const save = actions.locator('[data-action="save"]');
    const more = actions.getByRole('button', { name: /^More actions/ });
    const artwork = await first.locator("a").first().boundingBox();
    const metadata = await first.locator('.ui-poster-title').boundingBox();
    const row = await save.boundingBox();
    const moreBox = await more.boundingBox();
    assert.ok(row.y >= metadata.y + metadata.height, "Actions sit below title");
    assert.ok(row.height >= 44 && row.width >= 44 && moreBox.height >= 44 && moreBox.width >= 44, "Both controls keep44px targets");
    assert.ok(moreBox.x >= row.x + row.width, "Controls do not overlap");
    assert.ok(moreBox.x + moreBox.width <= artwork.x + artwork.width, "Action row fits the card");
    const rating = await first.getByLabel("Rating: 8.1 out of 10").boundingBox();
    assert.ok(rating.x < row.x && Math.abs(rating.y + rating.height / 2 - row.y - row.height / 2) < 1, "Inline rating aligns left of the icon pair");
    const upcoming = cards.nth(1);
    assert.equal((await upcoming.getByLabel("New title, not yet rated").innerText()).toLowerCase(), "new", "Unrated titles are labelled New");
    await upcoming.getByRole("button", { name: /^More actions/ }).click();
    const upcomingModal = upcoming.getByRole("dialog");
    await upcomingModal.waitFor();
    assert.equal(await upcomingModal.locator('[data-action="watched"]').count(), 1, "Released unrated titles can be marked watched");
    await page.keyboard.press('Escape');
    await upcomingModal.waitFor({ state: 'hidden' });
    assert.equal(await metadata.height, 40, "Two title lines stay reserved so card footers line up");
    assert.equal(await save.innerText(), '', "Save stays icon only");
    assert.equal(await more.innerText(), '', "More stays icon only");
    assert.equal(await save.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', "Actions have no permanent fill");
    await save.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-action="save"]')].every(button => button.getAttribute('aria-pressed') === 'true'));
    await more.click();
    const modal = page.getByRole('dialog', { name: 'A title that wraps onto another line', exact: true });
    await modal.waitFor();
    assert.equal(await more.getAttribute('aria-expanded'), 'true');
    const modalBox = await modal.boundingBox();
    assert.ok(modalBox.x >= 0 && modalBox.x + modalBox.width <= width, "Dialog fits viewport");
    if (width < 640) assert.ok(modalBox.y + modalBox.height >= 899, "Mobile actions use bottom sheet");
    for (const key of ['watched', 'like']) {
      if (!await modal.isVisible()) await more.click();
      const button = modal.locator(`[data-action="${key}"]`);
      const box = await button.boundingBox();
      assert.ok(box.height >= 52 && box.width >= modalBox.width - 48, "Dialog rows are spacious full width targets");
      await button.focus();
      assert.ok(await button.evaluate(element => parseFloat(getComputedStyle(element).outlineWidth) >= 2));
      await page.keyboard.press('Enter');
      await page.waitForFunction(key => [...document.querySelectorAll(`[data-action="${key}"]`)].every(button => button.getAttribute('aria-pressed') === 'true'), key);
      assert.equal(new URL(page.url()).pathname, '/', "Actions never navigate to title");
    }
    await page.evaluate(() => window.clearToasts());
    await more.click();
    await modal.waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    if (output) await modal.screenshot({ path: resolve(output, `poster-actions-dialog-${width}.png`) });
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await more.evaluate(element => document.activeElement === element), true, "Escape restores trigger focus");
    assert.equal(await more.getAttribute('aria-expanded'), 'false');
    assert.equal(await first.getByText('Watched · Liked', { exact: true }).count(), 0, "Footer has no extra state paragraph");
    assert.equal((await save.boundingBox()).y, (await more.boundingBox()).y, "Saved and More remain on one row at normal text size");
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(0, 0);
    if (output) await page.locator('.fixture-grid').screenshot({ path: resolve(output, `poster-actions-${width}.png`) });
    await more.click();
    await modal.waitFor();
    await page.mouse.click(2, 2);
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await more.evaluate(element => document.activeElement === element), true, "Backdrop close restores focus");
    // Padded 128px cards leave only104px for this row.
    await actions.evaluate(element => element.style.width = '104px');
    const narrowSave = await save.boundingBox();
    const narrowMore = await more.boundingBox();
    assert.deepEqual([narrowSave.width, narrowMore.width], [44, 44]);
    assert.equal(narrowSave.y, narrowMore.y, "104px active row remains on one line");
    assert.ok(narrowMore.x + narrowMore.width <= narrowSave.x + 104, "104px row never overflows");
    await actions.evaluate(element => element.style.width = '');
    await page.evaluate(() => { window.posterFixture.reset(); window.posterFixture.held = true; });
    await save.evaluate(element => { element.click(); element.click(); });
    await page.waitForFunction(() => document.querySelector('[data-action="save"]').getAttribute('aria-busy') === 'true');
    assert.equal(await page.evaluate(() => window.posterFixture.calls.length), 1, "Duplicate save produces one mutation");
    await more.click();
    await modal.locator('[data-action="like"]').click();
    assert.equal(await page.evaluate(() => window.posterFixture.calls.length), 2, "Like remains independent of pending Save");
    await page.reload();
    await more.click();
    await page.evaluate(() => { window.posterFixture.noop = true; });
    await modal.locator('[data-action="watched"]').click();
    assert.equal(await page.getByText('Marked as watched.', { exact: true }).count(), 0, "No-op never reports mutation success");
    await page.evaluate(() => { window.posterFixture.noop = false; window.posterFixture.retry(); });
    await more.click();
    await modal.getByRole('button', { name: /Retry watched status/ }).click();
    assert.equal(await page.evaluate(() => window.posterFixture.calls.length), 0, "Retry loads without mutation");
    assert.equal(await page.getByText('Marked as watched.', { exact: true }).count(), 0);
    await page.evaluate(() => window.posterFixture.auth(false));
    await more.click();
    await modal.locator('[data-action="watched"]').click();
    await modal.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    assert.equal(await page.evaluate(() => window.posterFixture.navigation), '/auth/login', "Guest toast is reachable after dialog closes");
    assert.equal(await page.evaluate(() => window.posterFixture.calls.length), 0);
    await page.evaluate(() => { window.posterFixture.reset(); window.posterFixture.fail = true; });
    await more.click();
    await modal.locator('[data-action="watched"]').click();
    await page.waitForFunction(() => window.posterFixture.errors === 1);
    assert.equal(await first.locator('[data-action="watched"]').getAttribute('aria-pressed'), 'false');
    await modal.waitFor({ state: 'hidden' });
    await more.click();
    assert.equal(await modal.locator('[data-action="watched"]').isEnabled(), true, "Failure releases lock");
    await modal.getByRole('button', { name: 'Close actions', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Layout never overflows viewport");
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await actions.evaluate(element => element.style.width = '104px');
      assert.ok(await actions.evaluate(element => element.scrollWidth <= element.clientWidth), "Large text wraps controls within104px");
      await page.setViewportSize({ width, height: 240 });
      await more.click();
      await modal.waitFor();
      assert.ok(await modal.evaluate(element => element.scrollHeight > element.clientHeight), "Short enlarged-text sheet scrolls");
      await modal.getByRole('button', { name: /^Like / }).scrollIntoViewIfNeeded();
      await page.keyboard.press('Escape');
      await modal.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', "Closing restores page scrolling");
    }
    console.log(`Minimal poster footer: inline rating, icon-only44px controls,104px row,52px dialog rows, shared state, keyboard/modal dismissal, auth and errors passed at ${width}px.`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  for (const [type, date, status, expected] of [
    ['movie', '2000-01-01', null, true],
    ['tv', '2000-01-01', null, true],
    ['movie', '2999-01-01', 'Released', false],
    ['tv', '2999-01-01', 'Returning Series', false],
    ['movie', null, 'Planned', false],
    ['tv', null, 'In Production', false],
    ['tv', null, 'Returning Series', true],
    ['movie', null, 'Released', true],
    ['movie', null, null, false],
    ['tv', null, null, false],
  ]) {
    await page.evaluate(({type,date,status}) => { window.posterFixture.reset(); window.releaseFixture({id:84,type,title:'Release eligibility fixture',vote_average:0,...(type==='tv'?{first_air_date:date}:{release_date:date}),status}); }, {type,date,status});
    const card = page.locator('article');
    await card.getByRole('button', { name: /^More actions/ }).click();
    const modal = page.getByRole('dialog', { name: 'Release eligibility fixture', exact: true });
    await modal.waitFor();
    assert.equal(await modal.locator('[data-action="watched"]').count(), expected ? 1 : 0, `${type} ${date ?? status ?? 'unknown'} watched eligibility is independent of zero rating`);
    assert.equal(await modal.locator('[data-action="like"]').isVisible(), true, 'Like remains available');
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await card.locator('[data-action="save"]').isVisible(), true, 'Save remains available');
  }
  console.log('Poster release eligibility passed for released movies/TV, future dates, planned statuses and unknown dates.');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}

