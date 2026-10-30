// Scene boundaries, input lock, timing, theme persistence and resource/runtime checks only.
import assert from 'node:assert/strict';
import {chooseFirstLevel} from './qa-navigation.mjs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  window.__riceCanvases=[];
  const stroke=CanvasRenderingContext2D.prototype.stroke;CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.strokeStyle==='#287344'&&this.lineWidth<3){const name=this.canvas.id||'layer';if(!window.__riceCanvases.includes(name))window.__riceCanvases.push(name);}return stroke.apply(this,args);};
  for(const key of ['translate','scale','rotate','setTransform','moveTo','lineTo','arc','ellipse','createLinearGradient']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const ready=()=>page.waitForFunction(()=>window.__MAN__?.fonts.length===3&&window.__MAN__.bombs.assetsReady);
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
const home=async()=>{
  assert.equal(await page.evaluate(()=>window.__MAN__.opening.mode),'title');
  for(const selector of ['.hud','#time','#score','#cuts','#alive','#tuning-button','#radar-controls','#shelter-controls'])assert.equal(await page.locator(selector).isVisible(),false,selector);
  assert.equal(await page.locator('#food-label').count(),0);assert.equal(await page.locator('#food-status').count(),0);assert.equal(await page.locator('#start-button').isVisible(),true);
};
try{
  await page.goto('http://127.0.0.1:5173/?qa');await ready();await page.evaluate(()=>window.__MAN_QA__.hold(true));await home();
  await step(60);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),0);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.chargeMax),100);
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const current=await page.evaluate(()=>document.documentElement.dataset.theme==='dark');if(current!==dark){await page.click('#menu-button');await page.click('#theme-toggle');await page.click('#menu-close');}
    await home();await page.click('#start-button');assert.equal(await page.evaluate(()=>window.__MAN__.opening.mode),'transition');
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ready');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.remaining),180);
    await page.mouse.click(viewport.width*.85,viewport.height*.8);await page.keyboard.press('Space');await page.keyboard.press('p');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.clicks),0);
    await step(.31);let frame=await page.evaluate(()=>window.__MAN__.opening);assert.ok(frame.buildings.food.visible&&frame.buildings.radar.visible&&frame.buildings.shelter.visible);
    await step(.45);frame=await page.evaluate(()=>window.__MAN__.opening);assert.equal(frame.backgroundOnly,true);assert.equal(await page.locator('#intro').isVisible(),false);
    await step(.24);assert.equal(await page.evaluate(()=>window.__MAN__.opening.glyphVisible),true);
    await step(.42);frame=await page.evaluate(()=>window.__MAN__.opening);assert.ok(frame.cutProgress>0&&frame.invertProgress>0);assert.equal(frame.fromDark,dark);assert.equal(frame.toDark,!dark);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),dark?'dark':'light');
    await step(.48);assert.ok(await page.evaluate(()=>window.__MAN__.opening.doorProgress>0));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),0);
    await step(.4);assert.equal(await page.evaluate(()=>window.__MAN__.opening.mode),'game');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ready');
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),0);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.remaining),180);
    assert.equal(await page.locator('#opening-scene').isVisible(),false);assert.equal(await page.evaluate(()=>window.__MAN__.route),'levels');assert.equal(await page.locator('.hud').isVisible(),false);assert.equal(await page.locator('#level-select').isVisible(),true);
    await chooseFirstLevel(page);assert.equal(await page.locator('.hud').isVisible(),true);assert.equal(await page.locator('#tuning-button').isVisible(),true);assert.equal(await page.locator('#radar-controls').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),dark?'dark':'light');
    await step(.1);assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.realTime>0));await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());await home();
    results.push({viewport,theme:dark?'dark':'light',duration:2.3,gameSecondsUsed:0,independentScene:true});
  }
  assert.ok(await page.evaluate(()=>window.__riceCanvases.includes('scene')&&window.__riceCanvases.includes('opening-scene')));
  await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.click('#start-button');await page.waitForFunction(()=>window.__MAN__.opening.mode==='game',{timeout:6000});
  assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.remaining>179.5));await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});await page.reload();await ready();await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#start-button');await step(.09);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),0);await step(.09);
  assert.equal(await page.evaluate(()=>window.__MAN__.opening.mode),'game');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.remaining),180);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,liveFrameCompletion:true,reducedMotion:true,riceMark:'shared transformed art',errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
