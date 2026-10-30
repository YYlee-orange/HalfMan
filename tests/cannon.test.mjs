import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {CANNON,Cannon,cannonFireRate,cannonHeatLimit,cannonGeometry,cannonRecoil,shotIntersects} from '../dist/cannon.js';
import {makeCannonDebris} from '../dist/cannon-art.js';
import {airHitFragmentAt} from '../dist/fx-physics.js';
const game=level=>{const g=new GameModel(()=>.5);g.start(level??'man-2');g.drainEvents();return g;};
function person(g,state='toWork',x=CANNON.x){const p={id:g.nextId++,part:0,variantId:1,x,y:CONFIG.ground-16,size:64,birthSize:64,born:-10,phase:0,vx:0,vy:0,hunger:80,state,landed:true,workX:CANNON.x,foodX:CONFIG.foodX};g.people.push(p);return p;}
function crew(g,n=6){for(let i=0;i<n;i++)person(g);g.toggleCannon();g.step(.02);g.drainEvents();assert.equal(g.cannonCrew.length,n);}
test('third level retains the fully functional cannon while first level still excludes it',()=>{
  const g=game('man-3');assert.equal(g.cannon.enabled,true);crew(g,1);g.cannon.trigger=true;g.step(.02);assert.equal(g.cannon.shots,1);assert.equal(game('man-1').cannon.enabled,false);
});
test('second-level recruitment continually fills at most six seats and never drafts radar workers',()=>{
  const first=game('man-1');person(first);assert.equal(first.toggleCannon(),false);
  const g=game(),worker=person(g,'work'),pool=Array.from({length:8},()=>person(g));g.toggleCannon();g.step(.05);
  assert.equal(g.cannonCrew.length,6);assert.equal(worker.state,'work');assert.equal(worker.cannonDraft,undefined);
  g.killPerson(g.cannonCrew[0]);const newcomer=person(g,'toFood');g.step(.05);assert.equal(g.cannonCrew.length,6);assert.equal(newcomer.state,'cannon');assert.equal(g.cannonState.reserved,6);
  assert.ok(pool.some(p=>p.state==='cannon'));g.toggleCannon();assert.equal(g.people.some(p=>p.cannonDraft),false);
});
test('new falling people are reserved, finish falling, then enter; the whole mode freezes crew hunger even while idle or overheated',()=>{
  const g=game(),p=person(g,'fall');p.landed=false;p.y=CONFIG.ground-15;g.toggleCannon();g.step(.2);assert.equal(p.state,'cannon');const hunger=p.hunger;
  g.cannon.overheated=true;g.cannon.heat=1;g.step(3);assert.equal(p.state,'cannon');assert.equal(p.hunger,hunger);
  g.recall();g.step(.2);assert.equal(p.state,'cannon');g.release();g.toggleCannon();const position={x:p.x,y:p.y};g.step(.6);assert.equal(p.state,'cannon');assert.deepEqual({x:p.x,y:p.y},position);assert.ok(Math.abs(p.hunger-(hunger-CONFIG.hungerDrain*.6))<1e-7);assert.equal(p.cannonDraft,undefined);
});
test('normal mode drains only seated hunger until each occupant needs food; eating does not automatically return them',()=>{
  const g=game();crew(g,2);const [hungry,seated]=g.cannonCrew;hungry.hunger=.1;const hunger=seated.hunger;g.toggleCannon();assert.equal(hungry.state,'cannon');assert.equal(seated.state,'cannon');g.step(.05);assert.equal(hungry.state,'toFood');assert.equal(hungry.hunger,0);assert.equal(seated.state,'cannon');assert.ok(Math.abs(seated.hunger-(hunger-CONFIG.hungerDrain*.05))<1e-7);
  g.step(10);assert.notEqual(hungry.state,'cannon');assert.equal(hungry.cannonDraft,undefined);assert.equal(seated.state,'cannon');
});
test('re-entering aim freezes retained crew and counts their seats before drafting newcomers',()=>{
  const g=game();crew(g,5);g.toggleCannon();g.step(1);const retained=[...g.cannonCrew],hunger=retained.map(p=>p.hunger);for(let i=0;i<4;i++)person(g);g.toggleCannon();g.step(.1);assert.equal(g.cannonCrew.length,6);assert.equal(g.cannonState.reserved,6);assert.deepEqual(retained.map(p=>p.hunger),hunger);
  g.recall();g.step(.1);assert.ok(retained.every(p=>p.state==='cannon'));assert.deepEqual(retained.map(p=>p.hunger),hunger);
});
test('all staffing rates converge toward a smaller range with evenly spaced increments',()=>{
  const rates=Array.from({length:7},(_,n)=>cannonFireRate(n));assert.deepEqual(rates,[1.5,2.05,2.6,3.15,3.7,4.25,4.8]);for(let i=1;i<rates.length;i++)assert.ok(Math.abs(rates[i]-rates[i-1]-.55)<1e-9);
});
test('empty gun has half the heat capacity, the same heat per shot and unchanged cooling rates',()=>{
  assert.equal(cannonHeatLimit(0),.5);for(let n=1;n<=6;n++)assert.equal(cannonHeatLimit(n),1);
  for(const [n,capacity,shots]of [[0,.5,5],[1,1,9]]){
    const c=new Cannon(true);c.toggle(0);c.trigger=true;let t=0;while(!c.overheated&&t<10){t+=1/120;c.step(1/120,t,n,game().view,CONFIG.ground,()=>.5,()=>{});}
    assert.equal(c.shots,shots);assert.equal(c.heat,capacity);assert.equal(c.snapshot(t,n).heatProgress,1);assert.equal(c.snapshot(t,n).heatMax,capacity);
    c.trigger=false;c.step(.2,t+.2,n,game().view,CONFIG.ground,()=>.5,()=>{});assert.ok(Math.abs(c.heat-(capacity-CANNON.overheatCoolRate*.2))<1e-9);
    c.heat=.3;c.overheated=false;c.step(.1,t+.3,n,game().view,CONFIG.ground,()=>.5,()=>{});assert.ok(Math.abs(c.heat-(.3-CANNON.coolRate*.1))<1e-9);
  }
});
test('staffing changes use the current capacity without resetting accumulated heat or bypassing a lock',()=>{
  const c=new Cannon(true),v=game().view;c.toggle(0);c.heat=.36;c.step(.01,0,0,v,CONFIG.ground,()=>.5,()=>{});const before=c.heat;
  c.step(.01,.01,1,v,CONFIG.ground,()=>.5,()=>{});assert.ok(Math.abs(c.heat-(before-CANNON.coolRate*.01))<1e-9);assert.equal(c.snapshot(.01,1).heatMax,1);
  c.heat=.7;c.trigger=true;c.step(.01,.02,0,v,CONFIG.ground,()=>.5,()=>{});assert.equal(c.overheated,true);assert.equal(c.shots,0);assert.ok(c.heat<.5);c.step(.01,.03,6,v,CONFIG.ground,()=>.5,()=>{});assert.equal(c.overheated,true);assert.equal(c.shots,0);
});
test('more occupants fire faster; spread varies, held fire overheats, cooling locks the gun then recovers',()=>{
  function shots(n){const c=new Cannon(true);c.toggle(0);c.trigger=true;const emitted=[];for(let t=0;t<1;t+=1/120)c.step(1/120,t,n,game().view,CONFIG.ground,()=>.5,(kind,e)=>emitted.push(e));return emitted.length;}
  assert.ok(shots(6)>shots(1));assert.ok(shots(0)>0&&shots(0)<shots(1));
  const g=game();crew(g);g.cannon.trigger=true;g.step(2);assert.equal(g.cannon.overheated,true);const count=g.cannon.shots;g.step(.5);assert.equal(g.cannon.shots,count);
  g.cannon.trigger=false;g.step(2);assert.equal(g.cannon.overheated,false);assert.equal(g.cannon.heat,0);
  const c=new Cannon(true),events=[];c.toggle(0);c.trigger=true;let flip=0;for(let i=0;i<2;i++)c.step(.6,i*.6,1,g.view,CONFIG.ground,()=>++flip%2,(k,e)=>events.push(e));assert.notEqual(events[0].bullet.vx,events[1].bullet.vx);
});
test('garrisoned crew are immune to meteor sweep and explosions while travelers remain vulnerable',()=>{
  const g=game();crew(g,1);const seated=g.cannonCrew[0],traveler=person(g,'toCannon');traveler.cannonDraft=true;
  g.blastPeople(CANNON.x,CONFIG.ground-16,120);assert.equal(seated.state,'cannon');assert.equal(traveler.state,'dead');
  const m=g.spawnMeteor(CANNON.x,CONFIG.ground-15,1,'man');g.sweepMeteor(m,{...m,y:CONFIG.ground-200});assert.equal(seated.state,'cannon');
  g.blastBomblet({id:999,x:CANNON.x,y:CONFIG.ground});assert.equal(seated.state,'cannon');g.toggleCannon();g.blastPeople(CANNON.x,CONFIG.ground-16,150);assert.equal(seated.state,'cannon');seated.hunger=.01;g.step(.02);g.blastPeople(CANNON.x,CONFIG.ground-16,150);assert.equal(seated.state,'dead');
});
test('shooting normal, bomb and bomblet targets makes cosmetic debris without people, explosions or penalties',()=>{
  for(const kind of ['man','bomb','child']){
    const g=game();crew(g,1);g.aimCannon(CANNON.x,150);const n=g.people.length;
    if(kind==='child')g.bomblets.push({id:g.nextId++,part:0,sourceSize:90,size:24,width:24,height:24,x:CANNON.x,y:350,vx:0,vy:0,angle:0,spin:0,born:g.sceneTime});
    else{const m=g.spawnMeteor(CANNON.x,350,kind==='man'?1:undefined,kind);m.vx=0;m.vy=0;}
    g.drainEvents();g.cannon.trigger=true;g.step(.5);const events=g.drainEvents(),hit=events.find(e=>e.type==='cannonHit');assert.ok(hit,kind);assert.equal(g.people.length,n);assert.equal(g.cuts,0);assert.equal(g.bombPenalty,0);assert.equal(g.cannonBonus,kind==='man'?75:kind==='bomb'?50:0);
    assert.ok(!events.some(e=>['bombArm','bombBurst','bombletImpact','cut'].includes(e.type)));assert.equal(g.meteors.length,0);assert.equal(g.bomblets.length,0);
    const debris=makeCannonDebris(hit,g.view,CONFIG.ground);assert.ok(debris.duration>0);for(const p of debris.pieces)assert.equal(airHitFragmentAt(p,debris.duration,debris.groundHeight),null);
    if(kind!=='child')assert.equal(events.find(e=>e.type==='scoreChange').source.label,kind==='man'?'炮击「曼」':'炮击「慢！」');
  }
});
test('pause, reset, viewport projection and reduced motion preserve gameplay while suppressing recoil',()=>{
  const g=game();crew(g);g.cannon.trigger=true;g.step(.2);const count=g.cannon.shots,heat=g.cannon.heat;g.status='paused';g.step(10);assert.equal(g.cannon.shots,count);assert.equal(g.cannon.heat,heat);
  assert.deepEqual(cannonRecoil(g.cannon,g.realTime,true),{x:0,y:0});g.start('man-2');assert.equal(g.cannon.aiming,false);assert.equal(g.cannon.bullets.length,0);assert.equal(g.cannonBonus,0);
  for(const [w,h]of [[1440,810],[390,844],[844,220]]){g.setViewport(w,h);g.toggleCannon();g.aimCannon(w*.8,h*.2);const pivot=cannonGeometry(g.view,CONFIG.ground).pivot;assert.ok(Number.isFinite(g.cannon.angle));assert.ok(g.cannon.aim.y*g.view.sy<pivot.y);g.toggleCannon();}
  assert.equal(shotIntersects({x:0,y:0},{x:1000,y:0},{x:500,y:0,rx:10,ry:10}),true);
});
