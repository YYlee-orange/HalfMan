import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>!document.getElementById('start-button').disabled);
  await page.click('#start-button');
  await page.evaluate(()=>{window.__MAN_QA__.hold(true);window.__MAN_QA__.spawn(600,250);window.__MAN_QA__.step(.001);});
  const canvas=await page.locator('canvas').boundingBox();
  const hud=await page.locator('.hud').boundingBox();
  const position=await page.evaluate(()=>window.__MAN__.meteors[0]),x=position.x,y=position.y;
  await page.mouse.move(x-50,y);await page.mouse.down();await page.mouse.move(x+50,y);await page.mouse.up();
  const origin=await page.evaluate(()=>window.__MAN_QA__.model.focus.time);
  const sample=async target=>{
    await page.evaluate(({target,origin})=>{const q=window.__MAN_QA__;q.step(Math.max(0,target-(q.model.realTime-origin)));},{target,origin});
    return page.evaluate(()=>({z:window.__MAN__.camera.z,scale:window.__MAN__.snapshot.timeScale}));
  };
  const first=await sample(.002);await page.screenshot({path:'qa-output/cut-002ms.png'});
  const peak=await sample(.075);await page.screenshot({path:'qa-output/cut-075ms.png'});
  const settled=await sample(.33);
  assert(first.z>1&&first.z<1.01);assert(Math.abs(peak.z-1.06)<1e-6);assert.equal(peak.scale,.35);assert.equal(settled.z,1);assert.equal(settled.scale,1);
  assert.deepEqual(await page.locator('.hud').boundingBox(),hud,'world camera leaves UI fixed');
  // A single fast pointer segment must still paint a solid blade belly.
  await page.mouse.move(canvas.x+canvas.width*.4,canvas.y+canvas.height*.55);await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width*.7,canvas.y+canvas.height*.55);await page.mouse.up();
  await page.evaluate(()=>window.__MAN_QA__.step(.001));
  const trail=await page.evaluate(()=>{
    const c=document.querySelector('canvas'),ctx=c.getContext('2d'),d=c.width/c.getBoundingClientRect().width;
    const row=ctx.getImageData(0,Math.round(c.height*.55),c.width,1).data;
    const xs=[];for(let x=0;x<c.width;x++){const i=x*4;if(row[i]===41&&row[i+1]===45&&row[i+2]===43)xs.push(x/d);}
    return{count:xs.length/d,width:xs.length?(Math.max(...xs)-Math.min(...xs)):0};
  });
  assert(trail.count>40);assert(trail.width<=canvas.width*.25+2);
  await page.screenshot({path:'qa-output/blade-one-segment.png'});
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;g.meteors=[];g.people=[];g.focus=null;
    g.people.push({id:g.nextId++,part:1,x:286,y:792,size:64,birthSize:82,born:g.sceneTime-2,state:'toShelter',hunger:80,workX:1150,foodX:708,phase:0,landed:true});q.step(.001);
  });
  const blueWidth=()=>page.evaluate(()=>{
    const c=document.querySelector('canvas'),ctx=c.getContext('2d'),a=ctx.getImageData(0,0,c.width,c.height).data;let lo=c.width,hi=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4;if((a[i]===61&&a[i+1]===169&&a[i+2]===219)||(a[i]===35&&a[i+1]===107&&a[i+2]===155)){lo=Math.min(lo,x);hi=Math.max(hi,x);}
    }return hi-lo+1;
  });
  const before=await blueWidth();await page.evaluate(()=>window.__MAN_QA__.step(.07));const squeezed=await blueWidth();
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.sheltered),1);assert(squeezed<before-5);
  await page.screenshot({path:'qa-output/shelter-jelly-squeeze.png'});
  await page.evaluate(()=>window.__MAN_QA__.step(.7));const restored=await blueWidth();assert(Math.abs(restored-before)<=1);
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;g.people=[];
    for(let part=0;part<2;part++)g.people.push({id:g.nextId++,part,x:700+part*25,y:791.8,size:64,birthSize:82,born:g.sceneTime-2,state:'fall',hunger:100,workX:1150,foodX:708,phase:0,landed:false,vx:0,vy:30});q.step(.03);
  });
  const landing=await page.evaluate(()=>window.__MAN__.camera);
  assert(Math.abs(landing.dy)>0&&Math.abs(landing.dy)<=1.5);assert(Math.abs(landing.dx)<=.5);
  assert.deepEqual(await page.locator('.hud').boundingBox(),hud);
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.step(.5);q.model.people=[];q.model.meteors=[];const m=q.spawn(590,808-41-.1);m.vy=230;m.vx=65;q.step(.002);});
  const impact=await page.evaluate(()=>({camera:window.__MAN__.camera,effects:window.__MAN__.effects}));
  assert(impact.effects.some(e=>e.type==='impact'&&e.particles===56));assert(Math.hypot(impact.camera.dx,impact.camera.dy)>10);
  assert.deepEqual(await page.locator('.hud').boundingBox(),hud,'strong impact leaves HUD fixed');
  await page.evaluate(()=>window.__MAN_QA__.step(.18));await page.screenshot({path:'qa-output/impact-180ms.png'});
  const debrisPixels=await page.evaluate(()=>{
    const c=document.querySelector('canvas'),ctx=c.getContext('2d');const x=380,y=Math.floor(c.height*808/810)-180,w=400,h=140,a=ctx.getImageData(x,y,w,h).data;
    let count=0;for(let i=0;i<a.length;i+=4)if(a[i]===41&&a[i+1]===45&&a[i+2]===43)count++;return count;
  });assert(debrisPixels>150);
  await page.evaluate(()=>window.__MAN_QA__.step(.18));assert.equal(await page.evaluate(()=>window.__MAN__.camera.dy),0);
  await page.click('#menu-button');await page.click('#motion-toggle');await page.click('#pause-button');
  await page.evaluate(()=>{const q=window.__MAN_QA__;const m=q.spawn(590,808-41-.1);m.vy=230;q.step(.002);});
  assert.equal(await page.evaluate(()=>window.__MAN__.camera.dy),0);
  const result={focus:{first,peak,settled},uiFixed:true,blade:trail,shelterWidth:{before,squeezed,restored},landingShake:{dx:landing.dx,dy:landing.dy},impact:{particles:56,dx:impact.camera.dx,dy:impact.camera.dy,debrisPixels,settlesAt:.34,reducedMotionDisablesShake:true}};
  fs.writeFileSync('qa-output/motion-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
