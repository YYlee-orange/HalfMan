// Functional wording, sequence, input, pause/reset and runtime only; no screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo']){const f=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...a){if(a.some(n=>typeof n==='number'&&!Number.isFinite(n)))throw Error(`Nonfinite ${name}`);return f.apply(this,a);};}});
const step=dt=>page.evaluate(dt=>window.__MAN_QA__.step(dt),dt),finish=()=>page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
const read=()=>page.evaluate(()=>({chapter:window.__MAN__.chapterHint,mechanism:window.__MAN__.mechanismHint,radar:window.__MAN__.onboardingHint.stage,cut:window.__MAN__.cutHint.stage,game:window.__MAN__.snapshot}));
const texts=['老大，我们引入了高级的分数生产设备','只要让小人降落在上面就可以生产分数！','虽然有点危险...','但是老大很厉害','所以没问题！'];
async function enter(){await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await page.click('[data-level="man-3"]');await page.click('[data-level="man-3"]');await finish();}
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:844,height:220}])for(const dark of [false,true]){
    await page.setViewportSize(viewport);await page.evaluate(d=>{if((document.documentElement.dataset.theme==='dark')!==d)document.getElementById('theme-toggle').click();},dark);await enter();let s=await read();assert.deepEqual(s.chapter.lines,['曼之三','农业']);assert.equal(s.chapter.stage,'writing');assert.equal(s.mechanism.stage,'hidden');assert.equal(s.radar,'hidden');
    const point=await page.evaluate(async()=>{const {radarLocalPoint}=await import('/radar.js'),v=window.__MAN__.viewport,r=window.__MAN__.radar,p=radarLocalPoint({type:'antenna',x:-12,y:-76},r.press,r.release,r),scale=v.artScale*r.scale;return{x:r.originX/1440*v.width+p.x*scale,y:808/810*v.height+p.y*scale};});await page.mouse.click(point.x,point.y);assert.equal((await read()).game.clicks,1);
    await step(3.951);assert.equal((await read()).chapter.stage,'done');
    for(let i=0;i<texts.length;i++){
      s=await read();assert.equal(s.mechanism.text,texts[i]);assert.equal(s.mechanism.stage,'writing');assert.equal(s.cut,'hidden');
      await step(.6);const progress=(await read()).mechanism.writeProgress;await page.setViewportSize({width:viewport.width-4,height:viewport.height});assert.equal((await read()).mechanism.writeProgress,progress);await page.setViewportSize(viewport);
      await page.click('#menu-button');const paused=await read();await step(2);assert.deepEqual(await read(),paused);await page.click('#pause-button');await step(.8);assert.equal((await read()).mechanism.stage,'shown');await step(1.7);assert.equal((await read()).mechanism.stage,'erasing');await step(1.05);
    }
    assert.equal((await read()).mechanism.stage,'done');await page.click('#menu-button');await page.click('#menu-restart-button');await finish();assert.equal((await read()).chapter.stage,'writing');assert.equal((await read()).mechanism.stage,'hidden');await page.click('#menu-button');await page.click('#return-start-button');await finish();assert.equal((await read()).mechanism.stage,'hidden');results.push({viewport,dark,exactWording:true,sequence:true,realClick:true,pauseResizeRestart:true});
  }
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);await page.evaluate(()=>window.__MAN_QA__.hold(true));await enter();assert.equal((await read()).chapter.stage,'shown');await step(1.601);for(const text of texts){assert.equal((await read()).mechanism.text,text);assert.equal((await read()).mechanism.stage,'shown');await step(1.7);}assert.equal((await read()).mechanism.stage,'done');await page.evaluate(()=>window.__MAN_QA__.hold(false));await page.waitForFunction(()=>window.__MAN__.snapshot.realTime>10.2);assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,reducedMotion:true,liveRaf:true,errors}));
}finally{await browser.close();}
