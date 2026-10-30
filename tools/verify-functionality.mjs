import {chooseFirstLevel} from './qa-navigation.mjs';
// Functional checks only. No screenshots, pixel checks, appearance or handfeel acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try{
  await page.addInitScript(()=>{
    for(const name of ['translate','scale','rotate','transform','setTransform','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','fillRect']){
      const original=CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error(`Nonfinite canvas ${name}`);return original.apply(this,args);};
    }
  });
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>!document.getElementById('start-button').disabled);
  assert.equal(await page.evaluate(()=>window.__MAN__.fonts.length),3);assert.equal(await page.evaluate(()=>window.__MAN__.variants.length),27);
  assert.deepEqual(await page.evaluate(()=>window.__MAN__.fonts),['yahei','simsun','youyuan']);
  const frameClock=await page.evaluate(()=>window.__MAN__.sky.time);
  await page.waitForFunction(start=>window.__MAN__.sky.time>start+.05,frameClock);
  await page.evaluate(()=>window.__MAN_QA__.hold(true));
  const skyStart=await page.evaluate(()=>window.__MAN__.sky);
  await page.evaluate(()=>window.__MAN_QA__.step(.5));
  assert.ok(Math.abs(await page.evaluate(()=>window.__MAN__.sky.time)-skyStart.time-.5)<1e-7);
  let shootingSeen=false;
  for(let i=0;i<28;i++){await page.evaluate(()=>window.__MAN_QA__.step(.25));if(await page.evaluate(()=>window.__MAN__.sky.shooting.length>0))shootingSeen=true;}
  assert.ok(shootingSeen,'background shooting stars are scheduled while the intro is shown');
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.click('#menu-button');
    const center=await page.locator('#game-menu').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight};});
    assert(Math.abs(center.x-center.w/2)<1&&Math.abs(center.y-center.h/2)<1);await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1440,height:900});await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);
  const radar=await page.evaluate(()=>{const v=window.__MAN__.viewport,r=window.__MAN__.radar,s=v.artScale*r.scale;return{x:r.originX/1440*v.width-10*s,y:808/810*v.height-165*s};});
  for(let i=0;i<9;i++)await page.mouse.click(radar.x,radar.y);
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.clicks),9);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),1);
  await page.evaluate(()=>{window.__MAN_QA__.hold(true);window.__MAN_QA__.step(3);});
  const m=await page.evaluate(()=>window.__MAN__.meteors[0]);await page.mouse.move(m.x-65,m.y);await page.mouse.down();await page.mouse.move(m.x+65,m.y+5,{steps:4});await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),1);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.alive),2);
  await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.hold(true);q.reset();for(let id=0;id<27;id++){q.spawn(700,180,id);g.slice({x:600,y:180},{x:800,y:180});}q.step(.01);});
  const types=await page.evaluate(()=>({count:window.__MAN__.snapshot.people.length,types:new Set(window.__MAN__.snapshot.people.map(p=>p.variantId)).size}));
  assert.deepEqual(types,{count:54,types:27});
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;g.focus=null;g.meteors=[];g.people=g.people.slice(0,2);
    for(const [i,p]of g.people.entries()){p.workAnchor={facility:'radar',type:'dish',x:-55+i*90,y:10};p.x=p.workX;p.y=808-p.size*.25;p.landed=true;p.state='toWork';}q.step(.02);
  });assert(await page.evaluate(()=>window.__MAN__.snapshot.people.every(p=>p.state==='jump')));
  await page.evaluate(()=>window.__MAN_QA__.step(1.5));assert(await page.evaluate(()=>window.__MAN__.snapshot.people.every(p=>p.state==='work'&&p.onRadar)));
  await page.click('#menu-button');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'paused');await page.click('#pause-button');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'playing');
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.people=[];q.model.totalCharge=0;q.model.charge=0;q.step(.05);q.model.addCharge(9);q.step(.001);});
  const before=await page.evaluate(()=>window.__MAN__.radar.pulseTime);
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.addCharge(1);q.step(.001);});assert(await page.evaluate(b=>window.__MAN__.radar.pulseTime>b,before));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();q.hold(true);q.spawn();q.step(0);});
    assert.ok(await page.evaluate(()=>{const m=window.__MAN__.meteors[0];return m.y+m.size*.7<0;}),'spawn starts outside the view');
    assert.equal(await page.evaluate(()=>window.__MAN__.radar.waves),true);
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();const m=q.spawn(700,300,19);q.step(.1);q.model.slice({x:m.x-100,y:m.y},{x:m.x+100,y:m.y});q.step(0);});
    assert.equal(await page.evaluate(()=>window.__MAN__.flames.length),3);
    await page.evaluate(()=>{const q=window.__MAN_QA__;for(let i=0;i<100&&!q.model.people.some(p=>p.landed);i++)q.step(.05);});
    assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='man')));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.reset();const m=q.spawn(700,760,1);m.vx=0;m.vy=1000;q.step(.02);});
    assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='meteor')));
    assert.ok(await page.evaluate(()=>Math.hypot(window.__MAN__.camera.dx,window.__MAN__.camera.dy)>1));
    await page.evaluate(()=>{
      const q=window.__MAN_QA__,g=q.model;q.reset();const m=q.spawn(700,200,19);g.slice({x:600,y:200},{x:800,y:200});g.focus=null;
      g.people=g.people.slice(0,1);const p=g.people[0];p.state='work';p.onRadar=true;p.landed=true;p.born=-10;p.workAnchor={type:'antenna',x:-12,y:-88};q.step(0);
      const head=window.__MAN__.people[0],v=g.view,n=q.spawn(head.x/v.sx,0,1);n.y=(head.y-100-n.size*.5*(v.sy-v.character))/v.sy;n.vx=0;n.vy=2000/v.sy;q.step(.08);
    });
    assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.deaths),1);
    const duration=await page.evaluate(()=>window.__MAN__.bursts.find(b=>b.type==='victim').duration);assert.ok(duration>.4);
    await page.evaluate(()=>window.__MAN_QA__.step(.45));assert.ok(await page.evaluate(()=>window.__MAN__.bursts.some(b=>b.type==='victim')));
    await page.evaluate(seconds=>window.__MAN_QA__.step(seconds+.1),duration);assert.ok(await page.evaluate(()=>window.__MAN__.bursts.every(b=>b.type!=='victim')));
  }
  await page.click('#menu-button');
  const paused=await page.evaluate(()=>window.__MAN__.snapshot.sceneTime);await page.evaluate(()=>window.__MAN_QA__.step(1));
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sceneTime),paused);
  const skyPaused=await page.evaluate(()=>window.__MAN__.sky.time);await page.evaluate(()=>window.__MAN_QA__.step(1));
  assert.equal(await page.evaluate(()=>window.__MAN__.sky.time),skyPaused);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__MAN__.reduced);await page.keyboard.press('Escape');await page.evaluate(()=>window.__MAN_QA__.step(0));
  assert.deepEqual(await page.evaluate(()=>({x:window.__MAN__.camera.dx,y:window.__MAN__.camera.dy})),{x:0,y:0});
  assert.deepEqual(await page.evaluate(()=>window.__MAN__.sky.shooting),[]);
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({functionalChecks:['3 font assets including YouYuan','27 types load and split','left/right type inheritance','centered menu on desktop and mobile','double radar hit region','real click and held-swipe input','jump-to-work states','menu pause/resume and reduced motion','10-percent progress pulse','offscreen spawn and antenna radio state','trail split and both landing burst states','finite nonzero impact shake','aerial worker collision and debris lifetime','background frame clock, sparse shooting stars and pause/reduced-motion states','finite canvas commands on desktop, portrait and landscape'],errors,artAndExperienceAcceptance:'reserved for user'},null,2));
}finally{await browser.close();}
