// Functional checks only: UI, persistence, real input, clocks and runtime errors. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const fn=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return fn.apply(this,args);};}});
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.click('#weapon-button');await page.waitForFunction(()=>getComputedStyle(document.getElementById('weapon-menu')).translate==='0px');
    const rect=await page.locator('#weapon-menu').boundingBox();assert.ok(Math.abs(rect.x+rect.width/2-viewport.width/2)<2);assert.ok(Math.abs(rect.y+rect.height/2-viewport.height/2)<2);
    await page.click('#weapon-menu [data-weapon="laser"]');assert.equal(await page.locator('#weapon-menu [data-weapon="laser"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>localStorage.getItem('man-weapon-v1')),'laser');
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await page.click('[data-level="man-2"]');await page.click('[data-level="man-2"]');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
    assert.equal(await page.evaluate(()=>window.__MAN__.cannon.weapon),'laser');await page.click('#cannon-toggle');assert.equal(await page.locator('#cannon-cooling-label').textContent(),'激光冷却');
    const aim={x:viewport.width*.62,y:viewport.height*.23};await page.locator('#scene').hover({position:aim});await page.mouse.down();await page.evaluate(()=>window.__MAN_QA__.step(.4));
    const before=await page.evaluate(()=>window.__MAN__.cannon.charge);assert.ok(before>0);await page.keyboard.press('p');await page.mouse.up();assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'paused');const paused=await page.evaluate(()=>window.__MAN__.cannon.charge);assert.equal(paused,0);await page.evaluate(()=>window.__MAN_QA__.step(3));assert.equal(await page.evaluate(()=>window.__MAN__.cannon.charge),paused);await page.click('#pause-button');
    await page.locator('#scene').hover({position:aim});await page.mouse.down();await page.evaluate(()=>window.__MAN_QA__.step(2.25));
    await page.evaluate(async()=>{const q=window.__MAN_QA__,g=q.model,{laserRay}=await import('./laser.js'),r=laserRay(g.cannon,g.view,g.ground);const m=g.spawnMeteor((r.from.x+r.to.x)/2,(r.from.y+r.to.y)/2,1,'man');m.vx=m.vy=0;});
    await page.evaluate(()=>window.__MAN_QA__.step(.2));assert.ok(await page.evaluate(()=>window.__MAN__.cannon.beam));assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.cannonKills>0));
    const held=await page.evaluate(()=>({id:window.__MAN__.cannon.beam.id,heat:window.__MAN__.cannon.heat}));await page.evaluate(()=>window.__MAN_QA__.step(.85));assert.equal(await page.evaluate(()=>window.__MAN__.cannon.beam.id),held.id);assert.ok(await page.evaluate(h=>window.__MAN__.cannon.heat>h,held.heat));assert.equal(await page.evaluate(()=>window.__MAN__.cannon.shots),1);
    const angle=await page.evaluate(()=>window.__MAN__.cannon.beam.angle);await page.mouse.move(viewport.width*.85,viewport.height*.25);await page.evaluate(()=>window.__MAN_QA__.step(.04));assert.notEqual(await page.evaluate(()=>window.__MAN__.cannon.beam.angle),angle);
    await page.mouse.up();await page.evaluate(()=>window.__MAN_QA__.step(.02));assert.equal(await page.evaluate(()=>window.__MAN__.cannon.beam),null);assert.equal(await page.evaluate(()=>window.__MAN__.cannon.charge),0);
    await page.click('#menu-button');await page.click('#menu-restart-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.evaluate(()=>window.__MAN__.cannon.weapon),'laser');assert.equal(await page.evaluate(()=>window.__MAN__.cannon.heat),0);
    await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());results.push({viewport,loadout:true,chargeAndRelease:true,follow:true,hit:true,pause:true,restart:true});
  }
  await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));assert.ok((await page.locator('#weapon-button').textContent()).includes('激光炮'));
  await page.click('#weapon-button');await page.click('#weapon-menu [data-weapon="cannon"]');await page.click('[data-weapon-close]');await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await page.click('[data-level="man-2"]');await page.click('[data-level="man-2"]');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.evaluate(()=>window.__MAN__.cannon.weapon),undefined);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,persistence:true,backToCannon:true,errors}));
}finally{await browser.close();}
