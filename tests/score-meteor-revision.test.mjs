import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel} from '../dist/engine.js';
import {scoreCutLimit,scoreChargeAt} from '../dist/score-meteor.js';
import {SCORE_METEOR} from '../dist/score-meteor-rules.js';
import {ScoreMeteorEffects} from '../dist/score-meteor-art.js';
import {SHARD_OUTLINES,shardColor,shardExtent} from '../dist/score-shard.js';
import {scoreAwardColor} from '../dist/score-award-style.js';
import {gemColorAt} from '../dist/score-gem.js';
import {cutScoreOffset} from '../dist/score-cut-feedback.js';
const cut=g=>g.slice({x:500,y:280},{x:900,y:280});
const game=()=>{const g=new GameModel(()=>.9999);g.start();return g;};
test('cut caps are uniformly bucketed from 39 through 49; an active chain can exceed the retired total time limit',()=>{
  const limits=Array.from({length:11},(_,i)=>scoreCutLimit(()=>(i+.5)/11));assert.deepEqual(limits,Array.from({length:11},(_,i)=>39+i));
  const g=game(),m=g.spawnMeteor(700,280,undefined,'score');assert.equal(m.cutLimit,49);cut(g);
  while(m.frenzy.cuts<48){g.step(.25);cut(g);}assert.ok(g.realTime>7.5);assert.equal(m.exploded,undefined);assert.equal(g.scoreFrenzy.id,m.id);
  assert.equal(scoreChargeAt(m,g.realTime).progress,0);
  g.step(.25);cut(g);assert.equal(m.frenzy.cuts,49);assert.equal(g.scoreCutBonus,49*SCORE_METEOR.cutPoints);assert.equal(m.frenzy.chargeStartedAt,g.realTime);assert.equal(cut(g).length,0);
  g.step(SCORE_METEOR.chargeDuration);assert.equal(m.exploded,true);assert.equal(g.scoreFrenzy,null);
});
test('charging starts only after the inactivity deadline and runs independently of cuts',()=>{
  const g=game(),m=g.spawnMeteor(700,280,undefined,'score');cut(g);g.step(.72);assert.equal(scoreChargeAt(m,g.realTime).progress,0);
  cut(g);g.step(.799);assert.equal(m.frenzy.chargeStartedAt,undefined);g.step(.002);assert.equal(m.frenzy.chargeStartedAt,m.frenzy.deadline);
  g.step(.18);const expanded=scoreChargeAt(m,g.realTime);assert.ok(expanded.expand>.8&&expanded.radius>.8);
  const progress=expanded.progress;assert.equal(cut(g).length,0);assert.equal(scoreChargeAt(m,g.realTime).progress,progress);
  g.status='paused';g.step(2);assert.equal(scoreChargeAt(m,g.realTime).progress,progress);g.status='playing';
  g.step(.25);const gathered=scoreChargeAt(m,g.realTime);assert.ok(gathered.contract>.8&&gathered.opacity>expanded.opacity&&gathered.radius<expanded.radius);assert.equal(m.exploded,undefined);
  g.step(.04);assert.equal(m.exploded,true);assert.equal(g.scoreMeteorCuts,2);
});
test('cut explosions keep a dedicated strong shake, independent of other feedback and disabled only under reduced motion',()=>{
  const fx=new ScoreMeteorEffects();fx.event({type:'scoreMeteorBurst',id:3,x:700,y:280,time:2,sceneTime:1,size:108,fragments:[]});
  assert.ok(new Set(fx.bursts[0].stars.map(star=>star.size)).size>1);
  assert.equal(new Set(fx.bursts[0].stars.map(star=>`${Math.sign(star.x)},${Math.sign(star.y)}`)).size,4);
  const first=fx.shakeAt(2.02);assert.ok(first.envelope>40);assert.ok(Math.max(...Array.from({length:10},(_,i)=>{const q=fx.shakeAt(2+i*.01);return Math.hypot(q.dx,q.dy);}))>35);assert.ok(fx.shakeAt(2.3).envelope<first.envelope);assert.equal(fx.shakeAt(2.61).envelope,0);assert.equal(fx.shakeAt(2.02,true).envelope,0);
});
test('sharp shard silhouettes vary and retain their parent facet colors for their own landing awards',()=>{
  assert.deepEqual(new Set(SHARD_OUTLINES.map(p=>p.length)),new Set([3,4,5]));
  for(const poly of SHARD_OUTLINES){const angles=poly.map((b,i)=>{const a=poly[(i+poly.length-1)%poly.length],c=poly[(i+1)%poly.length],ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1];return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))*180/Math.PI;});assert.ok(Math.min(...angles)<70);}
  const g=game(),m=g.spawnMeteor(700,280,undefined,'score');g.burstScoreMeteor(m);const fragments=g.scoreFragments;assert.ok(fragments.every(f=>f.gemSeed===m.id));
  const colors=[];for(const f of fragments){const e={type:'scoreFragmentLand',time:4,fragment:f};assert.equal(scoreAwardColor(e),shardColor(f,4));assert.equal(scoreAwardColor(e,true),shardColor(f,0));const q=shardExtent(f);assert.ok(q.rx>0&&q.ry>0);colors.push(scoreAwardColor(e));}assert.ok(new Set(colors).size>3);
  for(let cuts=1;cuts<=7;cuts++)assert.equal(scoreAwardColor({type:'scoreMeteorCut',id:m.id,time:3,cuts}),gemColorAt(cuts%7,3,m.id,-17));
  const scales=Array.from({length:20},(_,i)=>cutScoreOffset({id:3,cuts:i+1}).scale);assert.ok(Math.max(...scales)/Math.min(...scales)>1.7);
});
