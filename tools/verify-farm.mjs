// Routing, crop contacts, layer data, pause/reset and runtime only. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...a){if(a.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,a);};}});
const read=()=>page.evaluate(()=>window.__MAN__.farm),step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const choose=async id=>{const node=page.locator(`[data-level="${id}"]`);if(await node.getAttribute('aria-pressed')!=='true')await node.click();await node.click();await finish();};
async function pass(direction){
  await page.evaluate(direction=>{const q=window.__MAN_QA__;q.reset();const v=q.model.view,f=window.__MAN__.farm,g=f.geometry,c=f.crops.find(c=>c.layer==='front'),half=16;const screenX=g.x+(c.x-direction*65)*g.scale*g.sx,screenY=g.y+(c.y-c.height*.45)*g.scale*g.sy;
    q.model.people.push({id:q.model.nextId++,part:0,variantId:1,x:screenX/v.sx,y:(screenY-half*(v.sy-v.character))/v.sy,size:64,birthSize:64,born:-10,phase:0,vx:direction*450*g.scale/v.sx,vy:0,hunger:100,state:'fall',landed:false,workX:1200,foodX:708});q.step(0);
  },direction);
  await step(.2);await step(.1);assert.ok((await read()).crops.some(c=>c.reaction*direction>0));
}
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(d=>{if((document.documentElement.dataset.theme==='dark')!==d)document.getElementById('theme-toggle').click();},dark);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());assert.equal(await page.locator('.level-node').count(),4);assert.equal(await page.locator('[data-level="man-5"]').count(),0);assert.ok(!/曼-5|未解锁/.test(await page.locator('#level-select').textContent()));
    await page.click('[data-level="man-3"]');assert.equal(await page.evaluate(()=>window.__MAN__.route),'levels');await step(.2);await page.click('[data-level="man-3"]');await finish();assert.equal(await page.evaluate(()=>window.__MAN__.activeLevel),'man-3');assert.equal((await read()).enabled,true);assert.equal(await page.evaluate(()=>window.__MAN__.onboardingHint.stage),'hidden');
    const first=await read();assert.equal(first.crops.filter(c=>c.layer==='back').length,5);assert.equal(first.crops.filter(c=>c.layer==='front').length,4);await step(2);assert.ok((await read()).rotor>first.rotor);assert.notEqual((await read()).geometry.y,first.geometry.y);
    const moving=(await read()).geometry.x;await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(x=>window.__MAN__.farm.geometry.x>x+.5,moving);await page.evaluate(()=>window.__MAN_QA__.hold(true));
    assert.equal(await page.locator('#radar-shield').isVisible(),true);assert.equal(await page.locator('#cannon-controls').isVisible(),true);await page.click('#shield-button');await step(.7);assert.equal(await page.evaluate(()=>window.__MAN__.shield.active),true);
    await page.click('#cannon-toggle');await page.mouse.move(viewport.width*.35,viewport.height*.2);await page.mouse.down();await step(.08);await page.mouse.up();assert.ok(await page.evaluate(()=>window.__MAN__.cannon.shots>0));await page.click('#cannon-toggle');
    await pass(1);await pass(-1);await page.click('#menu-button');const paused=await read();await step(3);assert.deepEqual(await read(),paused);await page.click('#pause-button');
    await page.evaluate(()=>window.__MAN_QA__.model.people=[]);await step(2);assert.ok((await read()).crops.every(c=>c.reaction===0));
    await page.click('#menu-button');await page.click('#menu-restart-button');await finish();assert.equal((await read()).rotor,0);assert.ok((await read()).crops.every(c=>c.reaction===0));
    await page.click('#menu-button');await page.click('#return-levels-button');await finish();await choose('man-2');assert.equal((await read()).enabled,false);await page.click('#menu-button');await page.click('#return-start-button');await finish();results.push({viewport,dark,thirdLevel:true,fourthLocked:true,rotor:true,bothContactDirections:true,pauseReset:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-3');const a=await read();await step(2);assert.deepEqual(await read(),a);await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(()=>window.__MAN__.snapshot.realTime>2.15);assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,liveRaf:true,errors}));
}finally{await browser.close();}
