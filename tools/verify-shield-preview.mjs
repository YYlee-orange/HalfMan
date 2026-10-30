// Isolated preview controls, finite drawing, geometry and asset/runtime checks only.
// No screenshots, aesthetic acceptance, or gameplay shield mechanics.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SHIELD_ART,SHIELD_CELLS,previewFrame,shieldCellVisibility} from '../dist/shield-preview/visuals.js';
assert.ok(SHIELD_CELLS.every(c=>c.closeDelay+c.fadeDuration<=.55));
assert.ok(SHIELD_CELLS.every(c=>shieldCellVisibility(c,previewFrame(4.55))===0));
assert.equal(previewFrame(4.2).growth,previewFrame(3.9).growth);
const fadeValues=SHIELD_CELLS.map(c=>shieldCellVisibility(c,previewFrame(4.2)));assert.ok(new Set(fadeValues).size>2);
for(const start of [0,4])assert.notEqual(previewFrame(start+SHIELD_ART.colorShift/2).toggleColor,previewFrame(start+SHIELD_ART.colorShift).toggleColor);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,args);};}});
const state=()=>page.evaluate(()=>window.__SHIELD_PREVIEW__.snapshot),step=dt=>page.evaluate(dt=>window.__SHIELD_PREVIEW_QA__.step(dt),dt);
const clickToggle=async()=>{const r=await page.locator('#shield-toggle').boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
const checkSymbol=async name=>assert.deepEqual(await page.locator('.state-symbol').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className)),[`state-symbol symbol-${name}`]);
try{
  await page.goto('http://127.0.0.1:5173/shield-preview/?qa');await page.waitForFunction(()=>window.__SHIELD_PREVIEW__?.snapshot.layout.width>1);await page.evaluate(()=>window.__SHIELD_PREVIEW_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.click('[data-view="ready"]');assert.equal((await state()).state,'ready');
    assert.ok(await page.locator('#shield-control').evaluate(e=>{const r=e.getBoundingClientRect(),s=document.querySelector('.stage').getBoundingClientRect();return r.x>=s.x&&r.right<=s.right+1&&r.y>=s.y&&r.bottom<=s.bottom+1;}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const dark of [false,true]){
      if((await state()).dark!==dark)await page.click('#theme');
      await checkSymbol('ready');
      await page.click('#shield-toggle');let s=await state();assert.equal(s.state,'active');assert.equal(s.shell,0);assert.equal(s.position,0);await checkSymbol('active');
      await step(.2);s=await state();assert.ok(s.shell>0&&s.shell<1);assert.ok(s.cells>=70&&s.cells<=110);const locked=s.position;
      await clickToggle();assert.equal((await state()).position,locked);assert.equal(await page.locator('#shield-toggle').getAttribute('aria-disabled'),'true');
      await page.click('#pause');const frozen=(await state()).position;await step(1);assert.equal((await state()).position,frozen);await page.click('#pause');
      await step(3.81);s=await state();assert.equal(s.state,'cooldown');await checkSymbol('cooldown');assert.ok(s.shell>0&&s.shell<1);await step(.55);assert.equal((await state()).shell,0);
      const cooling=(await state()).position;await clickToggle();assert.equal((await state()).position,cooling);
      await step(15);s=await state();assert.equal(s.state,'ready');assert.equal(s.recharge,1);
      await page.click('[data-view="active"]');s=await state();assert.equal(s.shell,1);assert.equal(s.cycle,false);
      await page.locator('#position').evaluate(e=>{e.value='4.1';e.dispatchEvent(new Event('input',{bubbles:true}));});s=await state();assert.equal(s.state,'cooldown');assert.ok(s.shell>0&&s.shell<1);assert.equal(s.running,false);
      await page.click('[data-view="ready"]');
    }
    results.push({viewport,threeStates:true,lockedDuringActiveAndCooldown:true,openCloseInterpolation:true,controlsInBounds:true});
  }
  await page.click('#play-cycle');await step(19);let morph=await state();assert.equal(morph.state,'ready');assert.equal(morph.readyMorph,0);assert.equal(morph.recharge,1);const red=morph.toggleColor;
  await step(.225);morph=await state();assert.ok(morph.readyMorph>0&&morph.readyMorph<1);assert.notEqual(morph.toggleColor,red);const middle=morph.toggleColor;
  await step(.225);morph=await state();assert.equal(morph.readyMorph,1);assert.notEqual(morph.toggleColor,middle);
  await page.click('#play-cycle');await page.evaluate(()=>window.__SHIELD_PREVIEW_QA__.hold(false));await page.waitForFunction(()=>window.__SHIELD_PREVIEW__.snapshot.position>.15);await page.evaluate(()=>window.__SHIELD_PREVIEW_QA__.hold(true));
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('[data-view="active"]');let s=await state();assert.equal(s.shell,1);assert.equal(s.ambient,0);assert.equal(s.reduced,true);
  await page.click('[data-view="cooldown"]');assert.equal((await state()).shell,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({functionalOnly:true,results,staggerFadeWithin550ms:true,noClosingScaleChange:true,ringToCheckMorph:true,colorInterpolation:true,liveRaf:true,reducedMotion:true,errors,gameplayIntegration:false,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
