import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
fs.mkdirSync('qa-output',{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const errors=[],reports=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};watch(page);
const ready=async p=>{await p.goto('http://127.0.0.1:5173/?qa');await p.waitForFunction(()=>!document.getElementById('start-button').disabled);};
const radar=async p=>p.evaluate(()=>{const v=window.__MAN__.viewport;return{x:1250/1440*v.width-10*v.artScale,y:808/810*v.height-165*v.artScale};});
const meteor=async p=>p.evaluate(()=>window.__MAN__.meteors[0]);
try{
  await ready(page);assert.equal(await page.locator('header,footer,#radar-button').count(),0);
  await page.click('#menu-button');assert.equal(await page.locator('#game-menu').evaluate(e=>e.open),true);
  assert.equal(await page.locator('#pause-button').isDisabled(),true);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ready');
  await page.screenshot({path:'qa-output/desktop-intro.png'});await page.click('#start-button');
  const r=await radar(page);
  for(let i=0;i<9;i++)await page.mouse.click(r.x,r.y);
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.clicks),9);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),1);
  let m=await meteor(page);assert(m.size>=80);
  await page.mouse.move(m.x-60,m.y);await page.mouse.down();await page.mouse.move(m.x+60,m.y+9,{steps:5});await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),1);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.alive),2);
  await page.waitForTimeout(400);await page.evaluate(()=>window.__MAN_QA__.step(4));
  assert(await page.evaluate(()=>window.__MAN__.snapshot.people.every(p=>p.landed&&p.size===64)));
  await page.screenshot({path:'qa-output/desktop-play.png'});
  await page.click('#menu-button');const time=await page.evaluate(()=>window.__MAN__.snapshot.realTime);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.realTime),time);
  await page.screenshot({path:'qa-output/menu-playing.png'});await page.click('#pause-button');
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'playing');
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;q.hold(true);g.people=[];g.meteors=[];g.focus=null;
    for(let i=0;i<9;i++)g.people.push({id:g.nextId++,part:i%2,x:340+i*9,y:792,size:64,birthSize:82,born:g.sceneTime-2,state:i<6?'toFood':'work',hunger:70,workX:1150+i*10,foodX:708,phase:i,landed:true});q.step(.01);
  });
  await page.click('#recall-button');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.queued),2);
  await page.evaluate(()=>window.__MAN_QA__.step(2.4));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sheltered),6);
  await page.click('#release-button');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sheltered),0);
  // Pixel comparison proves black glyphs paint over red and green building faces.
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.people=[];q.step(.001);const c=document.querySelector('canvas');window.__qaBefore=c.getContext('2d').getImageData(0,0,c.width,c.height).data;});
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;
    for(const [x,state] of [[1255,'work'],[708,'eat']])g.people.push({id:g.nextId++,part:1,x,y:792,size:64,birthSize:82,born:g.sceneTime-2,state,hunger:70,workX:x,foodX:x,phase:0,landed:true});q.step(.001);
  });
  const layers=await page.evaluate(()=>{
    const c=document.querySelector('canvas'),b=window.__qaBefore,a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let red=0,green=0;
    for(let i=0;i<a.length;i+=4)if(a[i]===41&&a[i+1]===45&&a[i+2]===43){if(b[i]===218&&b[i+1]===62&&b[i+2]===62)red++;if(b[i]===67&&b[i+1]===173&&b[i+2]===100)green++;}return{red,green};
  });assert(layers.red>5&&layers.green>5);await page.screenshot({path:'qa-output/people-over-buildings.png'});
  reports.push({directRadarAndRealSwipe:true,menuInStartAndPlay:true,capacityAndRelease:true,peoplePaintOverBuildings:layers});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'paused');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.click('#pause-button');await page.evaluate(()=>window.__MAN_QA__.step(180));assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'ended');
  await page.click('#restart-button');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.cuts),0);
  await page.click('#menu-button');await page.click('#theme-toggle');await page.click('#motion-toggle');await page.click('#pause-button');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert(await page.evaluate(()=>window.__MAN__.reduced));
  await page.waitForTimeout(200);await page.screenshot({path:'qa-output/desktop-dark.png'});
  reports.push('visibility pause, settlement, restart, dark and reduced-motion controls');
  for(const [w,h] of [[1366,768],[1200,630],[844,390],[390,844]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(100);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
    const ground=await page.evaluate(()=>808/810*window.__MAN__.viewport.height);assert(h-ground<=3);
  }
  reports.push('four viewport sizes: full-screen fit and ground within 3 px of bottom');
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);
  await ready(mobile);await mobile.screenshot({path:'qa-output/mobile-intro.png'});await mobile.tap('#menu-button');await mobile.tap('#menu-close');await mobile.tap('#start-button');
  const rp=await radar(mobile);for(let i=0;i<9;i++)await mobile.touchscreen.tap(rp.x,rp.y);
  assert.equal(await mobile.evaluate(()=>window.__MAN__.snapshot.clicks),9);m=await meteor(mobile);assert(m.size>55);
  const cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:Math.max(2,m.x-40),y:m.y}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.min(388,m.x-40+i*14),y:m.y+5}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await mobile.evaluate(()=>window.__MAN__.snapshot.cuts),1);
  await mobile.evaluate(()=>window.__MAN_QA__.step(4));await mobile.screenshot({path:'qa-output/mobile-play.png'});
  await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(150);await mobile.screenshot({path:'qa-output/mobile-landscape.png'});
  reports.push('mobile: tap building, actual touch swipe, larger glyphs, menu and landscape');
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync('qa-output/browser-report.json',JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors},null,2));
  await mobile.close();
}finally{await browser.close();}
