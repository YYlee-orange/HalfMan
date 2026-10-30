// Input, state, parameter limits and finite rendering only; no visual acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  for(const key of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','arc','ellipse','bezierCurveTo','quadraticCurveTo']){
    const original=CanvasRenderingContext2D.prototype[key];
    CanvasRenderingContext2D.prototype[key]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite canvas ${key}`);return original.apply(this,args);};
  }
});
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
  await page.evaluate(()=>window.__MAN_QA__.hold(true));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{
      const q=window.__MAN_QA__,g=q.model;q.reset();
      for(let i=0;i<18;i++){q.spawn(700,300,13);g.slice({x:600,y:300},{x:800,y:300});}
      for(const p of g.people){Object.assign(p,{x:p.workX,y:808-p.size*.25,state:'toWork',cutMotion:false,born:-10,landed:true,hunger:100});}
      q.step(.02);
    });
    const arrival=await page.evaluate(()=>window.__MAN__.snapshot.people.map(p=>p.state));
    assert.ok(arrival.includes('work')&&arrival.includes('jump'),'both ground and mounted jobs are allocated');
    await page.evaluate(()=>window.__MAN_QA__.step(1.5));
    const work=await page.evaluate(()=>window.__MAN__.snapshot.people);
    assert.equal(work.length,36);assert.ok(work.every(p=>p.state==='work'));assert.ok(work.some(p=>p.onRadar)&&work.some(p=>!p.onRadar));
    assert.equal(new Set(work.map(p=>JSON.stringify(p.workAnchor))).size,36);
    await page.evaluate(()=>{
      const q=window.__MAN_QA__,g=q.model;g.meteors=[];
      for(const p of g.people)p.hunger=.01;q.step(.05);q.step(1.5);
      for(const p of g.people){p.state='toFood';p.onRadar=false;p.onFood=false;delete p.jump;p.x=p.foodX;p.y=808-p.size*.25;}
      q.step(.02);
    });
    const foodArrival=await page.evaluate(()=>window.__MAN__.snapshot.people.map(p=>p.state));
    assert.ok(foodArrival.includes('eat')&&foodArrival.includes('jump'),'food has ground and bowl arrivals');
    await page.evaluate(()=>window.__MAN_QA__.step(1.1));
    const eat=await page.evaluate(()=>window.__MAN__.snapshot.people);assert.ok(eat.every(p=>p.state==='eat'));
    assert.ok(eat.some(p=>p.onFood)&&eat.some(p=>!p.onFood));assert.equal(eat.filter(p=>p.state==='eat').length,36);
    await page.evaluate(()=>window.__MAN_QA__.step(3));assert.ok(await page.evaluate(()=>window.__MAN__.snapshot.people.every(p=>['toWork','work','jump'].includes(p.state))));
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;g.meteors=[];for(const p of g.people){p.state='toWork';p.x=286;p.y=808-p.size*.25;p.onRadar=false;p.onFood=false;delete p.jump;}q.step(0);});
    await page.click('#recall-button');await page.evaluate(()=>window.__MAN_QA__.step(.05));
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sheltered),36);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.capacity),null);
    assert.equal(await page.locator('#shelter-count').textContent(),'洞内 36 人');await page.click('#release-button');
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sheltered),0);assert.equal(await page.locator('#recall-button').isEnabled(),true);
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.spawn();q.step(.75);});
    const radio=await page.evaluate(()=>({arcs:window.__MAN__.radio,art:window.__MAN__.viewport.artScale}));
    assert.equal(radio.arcs.length,4);assert.ok(radio.arcs[0].radius>180*radio.art);
    for(const arc of radio.arcs){const dx=arc.x-arc.baseX,dy=arc.y-arc.baseY,angle=(arc.start+arc.end)/2;assert.ok(Math.abs((Math.cos(angle)*dx+Math.sin(angle)*dy)/Math.hypot(dx,dy)-1)<1e-9);}
    const dense=await page.evaluate(()=>{
      const q=window.__MAN_QA__;q.reset();let maxAmplitude=0,maxFrequency=0;
      for(let i=0;i<30;i++){q.model.addCharge(20);q.step(.05);const p=window.__MAN__.radar;maxAmplitude=Math.max(maxAmplitude,p.amplitude);maxFrequency=Math.max(maxFrequency,p.frequency);}
      return{maxAmplitude,maxFrequency};
    });
    assert.ok(dense.maxAmplitude<=2.2&&dense.maxAmplitude>1.4);assert.ok(dense.maxFrequency<=3);
    results.push({viewport,workers:work.length,eaters:eat.length,sheltered:36,...dense});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,results,errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
