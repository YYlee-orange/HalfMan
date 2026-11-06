import test from 'node:test';
import assert from 'node:assert/strict';
import {GEM_OUTLINE,GEM_FACETS,gemColorAt} from '../dist/score-gem.js';
import {ScoreCombo} from '../dist/score-combo.js';
import {strikeScoreMeteor,advanceScoreSpin} from '../dist/score-meteor.js';
import {cutLineAt,cutSparksAt,cutScoreOffset} from '../dist/score-cut-feedback.js';
import {GameModel} from '../dist/engine.js';
import {CUT} from '../dist/cut-settings.js';
import {cutCameraOffset} from '../dist/cut-motion.js';
import {ScoreMeteorEffects} from '../dist/score-meteor-art.js';
const angles=poly=>poly.map((b,i)=>{
  const a=poly[(i+poly.length-1)%poly.length],c=poly[(i+1)%poly.length],ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1];
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))*180/Math.PI;
});
test('the irregular near-circular outer polygon and every beveled cut face have only obtuse interior angles',()=>{
  const radii=GEM_OUTLINE.map(([x,y])=>Math.hypot(x,y));assert.ok(Math.max(...radii)/Math.min(...radii)<1.12);assert.ok(new Set(radii.map(n=>n.toFixed(3))).size>4);
  for(const poly of [GEM_OUTLINE,...GEM_FACETS]){assert.ok(poly.length>=6);assert.ok(angles(poly).every(a=>a>90&&a<180));}
  const colors=GEM_FACETS.map((_,i)=>gemColorAt(i,0));assert.ok(new Set(colors).size>=6);assert.ok(colors.every((color,i)=>color!==gemColorAt(i,2)));
});
test('each cut takes an equal share of the zoom range and the blast pulls back immediately',()=>{
  const g=new GameModel(()=>.5);g.start();const m=g.spawnMeteor(700,280,undefined,'score');const slice=()=>g.slice({x:500,y:280},{x:900,y:280});slice();g.step(.2);const first=g.scoreFocus.zoom;
  assert.ok(first>1&&first<1.2);slice();const unchanged=g.scoreFocus.zoom;assert.ok(Math.abs(unchanged-first)<1e-9);g.step(.14);assert.ok(g.scoreFocus.zoom>first);assert.ok(g.scoreFocus.zoom<CUT.frenzyZoom);
  for(let i=3;i<=m.cutLimit;i++){
    const previous=g.scoreFocus.zoom;slice();g.step(.14);
    assert.ok(Math.abs(g.scoreFocus.zoom-previous-(first-1))<1e-8);
  }
  const z=g.scoreFocus.zoom;assert.equal(z,CUT.frenzyZoom);g.step(.34);assert.equal(m.exploded,true);assert.ok(g.scoreFocus.zoom<z);g.step(.5);assert.equal(g.scoreFocus.zoom,1);
});
test('off-center swipe torque reverses on opposite sides; its angular momentum decays and each strike resets the ordinary directional camera pulse',()=>{
  const upper={},lower={};strikeScoreMeteor(upper,0,{x:1,y:0},{x:0,y:-.25});strikeScoreMeteor(lower,0,{x:1,y:0},{x:0,y:.25});assert.ok(upper.frenzy.angularVelocity>0&&lower.frenzy.angularVelocity<0);
  const speed=upper.frenzy.angularVelocity;advanceScoreSpin(upper,.1);advanceScoreSpin(lower,.1);assert.ok(upper.frenzy.rotation>0&&lower.frenzy.rotation<0);assert.ok(upper.frenzy.angularVelocity<speed);
  const g=new GameModel(()=>.5);g.start();g.spawnMeteor(700,280,undefined,'score');g.slice({x:500,y:280},{x:900,y:280});let cue=g.cutCue;assert.ok(cutCameraOffset(cue,.02,1,false).x>0);g.step(.1);g.slice({x:900,y:280},{x:500,y:280});assert.ok(g.cutCue.time>cue.time);assert.ok(cutCameraOffset(g.cutCue,g.realTime+.02,1,false).x<0);
});
test('cut glints originate along the actual offset blade line, flash and expire locally, while per-cut amounts use distinct scattered positions',()=>{
  const e={id:3,cuts:1,direction:{x:.8,y:.6},cutOffset:{x:.072,y:-.096}},size=200,line=cutLineAt(e,size);
  for(const age of [.01,.06,.14,.22])for(const dot of cutSparksAt(e,age,size)){
    const perpendicular=(dot.x-line.x)*line.nx+(dot.y-line.y)*line.ny;assert.ok(Math.abs(perpendicular)<size*.2);assert.ok(dot.opacity>=0&&dot.opacity<=1);assert.ok(Math.hypot(dot.x,dot.y)<size*.8);
  }
  assert.equal(cutSparksAt(e,.35,size).length,0);const positions=Array.from({length:12},(_,i)=>cutScoreOffset({...e,cuts:i+1}));assert.equal(new Set(positions.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size,12);
});
test('combo digits reuse rolling score retargeting and every update starts its own jelly pulse, independent of the score cooldown',()=>{
  const c=new ScoreCombo(2);c.feedback.reset(9);c.update(10,1);const during=c.snapshot(1.07);assert.equal(during.value,10);assert.ok(during.digits.some(d=>d.position%1!==0));assert.ok(during.sx>1&&during.sy<1);c.update(11,1.08);const next=c.snapshot(1.13);assert.ok(next.sx>1&&next.sy<1);
  assert.notEqual(next.color,during.color);
  const settled=c.snapshot(2);assert.equal(settled.value,11);assert.ok(settled.digits.every(d=>Math.round(d.position)%10===1));assert.ok(Math.abs(settled.sx-1)<.001);const reduced=c.snapshot(2,true);assert.equal(reduced.sx,1);assert.equal(reduced.sy,1);
  const fx=new ScoreMeteorEffects();fx.event({type:'scoreMeteorCut',id:2,cuts:1,time:0});fx.event({type:'scoreMeteorCut',id:2,cuts:2,time:.08});assert.equal(fx.combos.get(2).snapshot(.1).value,2);fx.clear();assert.equal(fx.combos.size,0);
});
