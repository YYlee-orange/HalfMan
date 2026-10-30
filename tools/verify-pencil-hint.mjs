import {chooseFirstLevel} from './qa-navigation.mjs';
// Real input, timing, layer isolation and runtime errors; no screenshots or visual acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  window.__hintEraseLayers=[];
  const stroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.globalCompositeOperation==='destination-out')window.__hintEraseLayers.push(this.canvas.id==='scene'?'game':'hint');return stroke.apply(this,args);};
  for(const key of ['drawImage','translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const radarPoint=()=>page.evaluate(()=>{const v=window.__MAN__.viewport,r=window.__MAN__.radar,s=v.artScale*r.scale;return{x:r.originX/1440*v.width-10*s,y:808/810*v.height-165*s};});
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(async()=>{(await import('./cut-settings.js')).applyCutSettings({bombChance:0},{persist:false});});
  assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'hidden');await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const [index,viewport]of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}].entries()){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.step(.4);});
    assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'hidden');
    const drawing=await page.evaluate(()=>window.__MAN__.onboardingHint);assert.equal(drawing.stage,'writing');assert.ok(drawing.completedStrokes>0);
    if(index===0){await page.evaluate(()=>window.__MAN_QA__.step(1.1));assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'shown');assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.writeProgress),1);}
    const radar=await radarPoint();for(let i=0;i<8;i++)await page.mouse.click(radar.x,radar.y);
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),0);assert.notEqual(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'erasing');
    await page.mouse.click(radar.x,radar.y);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),1);
    assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'erasing');
    const cutStart=await page.evaluate(()=>window.__MAN__.cutHint);assert.equal(cutStart.stage,'writing');
    assert.ok(Math.abs(cutStart.layout.x+cutStart.layout.width/2-viewport.width/2)<1e-7);
    assert.ok(Math.abs(cutStart.layout.y+cutStart.layout.height/2-viewport.height/2)<1e-7);
    await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(2));
    assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.writeProgress),cutStart.writeProgress);await page.click('#pause-button');
    const frozen=await page.evaluate(()=>window.__MAN__.onboardingHint.writeProgress);
    await page.evaluate(()=>window.__MAN_QA__.step(.35));const wiping=await page.evaluate(()=>window.__MAN__.onboardingHint);
    assert.equal(wiping.writeProgress,frozen);assert.ok(wiping.eraseProgress>0&&wiping.eraseProgress<1);
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawn();q.step(0);});
    assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.eraseProgress),wiping.eraseProgress);
    assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.serial),cutStart.serial);
    await page.evaluate(()=>window.__MAN_QA__.step(.8));assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'done');
    await page.evaluate(()=>window.__MAN_QA__.step(.35));assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'shown');
    const target=await page.evaluate(()=>{const q=window.__MAN_QA__,m=q.spawn(700,300,13);q.step(0);return window.__MAN__.meteors.find(p=>p.id===m.id);});
    await page.mouse.move(target.x-target.size*.9,target.y);await page.mouse.down();await page.mouse.move(target.x+target.size*.9,target.y,{steps:6});await page.mouse.up();
    assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.cuts>=1));assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'erasing');
    await page.evaluate(()=>window.__MAN_QA__.step(1.1));assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'done');
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawn();q.step(0);});assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'done');
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.step(.4);});
    const paused=await page.evaluate(()=>window.__MAN__.onboardingHint.writeProgress);await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(2));
    assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.writeProgress),paused);await page.click('#pause-button');
    await page.evaluate(()=>window.__MAN_QA__.step(.2));assert.ok(await page.evaluate(p=>window.__MAN__.onboardingHint.writeProgress>p,paused));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawn(700,300,13);q.model.slice({x:600,y:300},{x:800,y:300});q.step(0);});
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),1);
    const settings=await page.evaluate(()=>{localStorage.setItem('man-best','1234');localStorage.setItem('man-cut-saved-preset-v1',JSON.stringify({version:1,values:window.__MAN__.tuning}));return{live:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')};});
    await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
    const home=await page.evaluate(()=>({game:window.__MAN__.snapshot,hint:window.__MAN__.onboardingHint.stage,effects:window.__MAN__.effects.length,flames:window.__MAN__.flames.length,cutFeedback:window.__MAN__.cutFeedback.length,menu:document.getElementById('game-menu').open}));
    assert.equal(home.game.status,'ready');assert.equal(home.game.remaining,180);assert.equal(home.game.cuts,0);assert.equal(home.game.people.length,0);assert.equal(home.game.meteors.length,0);
    assert.equal(home.hint,'hidden');assert.equal(home.effects,0);assert.equal(home.flames,0);assert.equal(home.cutFeedback,0);assert.equal(home.menu,false);
    assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'hidden');
    assert.equal(await page.locator('#intro').isVisible(),true);assert.equal(await page.locator('#results').isVisible(),false);
    assert.deepEqual(await page.evaluate(()=>({live:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')})),settings);
    assert.equal(await page.evaluate(()=>localStorage.getItem('man-best')),'1234');
    await page.evaluate(()=>window.__MAN_QA__.step(1));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.remaining),180);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'writing');
    results.push({viewport,earlySummon:index>0,writeProgressAtSummon:frozen,erased:true,pauseAndRestart:'ok',returnToStart:'ok'});
  }
  assert.ok(await page.evaluate(()=>window.__hintEraseLayers.length>0&&window.__hintEraseLayers.every(layer=>layer==='hint')));
  await page.evaluate(()=>window.__MAN_QA__.step(180));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ended');
  await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ready');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(async()=>{(await import('./cut-settings.js')).applyCutSettings({bombChance:0},{persist:false});});
  await page.evaluate(()=>window.__MAN_QA__.hold(true));await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'shown');
  const p=await radarPoint();for(let i=0;i<9;i++)await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'done');
  assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'shown');
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawn(700,300,13);q.model.slice({x:600,y:300},{x:800,y:300});q.step(0);});
  assert.equal(await page.evaluate(()=>window.__MAN__.cutHint.stage),'done');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:'ok',eraseLayerIsolation:'ok',errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
