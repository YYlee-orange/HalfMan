import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel} from '../dist/engine.js';
import {CUT,cutKinematics,swipeStrength,cutCameraOffset,fragmentAngle} from '../dist/cut-motion.js';
import {meteorView,personView} from '../dist/body-geometry.js';
import {cutParticles,inverseGlyphColor,CutFeedback} from '../dist/cut-feedback.js';
import {applyCutSettings,CUT_BASELINE} from '../dist/cut-settings.js';
// Preserve the original parameter contract while testing the new live settings separately.
applyCutSettings(CUT_BASELINE,{persist:false});
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const game=()=>{const g=new GameModel(()=>.5);g.start();g.drainEvents();return g;};
function cut(g,dir={x:1,y:0},speed=1200){
  const m=g.spawnMeteor(600,280,19);m.vx=42;m.vy=120;
  g.slice({x:m.x-dir.x*90,y:m.y-dir.y*90},{x:m.x+dir.x*90,y:m.y+dir.y*90},3,null,{speed});
  return{m,people:g.people.slice(-2),event:g.drainEvents().find(e=>e.type==='cut')};
}
test('initial impulses retain full meteor momentum and separate along every knife normal',()=>{
  for(const dir of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:Math.SQRT1_2,y:Math.SQRT1_2}]){
    const g=game(),{m,people,event}=cut(g,dir),k=event.kinematics;
    for(let i=0;i<2;i++){
      const impulse=people[i].pendingImpulse,dv={x:impulse.vx-m.vx,y:impulse.vy-m.vy};
      close(dv.x*dir.x+dv.y*dir.y,m.size*(.12+.18*k.strength));
      close(dv.x*k.normal.x+dv.y*k.normal.y,impulse.sign*impulse.separation);
    }
    assert.ok(people[0].pendingImpulse.sign===-people[1].pendingImpulse.sign);
    assert.ok(people[0].pendingImpulse.angularVelocity<0&&people[1].pendingImpulse.angularVelocity>0);
  }
});
test('screen-space separation remains perpendicular on portrait and landscape projections',()=>{
  const m={size:82,vx:42,vy:120,tilt:.2};
  for(const [scaleX,scaleY]of [[.27,1.04],[.58,.27]]){
    const k=cutKinematics(m,{x:0,y:0},{x:40,y:70},{speed:800,scaleX,scaleY,visualScale:.7},()=>.5);
    for(const p of k.impulses){
      const dx=(p.vx-m.vx)*scaleX,dy=(p.vy-m.vy)*scaleY;
      close(dx*k.normal.x+dy*k.normal.y,p.sign*p.separation);
      close(dx*k.dir.x+dy*k.dir.y,k.diameter*(.12+.18*k.strength));
    }
  }
});
test('40ms target hold freezes both shapes while other meteors and the world continue',()=>{
  const g=game(),{m,people}=cut(g),initial=people.map(p=>({...p}));
  const other=g.spawnMeteor(1100,100,1);g.step(.039);
  for(let i=0;i<2;i++){close(people[i].x,initial[i].x);close(people[i].y,initial[i].y);assert.equal(people[i].motionAge,0);assert.ok(people[i].pendingImpulse);}
  assert.ok(other.y>100);close(g.remaining,180-.039);
  const parent=meteorView(m,g.view);
  for(const p of people){
    const q=personView(p,g.view,g.ground,g.sceneTime,g.radarPose()),offset=(p.part?1:-1)*m.size*1.0262974573319399/4;
    close(q.x,parent.x+Math.cos(m.tilt)*offset);close(q.y,parent.y+Math.sin(m.tilt)*offset);
  }
  g.step(.002);assert.ok(people.every(p=>!p.pendingImpulse&&p.motionAge>0));
});
test('continuous hits share the first hold deadline and never extend it',()=>{
  const g=game(),first=cut(g);g.step(.02);const second=cut(g);close(second.people[0].releaseAt,first.people[0].releaseAt);
  g.step(.025);const third=cut(g);close(third.people[0].releaseAt,g.realTime);
  assert.ok(!first.people[0].pendingImpulse);close(g.cutStopUntil,CUT.hitStop);close(g.timeScale,1);
});
test('burst position is ballistic without a translation tween; spin initially opposes',()=>{
  const g=game(),{people}=cut(g),p=people[0],initial={x:p.x,y:p.y},impulse={...p.pendingImpulse};
  g.step(CUT.hitStop+.10);close(p.x,initial.x+impulse.vx*.1);close(p.y,initial.y+impulse.vy*.1+.5*CUT.gravity*.1**2);
  assert.ok(fragmentAngle(people[0],-Math.PI/2,people[0].motionAge)<people[0].birthTilt);
  assert.ok(fragmentAngle(people[1],-Math.PI/2,people[1].motionAge)>people[1].birthTilt);
});
test('fast swipes increase separation, rotation and particle count without rejecting slow cuts',()=>{
  const slow=cut(game(),undefined,8),fast=cut(game(),undefined,2000),a=slow.event.kinematics,b=fast.event.kinematics;
  assert.equal(slow.people.length,2);assert.ok(b.strength>a.strength);
  assert.ok(b.impulses[0].separation>a.impulses[0].separation);assert.ok(Math.abs(b.impulses[0].angularVelocity)>Math.abs(a.impulses[0].angularVelocity));
  assert.equal(a.particleCount,6);assert.equal(b.particleCount,10);assert.ok(b.bladeLife>a.bladeLife);
  assert.ok(Number.isFinite(swipeStrength(NaN,82)));
});
test('fragment trajectories and angular recovery agree across frame rates and settle upright',()=>{
  const a=game(),b=game(),pa=cut(a).people,pb=cut(b).people;
  a.step(1);for(let i=0;i<120;i++)b.step(1/120);
  for(let i=0;i<2;i++){close(pa[i].x,pb[i].x);close(pa[i].y,pb[i].y);close(pa[i].spinAngle,pb[i].spinAngle);assert.ok(Math.abs(pa[i].spinAngle)<.01);}
});
test('cut particles are bounded and directional; camera returns in 80ms without stacking',()=>{
  const {event}=cut(game()),particles=cutParticles(event);assert.equal(particles.length,event.kinematics.particleCount);assert.deepEqual(cutParticles(event),particles);
  assert.ok(particles.every(p=>p.life<=.16&&p.life>=.11));
  const cue={time:1,dir:{x:0,y:-1},strength:1},offset=cutCameraOffset(cue,1.01);
  assert.equal(offset.x,0);assert.ok(offset.y<0&&offset.y>=-4);assert.deepEqual(cutCameraOffset(cue,1.081),{x:0,y:0});assert.deepEqual(cutCameraOffset(cue,1.01,1,true),{x:0,y:0});
});
test('one rendered flash per cut uses the inverse of the actual glyph shade',()=>{
  const {event}=cut(game()),feedback=new CutFeedback();feedback.add(event);
  let strokes=0;const noop=()=>{},ctx=new Proxy({},{get:(_,name)=>name==='stroke'?()=>{strokes++;}:noop,set:()=>true}),g={id:'youyuan',height:100,width:100};
  const options={meteorPoint:()=>({x:200,y:200}),glyphs:new Map([['youyuan',g]]),paths:new Map([['youyuan',{}]]),metrics:{art:1,character:1},glyphColor:()=>'#292929',ink:'#292929',reduced:false};
  feedback.draw(ctx,0,options);assert.equal(feedback.snapshot()[0].flashFrames,1);
  feedback.draw(ctx,.01,options);assert.equal(feedback.snapshot()[0].flashFrames,1);
  assert.equal(strokes,1,'one actual clipped stroke across both render calls');
  assert.equal(inverseGlyphColor('#292929'),'#ffffff');assert.equal(inverseGlyphColor('#eeeeee'),'#000000');
});
