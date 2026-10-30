// Functional cue sequencing, input, lifecycle and runtime checks. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  window.__rubbedGame=false;const stroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas.id==='scene'&&this.globalCompositeOperation==='destination-out')window.__rubbedGame=true;return stroke.apply(this,args);};
  for(const key of ['drawImage','translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
const hints=()=>page.evaluate(()=>window.__MAN__.tutorialFeedback);
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(()=>window.__MAN_QA__.reset());await page.click('#menu-button');
    if(await page.evaluate(()=>document.documentElement.dataset.theme)!==(dark?'dark':'light'))await page.click('#theme-toggle');await page.click('#pause-button');
    await page.evaluate(()=>{window.__MAN_QA__.spawn(700,200,1);window.__MAN_QA__.step(.4);});
    const m=await page.evaluate(()=>window.__MAN__.meteors[0]);await page.mouse.move(m.x-70,m.y);await page.mouse.down();await page.mouse.move(m.x+70,m.y,{steps:4});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),1);assert.equal((await hints()).praise.stage,'hidden');
    await step(1.06);assert.equal((await hints()).active,'praise');assert.equal((await hints()).praise.stage,'writing');await step(.3);
    await page.click('#menu-button');const frozen=(await hints()).praise;await step(1);assert.deepEqual((await hints()).praise,frozen);await page.click('#pause-button');
    await page.evaluate(()=>{window.__MAN_QA__.spawnBomb(400,150);window.__MAN_QA__.step(0);});
    let h=await hints();assert.equal(h.active,'warning');assert.equal(h.bombSeen,true);const serial=h.warning.serial,praiseSerial=h.praise.serial;
    await page.evaluate(()=>{window.__MAN_QA__.spawnBomb(800,150);window.__MAN_QA__.step(0);});assert.equal((await hints()).warning.serial,serial);
    await step(1.45);h=await hints();assert.equal(h.warning.stage,'shown');assert.equal(h.active,'warning');
    await step(2.2);assert.equal((await hints()).warning.stage,'erasing');await step(1.05);h=await hints();assert.equal(h.warning.stage,'done');assert.equal(h.active,'praise');assert.equal(h.praise.serial,praiseSerial);
    await step(3);assert.equal((await hints()).praise.stage,'done');
    await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());h=await hints();assert.equal(h.warning.stage,'hidden');assert.equal(h.praise.stage,'hidden');assert.equal(h.bombSeen,false);
    await page.evaluate(()=>{window.__MAN_QA__.reset();window.__MAN_QA__.spawnBomb(500,50);window.__MAN_QA__.step(0);});assert.equal((await hints()).active,'warning');
    await page.evaluate(()=>{window.__MAN_QA__.model.meteors=[];window.__MAN_QA__.step(181);});h=await hints();assert.equal(h.warning.stage,'hidden');assert.equal(h.praise.stage,'hidden');
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.hold(true);q.reset();q.spawn(700,150,1);q.model.slice({x:600,y:150},{x:800,y:150});q.step(0);});assert.equal((await hints()).praise.stage,'shown');
  await page.evaluate(()=>{window.__MAN_QA__.spawnBomb(700,20);window.__MAN_QA__.step(0);});assert.equal((await hints()).warning.stage,'shown');await step(2.21);assert.equal((await hints()).warning.stage,'done');
  assert.equal(await page.evaluate(()=>window.__rubbedGame),false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({checks:['real cut schedules praise after tutorial erasing','praise pauses with the game','first bomb once per round','warning priority and praise resumes without replay','writing, holding and erasing','both themes and three viewports','return/end cleanup and new-round replay','reduced motion','eraser isolated from game canvas'],errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
