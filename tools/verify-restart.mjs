import {chooseFirstLevel} from './qa-navigation.mjs';
// Functional restart, contextual menu, timer, persistence and runtime checks only.
// No screenshots or subjective appearance / handfeel acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
const state=()=>page.evaluate(()=>({game:window.__MAN__.snapshot,transition:window.__MAN__.sceneTransition,hint:window.__MAN__.onboardingHint.stage,inert:document.querySelector('.playfield').inert}));
const endRound=()=>page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.people=[];g.meteors=[];g.bomblets=[];g.cuts=4;g.charge=70;g.realTime=179.99;g.sceneTime=179.99;g.remaining=.01;q.step(.02);q.step(window.__MAN__.roundEnding.delay);});
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.click('#menu-button');
    assert.equal(await page.locator('#pause-button').isVisible(),false);assert.equal(await page.locator('#return-start-button').isVisible(),false);
    assert.equal(await page.locator('#motion-toggle').count(),0);assert.equal(await page.locator('#menu-restart-button').isVisible(),false);assert.equal(await page.locator('#theme-toggle').isVisible(),true);assert.equal(await page.locator('#help').isVisible(),true);
    if(await page.evaluate(()=>document.documentElement.dataset.theme)!==(dark?'dark':'light'))await page.click('#theme-toggle');await page.click('#menu-close');
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);assert.equal((await state()).game.status,'playing');
    await page.click('#menu-button');assert.equal(await page.locator('#pause-button').isVisible(),true);assert.equal(await page.locator('#return-start-button').isVisible(),true);await page.click('#pause-button');
    await step(2);await page.evaluate(()=>{window.__MAN_QA__.model.cuts=3;});await page.click('#menu-button');await page.click('#menu-restart-button');assert.equal((await state()).transition.active,true);await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal((await state()).game.remaining,180);assert.equal((await state()).game.cuts,0);assert.equal((await state()).game.levelId,'man-1');
    const stored=await page.evaluate(()=>{localStorage.setItem('man-best','12345');localStorage.setItem('man-cut-saved-preset-v1',JSON.stringify({version:1,values:window.__MAN__.tuning}));return{live:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')};});
    await endRound();assert.equal((await state()).game.status,'ended');await page.click('#menu-button');assert.equal(await page.locator('#pause-button').isVisible(),false);assert.equal(await page.locator('#return-start-button').isVisible(),true);
    await page.click('#menu-restart-button');let s=await state();assert.equal(s.transition.active,true);assert.equal(s.game.status,'ended');assert.equal(s.game.cuts,4);assert.equal(s.inert,true);
    await page.keyboard.press('Space');await page.keyboard.press('p');await page.evaluate(()=>document.getElementById('menu-restart-button').click());
    await step(.14);s=await state();assert.equal(s.game.status,'ended');assert.equal(s.game.cuts,4);assert.equal(s.transition.phase,'closing');
    await step(.14);s=await state();assert.equal(s.game.status,'paused');assert.equal(s.game.remaining,180);assert.equal(s.game.realTime,0);assert.equal(s.game.cuts,0);assert.equal(s.game.score,0);assert.equal(s.game.alive,0);assert.equal(s.game.charge,0);assert.equal(s.game.progression.radarFactor,1);assert.equal(s.hint,'hidden');assert.equal(s.transition.coverage,1);
    await step(.24);await step(.05);s=await state();assert.equal(s.transition.phase,'cut-pause');assert.equal(s.game.realTime,0);assert.equal(s.game.remaining,180);assert.equal(s.hint,'hidden');
    await step(.05);await step(.14);s=await state();assert.equal(s.transition.phase,'opening');assert.equal(s.game.status,'paused');assert.equal(s.game.realTime,0);assert.equal(s.hint,'hidden');
    await step(.14);s=await state();assert.equal(s.transition.active,false);assert.equal(s.game.status,'playing');assert.equal(s.game.realTime,0);assert.equal(s.game.remaining,180);assert.equal(s.hint,'writing');assert.equal(s.inert,false);assert.equal(await page.evaluate(()=>document.activeElement.id),'scene');
    assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),dark?'dark':'light');
    assert.deepEqual(await page.evaluate(()=>({live:window.__MAN__.tuning,saved:localStorage.getItem('man-cut-saved-preset-v1')})),stored);assert.equal(await page.evaluate(()=>localStorage.getItem('man-best')),'12345');
    await step(.1);assert.ok((await state()).game.realTime>.09);await endRound();assert.equal(await page.locator('#results-levels-button').textContent(),'返回选关');await page.click('#results-levels-button');assert.equal((await state()).transition.active,true);await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.evaluate(()=>window.__MAN__.route),'levels');assert.equal((await state()).game.status,'ready');assert.equal((await state()).game.alive,0);
    await page.click('#menu-button');assert.equal(await page.locator('#menu-restart-button').isVisible(),false);await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal((await state()).game.status,'ready');
  }
  await page.evaluate(()=>window.__MAN_QA__.reset());await endRound();await page.click('#menu-button');await page.click('#menu-restart-button');await page.evaluate(()=>window.__MAN_QA__.hold(false));
  await page.waitForFunction(()=>!window.__MAN__.sceneTransition.active&&window.__MAN__.snapshot.status==='playing');
  await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(()=>{window.__MAN_QA__.hold(true);window.__MAN_QA__.reset();});await endRound();await page.click('#menu-button');await page.click('#menu-restart-button');assert.ok((await state()).transition.duration<=.17);
  await step(.08);const reducedState=await state();assert.equal(reducedState.game.status,'paused');assert.equal(reducedState.game.remaining,180);await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
  assert.equal((await state()).game.status,'playing');assert.equal((await state()).hint,'shown');assert.equal((await state()).game.realTime,0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:['motion menu option removed','restart hidden outside game','in-progress and ended menu restart','results return to level selection','restart uses the shared transition','old round remains until full cover','new round stays at 180 seconds throughout reveal','onboarding starts after reveal','duplicate restart/input guarded','settings/best/theme preserved','both themes and three viewports','return/start still works','live RAF completion','reduced motion'],errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
