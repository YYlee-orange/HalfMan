import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {VOLCANO_RULES,volcanoLaunch} from '../dist/volcano-physics.js';
import {volcanoFrame,magmaChannel} from '../dist/volcano.js';
import {VolcanoSplash} from '../dist/volcano-fx.js';
import {viewMetrics,meteorView,personView} from '../dist/body-geometry.js';
import {farmGeometry} from '../dist/farm.js';
import {FARM_BOUNDS} from '../dist/farm-rowing.js';
import {FOOD_X} from '../dist/facilities.js';
import {RADAR_X} from '../dist/radar.js';
import {FlameTracks} from '../dist/flames.js';
import {FIRE,FIRE_BLUE,plumeColors,plumePath} from '../dist/fire.js';
const game=(r=.5,level='man-4')=>{const g=new GameModel(()=>r);g.start(level);g.drainEvents();return g;};
const erupt=(g,kind='man')=>g.spawnMeteor(undefined,undefined,kind==='man'?1:undefined,kind,{source:'volcano'});
function personAt(g,x,y){const p={id:g.nextId++,part:0,variantId:1,x:x/g.view.sx,y:(y-16*(g.view.sy-g.view.character))/g.view.sy,size:64,birthSize:64,born:-10,phase:0,hunger:100,state:'work',landed:false,onRadar:false,vx:0,vy:0,workX:1250};g.people.push(p);return p;}
test('each natural fourth-level meteor independently uses the exact fifteen-percent source threshold; other levels and positioned probes stay sky based',()=>{
  assert.equal(VOLCANO_RULES.chance,.15);assert.equal(game(.149999).spawnMeteor(undefined,undefined,1,'man').source,'volcano');assert.notEqual(game(.15).spawnMeteor(undefined,undefined,1,'man').source,'volcano');
  for(const level of ['man-1','man-2','man-3'])assert.notEqual(game(0,level).spawnMeteor(undefined,undefined,1,'man').source,'volcano');
  assert.notEqual(game(0).spawnMeteor(500,100,1,'man').source,'volcano');const g=game(0);erupt(g);assert.equal(g.volcanoEruptions,1);assert.equal(g.drainEvents().filter(e=>e.type==='volcanoErupt').length,1);
});
test('the screen-space cone runs from thirty degrees left to fifteen right; the slowest edge shot clears the whole farm and the fastest goes above the screen',()=>{
  assert.equal(VOLCANO_RULES.angleMin,-30);assert.equal(VOLCANO_RULES.angleMax,15);
  for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220],[320,568]])for(const angle of [0,.5,1])for(const speed of [0,1]){
    const v=viewMetrics(width,height),draws=[angle,speed],launch=volcanoLaunch(v,0,false,-10,{size:110.7},34,()=>draws.shift()),theta=Math.atan2(launch.vx*v.sx,-launch.vy*v.sy)*180/Math.PI;
    assert.ok(Math.abs(theta-(-30+angle*45))<1e-8);const peak=launch.mouth.y-(launch.vy*v.sy)**2/(2*launch.gravity*v.sy),farm=farmGeometry(v),top=farm.y-FARM_BOUNDS.top*farm.scale*farm.sy;
    assert.ok(peak<top-60,`${width}x${height} weak shot`);if(speed===1)assert.ok(peak+80*v.character<0);assert.ok(launch.speedRange[1]>launch.speedRange[0]);
  }
  assert.equal(volcanoLaunch(viewMetrics(),0,false,-10,{size:82},0,()=>.5).gravity,VOLCANO_RULES.gravityFallback);
});
test('ascending meteors cross people, the farm and an active shield without impact; descending restores ordinary farm damage',()=>{
  const g=game();g.reducedMotion=true;const f=g.farmGeometryAt(),m=erupt(g),p=personAt(g,f.x,f.y-20),offset=m.size*.5*(g.view.sy-g.view.character);
  m.x=f.x/g.view.sx;m.y=(f.y+70-offset)/g.view.sy;m.vx=0;m.vy=-4000/g.view.sy;g.step(.05);assert.equal(p.state,'work');assert.equal(m.impacted,undefined);assert.equal(g.drainEvents().some(e=>e.type==='impact'),false);
  m.y=(f.y-100-offset)/g.view.sy;m.vy=2400/g.view.sy;m.fallStartedAt=g.sceneTime;g.step(.1);assert.equal(p.state,'dead');assert.equal(g.drainEvents().find(e=>e.type==='impact')?.surface,'farm');
  const h=game();h.clickShield();h.step(.7);const circle=h.shieldGeometry(),a=erupt(h);a.x=circle.x/h.view.sx;a.y=(circle.y+circle.radius*.5-a.size*.5*(h.view.sy-h.view.character))/h.view.sy;a.vx=0;a.vy=-800/h.view.sy;h.step(.1);assert.equal(a.impacted,undefined);assert.ok(h.meteors.includes(a));
});
test('the exact apex splits an update into harmless ascent and collidable descent, with continuous ballistic positions',()=>{
  const g=game(),m=erupt(g),before={...m},apex=-m.vy/m.gravity;g.step(apex+.02);assert.ok(Math.abs(m.fallStartedAt-apex)<1e-7);assert.ok(Math.abs(m.y-(before.y+before.vy*(apex+.02)+.5*m.gravity*(apex+.02)**2))<1e-6);assert.ok(m.vy>0);
  const states=[];for(const fps of [30,120]){const h=game(),a=erupt(h);for(let i=0;i<fps*2;i++)h.step(1/fps);states.push(a);}assert.ok(Math.abs(states[0].y-states[1].y)<1e-7);
});
test('ascending normal meteors can be cut, ascending bombs can arm, and cannon shots can destroy both without explosion penalties',()=>{
  const g=game(),m=erupt(g);g.slice({x:m.x-100,y:m.y},{x:m.x+100,y:m.y});assert.equal(g.cuts,1);assert.equal(g.people.length,2);assert.ok(g.people.every(p=>p.volcanoTrail));
  const h=game(),bomb=erupt(h,'bomb');h.slice({x:bomb.x-100,y:bomb.y},{x:bomb.x+100,y:bomb.y});assert.ok(bomb.arm);h.step(.5);assert.equal(h.bombExplosions,1);assert.equal(h.bomblets.length,6);
  for(const kind of ['man','bomb']){const q=game(),target=erupt(q,kind),point=meteorView(target,q.view);q.cannon.bullets.push({id:999,x:point.x/q.view.sx-40,y:point.y/q.view.sy,vx:5000,vy:0,age:0});q.step(.02);assert.equal(q.cannonKills,1);assert.equal(q.cannonBonus,kind==='man'?75:50);assert.equal(q.bombExplosions,0);assert.equal(q.bomblets.length,0);}
});
test('volcanic tails stay orange/yellow throughout, only ascending meteor tails shorten, while child and blue bomblet rules remain unchanged',()=>{
  const g=game(),m=erupt(g),trails=new FlameTracks();trails.sync(g);const tail=trails.trails.get(m.id);assert.deepEqual(plumeColors(tail),FIRE);assert.equal(tail.ascending,true);
  const sample={...tail,points:[{x:0,y:0},{x:0,y:-100}]},project=(x,y)=>({x,y}),up=plumePath(sample,project,10),ordinary=plumePath({...sample,volcanic:false},project,10);assert.equal(Math.abs(up.at(-1).y-up[0].y),Math.abs(ordinary.at(-1).y-ordinary[0].y)*.5);assert.deepEqual(up.at(-1),ordinary.at(-1));
  const apex=-m.vy/m.gravity;g.step(apex+.225);trails.sync(g);assert.equal(tail.ascending,false);assert.deepEqual(plumeColors(tail),FIRE);assert.deepEqual(plumePath({...sample,ascending:false},project,10),ordinary);
  assert.deepEqual(plumeColors({palette:'blue',volcanic:true}),FIRE_BLUE);assert.deepEqual(plumePath({...sample,kind:'man'},project,10),plumePath({...sample,kind:'man',volcanic:false},project,10));
  const frame=g.volcanoState;g.status='paused';g.step(1);trails.sync(g);assert.deepEqual(g.volcanoState,frame);
  g.start('man-4');assert.equal(g.volcanoEruptions,0);assert.equal(g.volcanoPulse,-10);
});
test('enlarged solid volcano reaches the farm bottom and uses a moving red channel with stronger eruption jelly and bounded splashes',()=>{
  for(const [w,h]of [[1440,900],[390,844],[844,390],[320,220]]){const v=viewMetrics(w,h),a=volcanoFrame('man-4',v,0),b=volcanoFrame('man-4',v,.08,false,0),f=farmGeometry(v,0,true);assert.ok(a.geometry.x>FOOD_X*v.sx&&a.geometry.x<RADAR_X*v.sx);assert.ok(a.mouth.y<f.y+FARM_BOUNDS.bottom*f.scale);assert.ok(b.jelly>.3);assert.ok(b.geometry.sx>a.geometry.sx&&b.geometry.sy<a.geometry.sy);assert.notEqual(b.magma,a.magma);assert.equal(volcanoFrame('man-4',v,.08,true,0).jelly,0);assert.equal(magmaChannel(.1,true),magmaChannel(9,true));}
  const fx=new VolcanoSplash();for(let i=0;i<12;i++)fx.add({id:i,x:1000,y:500,sceneTime:0});assert.equal(fx.bursts.length,9);assert.ok(fx.snapshot(.2).every(p=>Number.isFinite(p.dx)&&Number.isFinite(p.dy)&&p.r>0));assert.deepEqual(fx.snapshot(2),[]);fx.clear();assert.equal(fx.bursts.length,0);
});
