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
const output = process.env.CATEGORY_SCREENSHOT_DIR;
if (output) await mkdir(output, { recursive: true });
const mocks = `import React from 'react';
  export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}
  export function useRouter(){return{push:url=>window.categoryNavigation=url}}
  export function useSearchParams(){return new URLSearchParams('sort=trending&page=4')}
  export function useWatchlist(){return{ready:true,add:async()=>{},remove:async()=>{},isInWatchlist:()=>false}}
  export function PosterActions(){return null}
`;
const result = await build({
  stdin: { resolveDir: root, loader: "tsx", contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CategoryContent}from'./client/components/category-content/CategoryContent';import Pagination from './client/components/ui/pagination';
    const data=Array.from({length:6},(_,i)=>({id:i+1,type:'movie',title:'Trending title '+(i+1),overview:'A film selected for this collection.',poster_path:'/poster.jpg',backdrop_path:'/backdrop.svg',release_date:'2008-05-02',vote_average:8.1,vote_count:100,popularity:100,origin_country:['US'],genres:['Adventure']}));
    function Fixture(){const[state,setState]=useState({currentPage:4,totalPages:12,disabled:false});window.setPagination=setState;window.pageChanges=[];return <><div id='standalone'><Pagination {...state} totalResults={238} onPageChange={page=>window.pageChanges.push(page)}/></div><CategoryContent data={data} currentPage={4} totalPages={12} total={238} title='Trending movies' subtitle='Popular films to explore.'/></>};createRoot(document.getElementById('root')).render(<Fixture/>);` },
  bundle:true,write:false,outfile:'fixture.js',jsx:'automatic',alias:{'@':resolve(root,'client')},
  define:{'process.env.NODE_ENV':'"test"','process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE':'""','process.env':'{}'},
  plugins:[{name:'category-fixture',setup(builder){builder.onResolve({filter:/^(?:next\/(?:link|navigation)|@\/(?:hooks\/useWatchlist|components\/ui\/PosterActions))$/},()=>({path:'mocks',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mocks,loader:'tsx',resolveDir:root}));}}],
});
const bundle=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
const globalPath=resolve(root,'client/app/globals.css');
const css=(await postcss([tailwind({base:resolve(root,'client')})]).process(await readFile(globalPath,'utf8'),{from:globalPath})).css+result.outputFiles.find(file=>file.path.endsWith('.css')).text+'body{font-family:Arial,sans-serif}#standalone{padding:16px;max-width:960px;margin:auto}';
const poster=await readFile(resolve(root,'client/public/images/ironmanposter.jpeg'));
const backdrop=await readFile(resolve(root,'client/public/placeholder-backdrop.svg'));
const server=createServer((request,response)=>{
  if(request.url==='/app.js'){response.setHeader('content-type','text/javascript');response.end(bundle)}
  else if(request.url==='/app.css'){response.setHeader('content-type','text/css');response.end(css)}
  else if(request.url==='/poster.jpg'){response.setHeader('content-type','image/jpeg');response.end(poster)}
  else if(request.url==='/backdrop.svg'){response.setHeader('content-type','image/svg+xml');response.end(backdrop)}
  else{response.setHeader('content-type','text/html');response.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>')}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,390,640,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
    for(const rank of [2,3]){
      const link=page.getByRole('link',{name:new RegExp(`^${rank}\\. Trending title ${rank}, Movie$`)});
      const image=link.locator('img');
      assert.equal(await image.getAttribute('src'),'/poster.jpg',`Rank${rank} uses poster rather than wide backdrop`);
      const geometry=await image.evaluate(element=>{const box=element.getBoundingClientRect();const frame=element.parentElement.getBoundingClientRect();return{width:box.width,height:box.height,frameWidth:frame.width,frameHeight:frame.height,fit:getComputedStyle(element).objectFit}});
      assert.ok(Math.abs(geometry.frameWidth/geometry.frameHeight-2/3)<0.001,'Supporting artwork preserves2:3frame');
      assert.equal(geometry.fit,'contain','Entire supporting poster stays visible');
      assert.ok(Math.abs(geometry.width-geometry.frameWidth)<1&&Math.abs(geometry.height-geometry.frameHeight)<1,'Poster fills its reserved frame');
      if(output&&[320,390,1440].includes(width))await link.screenshot({path:resolve(output,`trending-card-${rank}-${width}.png`)});
    }
    const nav=page.locator('#standalone nav');
    for(const currentPage of [1,6,12]){
      await page.evaluate(currentPage=>window.setPagination({currentPage,totalPages:12,disabled:false}),currentPage);
      await page.waitForFunction(current=>document.querySelector('#standalone [aria-current="page"]')?.textContent===String(current),currentPage);
      const previous=nav.getByRole('button',{name:'Previous page',exact:true});const next=nav.getByRole('button',{name:'Next page',exact:true});
      assert.equal(await previous.isDisabled(),currentPage===1);assert.equal(await next.isDisabled(),currentPage===12);
      const mobile=width<640;
      assert.equal(await nav.getByText(`Page ${currentPage} of 12`,{exact:true}).isVisible(),mobile);
      assert.equal(await nav.getByRole('button',{name:`Page ${currentPage}, current`,exact:true}).isVisible(),!mobile);
      assert.ok(await nav.locator('[aria-current="page"]').getAttribute('aria-current')==='page');
      const visibleNumbers=await nav.getByRole('button').count();assert.ok(visibleNumbers<=7,'At most5numeric buttons plus2steps');
      const step=currentPage===12?previous:next;const target=await step.boundingBox();assert.ok(target.width>=44&&target.height>=44);
      await step.focus();assert.ok(await step.evaluate(element=>parseFloat(getComputedStyle(element).outlineWidth)>=2));
      await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.pageChanges.at(-1)),currentPage+(currentPage===12?-1:1));
      if(output&&[320,390,1440].includes(width)&&currentPage===6){await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);await nav.screenshot({path:resolve(output,`pagination-${width}.png`)});}
      await page.evaluate(()=>window.setPagination({currentPage:6,totalPages:12,disabled:true}));
      await page.waitForFunction(()=>document.querySelector('#standalone nav')?.getAttribute('aria-busy')==='true');
      assert.equal(await nav.locator('button:not(:disabled)').count(),0,'Pending navigation disables all controls');
      const changes=await page.evaluate(()=>window.pageChanges.length);
      await next.evaluate(element=>element.click());
      assert.equal(await page.evaluate(()=>window.pageChanges.length),changes,'Disabled controls cannot dispatch navigation');
    }
    const collection=page.getByRole('navigation',{name:'Collection pages',exact:true});await collection.getByRole('button',{name:'Next page',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.categoryNavigation),'?sort=trending&page=5','Collection pagination preserves route filters');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Collection and pagination never overflow');
    if(width===640){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await page.evaluate(()=>document.querySelector('#standalone').scrollWidth<=innerWidth),'Pagination fits640px with200%text');}
    console.log(`Category posters and responsive pagination passed at ${width}px.`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(done=>server.close(done))}
