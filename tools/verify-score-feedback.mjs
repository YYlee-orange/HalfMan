// Functional checks only: score data, DOM state, input, pause, persistence, and runtime errors.
// No screenshots or appearance / motion-feel acceptance.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const probe=()=>page.evaluate(()=>({actual:window.__MAN__.snapshot.score,feedback:window.__MAN__.scoreFeedback,dom:document.getElementById('score').textContent,rows:[...document.querySelectorAll('.score-source')].map(e=>e.textContent)}));
try{
  await page.goto('http://127.0.0.1:5173/?qa');await page.waitForFunction(()=>!document.getElementById('start-button').disabled);
  assert.equal(await page.locator('#score-panel').isVisible(),false);
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.hold(true);q.reset();q.spawn(700,180,1);q.step(0);});
  const m=await page.evaluate(()=>window.__MAN__.meteors[0]);await page.mouse.move(m.x-70,m.y);await page.mouse.down();await page.mouse.move(m.x+70,m.y,{steps:4});await page.mouse.up();
  let p=await probe();assert.equal(p.actual,110);assert.equal(p.dom,'110');assert.equal(p.feedback.groups[0].amount,'+110');assert.ok(p.rows[0].includes('切割 +100'));assert.ok(p.rows[0].includes('2 man +10'));
  await page.evaluate(()=>window.__MAN_QA__.step(.06));const inMotion=await page.evaluate(()=>window.__MAN__.scoreFeedback);assert.ok(inMotion.scale>1);
  await page.click('#menu-button');await page.evaluate(()=>window.__MAN_QA__.step(.5));assert.deepEqual(await page.evaluate(()=>window.__MAN__.scoreFeedback),inMotion);
  await page.click('#pause-button');await page.evaluate(()=>window.__MAN_QA__.step(.25));assert.equal((await probe()).feedback.scale,1);
  await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.reset();for(let i=0;i<6;i++){q.spawn(700,180,1);g.slice({x:600,y:180},{x:800,y:180});}q.step(0);const b=q.spawnBomb(700,300);g.explodeBomb(b);g.killPerson(g.people[0]);g.killPerson(g.people[1]);g.bomblets=[];g.meteors=[];q.step(0);});
  p=await probe();assert.equal(p.actual,150);assert.equal(p.dom,'150');assert.equal(p.feedback.groups.length,2);const negative=p.feedback.groups.find(r=>r.direction<0);assert.equal(negative.amount,'−510');assert.ok(negative.label.includes('损失 2 man'));assert.ok(negative.label.includes('慢！'));
  await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.step(.3);g.explodeBomb(q.spawnBomb(700,200));g.bomblets=[];g.meteors=[];q.step(0);});
  p=await probe();assert.equal(p.actual,0);assert.equal(p.feedback.groups.find(r=>r.direction<0).amount,'−150');
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.step(.3);q.model.killPerson(q.model.people.find(p=>p.state!=='dead'));q.step(0);});
  p=await probe();assert.equal(p.actual,0);assert.equal(p.feedback.groups.find(r=>r.direction<0).amount,'0 分');
  await page.click('#tuning-button');await page.locator('.tuner-group').filter({has:page.locator('summary',{hasText:'分数反馈'})}).locator('summary').click();
  await page.locator('#cut-param-scoreGainScale').evaluate(e=>{e.value='1.6';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#tuner-save');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('man-cut-saved-preset-v1')).values.scoreGainScale),1.6);await page.click('#tuner-close');
  await page.click('#menu-button');await page.click('#return-start-button');await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());assert.equal(await page.locator('#score-panel').isVisible(),false);assert.equal((await probe()).feedback.groups.length,0);
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.reset();const before=g.score;g.cuts=10000;g.recordScore(before,{key:'new-source',label:'新计分项',tone:'gain',count:1});q.step(.3);});
    p=await probe();assert.equal(p.dom,'1000000');assert.equal(p.feedback.target,1000000);assert.ok(p.rows.some(t=>t.includes('新计分项')));
    assert.equal(await page.locator('#score-panel').getAttribute('data-digits'),'long');
    assert.ok(await page.locator('#score-panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&getComputedStyle(e).pointerEvents==='none';}));
    await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.realTime=150;q.step(0);});
    assert.ok(await page.locator('#score-panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
  }
  await page.click('#menu-button');await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__MAN__.reduced);await page.click('#pause-button');
  await page.evaluate(()=>{const q=window.__MAN_QA__,g=q.model;q.spawn(700,150,1);g.slice({x:600,y:150},{x:800,y:150});q.step(.05);});
  p=await probe();assert.equal(p.feedback.rotation,0);assert.equal(p.feedback.scale,1);assert.ok(p.rows.some(t=>t.includes('切开「曼」')));
  await page.evaluate(()=>{const q=window.__MAN_QA__;q.model.meteors=[];q.model.bomblets=[];q.model.people=[];q.step(181);});
  p=await probe();assert.equal(await page.locator('#final-score').textContent(),p.dom);assert.equal(p.feedback.groups.length,0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:['real swipe produces accurate total and source components','pause freezes feedback clock','simultaneous gains and losses','bomb cap and zero-score loss','new source without HUD edits','tuner persistence','return/start reset','responsive bounds and radar growth','reduced motion','final score synchronization'],errors,artAndExperienceAcceptance:'reserved for user'}));
}finally{await browser.close();}
