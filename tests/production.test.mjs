import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GameModel,CONFIG} from '../dist/engine.js';
import {VARIANTS,SIZE_LEVELS,GRAYS,halfFlip,halfHeight} from '../dist/variants.js';
import {chooseWorkAnchor,radarWorldPoint,RADAR_SCALE} from '../dist/radar.js';
const game=()=>{const g=new GameModel();g.start();g.drainEvents();return g;};
function recruit(g,id=1){const m=g.spawnMeteor(700,120,id);g.slice({x:600,y:120},{x:800,y:120});g.focus=null;g.drainEvents();return g.people.slice(-2);}

test('three real glyph assets and 27 unique combinations are complete',()=>{
  const {glyphs}=JSON.parse(fs.readFileSync(new URL('../dist/assets/glyphs.json',import.meta.url),'utf8'));
  assert.deepEqual(glyphs.map(g=>g.id),['yahei','simsun','youyuan']);assert.equal(new Set(glyphs.map(g=>g.path)).size,3);
  for(const g of glyphs){assert(g.path.length>100);assert.equal(g.halves[0].clip[2]+g.halves[1].clip[2],g.width);assert.equal(g.halves[1].clip[0],g.splitX);}
  assert.equal(VARIANTS.length,27);assert.equal(new Set(VARIANTS.map(v=>`${v.fontId}/${v.tone}/${v.sizeLevel}`)).size,27);
  assert.equal(SIZE_LEVELS[1],1);assert.equal(GRAYS.light.length,3);assert.equal(GRAYS.dark.length,3);
});
test('every shuffled bag contains all 27 variants, and both halves inherit their source type',()=>{
  const g=game();const ids=Array.from({length:54},()=>g.spawnMeteor(500,100,undefined,'man').variantId);
  assert.equal(new Set(ids.slice(0,27)).size,27);assert.equal(new Set(ids.slice(27)).size,27);
  for(const v of VARIANTS){
    const h=game(),people=recruit(h,v.id);
    assert.equal(people.length,2);assert(people.every(p=>p.variantId===v.id&&p.fontId===v.fontId&&p.tone===v.tone&&p.size===CONFIG.personSize*v.sizeScale));
  }
});
test('left half flips vertically while retaining horizontal order; right half remains unchanged',()=>{
  assert.equal(halfFlip(0,0),1);assert(Math.abs(halfFlip(0,.43))<1e-8);assert.equal(halfFlip(0,.7),-1);
  assert.equal(halfFlip(1,.7),1);assert.equal(halfFlip(0,0,true),-1);
});
test('a horizontal cut separates the halves vertically along its normal before landing',()=>{
  const g=game(),[left,right]=recruit(g);const initial=Math.abs(right.y-left.y);
  g.step(.4);assert(Math.abs(right.y-left.y)>initial+55);assert.equal(left.state,'fall');assert.equal(right.state,'fall');
});
test('progress emits a pulse per 10 percent, including wrap and worker-only charge',()=>{
  const g=game();g.addCharge(9);assert.equal(g.drainEvents().filter(e=>e.type==='radarProgress').length,0);
  g.addCharge(12);assert.deepEqual(g.drainEvents().filter(e=>e.type==='radarProgress').map(e=>e.percent),[10,20]);
  g.addCharge(91);assert.deepEqual(g.drainEvents().filter(e=>e.type==='radarProgress').map(e=>e.percent),[30,40,50,60,70,80,90,100,10]);
  assert.equal(g.meteors.length,1);assert.equal(g.charge,12);
  const h=game(),[p]=recruit(h);h.people=[p];p.state='work';p.onRadar=false;p.hunger=100;h.drainEvents();h.step(3.2);
  assert.equal(h.drainEvents().filter(e=>e.type==='radarProgress').length,1);
});
test('reusable jump follows an arc and reaches the requested state and exact destination',()=>{
  const g=game(),[p]=recruit(g);p.x=1100;p.y=CONFIG.ground-halfHeight(p);p.state='toWork';p.landed=true;
  g.jumpPerson(p,1200,CONFIG.ground-200,'work',{duration:1,height:100});g.step(.5);
  assert.equal(p.state,'jump');assert(p.x>1100&&p.x<1200);assert(p.y+halfHeight(p)<CONFIG.ground-100);
  g.step(.5);assert.equal(p.state,'work');assert(Math.abs(p.x-1200)<1e-7);assert(Math.abs(p.y+halfHeight(p)-(CONFIG.ground-200))<1e-7);
});
test('workers jump onto varied radar anchors, then jump down for food or recall',()=>{
  assert.equal(RADAR_SCALE,2*.75);const spots=new Set(Array.from({length:30},()=>JSON.stringify(chooseWorkAnchor())));assert(spots.size>20);
  const g=game(),[p]=recruit(g);g.people=[p];p.workAnchor={facility:'radar',type:'dish',x:-40,y:10};p.state='toWork';p.x=p.workX;p.y=CONFIG.ground-halfHeight(p);p.landed=true;
  g.step(.02);assert.equal(p.state,'jump');assert(p.jump.toAnchor);
  g.step(1.4);assert.equal(p.state,'work');assert.equal(p.onRadar,true);
  const expected=radarWorldPoint(p.workAnchor,CONFIG.ground);assert(Math.abs(p.x-expected.x)<1e-7);assert(Math.abs(p.y+halfHeight(p)-expected.y)<1e-7);
  p.hunger=.01;g.step(.02);assert.equal(p.state,'jump');assert.equal(p.jump.nextState,'toFood');
  g.step(1.5);assert.equal(p.state,'toFood');assert.equal(p.onRadar,false);
});
test('workers on radar depart at one real-second intervals through their jump-down action',()=>{
  const g=game(),people=[...recruit(g),...recruit(g)];g.people=people;
  for(const p of people){p.workAnchor={facility:'radar',type:'dish',x:-40,y:10};p.state='work';p.onRadar=true;const q=radarWorldPoint(p.workAnchor,CONFIG.ground);p.x=q.x;p.y=q.y-halfHeight(p);p.landed=true;}
  g.drainEvents();g.recall();g.step(2.01);const departures=g.drainEvents().filter(e=>e.type==='depart');
  assert.equal(departures.length,3);for(let i=0;i<departures.length;i++)assert(Math.abs(departures[i].time-i)<=1/60);
  assert.equal(g.recallQueue.length,1);
});
test('recalling an ascending person redirects to ground even when many people are sheltered',()=>{
  const g=game(),[p]=recruit(g);g.people=[p];p.workAnchor={facility:'radar',type:'dish',x:-40,y:10};p.landed=true;p.state='toWork';p.x=p.workX;p.y=CONFIG.ground-halfHeight(p);g.step(.02);
  assert.equal(p.state,'jump');g.recall();assert.equal(p.jump.nextState,'toShelter');assert.equal(p.jump.toAnchor,null);
  for(let i=0;i<6;i++)g.people.push({id:g.nextId++,state:'sheltered'});
  const x=p.x,y=p.y;g.step(.001);assert.equal(p.state,'jump');assert.equal(p.jump.nextState,'toShelter');assert(Math.abs(p.x-x)<1&&Math.abs(p.y-y)<2);
});
