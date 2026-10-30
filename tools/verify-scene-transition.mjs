import {chooseFirstLevel} from './qa-navigation.mjs';
// Functional state/geometry/runtime checks only. No screenshots or subjective acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  for(const key of ['translate','scale','rotate','setTransform','moveTo','lineTo','bezierCurveTo','arc','ellipse']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
const state=()=>page.evaluate(()=>({transition:window.__MAN__.sceneTransition,game:window.__MAN__.snapshot,scene:window.__MAN__.opening.mode,inert:document.querySelector('.playfield').inert,theme:document.documentElement.dataset.theme}));
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(()=>window.__MAN_QA__.reset());
    await page.click('#menu-button');if((await state()).theme!==(dark?'dark':'light'))await page.click('#theme-toggle');await page.click('#pause-button');
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawn(700,180,1);q.model.slice({x:600,y:180},{x:800,y:180});q.step(0);localStorage.setItem('man-best','9876');localStorage.setItem('man-cut-saved-preset-v1',JSON.stringify({version:1,values:window.__MAN__.tuning}));});
    const settings=await page.evaluate(()=>({tuning:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')}));
    const before=(await state()).game;await page.click('#menu-button');await page.click('#return-start-button');
    let s=await state();assert.equal(s.transition.active,true);assert.equal(s.transition.phase,'closing');assert.equal(s.transition.layerDark,!dark);assert.equal(s.inert,true);assert.equal(s.game.cuts,before.cuts);assert.equal(s.game.status,'paused');
    await page.keyboard.press('p');await page.keyboard.press('Space');await page.evaluate(()=>document.getElementById('return-start-button').click());
    await step(.14);s=await state();assert.ok(Math.abs(s.transition.coverage-.5)<1e-7);assert.equal(s.game.realTime,before.realTime);assert.equal(s.game.clicks,before.clicks);assert.equal(s.game.cuts,before.cuts);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await step(2);assert.equal((await state()).transition.time,.14);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await step(.14);s=await state();assert.equal(s.transition.coverage,1);assert.equal(s.transition.cutProgress,0);assert.equal(s.transition.covered,true);assert.equal(s.scene,'title');assert.equal(s.game.status,'ready');assert.equal(s.game.people.length,0);assert.equal(s.game.meteors.length,0);assert.equal(s.game.remaining,180);assert.equal(s.inert,true);
    await step(.12);s=await state();assert.equal(s.transition.phase,'covered');assert.equal(s.transition.coverage,1);assert.ok(Math.abs(s.transition.cutProgress-.5)<1e-7);
    await step(.12);s=await state();assert.equal(s.transition.phase,'cut-pause');assert.equal(s.transition.cutProgress,1);assert.equal(s.transition.coverage,1);
    await step(.05);s=await state();assert.equal(s.transition.phase,'cut-pause');assert.equal(s.transition.coverage,1);
    await step(.05);await step(.14);s=await state();assert.equal(s.transition.phase,'opening');assert.equal(s.transition.cutProgress,1);assert.ok(Math.abs(s.transition.coverage-.5)<1e-7);
    await page.evaluate(()=>document.getElementById('start-button').click());assert.equal((await state()).scene,'title');
    await page.setViewportSize({width:viewport.width-12,height:viewport.height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal((await state()).transition.active,true);await step(.14);s=await state();assert.equal(s.transition.active,false);assert.equal(s.inert,false);assert.equal(s.theme,dark?'dark':'light');
    assert.equal(await page.locator('#scene-transition').isVisible(),false);assert.equal(await page.locator('#score-panel').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'start-button');
    assert.deepEqual(await page.evaluate(()=>({tuning:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')})),settings);assert.equal(await page.evaluate(()=>localStorage.getItem('man-best')),'9876');
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);assert.equal((await state()).game.status,'playing');assert.equal((await state()).game.realTime,0);
  }
  // The actual RAF clock also completes the return, without the deterministic step helper.
  await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.click('#menu-button');await page.click('#return-start-button');
  await page.waitForFunction(()=>!window.__MAN__.sceneTransition.active&&window.__MAN__.opening.mode==='title');
  // The results screen uses the same return path.
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.hold(true);q.reset();q.step(181);q.step(window.__MAN__.roundEnding.delay);});assert.equal((await state()).game.status,'ended');
  await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal((await state()).game.status,'ready');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(()=>{window.__MAN_QA__.hold(true);window.__MAN_QA__.reset();});await page.click('#menu-button');await page.click('#return-start-button');
  assert.ok((await state()).transition.duration<=.17);await step(.035);assert.ok(Math.abs((await state()).transition.coverage-.5)<1e-7);await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal((await state()).inert,false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:['two themes and three viewport sizes','scene replacement only under full cover','frozen round time and locked input','duplicate trigger guard','tab visibility pause','resize without restarting transition','settings/best preserved','focus and scene cleanup','original opening still works','live RAF completion','results screen return','reduced motion'],errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
