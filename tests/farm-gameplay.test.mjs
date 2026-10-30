import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {FARM_CROPS} from '../dist/farm.js';
import {FARM_RULES,farmContact,farmYield,farmFoot} from '../dist/farm-physics.js';
import {FarmFeedback} from '../dist/farm-feedback.js';
import {halfHeight} from '../dist/variants.js';
import {personView,meteorView} from '../dist/body-geometry.js';
import {FlameTracks} from '../dist/flames.js';
const game=(w=1440,h=900)=>{const g=new GameModel(()=>.5);g.start('man-3');g.setViewport(w,h);g.reducedMotion=true;g.drainEvents();return g;};
function falling(g,local=50){
  const f=g.farmGeometryAt(),p={id:g.nextId++,part:0,variantId:1,x:(f.x+local*f.scale*f.sx)/g.view.sx,y:0,size:64,birthSize:64,born:-10,phase:0,vx:0,vy:500,hunger:10,state:'fall',landed:false,workX:1250,foodX:708};
  p.y=(f.y+FARM_RULES.deckY*f.scale*f.sy-35)/g.view.sy-halfHeight(p);g.people.push(p);return p;
}
function ready(g,n=1){
  const people=Array.from({length:n},(_,i)=>falling(g,FARM_CROPS[i].x));g.step(.15);assert.equal(g.farmWorkers.length,n);
  for(const p of people){const c=FARM_CROPS.find(c=>c.id===p.farm.cropId);p.farm.x=c.x;p.farm.y=c.y;p.farm.ready=true;p.farm.progress=0;g.syncFarmPosition(p);}g.drainEvents();return people;
}
test('only downward airborne feet board the moving deck, on every viewport; farmers follow it and heal without leaving for shelter or cannon',()=>{
  for(const [w,h]of [[1440,900],[390,844],[844,390]]){
    const g=game(w,h),p=falling(g);g.step(.15);assert.equal(p.state,'farm');assert.equal(p.cannonDraft,undefined);assert.equal(p.landed,true);
    const before=p.hunger;g.recall();g.toggleCannon();g.step(1);assert.equal(p.state,'farm');assert.ok(p.hunger>before);assert.equal(p.evacuate,false);assert.equal(p.cannonDraft,undefined);
    g.step(6);assert.equal(p.hunger,100);assert.equal(p.state,'farm');
    g.reducedMotion=false;g.step(1);const foot=farmFoot(p,g.view,g.sceneTime),q=personView(p,g.view,CONFIG.ground,g.sceneTime,g.radarPose());assert.ok(Math.abs(q.x-foot.x)<1e-7);assert.ok(Math.abs(q.y+halfHeight(p)*g.view.character-foot.y)<1e-7);
    const f=g.farmGeometryAt(),up={x:f.x,y:f.y+20,ry:0},high={...up,y:f.y-90};assert.equal(farmContact(up,high,f,f),null);
    const walking=falling(g);walking.state='toWork';walking.landed=true;walking.y=CONFIG.ground-halfHeight(walking);g.step(.1);assert.notEqual(walking.state,'farm');
  }
});
test('jumping down from another building boards; upward jumps and paths beside the platform do not',()=>{
  const g=game(),p=falling(g),f=g.farmGeometryAt();p.y=(f.y-200)/g.view.sy-halfHeight(p);g.jumpPerson(p,p.x,CONFIG.ground,'toWork',{duration:1,height:40,anticipation:0});g.step(1);assert.equal(p.state,'farm');
  const beside=falling(g,310);g.step(.2);assert.equal(beside.state,'fall');
});
test('real cut halves settle onto the farm without replacing their glyph identity or leaving a live flame trail',()=>{
  const g=game(),f=g.farmGeometryAt(),m=g.spawnMeteor(f.x/g.view.sx,(f.y-120)/g.view.sy,1,'man');m.vx=0;m.vy=100;
  const trails=new FlameTracks();g.slice({x:m.x,y:m.y-100},{x:m.x,y:m.y+100});for(const e of g.drainEvents())trails.event(e,g);
  for(let i=0;i<120;i++){g.step(1/60);for(const e of g.drainEvents())trails.event(e,g);trails.sync(g);}
  assert.equal(g.farmWorkers.length,2);assert.deepEqual(g.farmWorkers.map(p=>p.part).sort(),[0,1]);assert.ok(g.farmWorkers.every(p=>p.cutMotion&&p.variantId===1&&Number.isFinite(p.motionAge)));assert.ok([...trails.trails.values()].every(t=>t.ended!==null));
});
test('capacity is nine, overflow lands briefly then walks off and falls to normal duties; dead slots can be refilled',()=>{
  const g=game(),people=Array.from({length:10},(_,i)=>falling(g,i*2));g.step(.15);assert.equal(g.farmWorkers.length,9);const overflow=people.find(p=>p.state==='farmExit');assert.ok(overflow);
  g.recall();g.toggleCannon();assert.equal(overflow.state,'farmExit');assert.equal(overflow.cannonDraft,undefined);g.toggleCannon();g.release();
  g.step(6);assert.ok(!['farm','farmExit'].includes(overflow.state));assert.equal(g.farmWorkers.length,9);assert.equal(overflow.noTrail,true);
  const victim=g.farmWorkers[0];victim.farm.progress=11.9;g.killPerson(victim);const replacement=falling(g);g.step(.2);assert.equal(replacement.state,'farm');assert.equal(replacement.farm.progress,0);assert.equal(g.farmWorkers.length,9);
});
test('each crop completes a full independent 12 second cycle; score and random arithmetic steps use current workforce with convex growth',()=>{
  const g=game(),[a,b,c]=ready(g,3);a.farm.progress=11;b.farm.progress=5;c.farm.progress=0;g.step(.99);assert.equal(g.farmBonus,0);g.step(.02);
  let events=g.drainEvents(),harvest=events.find(e=>e.type==='farmHarvest');assert.equal(harvest.points,19);assert.equal(g.farmBonus,19);assert.equal(g.farmHarvests,1);
  const score=events.find(e=>e.type==='scoreChange'&&e.source.key==='farm');assert.equal(score.source.label,'农场收成');assert.equal(score.delta,19);assert.equal(g.score,g.alive*5+19);
  assert.ok(b.farm.progress>6&&b.farm.progress<6.1);assert.ok(c.farm.progress>1&&c.farm.progress<1.1);
  const values=[0,.2,.4,.6,.8].map(r=>farmYield(9,()=>r));assert.deepEqual(values,[21,26,31,36,41]);
  const means=[1,3,6,9].map(n=>n*([0,.2,.4,.6,.8].reduce((s,r)=>s+farmYield(n,()=>r),0)/5));assert.deepEqual(means,[15,57,150,279]);
  const before=g.farmBonus;g.status='paused';g.step(30);assert.equal(g.farmBonus,before);g.status='playing';g.step(.1);g.start('man-3');assert.equal(g.farmBonus,0);assert.equal(g.farmWorkers.length,0);
});
test('dead farmers lose unfinished work, settled income remains, and partial cycles are never paid at round end',()=>{
  const g=game(),[a,b]=ready(g,2);a.farm.progress=11.99;b.farm.progress=11;g.step(.02);assert.equal(g.farmBonus,17);const earned=g.farmBonus;g.killPerson(b);g.step(.1);assert.equal(g.farmBonus,earned);
  a.farm.progress=11;g.realTime=179.5;g.remaining=.5;g.step(1);assert.equal(g.status,'ended');assert.equal(g.farmBonus,earned);g.step(10);assert.equal(g.farmBonus,earned);
});
test('ordinary and uncut bomb meteors hit the farm top, kill nearby farmers, stop trails, and do not detonate or deduct bomb penalties',()=>{
  for(const kind of ['man','bomb'])for(const [w,h]of [[1440,900],[390,844],[844,390]]){
    const g=game(w,h),[p]=ready(g),foot=farmFoot(p,g.view,g.sceneTime,g.reducedMotion),m=g.spawnMeteor(foot.x/g.view.sx,0,kind==='man'?1:undefined,kind),v=meteorView(m,g.view);m.y=(foot.y-v.ry-100-m.size*.5*(g.view.sy-g.view.character))/g.view.sy;m.vx=0;m.vy=2000/g.view.sy;
    const trails=new FlameTracks();trails.sync(g);g.step(.2);const events=g.drainEvents(),impact=events.find(e=>e.type==='impact'&&e.id===m.id);assert.equal(impact?.surface,'farm');assert.ok(impact.y<CONFIG.ground);assert.equal(p.state,'dead');assert.equal(g.bombPenalty,0);assert.equal(g.bomblets.length,0);assert.equal(events.some(e=>e.type==='bombBurst'),false);trails.event(impact,g);assert.equal(trails.trails.get(m.id).reason,'landing');
  }
});
test('bomblets explode on the farm, while ground impacts cannot kill distant farmers just because horizontal coordinates match',()=>{
  const g=game(),[p]=ready(g),foot=farmFoot(p,g.view,g.sceneTime,g.reducedMotion);g.bomblets.push({id:g.nextId++,part:0,sourceSize:90,size:24,width:24,height:24,x:foot.x/g.view.sx,y:(foot.y-70)/g.view.sy,vx:0,vy:1200/g.view.sy,angle:0,spin:0,born:g.sceneTime});g.step(.15);assert.equal(p.state,'dead');assert.equal(g.drainEvents().find(e=>e.type==='bombletImpact')?.surface,'farm');
  const h=game(),[safe]=ready(h),m=h.spawnMeteor(safe.x,CONFIG.ground-50,1,'man');m.vx=0;m.vy=1000;h.step(.15);assert.equal(safe.state,'farm');
});
test('swept contact handles platform motion and large bodies; farm feedback is bounded, finite and expires',()=>{
  const g=game(),f=g.farmGeometryAt(),next={...f,x:f.x+40},a={x:f.x,y:f.y-100,rx:15,ry:10},b={x:f.x,y:f.y+100,rx:15,ry:10},hit=farmContact(a,b,f,next);assert.ok(hit&&hit.t>0&&hit.t<1);assert.equal(hit.surface,'farm');
  const feedback=new FarmFeedback();for(let i=0;i<40;i++)feedback.add({id:i,harvest:i,points:21,sceneTime:0});assert.equal(feedback.snapshot(.4).length,27);assert.ok(feedback.snapshot(.4).every(p=>p.opacity>0&&p.opacity<1&&Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.deepEqual(feedback.snapshot(2),[]);
});
