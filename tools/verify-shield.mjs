// Real controls, routing, state, collision events and runtime only. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,args);};}});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const shield=()=>page.evaluate(()=>window.__MAN__.shield);
const choose=async id=>{await page.click(`[data-level="${id}"]`);await page.click(`[data-level="${id}"]`);await finish();};
const rawClick=async()=>{const r=await page.locator('#shield-button').boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(dark=>{if((document.documentElement.dataset.theme==='dark')!==dark)document.getElementById('theme-toggle').click();},dark);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');
    assert.equal(await page.locator('#radar-shield').isVisible(),true);assert.equal((await shield()).state,'ready');
    assert.equal((await page.locator('#radar-shield').innerText()).trim(),'雷达护盾');
    assert.ok(await page.locator('#radar-shield').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
    await page.click('#shield-button');assert.equal((await shield()).active,true);const born=(await shield()).activatedAt;
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.clicks),0,'the shield does not also click the radar');
    await rawClick();assert.equal((await shield()).activatedAt,born);await step(.7);
    await page.click('#menu-button');const paused=await shield();await step(2);assert.deepEqual(await shield(),paused);assert.equal(await page.locator('#shield-button').isDisabled(),true);await page.click('#pause-button');
    await page.evaluate(()=>{const g=window.__MAN_QA__.model,c=g.shieldGeometry(),m=g.spawnMeteor(c.x/g.view.sx,0,1,'man');const offset=m.size*.5*(g.view.sy-g.view.character);m.y=(c.y-c.radius-180-offset)/g.view.sy;m.vx=0;m.vy=2400/g.view.sy;});
    await step(.3);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),0);
    assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='meteor'&&b.y<808)));
    await step(3.01);assert.equal((await shield()).state,'cooldown');await rawClick();assert.equal((await shield()).activatedAt,born);
    await step(15);assert.equal((await shield()).state,'ready');
    const original=(await shield()).circle.radius;
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.realTime=g.sceneTime=30.9;g.remaining=149.1;q.step(0);});
    assert.ok(Math.abs((await shield()).circle.radius/original-1.05)<1e-6);
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.realTime=g.sceneTime=179.99;g.remaining=.01;q.step(.02);});
    await page.click('#menu-button');await page.click('#menu-restart-button');await finish();assert.equal((await shield()).state,'ready');assert.equal((await shield()).activatedAt,null);
    await page.click('#menu-button');await page.click('#return-levels-button');await finish();await choose('man-1');assert.equal(await page.locator('#radar-shield').isVisible(),false);
    await page.click('#menu-button');await page.click('#return-start-button');await finish();assert.equal((await shield()).enabled,false);
    results.push({viewport,dark,secondLevelOnly:true,realSwitch:true,locksAndPause:true,surfaceImpact:true,scalesWithRadar:true,restart:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');await page.click('#shield-button');assert.equal((await shield()).reduced,true);assert.equal((await shield()).active,true);
  await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(()=>window.__MAN__.snapshot.realTime>.15);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,liveRaf:true,errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
