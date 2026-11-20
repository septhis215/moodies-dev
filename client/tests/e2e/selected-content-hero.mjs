import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium, expect } from 'playwright/test';

// Isolate the actual hero and CSS from auth, third-party video, and API availability.
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'output/selected-content-hero');
await mkdir(output, { recursive: true });
const mocks = {
  'next/navigation': 'export const useRouter=()=>({push:()=>{}});',
  'next/link': 'import React from "react"; export default function Link({prefetch,...props}){return <a {...props}/>}',
  'next/image': 'import React from "react"; export default function Image({fill,priority,unoptimized,sizes,...props}){return <img {...props} style={fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:undefined}/>}',
  useAuth: 'export const useAuth=()=>({isAuthenticated:false,loading:false});',
  useLiked: 'export const useLiked=()=>({isLiked:()=>false,ready:true});',
  useWatchlist: 'export const useWatchlist=()=>({isInWatchlist:()=>false,ready:true});',
  useMediaStats: 'export const useMediaStats=()=>({stats:{},getStat:()=>({likeCount:1,savedCount:2,reviewCount:3})});',
  SnapshotShareModal: 'export const SnapshotShareModal=()=>null;',
  WatchedTitleButton: 'export default ()=>null;',
};
const fixture = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {HeroContentCard} from './components/selected-content/sections/heroTop';
import {withMoodReview} from './lib/moodReview.server';
const params=new URLSearchParams(location.search), tv=params.has('tv');
const title=params.get('title') || 'The Odyssey';
const data={info:{id:1,title,content_type:tv?'tv':'movie',release_date:'2026-07-01',runtime:173,genres:[{name:'Adventure'}],overview:'A long journey home.',tagline:'Defy the gods.',director:params.has('missing')?'Unknown credit':'Christopher Nolan',created_by:tv?[{id:77,name:'Christopher Nolan'}]:[],vote_average:8,vote_count:4300,number_of_seasons:2},credits:{crew:tv?[]:[{id:525,name:'Christopher Nolan',job:'Director'}]}};
const content={id:1,title,year:'2026',poster:'/images/ironmanposter.jpeg',backdrop:'/images/ironmanbg.jpg',genres:['Adventure'],runtime:'2h 53m',overview:'A long journey home.',tagline:'Defy the gods.',director:data.info.director,rating:8};
const moodReview=params.has('empty')||params.has('noquote')?null:{id:'mood-review',content:params.get('quote')??'It stayed with me long after the credits. A spectacular journey home.',user:{name:'Alex'}};
const topMoods=params.has('empty')?[]:[{emoji:'/images/review-icons/amazing.png',count:8}];
// Reproduce the hosted API contract, which does not yet include moodReview.
withMoodReview({reviews:moodReview?[{...moodReview,moodEmojis:['/images/review-icons/amazing.png']}]:[],topMoods,pagination:{page:1,totalPages:1}},location.origin).then(reviews=>createRoot(document.getElementById('root')).render(<HeroContentCard data={data} content={content} topMoods={topMoods} totalMoodVotes={16} moodReview={reviews.moodReview} reviewStats={params.has('empty')?undefined:{totalRatings:8,averageRating:8}}/>));`;
const result = await build({
  stdin: { contents: fixture, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, outdir: output, jsx: 'automatic',
  alias: { '@': root }, define: { 'process.env.NODE_ENV': '"test"', 'process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE': 'undefined', 'process.env.NEXT_PUBLIC_API_URL': '"/api"' },
  plugins: [{ name: 'hero-dependencies', setup(api) {
    api.onResolve({ filter: /next\/(navigation|link|image)$|AuthProvider$|useLiked$|useWatchlist$|useMediaStats$|SnapshotShareModal$|WatchedTitleButton$/ }, ({ path }) => ({ path: path.endsWith('AuthProvider') ? 'useAuth' : path.split('/').pop() in mocks ? path.split('/').pop() : path, namespace: 'mock' }));
    api.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'jsx', resolveDir: root }));
  } }],
});
const sourceCss = await readFile(resolve(root, 'app/globals.css'), 'utf8');
const css = (await postcss([tailwind({ base: root })]).process(sourceCss, { from: resolve(root, 'app/globals.css') })).css;
const bundle = result.outputFiles.find((file) => file.path.endsWith('.js')).text;
const moduleCss = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const server = createServer(async (req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
  if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css + moduleCss); }
  if (req.url.startsWith('/images/')) {
    res.setHeader('Content-Type', req.url.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
    return res.end(await readFile(resolve(root, 'public', req.url.slice(1))));
  }
  res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.stack); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [width, height] of [[320,568],[375,667],[390,844],[427,952],[430,932],[568,320],[639,844],[640,900],[768,1024],[1024,768],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    const poster = page.locator('img[alt="The Odyssey poster"]:visible');
    await expect(poster).toBeVisible();
    const closed = await poster.boundingBox();
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    const panel = page.locator('[aria-label="Audience ratings"]');
    if (width < 640) {
      assert.ok(title.y > closed.y + closed.height, 'Title follows poster on mobile');
      assert.ok(closed.height <= height * .52, 'Poster fits phone height');
      const cards = await panel.locator(':scope > div').all();
      const [left, right] = await Promise.all(cards.map((card) => card.boundingBox()));
      assert.ok(Math.abs(left.width - right.width) < 1 && Math.abs(left.y - right.y) < 1, 'Ratings use equal columns');
      assert.equal(await panel.evaluate((el) => getComputedStyle(el).textAlign), 'center');
      await expect(panel.locator('img[src*="moodies-transparent"]')).toBeVisible();
      await expect(panel.locator('img[src*="tmdb-logo"]')).toBeVisible();
      for (const label of ['Moodies', 'TMDB']) {
        const labelBounds = await panel.getByText(label, { exact: true }).boundingBox();
        assert.ok(labelBounds.width <= 1 && labelBounds.height <= 1, 'Mobile rating labels are only exposed to screen readers');
      }
    } else {
      assert.ok(title.y < closed.y + closed.height, 'Desktop/tablet title stays beside poster');
      await expect(panel.locator('img[src*="tmdb-logo"]')).not.toBeVisible();
    }
    if (width < 640) {
      await expect(page.getByRole('button', { name: /^Audience mood:/ })).toHaveCount(0);
      const mood = page.getByRole('img', { name: /^Audience mood:/ });
      await expect(mood).toHaveText('50%');
      const moodImage = await mood.locator('img').boundingBox();
      assert.ok(moodImage.y >= closed.y + closed.height && moodImage.width >= 112, 'Large static mood image sits below the poster');
      await poster.click();
      assert.deepEqual(await poster.boundingBox(), closed, 'Tapping the mobile poster does not move it');
      const quote = page.getByRole('link', { name: 'Read full review by Alex' });
      await expect(quote).toHaveAttribute('href', '/movies/1/reviews?highlight=mood-review');
      await expect(quote.locator('blockquote')).toContainText('A spectacular journey home.');
      await expect(quote.locator('figcaption')).toContainText('Alex');
      const quoteBounds = await quote.boundingBox();
      const moodBounds = await mood.boundingBox();
      assert.ok(quoteBounds.x >= moodImage.x + moodImage.width && quoteBounds.y < moodBounds.y + moodBounds.height, 'Mood and review sit beside each other in a compact row');
      assert.ok(Math.max(quoteBounds.y + quoteBounds.height, moodBounds.y + moodBounds.height) - Math.min(quoteBounds.y, moodBounds.y) <= 144, 'Mood and review do not create a tall empty section');
      for (const element of [mood, quote]) {
        assert.equal(await element.evaluate((node) => ['Top', 'Right', 'Bottom', 'Left'].every(side => parseFloat(getComputedStyle(node)[`border${side}Width`]) === 0)), true, 'Mood and review have no borders');
      }
    } else {
      const reveal = page.getByRole('button', { name: /^Audience mood:/ });
      await reveal.click();
      await expect(reveal).toHaveAttribute('aria-expanded', 'true');
      await page.waitForTimeout(360);
      await expect(page.getByRole('link', { name: 'Read full review by Alex' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(reveal).toHaveAttribute('aria-expanded', 'false');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}`);
    if ([320,390,427,1440].includes(width)) await page.screenshot({ path: resolve(output, `hero-${width}.png`), fullPage: true });
    await expect(page.getByRole('link', { name: 'Christopher Nolan', exact: true })).toHaveAttribute('href', '/celeb/525');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const query of ['?tv', '?empty', '?missing', '?noquote', '?quote=   ', `?quote=${encodeURIComponent('<img src=x onerror=alert(1)>')}`, `?quote=${'A very long review. '.repeat(80)}`, `?title=${'AnUnbrokenTitle'.repeat(18)}`]) {
    await page.goto(base + query);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, query);
    if (query === '?tv') await expect(page.getByRole('link', { name: 'Christopher Nolan', exact: true })).toHaveAttribute('href', '/celeb/77');
    if (query === '?missing') await expect(page.getByRole('link', { name: 'Unknown credit' })).toHaveCount(0);
    if (query === '?empty') { await expect(page.getByRole('button', { name: /^Audience mood:/ })).toHaveCount(0); await expect(page.getByText('No ratings yet')).toBeVisible(); }
    if (query === '?tv') await expect(page.getByRole('link', { name: 'Read full review by Alex' })).toHaveAttribute('href', '/tv/1/reviews?highlight=mood-review');
    if (['?empty', '?noquote', '?quote=   '].includes(query)) await expect(page.getByRole('link', { name: 'Read full review by Alex' })).toHaveCount(0);
    if (query.includes('onerror')) { await expect(page.locator('blockquote')).toContainText('<img src=x onerror=alert(1)>'); await expect(page.locator('blockquote img')).toHaveCount(0); }
    if (query.startsWith('?quote=A very')) assert.ok((await page.locator('blockquote p').boundingBox()).height <= 72, 'Long quotes stay compact');
  }
  await page.goto(base);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: /^Audience mood:/ })).toHaveCount(0);
  assert.equal(await page.locator('img[alt="The Odyssey poster"]:visible').evaluate((el) => getComputedStyle(el.parentElement).transform), 'none');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Enlarged text does not overflow');
  const director = page.getByRole('link', { name: 'Christopher Nolan', exact: true });
  await director.focus();
  await expect(director).toBeFocused();
  await director.click();
  await expect(page).toHaveURL(`${base}/celeb/525`);
  assert.deepEqual(errors, []);
  console.log('Selected-content hero passed: 11 viewports, static mobile mood, attributed quote, escaped text, desktop reveal, empty states, credit links, reduced motion, enlarged text.');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
