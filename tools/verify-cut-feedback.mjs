import {chooseFirstLevel} from './qa-navigation.mjs';
// Input/state/runtime checks only. No screenshots or visual/handfeel acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','fillRect']){
    const original=CanvasRenderingContext2D.prototype[name];
    CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${name}`);return original.apply(this,args);};
  }
});
async function gesture(interval){
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.hold(true);const m=q.spawn(700,300,19);m.vx=42;m.vy=120;q.step(0);});
  const m=await page.evaluate(()=>window.__MAN__.meteors[0]),box=await page.locator('#scene').boundingBox();
  await page.mouse.move(box.x+m.x-70,box.y+m.y);await page.mouse.down();
  await page.evaluate(({m,box,interval})=>{
    const canvas=document.getElementById('scene'),base=performance.now();
    for(let i=1;i<=14;i++){
      const event=new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'mouse',buttons:1,clientX:box.x+m.x-70+i*10,clientY:box.y+m.y});
      Object.defineProperty(event,'timeStamp',{value:base+i*interval});Object.defineProperty(event,'getCoalescedEvents',{value:()=>[]});canvas.dispatchEvent(event);
    }
    window.__MAN_QA__.step(0);
  },{m,box,interval});
  await page.mouse.up();return page.evaluate(()=>({feedback:window.__MAN__.cutFeedback[0],people:window.__MAN__.snapshot.people,blade:window.__MAN__.blade}));
}
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>!document.getElementById('start-button').disabled);await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);
  await page.click('#tuning-button');await page.click('#tuner-baseline');await page.click('#tuner-close');
  const results=[];
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const slow=await gesture(100),fast=await gesture(2);
    assert.ok(fast.feedback.strength>slow.feedback.strength);assert.ok(fast.feedback.particleCount>slow.feedback.particleCount);
    assert.equal(fast.feedback.flashFrames,1);assert.equal(fast.people.length,2);assert.ok(fast.people.every(p=>p.pendingImpulse));
    assert.ok(fast.blade.some(p=>p.life>.1));
    await page.evaluate(()=>window.__MAN_QA__.step(.02));
    const held=await page.evaluate(()=>({people:window.__MAN__.snapshot.people,feedback:window.__MAN__.cutFeedback[0],camera:window.__MAN__.camera}));
    assert.ok(held.people.every(p=>p.motionAge===0));assert.equal(held.feedback.flashFrames,1);
    assert.equal(held.camera.z,1);assert.ok(held.camera.dx>0);assert.ok(Math.abs(held.camera.dy)<1e-7);
    await page.evaluate(()=>window.__MAN_QA__.step(.03));
    const released=await page.evaluate(()=>window.__MAN__.snapshot.people);assert.ok(released.every(p=>!p.pendingImpulse&&p.motionAge>0));
    assert.ok(released[0].angularVelocity*released[1].angularVelocity<0);
    await page.evaluate(()=>window.__MAN_QA__.step(.05));
    assert.deepEqual(await page.evaluate(()=>({x:window.__MAN__.camera.dx,y:window.__MAN__.camera.dy})),{x:0,y:0});
    results.push({viewport,slowStrength:slow.feedback.strength,fastStrength:fast.feedback.strength,flashFrames:1,holdAndRelease:'ok'});
  }
  // Light/dark shades and reduced motion use the same input and feedback path.
  await page.click('#menu-button');await page.click('#theme-toggle');await page.click('#motion-toggle');await page.keyboard.press('Escape');
  const reduced=await gesture(2);assert.equal(reduced.feedback.flashFrames,1);
  await page.evaluate(()=>window.__MAN_QA__.step(.02));assert.deepEqual(await page.evaluate(()=>({x:window.__MAN__.camera.dx,y:window.__MAN__.camera.dy})),{x:0,y:0});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,errors},null,2));
}finally{await browser.close();}
