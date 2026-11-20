import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium } from "playwright";

// Exercise real rails and CSS with native touch input, independent of API/auth.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const screenshotDir = process.env.CAROUSEL_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
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
      const upcoming=[{...items[0],id:13,name:'February release',release_date:'2027-02-01'},...items];
      const cardItems=items.map((item,index)=>({...item,name:undefined,title:index===1?'A very long movie title that needs several lines but must keep its preview compact':item.title,poster:'/images/ironmanposter.jpeg',runtime:173,origin_country:['GB'],genres:index===1?['Science Fiction','Action & Adventure','Documentary']:['Adventure','Action','Fantasy'],recommendations:items.slice(1,4).map(rec=>({...rec,poster:'/images/ironmanposter.jpeg'}))}));
      window.actions=0;
      window.clicks=0;
      document.addEventListener('click',()=>window.clicks++,true);
      window.scrollBehaviors=[];
      const scrollTo=Element.prototype.scrollTo;
      Element.prototype.scrollTo=function(...args){window.scrollBehaviors.push(args[0]?.behavior);return scrollTo.apply(this,args);};
      window.fetch=async()=>({ok:true,json:async()=>items});
      document.addEventListener('click',e=>{if(e.target.closest('a')){e.preventDefault();window.actions++;}});
      const reviews=Array.from({length:20},(_,index)=>({tmdbId:index+1,mediaType:'MOVIE',title:'Card '+(index+1),name:'A member '+(index+1),avatar:'',rating:8,quote:'A thoughtful story. '.repeat(70)}));
      createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('modal')
        ? <TrailerModal trailer={{...items[0],trailer_key:null,recommendations:items}} onClose={()=>{}} onSelectTrailer={()=>window.actions++}/>
        : <><div id="fixture-cards"><CardCarousel title="Movies" items={cardItems}/></div><div id="fixture-generic" className="ui-shell"><Carousel items={items} CardComponent={({show})=><a href={'/movies/'+show.id} style={{display:'block',height:220,background:'#392621'}}>{show.title}</a>}/></div><div id="fixture-people" className="ui-shell"><PeopleRail people={items}/></div><div id="fixture-curated" className="ui-shell"><CuratedShelf items={items}/></div><div id="fixture-reviews"><CommunityPicks data={reviews}/></div><div id="fixture-premiere"><Premiere data={items}/></div><div id="fixture-upcoming"><UpcomingTrailers data={items}/></div><div id="fixture-celebs"><Celebs/></div><div id="fixture-football"><Football/></div><div id="fixture-coming"><ComingSoonSection title="Coming soon" items={upcoming} type="movies"/></div><div style={{height:'150vh'}}/></>);
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
const posterImage = await readFile(resolve(root, 'client/public/images/ironmanposter.jpeg'));
const server = createServer((request, response) => {
  if (request.url === "/app.js") {
    response.setHeader("content-type", "text/javascript"); response.end(bundle);
  } else if (request.url === "/app.css") {
    response.setHeader("content-type", "text/css"); response.end(css);
  } else if (request.url === '/images/ironmanposter.jpeg') {
    response.setHeader('content-type', 'image/jpeg'); response.end(posterImage);
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
  const desktop = await browser.newContext();
  const hoverPage = await desktop.newPage();
  const output = resolve(root, 'client/output/card-hover');
  await mkdir(output, { recursive: true });
  for (const width of [640, 768, 1024, 1440]) {
    await hoverPage.setViewportSize({ width, height: 800 });
    await hoverPage.goto(base);
    const cards = hoverPage.locator('#fixture-cards article');
    for (const [index, card] of [cards.first(), cards.nth(1), cards.last()].entries()) {
      const poster = card.locator('.ui-poster');
      await poster.scrollIntoViewIfNeeded();
      const panel = poster.locator(':scope > div').first();
      await panel.waitFor({ state: 'attached' });
      assert.ok(await panel.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42) > 0, 'Details start below the poster for an upward reveal');
      const before = await card.boundingBox();
      await poster.hover();
      await hoverPage.waitForFunction(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 === 0, await panel.elementHandle());
      assert.deepEqual(await card.boundingBox(), before, 'Hover does not enlarge the card or move the rail');
      const frame = await poster.boundingBox();
      const details = await panel.boundingBox();
      assert.ok(details.x >= frame.x && details.x + details.width <= frame.x + frame.width && details.y >= frame.y && details.y + details.height <= frame.y + frame.height, 'Details remain within the poster');
      for (const rec of await panel.locator('a[aria-label^="View "]').all()) {
        const thumb = await rec.boundingBox();
        assert.ok(Math.abs(thumb.width / thumb.height - 2 / 3) < .02, 'Recommendation thumbnails keep their poster proportions');
        assert.ok(thumb.y + thumb.height <= frame.y + frame.height, 'Recommendations fit inside the card');
      }
      await card.screenshot({ path: resolve(output, `hover-${width}-${index}.png`) });
      const recommendation = panel.locator('a[aria-label^="View "]').last();
      await recommendation.focus();
      await hoverPage.mouse.move(0, 0);
      assert.equal(await panel.evaluate(node => getComputedStyle(node).visibility), 'visible', 'Keyboard focus keeps details available');
      assert.equal(await hoverPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Edge-card previews do not overflow the page');
    }
  }
  await hoverPage.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await hoverPage.locator('#fixture-cards .ui-poster > div').first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  await desktop.close();
  console.log('Upward card reveal, fixed thumbnails, bounded layout and keyboard/reduced-motion checks passed.');
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
  if (!process.env.CAROUSEL_NAV_ONLY) {
    for (const width of [320, 390]) {
      await page.emulateMedia({ reducedMotion: width === 320 ? "reduce" : "no-preference" });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base);
      const community = page.locator("#fixture-reviews");
      const rail = community.getByRole("region", { name: "Member reviews" });
      const dots = community.getByRole("button", { name: /Show review \d+ of 20/ });
      await rail.waitFor();
      assert.match(await community.innerText(), /20 featured reviews/);
      assert.equal(await rail.locator(":scope > article").count(), 20);
      assert.equal(await dots.count(), 5, "Twenty reviews keep at most five visible pagination controls");
      await community.getByRole("button", { name: "Show review 5 of 20", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-current="true"]')?.getAttribute("aria-label") === "Show review 5 of 20");
      assert.equal(await dots.count(), 5);
      await rail.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: "instant" }));
      await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-current="true"]')?.getAttribute("aria-label") === "Show review 20 of 20");
      assert.deepEqual(await dots.evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label"))), Array.from({ length: 5 }, (_, index) => `Show review ${index + 16} of 20`));
      await community.getByRole("button", { name: "Show review 18 of 20", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-current="true"]')?.getAttribute("aria-label") === "Show review 18 of 20");
      await community.getByRole("button", { name: "Show review 20 of 20", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-current="true"]')?.getAttribute("aria-label") === "Show review 20 of 20");
      assert.match(await community.innerText(), /20 \/ 20/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Review pagination does not overflow the mobile page");
      if (screenshotDir) await community.screenshot({ path: resolve(screenshotDir, `community-20-${width}.png`) });
      await rail.evaluate(element => element.scrollIntoView({ block: "start" }));
      const railBox = await rail.boundingBox();
      await swipe(30, railBox.y + 100, width * .65, 0);
      assert.notEqual(await community.locator('[aria-current="true"]').getAttribute("aria-label"), "Show review 20 of 20", "Native swiping can leave the twentieth review");
      assert.equal(await dots.count(), 5);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
    const desktopRail = page.locator('#fixture-reviews [aria-label="Member reviews"]');
    const desktopReviews = desktopRail.locator(":scope > article");
    await desktopReviews.first().waitFor();
    assert.equal(await desktopReviews.count(), 20);
    const reviewLayout = await desktopReviews.evaluateAll(cards => cards.map(card => { const box = card.getBoundingClientRect(); return { y: box.y, height: box.height, width: box.width }; }));
    assert.ok(reviewLayout.every(card => Math.abs(card.y - reviewLayout[0].y) < 1), "All twenty desktop reviews remain in one horizontal row");
    assert.ok(reviewLayout.every(card => card.height >= 416 && card.height < 800), "Review cards retain a bounded independent height");
    const railWidth = await desktopRail.evaluate(element => element.clientWidth);
    assert.ok(reviewLayout[0].width > railWidth * .3 && reviewLayout[0].width < railWidth * .35, "Desktop carousel shows three balanced cards");
    const nextReview = page.getByRole("button", { name: "Next community reviews", exact: true });
    const previousReview = page.getByRole("button", { name: "Previous community reviews", exact: true });
    const collapsedRailHeight = (await desktopRail.boundingBox()).height;
    await desktopReviews.nth(1).getByRole("button", { name: "Read more", exact: true }).click();
    assert.ok((await desktopRail.boundingBox()).height > collapsedRailHeight + 100, "Expanding a desktop review grows its own carousel row");
    await nextReview.click();
    await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-label="Member reviews"]').scrollLeft > 100);
    await desktopRail.getByRole("button", { name: "Show less", exact: true }).waitFor({ state: "hidden" });
    assert.ok(Math.abs((await desktopRail.boundingBox()).height - collapsedRailHeight) < 1, "Changing pages collapses the expanded supporting review and restores row height");
    await previousReview.click();
    await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-label="Member reviews"]').scrollLeft === 0);
    await desktopRail.evaluate(element => element.scrollTo({ left: element.scrollWidth, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector('#fixture-reviews [aria-current="true"]')?.getAttribute("aria-label") === "Show review 20 of 20");
    assert.match(await page.locator("#fixture-reviews").innerText(), /20 \/ 20/);
    assert.ok((await desktopRail.boundingBox()).height < 800, "Twenty reviews do not make the section grow downwards");
    if (screenshotDir) await page.locator("#fixture-reviews").screenshot({ path: resolve(screenshotDir, "community-20-desktop.png") });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log("Twenty community reviews, moving five-dot pagination, mobile swipes and bounded three-card desktop carousel passed.");
  }
  if (!process.env.CAROUSEL_NAV_ONLY && !process.env.COMMUNITY_REVIEWS_ONLY) {
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

  const calendar = page.getByRole("region", { name: "Coming soon", exact: true });
  const january = calendar.getByRole("button", { name: "January 2027" });
  const february = calendar.getByRole("button", { name: "February 2027" });
  const releases = calendar.locator("article:visible");
  assert.equal(await january.getAttribute("aria-pressed"), "true");
  assert.equal(await releases.count(), 6);
  for (const [width, label] of [[390, "Show 3 more"], [768, "Show 6 more"]]) {
    await page.setViewportSize({ width, height: 844 });
    const showMore = calendar.getByRole("button", { name: label });
    const style = await showMore.evaluate(button => {
      const bounds = button.getBoundingClientRect();
      const row = button.parentElement.getBoundingClientRect();
      const { backgroundColor, borderTopWidth } = getComputedStyle(button);
      return {
        centered: Math.abs(bounds.left + bounds.width / 2 - row.left - row.width / 2) < 1,
        backgroundColor,
        borderTopWidth,
      };
    });
    assert.deepEqual(style, { centered: true, backgroundColor: "rgba(0, 0, 0, 0)", borderTopWidth: "0px" });
  }
  await calendar.getByRole("button", { name: "Show 6 more" }).click();
  assert.equal(await releases.count(), 12);
  await february.focus();
  await page.keyboard.press("Enter");
  assert.equal(await february.getAttribute("aria-pressed"), "true");
  assert.equal(await calendar.getByRole("status").textContent(), "February 2027 · 1 release");
  assert.match(await releases.first().textContent(), /Mon, Feb 1.*February release/);
  await january.click();
  assert.equal(await releases.count(), 12);
  await page.setViewportSize({ width: 1440, height: 900 });
  const featuredCards = calendar.locator(".mobile-native-scroll > a");
  const lead = await featuredCards.first().boundingBox();
  const supporting = await featuredCards.nth(1).boundingBox();
  assert.ok(lead.x < supporting.x && lead.height > supporting.height);
  console.log("Release calendar month switching, date labels and paging passed.");
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
  assert.notEqual(await page.locator('#fixture-reviews [aria-current="true"]').getAttribute("aria-label"), "Show review 1 of 20");
  console.log("Expanded review stays open during a swipe and collapses after settling.");
  }
  // Desktop buttons still page the shared rails, including reduced-motion mode.
  if (!process.env.COMMUNITY_REVIEWS_ONLY) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
    for (const id of ["cards", "generic", "people", "curated", "celebs", "football", "upcoming", "premiere", "reviews"]) {
      const buttons = page.locator(`#fixture-${id} [role="group"] button[aria-controls]`);
      await buttons.first().waitFor();
      assert.equal(await buttons.count(), 2, `${id}: paired navigation controls`);
      for (const button of await buttons.all()) {
        const style = await button.evaluate(element => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const iconBounds = element.querySelector("svg").getBoundingClientRect();
          const iconStyle = getComputedStyle(element.querySelector("svg"));
          return { width: bounds.width, height: bounds.height, border: style.borderTopWidth, background: style.backgroundColor, opacity: style.opacity, iconWidth: iconBounds.width, transition: iconStyle.transitionDuration };
        });
        assert.deepEqual([style.width, style.height, style.border, style.background], [56, 56, "0px", "rgba(0, 0, 0, 0)"], `${id}: borderless 56px controls`);
        assert.equal(style.iconWidth, 48, `${id}: larger 48px chevron`);
        assert.ok(Number(style.opacity) > 0, `${id}: controls remain discoverable without hover`);
        assert.equal(await button.locator("svg").getAttribute("stroke-width"), "2");
        if (reducedMotion === "reduce") assert.equal(style.transition, "0s");
        const edge = button.locator("..");
        if (await edge.getAttribute("data-carousel-edge")) {
          await edge.scrollIntoViewIfNeeded();
          const shade = await edge.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            const container = element.parentElement.parentElement.getBoundingClientRect();
            const shade = getComputedStyle(element.querySelector("span"));
            const target = document.elementFromPoint(bounds.x + bounds.width / 2, Math.max(0, bounds.y) + 20);
            return { height: bounds.height, containerHeight: container.height, y: bounds.y, containerY: container.y, x: bounds.x, right: bounds.right, containerX: container.x, containerRight: container.right, width: bounds.width, gradient: shade.backgroundImage, opacity: shade.opacity, pointerEvents: getComputedStyle(element).pointerEvents, targetIntercepted: !!target?.closest("[data-carousel-edge]"), transition: shade.transitionDuration };
          });
          assert.ok(Math.abs(shade.height - shade.containerHeight) < 1 && Math.abs(shade.y - shade.containerY) < 1, `${id}: fade spans carousel height`);
          assert.ok(shade.x >= shade.containerX - 1 && shade.right <= shade.containerRight + 1 && shade.width >= 96, `${id}: broad fade remains inside carousel`);
          assert.match(shade.gradient, /linear-gradient/);
          assert.equal(shade.pointerEvents, "none");
          assert.equal(shade.targetIntercepted, false, `${id}: fade allows underlying card interaction`);
          if (await button.isDisabled()) {
            assert.equal(shade.opacity, "0", `${id}: disabled direction does not darken edge content`);
            await button.hover();
            assert.equal(await edge.locator("span").evaluate(element => getComputedStyle(element).opacity), "0", `${id}: hovering a disabled direction keeps its fade hidden`);
          }
          if (reducedMotion === "reduce") assert.equal(shade.transition, "0s");
        }
      }
      for (const button of await buttons.all()) {
        if (await button.isEnabled()) {
          await button.focus();
          assert.equal(await button.evaluate(element => getComputedStyle(element).outlineWidth), "2px", `${id}: visible keyboard focus`);
          break;
        }
      }
    }
    const rail = page.locator("#fixture-cards .mobile-native-scroll");
    if (screenshotDir) await page.locator("#fixture-cards").screenshot({ path: resolve(screenshotDir, `controls-${reducedMotion}.png`) });
    const actionsBeforeSave = await page.evaluate(() => window.actions);
    await page.locator("#fixture-cards").getByRole("button", { name: /Add .* to My List/ }).first().click();
    assert.equal(await page.evaluate(() => window.actions), actionsBeforeSave + 1, "Edge fade does not block poster save action");
    await page.getByRole("button", { name: "Scroll Movies right" }).click();
    await page.waitForFunction(() => document.querySelector("#fixture-cards .mobile-native-scroll").scrollLeft > 100);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Scroll Movies left" }).click();
    await page.waitForFunction(() => document.querySelector("#fixture-cards .mobile-native-scroll").scrollLeft === 0);
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
  }
  assert.deepEqual(errors, []);
  if (!process.env.COMMUNITY_REVIEWS_ONLY) console.log("Desktop navigation and reduced-motion checks passed.");
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
