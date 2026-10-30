// Functional controls, timers, staffing, scoring and runtime only. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','roundRect','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,args);};}});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition()),read=()=>page.evaluate(()=>window.__MAN__.cannon);
const choose=async id=>{await page.click(`[data-level="${id}"]`);await page.click(`[data-level="${id}"]`);await finish();};
async function recruit(){
  await page.evaluate(()=>{const g=window.__MAN_QA__.model;for(let i=0;i<7;i++)g.people.push({id:g.nextId++,part:i%2,variantId:1,x:i===6?1250:500,y:792,size:64,birthSize:64,born:-10,phase:0,vx:0,vy:0,hunger:90,state:i===6?'work':'toWork',landed:true,workX:1200,foodX:708});});
  await page.click('#cannon-toggle');await step(.04);assert.equal((await read()).crew,6);assert.equal((await read()).aiming,true);assert.equal(await page.locator('#cannon-toggle').getAttribute('aria-pressed'),'true');
}
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(d=>{if((document.documentElement.dataset.theme==='dark')!==d)document.getElementById('theme-toggle').click();},dark);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');
    assert.equal(await page.locator('#cannon-controls').isVisible(),true);assert.ok(await page.locator('#cannon-controls').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
    const fixed=await page.locator('#cannon-controls').boundingBox(),geometry=(await read()).geometry,expectedSize=Math.min(48,Math.max(24,50*geometry.scale));assert.ok(Math.abs(fixed.width-expectedSize)<.02);assert.ok(Math.abs(fixed.height-expectedSize)<.02);assert.ok(Math.abs(fixed.x+fixed.width/2-geometry.pivot.x)<.02);assert.ok(Math.abs(fixed.y+fixed.height/2-geometry.pivot.y)<1);await step(.6);const idle=await page.locator('#cannon-controls').boundingBox();assert.equal(idle.x,fixed.x);assert.equal(idle.y,fixed.y);
    assert.ok(await page.locator('#cannon-crew').evaluate(e=>{const label=e.getBoundingClientRect(),button=document.getElementById('cannon-toggle').getBoundingClientRect();return label.top>=button.bottom&&label.bottom<=innerHeight;}));
    assert.ok(await page.locator('#cannon-crew-count').evaluate(e=>getComputedStyle(e).fontFamily===getComputedStyle(document.querySelector('.score-motion')).fontFamily&&Number(getComputedStyle(e).fontWeight)>=700));
    assert.equal(await page.locator('#cannon-cooling-hud').isVisible(),false);assert.equal(await page.locator('.cannon-front').textContent(),'射');assert.equal(await page.locator('.cannon-back').textContent(),'退');
    await page.click('#cannon-toggle');await page.mouse.move(500/1440*viewport.width,viewport.height*.2);await page.mouse.down();await step(.1);assert.equal((await read()).crew,0);assert.equal((await read()).shots,1);await step(.5);assert.equal((await read()).shots,1);await page.mouse.up();await page.click('#cannon-toggle');await page.evaluate(()=>window.__MAN_QA__.reset());
    await recruit();const point={x:500/1440*viewport.width,y:viewport.height*.2};await page.mouse.move(point.x,point.y);await page.mouse.down();await step(.06);
    assert.equal(await page.locator('#cannon-cooling-hud').isVisible(),true);assert.equal(await page.locator('#cannon-cooling-label').textContent(),'开炮冷却');assert.equal(await page.locator('#cannon-cooling-hud').evaluate(e=>e.parentElement.id),'score-panel');
    assert.ok((await read()).shots>0);assert.ok((await read()).heat>0);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.clicks),0);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),0);
    await step(2);assert.equal((await read()).overheated,true);const shots=(await read()).shots;await step(.3);assert.equal((await read()).shots,shots);await page.mouse.up();await step(2);assert.equal((await read()).heat,0);
    await page.evaluate(()=>{const g=window.__MAN_QA__.model;g.cannon.bullets=[];const m=g.spawnMeteor(500,350,1,'man');m.vx=m.vy=0;});
    await page.mouse.down();await step(1);await page.mouse.up();assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cannonBonus),75);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.people.length),7);assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='cannonDebris')));
    await step(2);await page.evaluate(()=>{const g=window.__MAN_QA__.model;g.cannon.bullets=[];const m=g.spawnMeteor(500,350,undefined,'bomb');m.vx=m.vy=0;});
    await page.mouse.down();await step(1);await page.mouse.up();assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cannonBonus),125);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bombPenalty),0);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.bomblets.length),0);
    const hunger=await page.evaluate(()=>window.__MAN_QA__.model.cannonCrew.map(p=>p.hunger));await page.click('#cannon-toggle');assert.equal((await read()).aiming,false);assert.equal((await read()).crew,6);assert.equal((await read()).reserved,6);await step(.5);assert.ok(await page.evaluate(before=>window.__MAN_QA__.model.cannonCrew.every((p,i)=>Math.abs(p.hunger-(before[i]-2))<1e-7),hunger));
    await page.waitForFunction(()=>document.getElementById('cannon-cooling-hud').hidden);
    await page.click('#menu-button');const paused=await read();await step(2);assert.deepEqual(await read(),paused);await page.click('#pause-button');
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.realTime=g.sceneTime=179.99;g.remaining=.01;q.step(.02);q.step(window.__MAN__.roundEnding.delay);});assert.equal(await page.locator('#final-cannon').textContent(),'125');
    await page.click('#menu-button');await page.click('#menu-restart-button');await finish();assert.equal((await read()).aiming,false);assert.equal((await read()).shots,0);assert.equal((await read()).heat,0);
    await page.click('#menu-button');await page.click('#return-levels-button');await finish();await choose('man-1');assert.equal(await page.locator('#cannon-controls').isVisible(),false);
    await page.click('#menu-button');await page.click('#return-start-button');await finish();results.push({viewport,dark,continuousRecruitment:true,actualHoldFire:true,overheat:true,normal75:true,bomb50:true,noNewPeople:true,exitAndRestart:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');await recruit();
  await page.mouse.move(500/1440*844,80);await page.mouse.down();await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(()=>window.__MAN__.cannon.shots>0);await page.mouse.up();await page.evaluate(()=>window.__MAN_QA__.hold(true));assert.equal(await page.evaluate(()=>window.__MAN__.reduced),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,liveRaf:true,errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
