// Functional browser probe only. No screenshots or visual/experience acceptance.
import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath));
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/preview/';
const results=[];
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    const context=await browser.newContext({viewport,reducedMotion:'no-preference'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
    const response=await page.goto(base);assert.equal(response.status(),200);
    await page.waitForFunction(()=>window.__FX_PREVIEW__?.ready);
    const snapshot=()=>page.evaluate(()=>window.__FX_PREVIEW__.snapshot());
    const seek=async t=>{
      await page.locator('#seek').evaluate((element,value)=>{element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));},t);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    assert.deepEqual((await snapshot()).fonts,['yahei','simsun','youyuan']);
    await page.locator('[data-scene="cut"]').click();await seek(2.4);
    let state=await snapshot();assert.equal(state.playing,false);assert.equal(state.meteors.length,1);
    assert.ok(Math.abs(state.time-2.4)<1e-8);await page.locator('#cut').click();
    state=await snapshot();assert.equal(state.people.length,2);assert.equal(state.trails.length,3);
    await seek(2.4);state=await snapshot();
    // On a short canvas the meteor is intentionally still entering from above.
    for(let t=2.5;state.meteors[0].y*state.metrics.sy<20&&t<4;t+=.1){await seek(t);state=await snapshot();}
    const box=await page.locator('#stage').boundingBox(),meteor=state.meteors[0],x=box.x+meteor.x*state.metrics.sx,y=box.y+meteor.y*state.metrics.sy;
    await page.mouse.move(x-65,y);await page.mouse.down();await page.mouse.move(x+65,y,{steps:5});await page.mouse.up();
    assert.equal((await snapshot()).people.length,2,`gesture cuts without a click button at ${viewport.width}×${viewport.height}`);
    for(const t of [1.2,2.7,3.2,4.8,5.5,6.2])await seek(t);
    assert.equal((await snapshot()).people.filter(p=>p.landed).length,2);
    await page.locator('[data-scene="impact"]').click();
    for(const t of [1.3,3,4.2,4.8,5.3,5.7])await seek(t);
    assert.ok((await snapshot()).events.some(e=>e.type==='meteorLand'));
    await page.locator('[data-scene="collision"]').click();await seek(6);
    state=await snapshot();assert.ok(state.deaths>0);assert.ok(state.events.some(e=>e.type==='airHit'));
    await page.locator('#font').selectOption('yahei');assert.equal((await snapshot()).fontId,'yahei');
    await page.locator('#font').selectOption('youyuan');assert.equal((await snapshot()).fontId,'youyuan');
    await page.locator('#size').selectOption('1.32');await seek(1.02);
    assert.ok((await snapshot()).events.find(e=>e.type==='spawn').lowestScreenPixel<0);
    await page.locator('#speed').selectOption('0.35');assert.equal((await snapshot()).speed,.35);
    await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await seek(5);await page.locator('#play').click();await page.waitForFunction(()=>window.__FX_PREVIEW__.snapshot().time>5.01);
    await page.locator('#play').click();assert.equal((await snapshot()).playing,false);
    await page.locator('[data-scene="idle"]').click();await seek(8.5);assert.equal((await snapshot()).meteors.length,0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'controls do not create horizontal overflow');
    assert.deepEqual(errors,[]);results.push({viewport,resources:'ok',controls:'ok',gesture:'ok',runtimeErrors:0});await context.close();
  }
  console.log(JSON.stringify({functionalOnly:true,results},null,2));
}finally{await browser.close();}
