// Functional input/state/runtime checks only; no screenshots or visual approval.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SCORE_METEOR} from '../dist/score-meteor-rules.js';
const {cutPoints,fragmentPoints,chargeDuration}=SCORE_METEOR;
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
try{
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{
    window.__scoreBlurUses=0;const filter=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'filter');
    Object.defineProperty(CanvasRenderingContext2D.prototype,'filter',{...filter,set(value){if(this.canvas.id==='scene'&&String(value).startsWith('blur('))window.__scoreBlurUses++;filter.set.call(this,value);}});
    for(const name of ['translate','scale','rotate','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,args);};}
  });
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#weapon-button');await page.uncheck('#score-meteor-enabled');await page.click('[data-weapon-close]');
  assert.equal(await page.evaluate(()=>localStorage.getItem('man-score-meteor-v1')),'false');
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreMeteorsEnabled),false);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await page.click('[data-level="man-1"]');await page.click('[data-level="man-1"]');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
    await page.click('#tuning-button');await page.click('#tuner-score');await page.click('#tuner-close');
    const spawned=await page.evaluate(()=>window.__MAN__.meteors.find(m=>m.kind==='score')??window.__MAN__.meteors[0]);
    assert.ok(spawned.y+spawned.ry<0);
    const id=await page.evaluate(()=>{const g=window.__MAN_QA__.model,m=g.meteors.find(m=>m.kind==='score');m.x=720;m.y=250;m.vx=m.vy=0;window.__MAN_QA__.step(.01);return m.id;});
    async function swipe(){const p=await page.evaluate(id=>window.__MAN__.meteors.find(m=>m.id===id),id),left=Math.max(2,p.x-p.size*1.08),right=Math.min(viewport.width-2,p.x+p.size*1.08);await page.mouse.move(left,p.y);await page.mouse.down();await page.mouse.move(right,p.y,{steps:12});await page.mouse.up();}
    await swipe();await page.evaluate(()=>window.__MAN_QA__.step(.25));
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreCutBonus),cutPoints);const firstZoom=await page.evaluate(()=>window.__MAN__.camera.z);assert.ok(firstZoom>1&&firstZoom<1.03);assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.timeScale<.3));assert.ok(await page.evaluate(()=>window.__scoreBlurUses>0));
    assert.ok(await page.locator('#score-panel').isVisible());assert.ok(await page.locator('.time-metric').isVisible());assert.equal(await page.locator('#menu-button').isVisible(),false);assert.equal(await page.locator('#radar-controls').isVisible(),false);assert.equal(await page.locator('.other-metrics').isVisible(),false);
    await swipe();await page.evaluate(()=>window.__MAN_QA__.step(.1));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreCutBonus),2*cutPoints);assert.ok(await page.evaluate(z=>window.__MAN__.camera.z>z,firstZoom));assert.equal(await page.evaluate(()=>window.__MAN__.scoreMeteorFeedback.combos[0].value),2);assert.ok((await page.locator('.score-sources').textContent()).includes('连切分数陨石'));
    await page.keyboard.press('p');const before=await page.evaluate(()=>window.__MAN__.snapshot.realTime);await page.evaluate(()=>window.__MAN_QA__.step(4));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),before);await page.click('#pause-button');
    await page.evaluate(()=>{const q=window.__MAN_QA__,m=q.model.scoreFrenzy;q.step(m.frenzy.deadline-q.model.realTime+.02);});
    assert.ok(await page.evaluate(()=>window.__MAN_QA__.model.scoreFrenzy.frenzy.chargeStartedAt!=null));
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreFragments.length),0);
    await swipe();assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreCutBonus),2*cutPoints);
    await page.evaluate(duration=>window.__MAN_QA__.step(duration),chargeDuration);
    const count=await page.evaluate(()=>window.__MAN__.snapshot.scoreFragments.length);assert.ok(count>=6&&count<=9);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreFragmentBonus),0);assert.equal(await page.evaluate(()=>window.__MAN__.scoreMeteorFeedback.bursts[0].type),'bombAir');
    assert.ok(await page.evaluate(()=>window.__MAN__.scoreMeteorFeedback.shake.envelope>25));
    await page.evaluate(()=>window.__MAN_QA__.step(8));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreFragmentBonus),count*fragmentPoints);assert.equal(await page.evaluate(()=>window.__MAN__.camera.z),1);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreFragments.length),0);
    assert.ok(await page.locator('#menu-button').isVisible());assert.ok(await page.locator('#radar-controls').isVisible());
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.realTime=g.roundSeconds-.01;g.remaining=.01;q.step(.02);q.step(1.2);});
    assert.equal(await page.locator('#final-score-cuts').textContent(),String(2*cutPoints));assert.equal(await page.locator('#final-score-fragments').textContent(),String(count*fragmentPoints));assert.ok(await page.locator('#results').isVisible());
    results.push({viewport,cuts:2,fragments:count,editorSpawn:true,continuousGesture:true,zoom:true,backgroundBlur:true,slowMotion:true,pause:true,settlement:true});
  }
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.click('#weapon-button');await page.check('#score-meteor-enabled');await page.click('[data-weapon-close]');await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.scoreMeteorsEnabled),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,savedOption:true,errors}));
}finally{await browser.close();}
