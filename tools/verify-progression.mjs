// Functional growth, hit regions, geometry and charge accounting only; no screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  for(const key of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse']){
    const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite ${key}`);return original.apply(this,args);};
  }
});
const point=()=>page.evaluate(()=>{const v=window.__MAN__.viewport,r=window.__MAN__.radar,s=v.artScale*r.scale;return{x:r.originX/1440*v.width+12*s,y:808/810*v.height-40*s};});
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  const radarBase=await page.evaluate(async()=>(await import('./radar.js')).RADAR_SCALE);close(radarBase,1.5);
  await page.evaluate(async()=>{window.__MAN_QA__.hold(true);(await import('./cut-settings.js')).applyCutSettings({bombChance:0},{persist:false});});
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    let scoreBounds;
    for(const time of [0,30,60,90,120,150]){
      await page.evaluate(time=>{const q=window.__MAN_QA__,g=q.model;q.reset();g.random=()=>.99;g.realTime=time+.9;g.sceneTime=time+.9;g.remaining=180-time-.9;q.step(0);},time);
      const stage=time/30,factor=1+stage*.05,snapshot=await page.evaluate(()=>window.__MAN__.snapshot),r=await page.locator('#radar-controls').boundingBox();
      close(snapshot.progression.summonMultiplier,1+stage*.2);close(snapshot.chargeMax,100*factor);close(await page.evaluate(()=>window.__MAN__.radar.scale),radarBase*factor);
      const score=await page.locator('#score-panel').boundingBox();if(scoreBounds)assert.deepEqual(score,scoreBounds,'radar growth never repositions the score panel');else scoreBounds=score;
      assert.ok(Math.abs(r.width-(viewport.width<=700?80:112)*factor)<.1);assert.ok(r.x>=0&&r.x+r.width<=viewport.width);
      const p=await point();await page.mouse.click(p.x,p.y);close(await page.evaluate(()=>window.__MAN__.snapshot.chargePercent),12);
      assert.equal(await page.locator('.charge-track').getAttribute('aria-valuenow'),'12');
      for(let i=0;i<8;i++)await page.mouse.click(p.x,p.y);
      const wave=await page.evaluate(()=>window.__MAN__.snapshot);assert.equal(wave.summonWaves,1);assert.equal(wave.meteors.length,time===150?2:1);close(wave.chargePercent,8);
      await page.evaluate(()=>window.__MAN_QA__.step(.75));const radio=await page.evaluate(()=>window.__MAN__.radio);assert.equal(radio.length,4);
      for(const arc of radio){const dx=arc.x-arc.baseX,dy=arc.y-arc.baseY,a=(arc.start+arc.end)/2;close((Math.cos(a)*dx+Math.sin(a)*dy)/Math.hypot(dx,dy),1);}
    }
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.reset();g.realTime=29.9;g.sceneTime=29.9;g.remaining=150.1;q.step(0);});
    let lastFactor=1;
    for(const dt of [.1,.15,.3,.45]){
      await page.evaluate(dt=>window.__MAN_QA__.step(dt),dt);
      const p=await page.evaluate(()=>({factor:window.__MAN__.radar.growth,scale:window.__MAN__.radar.scale,capacity:window.__MAN__.snapshot.chargeMax,time:window.__MAN__.snapshot.realTime}));
      assert.ok(p.factor>=lastFactor&&p.factor<=1.05+1e-8);if(p.time>30.01&&p.time<30.89)assert.ok(p.factor>1&&p.factor<1.05);
      close(p.scale,radarBase*p.factor);close(p.capacity,100*p.factor);
      const actualWidth=await page.locator('#radar-controls').evaluate(e=>parseFloat(e.style.width));
      assert.ok(Math.abs(actualWidth-(viewport.width<=700?80:112)*p.factor)<.02,'CSS width follows the shared factor within subpixel serialization precision');
      lastFactor=p.factor;
    }
    close(lastFactor,1.05);
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.realTime=30.45;q.model.sceneTime=30.45;q.model.remaining=149.55;q.step(0);});
    const midPoint=await point();await page.mouse.click(midPoint.x,midPoint.y);close(await page.evaluate(()=>window.__MAN__.snapshot.chargePercent),12);
    const growthPaused=await page.evaluate(()=>window.__MAN__.radar.growth);await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(1));close(await page.evaluate(()=>window.__MAN__.radar.growth),growthPaused);await page.click('#pause-button');
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.reset();g.realTime=30;g.sceneTime=30;g.remaining=150;g.random=()=>0;q.step(0);});
    const p=await point();for(let i=0;i<9;i++)await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),2);
    await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(60));close(await page.evaluate(()=>window.__MAN__.snapshot.realTime),30);
    await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());close(await page.evaluate(()=>window.__MAN__.radar.scale),radarBase);close(await page.evaluate(()=>window.__MAN__.snapshot.chargeMax),100);
    results.push({viewport,stages:6,clickPercent:12,batchChance:'ok',radarBase,scoreBoundsFixed:'ok',smoothGrowthAndSynchronizedBar:'ok',growthPause:'ok',radioDirection:'ok',reset:'ok'});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
