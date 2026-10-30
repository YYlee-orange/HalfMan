import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {progressionAt,PROGRESSION} from '../dist/progression.js';
import {RADAR_SCALE,radarWorldPoint,radarScreenPoint} from '../dist/radar.js';
import {personView} from '../dist/body-geometry.js';
import {halfHeight} from '../dist/variants.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function game(time=0){const g=new GameModel(()=>.5);g.start();g.realTime=time;g.sceneTime=time;g.remaining=CONFIG.roundSeconds-time;g.drainEvents();return g;}

test('30-second steps add .2 to output and .05 to size/capacity with a 1.5 growth cap',()=>{
  assert.equal(progressionAt(29.999999).stage,0);
  for(const [time,multiplier,factor]of [[0,1,1],[30,1.2,1.05],[60,1.4,1.1],[90,1.6,1.15],[120,1.8,1.2],[150,2,1.25],[180,2.2,1.3],[300,3,1.5],[600,5,1.5]]){
    const p=progressionAt(time),settled=progressionAt(time+PROGRESSION.growthDuration);close(p.summonMultiplier,multiplier);close(p.radarTargetFactor,factor);close(settled.radarFactor,factor);
    assert.equal(p.guaranteed,Math.floor(multiplier));close(p.guaranteed+p.extraChance,multiplier);
  }
  assert.equal(progressionAt(150).extraChance,0);assert.equal(progressionAt(300).extraChance,0);
});

test('each full charge produces the guaranteed count and exact fractional chance, carrying excess charge',()=>{
  for(const [time,roll,count]of [[0,.01,1],[30,.19999,2],[30,.2,1],[60,.39999,2],[60,.4,1],[90,.59999,2],[90,.6,1],[120,.79999,2],[120,.8,1],[150,0,2],[150,.99,2]]){
    const g=game(time);let first=true;g.random=()=>{if(first){first=false;return roll;}return .5;};
    g.addCharge(g.chargeMax+7);assert.equal(g.meteors.length,count,`${time}/${roll}`);close(g.charge,7);assert.equal(g.summonWaves,1);
    const wave=g.drainEvents().find(e=>e.type==='summonWave');assert.equal(wave.count,count);close(wave.multiplier,progressionAt(time).summonMultiplier);
  }
  const g=game(150);g.addCharge(3*g.chargeMax+17);assert.equal(g.summonWaves,3);assert.equal(g.meteors.length,6);close(g.charge,17);
});

test('a click always fills twelve percent and a worker keeps the original absolute rate',()=>{
  for(const time of [0,30,60,90,120,150,300]){
    const g=game(time);g.clickRadar();close(g.chargePercent,12);
    for(let i=0;i<8;i++)g.clickRadar();assert.equal(g.summonWaves,1);close(g.chargePercent,8);
    g.charge=0;g.addCharge(CONFIG.workerCharge);close(g.charge,3.2);close(g.chargePercent,3.2/g.chargeMax*100);
  }
});

test('growth retains earned absolute charge and progress pulses follow the current percentage',()=>{
  const g=game(29.99);g.charge=50;g.step(.02);close(g.charge,50);assert.ok(g.chargeMax>100&&g.chargeMax<105);close(g.chargePercent,50/g.chargeMax*100);
  g.step(.9);close(g.chargeMax,105);close(g.charge,50);
  g.drainEvents();g.clickRadar();close(g.charge,62.6);
  assert.deepEqual(g.drainEvents().filter(e=>e.type==='radarProgress').map(e=>e.percent),[50]);
});

