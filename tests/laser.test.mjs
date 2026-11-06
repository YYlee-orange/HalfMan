import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {CANNON,cannonGeometry} from '../dist/cannon.js';
import {LASER,LaserCannon,laserChargeTime,laserRay,laserContact} from '../dist/laser.js';
import {drawCannon} from '../dist/cannon-art.js';
import {drawLaserBeams} from '../dist/laser-art.js';
import {RoundEnding} from '../dist/round-ending.js';
import {loadWeapon} from '../dist/weapon-choice.js';
const game=level=>{const g=new GameModel(()=>.5);g.setWeapon('laser');g.start(level??'man-2');g.toggleCannon();g.aimCannon(CANNON.x*g.view.sx,100*g.view.sy);return g;};
function tick(c,seconds,crew=0){const v=new GameModel().view;for(let i=0;i<Math.round(seconds*120);i++){c.clock=(c.clock??0)+1/120;c.step(1/120,c.clock,crew,v,CONFIG.ground,()=>.5,()=>{});}}
test('loadout persists across rounds, respects level availability, and cannot change during a round',()=>{
  const g=game();assert.equal(g.cannon.weapon,'laser');assert.equal(g.setWeapon('cannon'),false);g.start('man-1');assert.equal(g.cannon.enabled,false);assert.equal(g.cannon.weapon,'laser');
  for(const id of ['man-2','man-3','man-4','man-5']){g.start(id);assert.equal(g.cannon.enabled,true);assert.equal(g.cannon.weapon,'laser');}
  g.reset();assert.equal(g.setWeapon('cannon'),true);g.start('man-2');assert.equal(g.cannon.weapon,undefined);
  assert.equal(loadWeapon({getItem:()=>{throw Error();}}),'cannon');assert.equal(loadWeapon({getItem:()=> 'laser'}),'laser');assert.equal(loadWeapon({getItem:()=> 'bad'}),'cannon');
});
test('zero crew can charge; more crew reduce charge time, releasing cancels partial charge',()=>{
  for(let n=1;n<=6;n++)assert.ok(laserChargeTime(n)<laserChargeTime(n-1));
  const c=new LaserCannon(true);c.toggle(0);c.trigger=true;tick(c,2.2);assert.equal(c.shots,0);assert.ok(c.charge>.9);c.trigger=false;tick(c,.02);assert.equal(c.charge,0);assert.equal(c.beam,null);
  c.trigger=true;tick(c,2.4);assert.equal(c.shots,1);assert.ok(c.beam);assert.equal(c.bullets.length,0);
  const full=new LaserCannon(true);full.toggle(0);full.trigger=true;tick(full,1,6);assert.equal(full.shots,1);
});
test('a charged laser penetrates multiple normal, bomb and child targets with cannon scoring and no newborns or bomb punishment',()=>{
  const g=game(),normal=g.spawnMeteor(500,450,1,'man'),second=g.spawnMeteor(500,350,1,'man'),bomb=g.spawnMeteor(500,250,undefined,'bomb');
  for(const m of [normal,second,bomb]){m.vx=0;m.vy=0;}
  g.bomblets.push({id:g.nextId++,part:0,sourceSize:90,size:24,width:24,height:24,x:500,y:150,vx:0,vy:0,angle:0,spin:0,born:0});
  const missed=g.spawnMeteor(1000,300,1,'man');g.cannon.charge=.999;g.cannon.trigger=true;g.drainEvents();g.step(.03);
  assert.equal(g.cannonBonus,200);assert.equal(g.cannonKills,4);assert.equal(g.people.length,0);assert.equal(g.cuts,0);assert.equal(g.bombPenalty,0);assert.equal(g.bomblets.length,0);assert.deepEqual(g.meteors.map(m=>m.id),[missed.id]);
  const events=g.drainEvents();assert.equal(events.filter(e=>e.type==='cannonHit').length,4);assert.equal(events.some(e=>['bombArm','bombBurst','cut'].includes(e.type)),false);assert.equal(g.cannon.contacts.length,4);
  g.aimCannon(1050*g.view.sx,180*g.view.sy);const ray=laserRay(g.cannon,g.view,CONFIG.ground);const target=g.spawnMeteor((ray.from.x+ray.to.x)/2,(ray.from.y+ray.to.y)/2,1,'man');target.vx=target.vy=0;g.step(.02);assert.ok(!g.meteors.some(m=>m.id===target.id));
  const stopped=g.spawnMeteor(target.x,target.y,1,'man');g.cannon.trigger=false;g.step(.02);assert.equal(g.cannon.beam,null);assert.equal(g.cannon.charge,0);assert.ok(g.meteors.some(m=>m.id===stopped.id));
});
test('one charged beam persists while held, accumulates heat continuously, and stops on release',()=>{
  const c=new LaserCannon(true);c.toggle(0);c.trigger=true;tick(c,1,6);const beamId=c.beam.id,initialHeat=c.heat;
  tick(c,1.5,6);assert.equal(c.beam.id,beamId);assert.equal(c.shots,1);assert.equal(c.charge,0);assert.ok(Math.abs(c.heat-initialHeat-LASER.heatPerSecond*1.5)<1e-9);
  c.trigger=false;tick(c,.02,6);assert.equal(c.beam,null);assert.equal(c.charge,0);assert.ok(c.traces.length>0);assert.ok(c.heat<initialHeat+LASER.heatPerSecond*1.5);
  c.trigger=true;tick(c,.4,6);assert.equal(c.shots,1);assert.equal(c.beam,null);assert.ok(c.charge>0);
});
test('continuous beams hit the current heat capacity; mode switching or adding crew cannot bypass cooling',()=>{
  for(const n of [0,6]){
    const c=new LaserCannon(true);c.toggle(0);c.trigger=true;while(!c.overheated&&(c.clock??0)<20)tick(c,.1,n);assert.equal(c.shots,1);assert.equal(c.overheated,true);assert.equal(c.beam,null);assert.equal(c.charge,0);
    assert.ok(Math.abs(c.clock-laserChargeTime(n)-(n===0?.5:1)/LASER.heatPerSecond)<.11);
    c.toggle(c.clock);c.toggle(c.clock);c.trigger=true;tick(c,.2,6);assert.equal(c.shots,1);assert.equal(c.overheated,true);c.trigger=false;tick(c,3,6);assert.equal(c.overheated,false);assert.equal(c.heat,0);
  }
});
test('pause freezes charge, restart and time-up clear beam state; seated crew retain immunity and hunger rules',()=>{
  const g=game(),p={id:g.nextId++,part:0,variantId:1,x:500,y:780,size:64,birthSize:64,born:-10,phase:0,vx:0,vy:0,hunger:80,state:'cannon',landed:true};g.people.push(p);
  g.cannon.trigger=true;g.step(.4);const charge=g.cannon.charge;g.status='paused';g.step(5);assert.equal(g.cannon.charge,charge);assert.equal(p.hunger,80);g.status='playing';g.blastPeople(500,780,200);assert.equal(p.state,'cannon');
  g.cannon.charge=.999;g.step(.03);assert.ok(g.cannon.beam);g.remaining=.01;g.realTime=g.roundSeconds-.01;g.step(.02);new RoundEnding().start(g);assert.equal(g.cannon.beam,null);assert.equal(g.cannon.traces.length,0);
  g.start('man-2');assert.equal(g.cannon.weapon,'laser');assert.equal(g.cannon.heat,0);assert.equal(g.cannon.charge,0);assert.equal(g.cannon.beam,null);
});
test('contact uses the object surface; projection and all effect coordinates stay finite after resize',()=>{
  assert.equal(laserContact({x:0,y:0},{x:1000,y:0},{x:500,y:0,rx:10,ry:10}).x,490);assert.equal(laserContact({x:0,y:0},{x:1000,y:0},{x:500,y:100,rx:10,ry:10}),null);
  const ctx=new Proxy({},{get:()=> (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));},set:(_,key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value),key);return true;}});
  for(const [w,h]of [[1440,900],[390,844],[844,390]])for(const reduced of [false,true]){
    const g=game();g.setViewport(w,h);g.aimCannon(w*.7,h*.2);g.cannon.trigger=true;g.cannon.charge=.999;g.step(.03);const f=g.cannonState,project=(x,y)=>({x:x*g.view.sx,y:y*g.view.sy});
    drawCannon(ctx,f,cannonGeometry(g.view,CONFIG.ground),g.realTime,reduced);drawLaserBeams(ctx,f,g.realTime,project,g.view,reduced);assert.ok(f.beam);g.cannon.trigger=false;g.step(.02);drawLaserBeams(ctx,g.cannonState,g.realTime,project,g.view,reduced);
  }
});
