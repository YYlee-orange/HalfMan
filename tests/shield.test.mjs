import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {SHIELD,shieldCircle,shieldContact} from '../dist/shield.js';
import {halfHeight} from '../dist/variants.js';
import {personView,meteorView,viewMetrics} from '../dist/body-geometry.js';
import {FlameTracks} from '../dist/flames.js';
import {makeBombBurst} from '../dist/bomb-fx.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const game=(level='man-2')=>{const g=new GameModel(()=>.5);g.start(level);g.drainEvents();return g;};
function active(g){assert.equal(g.clickShield(),true);g.step(.7);g.drainEvents();return g.shieldGeometry();}
function personAt(g,x,y){
  const p={id:g.nextId++,part:0,variantId:1,x:x/g.view.sx,y:0,size:64,birthSize:64,born:-10,phase:0,state:'work',hunger:100,landed:false,onRadar:false};
  p.y=(y-halfHeight(p)*(g.view.sy-g.view.character))/g.view.sy;g.people.push(p);return p;
}
function meteorAt(g,x,y,kind='man'){
  const m=g.spawnMeteor(x/g.view.sx,0,kind==='man'?1:undefined,kind),point=meteorView(m,g.view);
  m.y=(y-point.y)/g.view.sy;m.vx=0;m.vy=2400/g.view.sy;return m;
}

test('shield is a second-level ability, locks for 4 seconds then cools for 15, pause and reset are respected',()=>{
  const first=game('man-1');assert.equal(first.clickShield(),false);assert.equal(first.shieldState.enabled,false);
  const g=game();assert.equal(g.shieldState.state,'ready');assert.equal(g.clickShield(),true);const born=g.shield.activatedAt;
  assert.equal(g.clickShield(),false);g.step(3.9);assert.equal(g.shieldState.active,true);
  g.status='paused';g.step(100);assert.equal(g.shield.activatedAt,born);close(g.realTime,3.9);assert.equal(g.clickShield(),false);
  g.status='playing';g.step(.11);assert.equal(g.shieldState.state,'cooldown');assert.equal(g.shieldState.active,false);assert.equal(g.clickShield(),false);
  g.step(14.98);assert.equal(g.clickShield(),false);g.step(.02);assert.equal(g.shieldState.state,'ready');assert.equal(g.clickShield(),true);
  g.start('man-2');assert.equal(g.shieldState.state,'ready');assert.equal(g.shield.activatedAt,null);g.reset();assert.equal(g.shield.enabled,false);
});
test('third level retains activation and spherical interception of the radar shield',()=>{
  const g=game('man-3'),circle=active(g),m=meteorAt(g,circle.x,circle.y-circle.radius-200);g.step(.3);assert.equal(g.shield.enabled,true);assert.equal(g.drainEvents().find(e=>e.type==='impact'&&e.id===m.id)?.surface,'shield');
});

test('normal and uncut bomb meteors hit the spherical surface before the floor on every aspect ratio and radar growth stage',()=>{
  for(const [width,height]of [[1440,810],[390,844],[844,220]])for(const elapsed of [0,90,150])for(const kind of ['man','bomb']){
    const g=game();g.setViewport(width,height);g.realTime=g.sceneTime=elapsed+1;g.remaining=180-g.realTime;
    const circle=active(g),m=meteorAt(g,circle.x,circle.y-circle.radius-200,kind);g.step(.3);
    const impact=g.drainEvents().find(e=>e.type==='impact'&&e.id===m.id);assert.ok(impact,`${width} ${height} ${elapsed} ${kind}`);
    assert.equal(impact.surface,'shield');assert.ok(impact.y<CONFIG.ground);
    close(Math.hypot(impact.x*g.view.sx-circle.x,impact.y*g.view.sy-circle.y),circle.radius);
    assert.equal(g.meteors.length,0);assert.equal(g.cuts,0);assert.equal(g.bombPenalty,0);assert.equal(g.bomblets.length,0);
  }
});