test('mounted people, walk targets and jump destinations follow a growing radar without moving ground workers',()=>{
  const g=game(29.99);g.spawnMeteor(700,200,1);g.slice({x:600,y:200},{x:800,y:200});const [a,b]=g.people;
  const anchor={facility:'radar',type:'tower',x:10,y:-100},before=radarWorldPoint(anchor,CONFIG.ground,RADAR_SCALE);
  Object.assign(a,{workAnchor:anchor,workX:before.x,x:before.x,y:before.y-halfHeight(a),state:'work',onRadar:true,landed:true,hunger:100,cutMotion:false,born:-10});
  Object.assign(b,{workAnchor:anchor,workX:before.x,x:before.x,y:CONFIG.ground-halfHeight(b),state:'toWork',onRadar:false,landed:true,cutMotion:false,born:-10});
  g.jumpPerson(b,before.x,before.y,'work',{toAnchor:anchor,duration:1});g.step(.02);
  const target=radarWorldPoint(anchor,CONFIG.ground,g.radarScale),foot=radarScreenPoint(anchor,g.view,CONFIG.ground,g.radarPose());
  close(a.workX,target.x);close(a.x,target.x);close(b.jump.toX,target.x);close(b.jump.toY,target.y);
  const q=personView(a,g.view,CONFIG.ground,g.sceneTime,g.radarPose());close(q.x,foot.x);close(q.y+halfHeight(a)*g.view.character,foot.y);
  const ground=game(29.99);ground.people=[{...a,id:1,state:'work',onRadar:false,x:1100,workX:1100}];ground.step(.02);close(ground.people[0].x,1100);
});

test('falling meteors collide with people on the enlarged radar at the rendered position',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,220]]){
    const g=game(150);g.setViewport(w,h);const anchor={facility:'radar',type:'tower',x:12,y:-100};
    const p={id:g.nextId++,part:1,variantId:1,size:64,birthSize:64,born:-10,state:'work',onRadar:true,workAnchor:anchor,workX:1100,landed:true,x:1100,y:600,hunger:100,phase:0};g.people=[p];
    const q=personView(p,g.view,CONFIG.ground,g.sceneTime,g.radarPose()),m=g.spawnMeteor(q.x/g.view.sx,0,1);
    m.y=(q.y-120-m.size*.5*(g.view.sy-g.view.character))/g.view.sy;m.vx=0;m.vy=2000/g.view.sy;g.step(.08);assert.equal(g.deaths,1);
  }
});

test('pause freezes progression and restarting clears both the growth and batch count',()=>{
  const g=game();g.step(30.45);close(g.progression.summonMultiplier,1.2);const factor=g.progression.radarFactor;g.status='paused';g.step(90);close(g.realTime,30.45);close(g.progression.radarFactor,factor);
  g.start();assert.equal(g.radarScale,RADAR_SCALE);assert.equal(g.chargeMax,100);assert.equal(g.summonWaves,0);assert.equal(g.progression.summonMultiplier,1);
});

test('scale is continuous, monotonic and smooth at each threshold, with an exact settled cap',()=>{
  for(const boundary of [30,60,150,300,330]){
    const before=progressionAt(boundary-1e-6).radarFactor,at=progressionAt(boundary).radarFactor,after=progressionAt(boundary+1e-6).radarFactor;
    close(before,at);close(at,after);let last=at;
    for(let i=0;i<=90;i++){const p=progressionAt(boundary+i*.01);assert.ok(p.radarFactor>=last-1e-10&&p.radarFactor<=1.5);last=p.radarFactor;}
    close(last,progressionAt(boundary).radarTargetFactor);
  }
  close(progressionAt(30.45).radarFactor,1.025);close(progressionAt(300.9).radarFactor,1.5);
});
test('the twelve-percent click contribution is preserved throughout growth and frame rates agree',()=>{
  for(const time of [29.99,30,30.1,30.45,30.89,30.9,150.45]){const g=game(time);g.clickRadar();close(g.chargePercent,12);}
  const outcomes=[];
  for(const fps of [30,60,120]){const g=game(29.9);for(let i=0;i<fps;i++)g.step(1/fps);outcomes.push({factor:g.progression.radarFactor,capacity:g.chargeMax});}
  for(const p of outcomes){close(p.factor,1.05);close(p.capacity,105);}
});
