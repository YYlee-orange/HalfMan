// Functional input, timing, damage, saved sliders and runtime checks. No visual acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CUT_FIELDS} from '../dist/cut-settings.js';
import {BOMB_FIELDS} from '../dist/bomb-settings.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  for(const key of ['drawImage','translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const ready=()=>page.waitForFunction(()=>window.__MAN__?.bombs.assetsReady&&window.__MAN__.fonts.length===3);
const set=(key,value)=>page.locator(`#cut-param-${key}`).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
const slash=async target=>{await page.mouse.move(target.x-target.size*.85,target.y);await page.mouse.down();await page.mouse.move(target.x+target.size*.85,target.y,{steps:5});await page.mouse.up();};
try{
  await page.goto('http://127.0.0.1:5173/?qa');await ready();await page.evaluate(()=>{window.__MAN_QA__.hold(true);window.__MAN_QA__.reset();});
  assert.deepEqual(await page.evaluate(()=>window.__MAN__.bombs.parts),['忄','日','罒','又','！竖笔','！圆点']);
  await page.click('#tuning-button');assert.equal(await page.locator('#cut-tuner input[type=range]').count(),CUT_FIELDS.length);
  for(const f of BOMB_FIELDS)assert.equal(await page.locator(`#cut-param-${f.key}`).count(),1);
  await set('bombPenalty',450);await set('bombExpand',150);await set('bombContract',250);await set('bombChildSpeed',400);await set('bombShake',48);
  await page.click('#tuner-save');const saved=await page.evaluate(()=>window.__MAN__.tuning);
  await set('bombChildSpeed',80);await page.click('#tuner-load');assert.deepEqual(await page.evaluate(()=>window.__MAN__.tuning),saved);
  await page.click('#tuner-bomb');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors[0].kind),'bomb');
  assert.ok(await page.evaluate(()=>window.__MAN__.meteors[0].y+window.__MAN__.meteors[0].ry<0));
  await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>window.__MAN__.tuning),saved);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.model.cuts=10;q.spawnBomb(700,240);q.step(0);});
    const target=await page.evaluate(()=>window.__MAN__.meteors[0]);await slash(target);
    assert.equal(await page.evaluate(()=>window.__MAN__.bombs.charges.length),1);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.people.length),0);
    const frozen=await page.evaluate(()=>({x:window.__MAN_QA__.model.meteors[0].x,y:window.__MAN_QA__.model.meteors[0].y}));
    await page.evaluate(()=>window.__MAN_QA__.step(.1));assert.deepEqual(await page.evaluate(()=>({x:window.__MAN_QA__.model.meteors[0].x,y:window.__MAN_QA__.model.meteors[0].y})),frozen);
    await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(3));assert.ok(Math.abs(await page.evaluate(()=>window.__MAN__.snapshot.realTime)-.1)<1e-7);await page.click('#pause-button');
    await page.evaluate(()=>window.__MAN_QA__.step(.16));assert.ok(await page.evaluate(()=>window.__MAN__.bombs.charges[0].contract>0));
    await page.evaluate(()=>window.__MAN_QA__.step(.15));
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bomblets.length),6);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.score),550);
    assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='bombAir')));assert.ok(await page.evaluate(()=>Math.hypot(window.__MAN__.camera.dx,window.__MAN__.camera.dy)>0));
    const child=await page.evaluate(()=>{const c=window.__MAN__.bomblets[0];return{...c,size:30};});await slash(child);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),10);
    await page.evaluate(()=>window.__MAN_QA__.step(.05));assert.equal(await page.evaluate(()=>window.__MAN__.flames.filter(t=>t.kind==='bomblet').length),6);
    await page.evaluate(()=>window.__MAN_QA__.step(5));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bomblets.length),0);
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bombPenalty),450);
    await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bomblets.length),0);assert.equal(await page.evaluate(()=>window.__MAN__.bursts.length),0);
    results.push({viewport,armedByPointer:true,paused:true,children:6,penalty:450,landed:true});
  }
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'});await page.reload();await ready();await page.evaluate(()=>{const q=window.__MAN_QA__;q.hold(true);q.reset();q.model.cuts=10;q.spawnBomb(700,240);q.step(0);});
  await slash(await page.evaluate(()=>window.__MAN__.meteors[0]));await page.evaluate(()=>window.__MAN_QA__.step(.5));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bomblets.length),6);
  assert.equal(await page.evaluate(()=>window.__MAN__.camera.dx),0);assert.equal(await page.evaluate(()=>window.__MAN__.camera.dy),0);
  await page.evaluate(()=>window.__MAN_QA__.step(180));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ended');assert.equal(await page.locator('#final-penalty').textContent(),'−450');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,parameters:BOMB_FIELDS.length,savedAndRestored:true,results,reducedMotionAndDarkMode:'runtime ok',errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
