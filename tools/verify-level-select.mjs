// Functional routing, real gestures, timing, locking and finite geometry only. No screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...a){if(a.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return original.apply(this,a);};}});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
const finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const read=()=>page.evaluate(()=>({route:window.__MAN__.route,level:window.__MAN__.activeLevel,selection:window.__MAN__.levelSelection,game:window.__MAN__.snapshot}));
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(dark=>{if((document.documentElement.dataset.theme==='dark')!==dark)document.getElementById('theme-toggle').click();},dark);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());
    let s=await read();assert.equal(s.route,'levels');assert.equal(s.game.status,'ready');assert.equal(s.game.realTime,0);assert.equal(s.game.remaining,180);
    assert.equal(await page.locator('#score-panel').isVisible(),false);assert.equal(await page.locator('#radar-controls').isVisible(),false);
    assert.equal(await page.locator('.level-node').count(),5);assert.equal(await page.locator('[data-level="man-4"]').count(),1);assert.equal(await page.locator('[data-level="man-6"]').count(),0);
    assert.equal(await page.locator('#level-enter,#level-status,#level-back').count(),0);
    assert.ok(!/曼-6|未解锁/.test(await page.locator('#level-select').textContent()));
    const captions=await page.locator('.level-node-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y};})),rockY=s.selection.nodes[0].y;
    await step(.25);assert.notEqual((await read()).selection.nodes[0].y,rockY);
    assert.deepEqual(await page.locator('.level-node-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y};})),captions);
    await page.click('[data-level="man-1"]');assert.equal((await read()).selection.nodes[0].flame,0);
    await step(.06);s=await read();assert.ok(s.selection.nodes[0].sx>1.3);assert.ok(s.selection.nodes[0].flame>0&&s.selection.nodes[0].flame<1);
    const before=s.selection.nodes[0].angle;await step(.64);s=await read();assert.equal(s.selection.nodes[0].flame,1);assert.ok(s.selection.nodes[0].angle>before);
    await page.hover('[data-level="man-1"]');assert.ok(await page.locator('.level-node-label').evaluateAll(es=>es.every(e=>getComputedStyle(e).textDecorationLine==='none')));
    await step(3);assert.equal((await read()).route,'levels');assert.equal(await page.evaluate(()=>window.__MAN__.sceneTransition.active),false,'one click never auto-enters');
    if(viewport.width<680){
      const map=await page.locator('#level-map').boundingBox();await page.mouse.move(map.x+map.width*.5,map.y+map.height*.7);await page.mouse.wheel(280,0);
      await page.waitForFunction(()=>document.getElementById('level-map').scrollLeft>0);
    }
    await page.click('[data-level="man-2"]');await step(.1);s=await read();assert.equal(s.selection.selected,'man-2');
    await page.locator('#level-map').evaluate(e=>{e.scrollLeft=e.scrollWidth-e.clientWidth;});
    const locked=await page.evaluate(()=>{const map=document.getElementById('level-map'),r=map.getBoundingClientRect(),n=window.__MAN__.levelSelection.nodes.at(-1);return{x:r.x+n.x-map.scrollLeft,y:r.y+n.y};});await page.mouse.click(locked.x,locked.y);
    assert.equal((await read()).selection.selected,'man-2');
    await page.click('#menu-button');assert.equal(await page.locator('#pause-button').isVisible(),false);assert.equal(await page.locator('#return-start-button').isVisible(),true);
    const paused=(await read()).selection;await step(5);assert.deepEqual((await read()).selection,paused);await page.click('#menu-close');
    await step(3);assert.equal((await read()).route,'levels');assert.equal(await page.evaluate(()=>window.__MAN__.sceneTransition.active),false);
    await page.click('[data-level="man-2"]');assert.equal(await page.evaluate(()=>window.__MAN__.sceneTransition.active),true);await step(.12);assert.equal((await read()).route,'levels');await step(.20);s=await read();assert.equal(s.route,'game');assert.equal(s.game.status,'paused');assert.equal(s.level,'man-2');assert.equal(s.game.remaining,180);
    await finish();s=await read();assert.equal(s.game.status,'playing');assert.equal(s.game.realTime,0);await step(.1);assert.ok((await read()).game.remaining<180);
    await page.click('#menu-button');await page.click('#return-levels-button');await finish();s=await read();assert.equal(s.route,'levels');assert.equal(s.selection.selected,'man-2');assert.equal(s.game.realTime,0);
    await step(2);assert.equal((await read()).route,'levels','returning never replays a queued entry');
    await page.click('#menu-button');await page.click('#return-start-button');await finish();assert.equal((await read()).route,'title');
    results.push({viewport,dark,realSelection:true,lockedRejected:true,clockAndPause:true,routing:true});
  }
  // Keyboard and live RAF use the same handlers as real visitors, not probe-only entry.
  await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await page.locator('[data-level="man-1"]').focus();await page.keyboard.press('ArrowRight');assert.equal((await read()).selection.selected,'man-2');
  await step(1);assert.equal((await read()).route,'levels');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__MAN__.sceneTransition.active),true);await finish();await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.remaining=.01;q.model.realTime=179.99;q.model.sceneTime=179.99;q.step(.02);q.step(window.__MAN__.roundEnding.delay);});
  await page.click('#menu-button');await page.click('#menu-restart-button');await finish();assert.equal((await read()).level,'man-2');assert.equal((await read()).game.remaining,180);
  await page.click('#menu-button');await page.click('#return-levels-button');await finish();const clock=(await read()).selection.time;
  await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(t=>window.__MAN__.levelSelection.time>t+.12,clock);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#menu-button');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__MAN__.reduced);await page.click('#menu-close');await step(.5);let s=await read();assert.deepEqual(s.selection.drift,{x:0,y:0});assert.ok(s.selection.nodes.every(n=>n.angle===0&&n.sx===1&&n.sy===1));
  await page.click('[data-level="man-1"]');assert.equal((await read()).selection.nodes[0].flame,1);await step(2);assert.equal((await read()).route,'levels');
  await page.click('[data-level="man-1"]');await finish();assert.equal((await read()).game.status,'playing');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,keyboard:true,restartKeepsLevel:true,liveRaf:true,reducedMotion:true,errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
