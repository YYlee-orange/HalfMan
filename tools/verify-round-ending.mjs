// State, timers, input, animation lifecycle and runtime only; no screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const state=()=>page.evaluate(()=>({ending:window.__MAN__.roundEnding,game:window.__MAN__.snapshot}));
async function slide(selector){
  const motion=await page.locator(selector).evaluate(async e=>{await new Promise(requestAnimationFrame);return e.getAnimations().map(a=>({property:a.transitionProperty,frames:a.effect.getKeyframes()}));});
  assert.ok(motion.some(a=>a.property==='translate'&&a.frames[0].translate!==a.frames.at(-1).translate),`${selector} has no sliding transition: ${JSON.stringify(motion)}`);
}
const settle=selector=>page.locator(selector).evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
const choose=async id=>{const node=page.locator(`[data-level="${id}"]`);if(await node.getAttribute('aria-pressed')!=='true')await node.click();await node.click();await finish();};
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#menu-button');await slide('#game-menu');await settle('#game-menu');await page.keyboard.press('Escape');await slide('#game-menu');await settle('#game-menu');assert.equal(await page.locator('#game-menu').evaluate(e=>e.open),false);
  await page.click('#menu-button');await page.keyboard.press('Escape');await page.click('#menu-button');await settle('#game-menu');assert.equal(await page.locator('#game-menu').evaluate(e=>e.open),true);await page.keyboard.press('Escape');await settle('#game-menu');
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const level of ['man-1','man-2','man-3']){
    await page.setViewportSize(viewport);await page.evaluate(d=>{if((document.documentElement.dataset.theme==='dark')!==d)document.getElementById('theme-toggle').click();},level==='man-2');await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose(level);
    await page.click('#tuning-button');await slide('#cut-tuner');await settle('#cut-tuner');const tunerPosition=await page.locator('#cut-tuner').evaluate(e=>({left:e.style.left,top:e.style.top}));await page.click('#tuner-close');await slide('#cut-tuner');await settle('#cut-tuner');assert.equal(await page.locator('#cut-tuner').evaluate(e=>getComputedStyle(e).display),'none');
    await page.click('#tuning-button');await settle('#cut-tuner');assert.deepEqual(await page.locator('#cut-tuner').evaluate(e=>({left:e.style.left,top:e.style.top})),tunerPosition);await page.click('#tuner-close');await settle('#cut-tuner');
    await page.click('#menu-button');await settle('#game-menu');const time=(await state()).game.realTime;await step(2);assert.equal((await state()).game.realTime,time);await page.click('#pause-button');await slide('#game-menu');await settle('#game-menu');assert.equal((await state()).game.status,'playing');
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.cuts=5;if(g.levelId==='man-3'){g.farmBonus=279;g.farmHarvests=9;}g.meteors=[];g.bomblets=[];g.realTime=g.sceneTime=179.99;g.remaining=.01;g.spawnMeteor(360,90,1,'man');g.spawnMeteor(700,150,undefined,'bomb');g.bomblets.push({id:999,part:0,sourceSize:90,size:24,width:24,height:24,x:850,y:210,vx:100,vy:80,angle:0,spin:2,born:g.sceneTime});q.step(.02);});
    const frozen=await state();assert.equal(frozen.game.status,'ended');assert.equal(frozen.ending.phase,'exploding');assert.equal(frozen.ending.count,3);assert.equal(frozen.game.meteors.length+frozen.game.bomblets.length,0);assert.equal(await page.locator('#results').evaluate(e=>e.hidden),true);assert.equal(await page.locator('#menu-button').isDisabled(),true);assert.equal(await page.evaluate(()=>window.__MAN__.bursts.filter(b=>b.roundEnd).length),3);
    await step(.5);assert.equal((await state()).ending.phase,'exploding');await step(.5);assert.equal((await state()).ending.phase,'results');await slide('#results');await settle('#results');assert.equal(await page.locator('#results').isVisible(),true);assert.equal(await page.locator('#final-score').textContent(),String(frozen.game.score));assert.equal(await page.locator('#menu-button').isDisabled(),false);
    assert.equal(await page.locator('#results-backdrop').isVisible(),true);assert.ok(await page.evaluate(()=>{const bg=getComputedStyle(document.getElementById('results-backdrop')).backgroundColor,menu=getComputedStyle(document.getElementById('game-menu'),'::backdrop').backgroundColor;return bg===menu&&bg!=='rgba(0, 0, 0, 0)'&&document.elementFromPoint(5,50)?.id==='results-backdrop';}));
    if(level==='man-3'){assert.equal(await page.locator('#farm-result').isVisible(),true);assert.equal(await page.locator('#final-farm').textContent(),'279');}
    await step(20);const after=await state();for(const key of ['score','cuts','alive','deaths','bombPenalty','cannonBonus','farmBonus','remaining','realTime','sceneTime'])assert.equal(after.game[key],frozen.game[key],key);assert.equal(after.game.farm.harvests,frozen.game.farm.harvests);assert.equal(await page.evaluate(()=>window.__MAN__.bursts.filter(b=>b.roundEnd).length),0);
    await page.click('#results-levels-button');await slide('#results');await finish();assert.equal(await page.evaluate(()=>window.__MAN__.route),'levels');assert.equal((await state()).ending.phase,'idle');assert.equal(await page.locator('#results').evaluate(e=>e.hidden),true);
    assert.equal(await page.locator('#results-backdrop').evaluate(e=>e.hidden),true);
    await choose(level);assert.equal((await state()).ending.phase,'idle');await page.click('#menu-button');await page.click('#return-start-button');await finish();results.push({viewport,level,threeStationaryBursts:true,frozenScore:true,resultsDelayed:true,popupEntryAndExit:true,reset:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-3');
  await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.realTime=g.sceneTime=179.99;g.remaining=.01;g.spawnMeteor(500,100,1,'man');q.step(.02);q.hold(false);});await page.waitForFunction(()=>window.__MAN__.roundEnding.phase==='results');await page.evaluate(()=>window.__MAN_QA__.hold(true));await settle('#results');assert.equal(await page.locator('#results').evaluate(e=>getComputedStyle(e).translate),'none');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,errors}));
}finally{await browser.close();}
