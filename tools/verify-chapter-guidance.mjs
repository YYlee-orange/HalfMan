// Functional level-specific guidance, real input, timer and runtime checks only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const state=()=>page.evaluate(()=>({chapter:window.__MAN__.chapterHint,mechanism:window.__MAN__.mechanismHint,radar:window.__MAN__.onboardingHint.stage,cut:window.__MAN__.cutHint.stage,feedback:window.__MAN__.tutorialFeedback,game:window.__MAN__.snapshot}));
const noTutorial=s=>{assert.equal(s.radar,'hidden');assert.equal(s.cut,'hidden');assert.equal(s.feedback.active,null);assert.equal(s.feedback.bombSeen,false);};
const choose=async id=>{await page.click(`[data-level="${id}"]`);await page.click(`[data-level="${id}"]`);};
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(dark=>{if((document.documentElement.dataset.theme==='dark')!==dark)document.getElementById('theme-toggle').click();},dark);
    await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');await step(.28);
    assert.equal((await state()).chapter.stage,'hidden');assert.equal((await state()).game.remaining,180);await finish();let s=await state();
    noTutorial(s);assert.equal(s.chapter.stage,'writing');assert.deepEqual(s.chapter.lines,['曼之二','防空']);assert.equal(s.chapter.strokeScale,1.9);assert.equal(s.game.realTime,0);
    await step(.3);await page.click('#menu-button');const frozen=(await state()).chapter;await step(2);assert.deepEqual((await state()).chapter,frozen);await page.click('#pause-button');
    const point=await page.evaluate(async()=>{const {radarLocalPoint}=await import('/radar.js'),v=window.__MAN__.viewport,r=window.__MAN__.radar,s=v.artScale*r.scale,p=radarLocalPoint({type:'antenna',x:-12,y:-76},r.press,r.release,r);return{x:r.originX/1440*v.width+p.x*s,y:808/810*v.height+p.y*s};});
    for(let i=0;i<9;i++)await page.mouse.click(point.x,point.y);assert.ok((await state()).game.meteors.length>0,JSON.stringify({viewport,dark,point,clicks:(await state()).game.clicks}));noTutorial(await state());assert.equal((await state()).chapter.writeProgress,frozen.writeProgress);
    await page.evaluate(()=>{window.__MAN_QA__.spawn(650,160,1);window.__MAN_QA__.step(0);});const m=await page.evaluate(()=>window.__MAN__.meteors.at(-1));
    await page.mouse.move(m.x-70,m.y);await page.mouse.down();await page.mouse.move(m.x+70,m.y,{steps:4});await page.mouse.up();assert.ok((await state()).game.cuts>0);noTutorial(await state());
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.spawnBomb(500,100);q.step(0);q.model.meteors=[];q.model.people=[];});noTutorial(await state());
    await step(1.01);assert.equal((await state()).chapter.stage,'shown');await step(1.6);assert.equal((await state()).chapter.stage,'erasing');await step(1.06);assert.equal((await state()).chapter.stage,'done');
    for(const cue of ['shield-intro','shield-open','cannon-intro','cannon-open','sky-secure','advantage']){
      const m=(await state()).mechanism;assert.equal(m.cue,cue);assert.equal(m.stage,'writing');
      if(cue==='shield-open'){const target=await page.locator('#shield-button').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,top:document.getElementById('radar-shield').getBoundingClientRect().top};});assert.ok(Math.abs(target.x-m.target.x)<.02);assert.ok(m.target.y<=target.top-31);}
      if(cue==='cannon-open'){const top=await page.evaluate(async()=>{const {CANNON}=await import('/cannon.js'),g=window.__MAN__.cannon.geometry;return g.pivot.y-(CANNON.barrel+6)*g.scale;});assert.ok(Number.isFinite(m.target.x)&&m.target.y<=top-31);}
      if(cue==='sky-secure')assert.equal(m.text,'现在空中已不构成威胁');if(cue==='advantage')assert.equal(m.text,'优势在我！');
      await step(1.4);assert.equal((await state()).mechanism.stage,'shown');await page.click('#menu-button');const paused=(await state()).mechanism;await step(1);assert.deepEqual((await state()).mechanism,paused);await page.click('#pause-button');
      await step(1.7);assert.equal((await state()).mechanism.stage,'erasing');await step(1.05);
    }
    assert.equal((await state()).mechanism.stage,'done');
    const serial=(await state()).chapter.serial;await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.realTime=179.99;q.model.remaining=.01;q.model.sceneTime=179.99;q.step(.02);q.step(window.__MAN__.roundEnding.delay);});
    await page.click('#menu-button');await page.click('#menu-restart-button');await step(.28);assert.equal((await state()).chapter.stage,'hidden');await finish();assert.equal((await state()).chapter.serial,serial+1);assert.equal((await state()).chapter.stage,'writing');noTutorial(await state());
    await page.click('#menu-button');await page.click('#return-levels-button');await finish();assert.equal((await state()).chapter.stage,'hidden');assert.equal((await state()).mechanism.stage,'hidden');await choose('man-1');await finish();s=await state();assert.equal(s.chapter.stage,'writing');assert.deepEqual(s.chapter.lines,['曼之一','切！']);assert.equal(s.mechanism.stage,'hidden');assert.equal(s.radar,'hidden');await step(4);assert.equal((await state()).radar,'writing');
    await page.evaluate(()=>{window.__MAN_QA__.spawn(650,160,1);window.__MAN_QA__.step(0);});assert.equal((await state()).cut,'writing');
    await page.click('#menu-button');await page.click('#return-start-button');await finish();results.push({viewport,dark,secondChapter:true,onboardingSuppressed:true,firstLevelPreserved:true,pauseAndRestart:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await choose('man-2');await finish();assert.equal((await state()).chapter.stage,'shown');noTutorial(await state());await step(1.61);assert.equal((await state()).chapter.stage,'done');assert.equal((await state()).mechanism.cue,'shield-intro');assert.equal((await state()).mechanism.stage,'shown');await step(10.2);assert.equal((await state()).mechanism.stage,'done');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
