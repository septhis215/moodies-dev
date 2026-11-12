import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Exercise real rails and CSS with native touch input, independent of API/auth.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const result = await build({
  stdin: {
    resolveDir: root,
    loader: "tsx",
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import CardCarousel from './client/components/sections/CardCarousel';
      import { Carousel } from './client/components/ui/Carousel';
      import PeopleRail from './client/components/celeb/PeopleRail';
      import { CuratedShelf } from './client/components/sections/CuratedShelf';
      import CommunityPicks from './client/components/sections/CommunityPicks';
      import Premiere from './client/components/sections/PremiereHighlights';
      import { UpcomingTrailers } from './client/components/sections/UpcomingTrailers';
      import Celebs from './client/components/sections/CelebsSection';
      import Football from './client/components/sections/FootballStoriesSection';
      import { ComingSoonSection } from './client/components/sections/ComingSoon';
      import TrailerModal from './client/components/sections/TrailerModal';
      const items=Array.from({length:12},(_,i)=>({id:i+1,title:'Card '+(i+1),name:'Person '+(i+1),type:'movie',poster_path:null,backdrop_path:null,release_date:'2027-01-15',vote_average:8,overview:'A story of friendship.',known_for:[],trailer_key:'fixture-trailer',recommendations:[]}));
      window.actions=0;
      window.clicks=0;
      document.addEventListener('click',()=>window.clicks++,true);
      window.scrollBehaviors=[];
      const scrollTo=Element.prototype.scrollTo;
      Element.prototype.scrollTo=function(...args){window.scrollBehaviors.push(args[0]?.behavior);return scrollTo.apply(this,args);};
      window.fetch=async()=>({ok:true,json:async()=>items});
      document.addEventListener('click',e=>{if(e.target.closest('a')){e.preventDefault();window.actions++;}});
      const reviews=items.slice(0,5).map(item=>({tmdbId:item.id,mediaType:'MOVIE',title:item.title,name:'A member',avatar:'',rating:8,quote:'A thoughtful story. '.repeat(70)}));
      createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('modal')
        ? <TrailerModal trailer={{...items[0],trailer_key:null,recommendations:items}} onClose={()=>{}} onSelectTrailer={()=>window.actions++}/>
        : <><div id="fixture-cards"><CardCarousel title="Movies" items={items}/></div><div id="fixture-generic" className="ui-shell"><Carousel items={items} CardComponent={({show})=><a href={'/movies/'+show.id} style={{display:'block',height:220,background:'#392621'}}>{show.title}</a>}/></div><div id="fixture-people" className="ui-shell"><PeopleRail people={items}/></div><div id="fixture-curated" className="ui-shell"><CuratedShelf items={items}/></div><div id="fixture-reviews"><CommunityPicks data={reviews}/></div><div id="fixture-premiere"><Premiere data={items}/></div><div id="fixture-upcoming"><UpcomingTrailers data={items}/></div><div id="fixture-celebs"><Celebs/></div><div id="fixture-football"><Football/></div><div id="fixture-coming"><ComingSoonSection title="Coming soon" items={items} type="movies"/></div><div style={{height:'150vh'}}/></>);
    `,
  },
  bundle: true,
  write: false,
  outfile: "fixture.js",
  jsx: "automatic",
  alias: { "@": resolve(root, "client") },
  define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_API_URL": '"/api"', "process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE": "undefined" },
  plugins: [{
    name: "fixture-providers",
    setup(api) {
      api.onResolve({ filter: /^\/images\// }, args => ({ path: args.path, external: true }));
      api.onResolve({ filter: /^(next\/(image|link|navigation|dynamic))$|useWatchlist$/ }, args => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        loader: "jsx",
        resolveDir: root,
        contents: path.endsWith("image")
          ? `import React from 'react';export default function Image({fill,unoptimized,priority,quality,sizes,style,loading,...props}){return <img {...props} loading={loading??(priority?'eager':'lazy')} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...style}}/>}`
          : path.endsWith("link") ? `import React from 'react';export default function Link(props){return <a {...props}/>}`
          : path.endsWith("navigation") ? `export const useRouter=()=>({push:()=>window.actions++});`
          : path.endsWith("dynamic") ? `export default ()=>()=>null;`
          : `export const useWatchlist=()=>({add:async()=>window.actions++,remove:async()=>window.actions++,isInWatchlist:()=>false,ready:true});`,
      }));
    },
  }],
});
const bundle = result.outputFiles.find(file => file.path.endsWith(".js")).text;
const css = (await postcss([tailwind({ base: resolve(root, "client") })]).process(
  await readFile(resolve(root, "client/app/globals.css"), "utf8"),
  { from: resolve(root, "client/app/globals.css") },
)).css + result.outputFiles.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n");
const server = createServer((request, response) => {
  if (request.url === "/app.js") {
    response.setHeader("content-type", "text/javascript"); response.end(bundle);
  } else if (request.url === "/app.css") {
    response.setHeader("content-type", "text/css"); response.end(css);
  } else if (request.url.startsWith("/placeholder-")) {
    response.setHeader("content-type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#392621"/></svg>');
  } else {
    response.setHeader("content-type", "text/html"); response.end('<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><body><main id="root"></main><script src="/app.js"></script></body></html>');
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  async function swipe(x, y, dx, dy, beforeEnd) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 12, y: y + dy * step / 12 }] });
      await page.waitForTimeout(16);
    }
    if (beforeEnd) await beforeEnd();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(500);
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base);
    for (const id of ["cards", "generic", "people", "curated", "reviews", "premiere", "upcoming", "celebs", "football", "coming"]) {
      const rail = page.locator(`#fixture-${id} .mobile-native-scroll, #fixture-${id} [data-curated-rail], #fixture-${id} [aria-label="Member reviews"]`).first();
      await rail.waitFor();
      if (id === "coming" && width >= 640) {
        assert.equal(await rail.evaluate(element => getComputedStyle(element).display), "grid");
        continue;
      }
      await page.waitForFunction(selector => document.querySelector(selector)?.scrollWidth > document.querySelector(selector)?.clientWidth, `#fixture-${id} .mobile-native-scroll, #fixture-${id} [data-curated-rail], #fixture-${id} [aria-label="Member reviews"]`, { timeout: 10000 }).catch(async () => {
        throw new Error(`${id} has no horizontal overflow at ${width}px: ${JSON.stringify(await rail.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, display: getComputedStyle(element).display })))}`);
      });
      await rail.evaluate(element => element.scrollIntoView({ block: "start" }));
      const box = await rail.boundingBox();
      const style = await rail.evaluate(element => ({ snap: getComputedStyle(element).scrollSnapType, touch: getComputedStyle(element).touchAction }));
      assert.equal(style.snap, "x", `${id}: proximity snapping expected`);
      assert.equal(style.touch, "auto", `${id}: both native scroll axes must remain available`);
      await swipe(Math.min(width - 30, box.x + box.width - 25), box.y + Math.min(100, box.height / 2), -width * .65, 0);
      let left = await rail.evaluate(element => element.scrollLeft);
      assert.ok(left > 30, `${id}: touch swipe did not move the rail at ${width}px`);
      assert.equal(await page.evaluate(() => window.actions), 0, `${id}: swipe activated a card`);
      assert.equal(await page.evaluate(() => window.clicks), 0, `${id}: swipe generated a click`);
      if (id === "cards" || id === "generic") {
        await swipe(Math.max(30, box.x + 25), box.y + Math.min(100, box.height / 2), width * .65, 0);
        const reversed = await rail.evaluate(element => element.scrollLeft);
        assert.ok(reversed < left - 20, `${id}: reverse swipe got stuck`);
        left = reversed;
      }
      const top = await page.evaluate(() => scrollY);
      await swipe(width / 2, box.y + Math.min(180, box.height * .8), 0, -110);
      assert.ok(await page.evaluate(() => scrollY) > top + 20, `${id}: rail blocked vertical page scrolling`);
      assert.ok(Math.abs(await rail.evaluate(element => element.scrollLeft) - left) < 5, `${id}: vertical gesture moved the rail`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(`Native swipes, vertical scrolling and click suppression passed at ${width}px (coming-soon becomes a grid at 640px).`);
  }
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base + "?modal=1");
    const rail = page.locator('[role="dialog"] .snap-x');
    await rail.waitFor();
    await rail.evaluate(element => element.scrollIntoView({ block: "center" }));
    const box = await rail.boundingBox();
    await swipe(box.x + box.width - 20, box.y + Math.min(70, box.height / 2), -box.width * .65, 0);
    assert.ok(await rail.evaluate(element => element.scrollLeft) > 30, "Trailer recommendations did not swipe");
    assert.equal(await page.evaluate(() => window.actions), 0, "Recommendation swipe activated a card");
    assert.equal(await page.evaluate(() => window.clicks), 0, "Recommendation swipe generated a click");
  }
  console.log("Trailer-modal recommendation swipes passed.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  const reviewRail = page.getByRole("region", { name: "Member reviews" });
  const expand = reviewRail.getByRole("button", { name: "Read more", exact: true }).first();
  await expand.click();
  const collapse = reviewRail.getByRole("button", { name: "Show less", exact: true });
  await reviewRail.evaluate(element => element.scrollIntoView({ block: "start" }));
  await swipe(355, 100, -260, 0, async () => {
    assert.equal(await collapse.count(), 1, "Expanded review collapsed during the swipe");
  });
  await collapse.waitFor({ state: "hidden" });
  assert.notEqual(await page.locator('#fixture-reviews [aria-current="true"]').getAttribute("aria-label"), "Show review 1 of 5");
  console.log("Expanded review stays open during a swipe and collapses after settling.");
  // Desktop buttons still page the shared rails, including reduced-motion mode.
  for (const reducedMotion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
    const rail = page.locator("#fixture-cards .mobile-native-scroll");
    await page.getByRole("button", { name: "Scroll Movies right" }).click({ force: true });
    await page.waitForFunction(() => document.querySelector("#fixture-cards .mobile-native-scroll").scrollLeft > 100);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Scroll Movies left" }).click({ force: true });
    await page.waitForFunction(() => document.querySelector("#fixture-cards .mobile-native-scroll").scrollLeft < 2);
    assert.equal(await rail.evaluate(element => element.scrollLeft), 0);
    assert.equal(await page.evaluate(() => window.scrollBehaviors.at(-1)), reducedMotion === "reduce" ? "instant" : "smooth");

    for (const [id, title] of [["upcoming", "Coming Soon"], ["premiere", "Fresh Off the Screen"]]) {
      const shelf = page.locator(`#fixture-${id}`);
      const trailerRail = shelf.locator(".mobile-native-scroll");
      const firstCard = await trailerRail.locator(":scope > div").first().elementHandle();
      const next = shelf.getByRole("button", { name: `Next ${title}` });
      const previous = shelf.getByRole("button", { name: `Previous ${title}` });
      await next.click({ force: true });
      await page.waitForFunction(element => element.scrollLeft > 100, await trailerRail.elementHandle());
      assert.equal(await firstCard.evaluate(element => element.isConnected), true, "Changing pages must keep the original card mounted");
      await previous.click({ force: true });
      await page.waitForFunction(element => element.scrollLeft < 2, await trailerRail.elementHandle());
      assert.equal(await trailerRail.locator(":scope > div").count(), 12);
      await trailerRail.scrollIntoViewIfNeeded();
      const card = await firstCard.boundingBox();
      await page.mouse.move(card.x + card.width * 0.7, card.y + 40);
      await page.mouse.down();
      await page.mouse.move(card.x + card.width * 0.3, card.y + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction(element => element.scrollLeft > 100, await trailerRail.elementHandle());
    }
  }
  assert.deepEqual(errors, []);
  console.log("Desktop navigation and reduced-motion checks passed.");
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
