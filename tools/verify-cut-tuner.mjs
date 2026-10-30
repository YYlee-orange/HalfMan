import {chooseFirstLevel} from './qa-navigation.mjs';
// Functional controls, persistence and parameter wiring only; no screenshots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CUT_FIELDS} from '../dist/cut-settings.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedCutParameters=text;}}});
  if(!sessionStorage.getItem('preset-migration-tested')){
    localStorage.setItem('man-cut-tuning-v1',JSON.stringify({version:1,values:{normalBase:4,meteorSpeed:76,meteorGravity:115}}));
    sessionStorage.setItem('preset-migration-tested','yes');
  }
});
const waitReady=()=>page.waitForFunction(()=>window.__MAN__?.fonts.length===3);
const set=async(key,value)=>page.locator(`#cut-param-${key}`).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
try{
  await page.goto('http://127.0.0.1:5173/?qa');await waitReady();await page.evaluate(()=>window.__MAN_QA__.hold(true));await page.click('#start-button');await page.evaluate(()=>window.__MAN_QA__.finishOpening());await chooseFirstLevel(page);
  assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),2);
  assert.equal(await page.evaluate(()=>window.__MAN__.tuning.meteorSpeed),76);assert.equal(await page.evaluate(()=>window.__MAN__.tuning.meteorGravity),115);
  await page.click('#tuning-button');assert.equal(await page.locator('#cut-tuner').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'playing','nonmodal tuning keeps the game active');
  assert.equal(await page.locator('#cut-tuner input[type=range]').count(),CUT_FIELDS.length);
  assert.equal(await page.locator('#tuner-load').isDisabled(),true);
  await set('meteorSpeed',80);await set('meteorGravity',120);
  await page.click('#tuner-summon');
  const fall=await page.evaluate(()=>{const q=window.__MAN_QA__,m=q.model.meteors[0],before={y:m.y,vy:m.vy};q.step(.5);return{before,y:m.y,vy:m.vy};});
  assert.equal(fall.before.vy,80);assert.ok(Math.abs(fall.y-fall.before.y-55)<1e-7);assert.ok(Math.abs(fall.vy-140)<1e-7);
  await set('normalBase',10);assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),10);
  await page.locator('#cut-param-normalBase').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),10.1,'arrow keys adjust the slider');
  await set('hitStop',120);await set('normalExtra',8);
  await page.evaluate(()=>{
    const q=window.__MAN_QA__,g=q.model;q.reset();const m=q.spawn(700,300,19);g.slice({x:600,y:300},{x:800,y:300},3,null,{speed:2000});q.step(0);
  });
  const p=await page.evaluate(()=>window.__MAN__.snapshot.people[0]);assert.equal(p.releaseAt,.12);assert.ok(p.pendingImpulse.separation>1300);
  await page.click('#tuner-save');assert.equal(await page.locator('#tuner-load').isEnabled(),true);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('man-cut-saved-preset-v1')));
  assert.equal(Object.keys(saved.values).length,CUT_FIELDS.length);assert.equal(saved.values.normalBase,10.1);
  await set('normalBase',3.4);await set('meteorSpeed',95);
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,200)));
  await page.reload();await waitReady();assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),3.4);assert.equal(await page.evaluate(()=>window.__MAN__.tuning.meteorSpeed),95);
  await page.evaluate(()=>window.__MAN_QA__.reset());await page.click('#tuning-button');await page.click('#tuner-load');
  assert.deepEqual(await page.evaluate(()=>window.__MAN__.tuning),saved.values);
  assert.equal(await page.locator('#cut-param-normalBase').inputValue(),'10.1');assert.equal(await page.locator('#cut-param-meteorSpeed').inputValue(),'80');
  await page.click('#tuner-copy');await page.waitForFunction(()=>window.__copiedCutParameters);
  const copied=await page.evaluate(()=>JSON.parse(window.__copiedCutParameters));assert.equal(copied.values.normalBase,10.1);assert.equal(Object.keys(copied.values).length,CUT_FIELDS.length);
  assert.equal(copied.values.meteorSpeed,80);assert.equal(copied.values.meteorGravity,120);
  await page.click('#tuner-baseline');assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),1.2);
  await page.click('#tuner-strong');assert.equal(await page.evaluate(()=>window.__MAN__.tuning.normalBase),2);assert.equal(await page.evaluate(()=>window.__MAN__.tuning.meteorSpeed),30);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('man-cut-saved-preset-v1')).values),saved.values);
  await page.click('#tuner-summon');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.status),'playing');assert.equal(await page.evaluate(()=>window.__MAN__.snapshot.meteors.length),1);
  await page.click('#tuner-collapse');assert.equal(await page.locator('#tuner-body').isVisible(),false);
  const heading=await page.locator('#tuner-drag').boundingBox();await page.mouse.move(heading.x+70,heading.y+20);await page.mouse.down();await page.mouse.move(heading.x-180,heading.y+45,{steps:4});await page.mouse.up();
  const moved=await page.locator('#cut-tuner').boundingBox();assert.ok(moved.x<heading.x-100,'panel can be dragged');
  await page.click('#tuner-collapse');assert.equal(await page.locator('#tuner-body').isVisible(),true);
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const r=await page.locator('#cut-tuner').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width+1);assert.ok(r.y<viewport.height-30);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.click('#tuner-close');assert.equal(await page.locator('#cut-tuner').isVisible(),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({functionalOnly:true,sliders:CUT_FIELDS.length,liveParameters:'ok',meteorFallParameters:'ok',legacyMigration:'ok',explicitSaveAndRestore:'ok',persistence:'ok',copyAndPresets:'ok',dragAndCollapse:'ok',mobileControls:'ok',errors},null,2));
}finally{await browser.close();}