test('paths outside the shield retain ordinary floor impacts and first-level falling hazards',()=>{
  for(const level of ['man-1','man-2']){
    const g=game(level);if(level==='man-2')active(g);
    const m=g.spawnMeteor(120,CONFIG.ground-50,1,'man');m.vx=0;m.vy=300;g.step(.2);
    assert.equal(g.drainEvents().find(e=>e.type==='impact'&&e.id===m.id).surface,'ground');
  }
});

test('shield protects only people inside its circle against direct strikes and splash damage, and stops protecting after expiry',()=>{
  const g=game(),circle=active(g),inside=personAt(g,circle.x,circle.y-circle.radius+12),outside=personAt(g,circle.x,circle.y-circle.radius-30);
  assert.equal(g.isShieldProtected(inside),true);assert.equal(g.isShieldProtected(outside),false);
  g.blastPeople(circle.x,circle.y-circle.radius,80);assert.notEqual(inside.state,'dead');assert.equal(outside.state,'dead');
  const m=meteorAt(g,circle.x,circle.y-circle.radius-20);m.y+=130/g.view.sy;g.sweepMeteor(m,{...m,y:m.y-180/g.view.sy});assert.notEqual(inside.state,'dead');
  g.meteors=[];g.step(3.31);assert.equal(g.shieldState.active,false);
  const q=personView(inside,g.view,CONFIG.ground,g.sceneTime,g.radarPose());g.blastPeople(q.x,q.y,40);assert.equal(inside.state,'dead');
});

test('blue bomblets are intercepted once, explode at contact, and terminate their trails',()=>{
  const g=game(),circle=active(g),fx=new FlameTracks();
  const c={id:g.nextId++,part:0,sourceSize:90,size:24,width:24,height:24,x:circle.x/g.view.sx,y:(circle.y-circle.radius-100)/g.view.sy,vx:0,vy:2000/g.view.sy,angle:0,spin:0,born:g.sceneTime};
  g.bomblets=[c];fx.sync(g);g.step(.15);const events=g.drainEvents(),impact=events.find(e=>e.type==='bombletImpact');
  assert.ok(impact);assert.equal(impact.surface,'shield');assert.equal(events.filter(e=>e.type==='bombletImpact').length,1);
  close(Math.hypot(impact.x*g.view.sx-circle.x,impact.y*g.view.sy-circle.y),circle.radius);
  for(const e of events)fx.event(e,g);fx.sync(g);assert.equal(g.bomblets.length,0);assert.equal(fx.trails.get(c.id).reason,'landing');
  const burst=makeBombBurst(impact);assert.equal(burst.type,'bombGround');close(burst.y,impact.y);assert.equal(g.bombPenalty,0);
});

test('nearby floor explosions cannot bypass protection of people at the bottom of the sphere',()=>{
  const g=game(),circle=active(g),inside=personAt(g,circle.x,circle.y+circle.radius-2),outside=personAt(g,circle.x,circle.y+circle.radius+12);
  g.blastBomblet({id:g.nextId++,x:circle.x/g.view.sx,y:CONFIG.ground});assert.notEqual(inside.state,'dead');assert.equal(outside.state,'dead');
});

test('shield geometry grows with the radar and swept collision cannot tunnel through it',()=>{
  const v=viewMetrics(1440,810),small=shieldCircle(v,CONFIG.ground,1.5),large=shieldCircle(v,CONFIG.ground,2.25);
  close(large.radius/small.radius,1.5);assert.ok(large.x<small.x&&large.y<small.y);
  const hit=shieldContact({x:small.x,y:small.y-2000,rx:40,ry:40},{x:small.x,y:small.y+2000,rx:40,ry:40},small);
  assert.ok(hit&&hit.t>0&&hit.t<1);close(hit.y,small.y-small.radius);
  assert.equal(SHIELD.duration,4);assert.equal(SHIELD.cooldown,15);
});
