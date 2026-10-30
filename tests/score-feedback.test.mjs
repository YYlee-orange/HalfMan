import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel} from '../dist/engine.js';
import {scoreChange} from '../dist/score-rules.js';
import {ScoreFeedback,SCORE_DEFAULTS,scorePanelLayout} from '../dist/score-feedback.js';
import {sanitizeCutSettings} from '../dist/cut-settings.js';
const change=(before,after,key='cut',extra={})=>scoreChange(before,after,{key,label:key==='cut'?'切开「曼」':key,count:1,tone:after>=before?'gain':'loss',...extra});
const cut=g=>{g.spawnMeteor(700,150,1,'man');g.slice({x:600,y:150},{x:800,y:150});};

test('score records carry actual before/after values and source components without landing duplicates',()=>{
  const g=new GameModel(()=>.5);g.start();cut(g);
  const e=g.drainEvents().filter(e=>e.type==='scoreChange');assert.equal(e.length,1);
  assert.deepEqual([e[0].before,e[0].after,e[0].delta],[0,110,110]);assert.equal(e[0].source.key,'cut');
  assert.deepEqual(e[0].source.components.map(p=>p.value),[100,10]);
  const person=g.people[0];g.killPerson(person);g.killPerson(person);
  const deaths=g.drainEvents().filter(e=>e.type==='scoreChange');assert.equal(deaths.length,1);assert.equal(deaths[0].delta,-5);
  g.people[1].x=700;g.people[1].y=700;g.people[1].vy=100;g.step(.5);
  assert.equal(g.drainEvents().filter(e=>e.type==='scoreChange').length,0);
});
test('future rule values flow through the same event and arbitrary new sources need no feedback changes',()=>{
  const g=new GameModel(()=>.5,{cutPoints:243,survivorPoints:7});g.start();cut(g);
  const e=g.drainEvents().find(e=>e.type==='scoreChange');assert.equal(e.delta,257);
  const f=new ScoreFeedback();f.receive(e);f.step(.25);assert.equal(f.snapshot().target,257);
  const before=g.score;g.cuts++;g.recordScore(before,{key:'future',label:'新的奖励来源',count:1,tone:'gain'});
  f.receive(g.drainEvents().find(e=>e.type==='scoreChange'));f.step(.25);
  assert.equal(f.snapshot().target,500);assert.ok(f.snapshot().groups[0].label.includes('新的奖励来源'));
});
test('bomb deductions and death at zero report the actual floor rather than fictitious losses',()=>{
  const g=new GameModel(()=>.5);g.start();cut(g);g.drainEvents();
  g.explodeBomb(g.spawnMeteor(800,300,undefined,'bomb'));
  const e=g.drainEvents().find(e=>e.type==='scoreChange');assert.deepEqual([e.before,e.after,e.delta],[110,0,-110]);assert.equal(e.source.emphasis,'heavy');
  g.killPerson(g.people[0]);const loss=g.drainEvents().find(e=>e.type==='scoreChange');assert.equal(loss.delta,0);assert.equal(loss.clipped,true);assert.deepEqual(loss.source.components,[]);
  const f=new ScoreFeedback();f.receive(loss);f.step(.1);const s=f.snapshot();assert.equal(s.target,0);assert.equal(s.groups[0].amount,'0 分');assert.ok(s.groups[0].detail.includes('当前 0 分'));
});
test('a burst of gains merges sources, both signs remain visible and the latest exact target settles promptly',()=>{
  const f=new ScoreFeedback();
  f.receive(change(0,110));f.step(.04);f.receive(change(110,220));f.step(.04);f.receive(change(220,330));
  f.receive(change(330,315,'损失',{tone:'loss'}));
  const s=f.snapshot();assert.equal(s.groups.length,2);assert.equal(s.groups.find(r=>r.direction===1).amount,'+330');assert.ok(s.groups.find(r=>r.direction===1).label.includes('×3'));
  assert.equal(s.groups.find(r=>r.direction===-1).amount,'−15');f.step(.22);
  assert.equal(f.snapshot().target,315);assert.deepEqual(f.snapshot().digits.map(d=>Math.round(((d.position%10)+10)%10)),[5,1,3]);
  f.step(2);assert.equal(f.snapshot().groups.length,0);
});
test('retargeting preserves fractional digit positions, reverses cleanly and handles losing a leading digit',()=>{
  const f=new ScoreFeedback();f.reset(995);f.receive(change(995,1105));f.step(.06);
  const before=f.snapshot().digits;f.receive(change(1105,1185));const after=f.snapshot().digits;
  for(let i=0;i<before.length;i++)assert.ok(Math.abs(before[i].position-after[i].position)<1e-8);
  f.step(.03);const rolling=f.snapshot().digits;f.receive(change(1185,95,'扣分',{tone:'loss'}));
  for(let i=0;i<rolling.length;i++)assert.ok(Math.abs(rolling[i].position-f.snapshot().digits[i].position)<1e-8);
  f.step(.22);assert.equal(f.snapshot().digits.length,2);assert.deepEqual(f.snapshot().digits.map(d=>Math.round(((d.position%10)+10)%10)),[5,9]);
});
test('heavy feedback can interrupt a gain, amplification stays bounded, reduced motion preserves all information',()=>{
  const f=new ScoreFeedback();f.receive(change(0,110));f.step(.04);f.receive(change(110,0,'炸弹',{tone:'loss',emphasis:'heavy'}));f.step(.11);
  assert.equal(f.snapshot().tone,'heavy');assert.ok(f.snapshot().scale>1.4);
  for(let i=0;i<100;i++)f.receive(change(0,110));
  const s=f.snapshot();assert.ok(s.scale<=SCORE_DEFAULTS.scoreHeavyScale);assert.ok(Math.abs(s.rotation)<=4.01);assert.ok(s.groups.length<=2);
  const reduced=f.snapshot(true);assert.equal(reduced.scale,1);assert.equal(reduced.rotation,0);assert.equal(reduced.y,0);assert.ok(reduced.groups.every(r=>r.rotation===0&&r.scale===1));
  f.settle(1234);assert.equal(f.snapshot().target,1234);assert.equal(f.snapshot().groups.length,0);assert.equal(f.snapshot().scale,1);
  f.reset();assert.equal(f.snapshot().target,0);assert.equal(f.snapshot().groups.length,0);
});
test('saved tuning gains defaults and score placement stays fixed throughout radar growth',()=>{
  const old=sanitizeCutSettings({normalBase:4});for(const key of Object.keys(SCORE_DEFAULTS))assert.equal(old[key],SCORE_DEFAULTS[key]);
  for(const [width,height]of [[1440,900],[390,844],[844,390],[320,568]]){
    const expected=scorePanelLayout(width,height);
    for(const radarTop of [114,350,700]){
      const p=scorePanelLayout(width,height,{radarTop,radarLeft:width*.65});assert.deepEqual(p,expected);
      assert.ok(p.right>=16&&p.width+p.right<=width);assert.ok(p.top>=80&&p.top<height);
    }
  }
});
