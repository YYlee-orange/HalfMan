import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,GameModel} from '../dist/engine.js';
import {foodDamageStage} from '../dist/food-health.js';
import {NUCLEAR_RULES} from '../dist/nuclear.js';
import {RoundEnding} from '../dist/round-ending.js';
import {foodBreakDelay} from '../dist/food-art.js';

function game(level='man-6'){
  const model=new GameModel(()=>.5);
  model.start(level);model.drainEvents();
  return model;
}

function drop(model,kind='man',x=CONFIG.foodX){
  const m=model.spawnMeteor(x,CONFIG.ground-165,1,kind,{source:'sky'});
  m.vx=0;m.vy=3700;
  model.step(.08);
}

function addDiners(model,count){
  for(let i=0;i<count;i++)model.people.push({
    id:model.nextId++,state:'eat',size:64,birthSize:64,part:1,variantId:1,
    hunger:0,x:CONFIG.foodX,y:CONFIG.ground-16,phase:0,born:-1,landed:true,
  });
}

test('only direct meteor and child impacts damage the sixth-level bowl',()=>{
  const g=game();g.setViewport(390,844);
  drop(g,'man',CONFIG.foodX-330);
  assert.equal(g.foodHealth,100);
  drop(g);assert.equal(g.foodHealth,90);
  drop(g,'bomb');assert.equal(g.foodHealth,80);
  g.bomblets.push({id:g.nextId++,x:CONFIG.foodX,y:CONFIG.ground-150,vx:0,vy:3000,width:25,height:32,angle:0,spin:0,born:g.sceneTime});
  g.step(.08);assert.equal(g.foodHealth,75);
  const events=g.drainEvents();
  assert.deepEqual(events.filter(e=>e.type==='foodHit').map(e=>e.kind),['man','bomb','child']);
  assert.ok(events.some(e=>e.type==='impact'&&e.surface==='ground'));
  assert.deepEqual([100,75,50,25].map(foodDamageStage),[0,1,2,3]);
  const earlier=game('man-5');
  drop(earlier);assert.equal(earlier.foodHealth,null);
  assert.ok(!earlier.drainEvents().some(e=>e.type==='foodHit'));
});

test('only real eating time repairs the bowl, slowly and with a capped five-point pulse',()=>{
  const solo=game();drop(solo);solo.drainEvents();
  addDiners(solo,1);solo.step(2);
  assert.ok(Math.abs(solo.foodHealth-91)<1e-8);
  assert.ok(!solo.drainEvents().some(e=>e.type==='foodRepair'));
  solo.step(1);
  assert.ok(Math.abs(solo.foodHealth-(90+50/42))<1e-8);

  const crew=game();drop(crew);crew.drainEvents();
  addDiners(crew,8);crew.step(2);
  assert.ok(Math.abs(crew.foodHealth-93)<1e-8);
  addDiners(crew,4);crew.step(1.4);
  assert.ok(Math.abs(crew.foodHealth-95.1)<1e-8);
  assert.equal(crew.drainEvents().filter(e=>e.type==='foodRepair').length,1);
  addDiners(crew,6);crew.step(4);
  addDiners(crew,6);crew.step(2);
  assert.equal(crew.foodHealth,100);
  assert.equal(crew.drainEvents().filter(e=>e.type==='foodRepair').length,1);
});

test('sixth-level nuclear damage and lethal impacts lead to one delayed defeat',()=>{
  const g=game();
  assert.ok(g.requestNuclear(true));
  g.realTime=g.sceneTime=NUCLEAR_RULES.warning+NUCLEAR_RULES.launchGap+3;
  g.stepNuclear();assert.equal(g.foodHealth,60);
  for(let i=0;i<6;i++)drop(g);
  assert.equal(g.foodHealth,0);
  assert.equal(g.status,'ended');
  const events=g.drainEvents();
  assert.equal(events.filter(e=>e.type==='foodDestroyed').length,1);
  assert.deepEqual(events.filter(e=>e.type==='end').map(e=>e.foodDestroyed),[true]);
  const ending=new RoundEnding(),delay=foodBreakDelay(false);
  ending.start(g,false,delay);assert.ok(ending.delay>=delay);
  assert.equal(ending.step(delay-.01),false);
  assert.equal(ending.step(ending.delay),true);
  g.step(3);assert.equal(g.foodHealth,0);
  g.start('man-6');assert.equal(g.foodHealth,100);
});
