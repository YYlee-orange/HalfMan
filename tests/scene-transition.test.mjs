import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneTransition,SceneTransitionRenderer,SCENE_TRANSITION,transitionSeam} from '../dist/scene-transition.js';
import {BackgroundSky} from '../dist/background.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('generic transition closes, changes the scene only at full coverage, then opens in .9 seconds',()=>{
  const t=new SceneTransition(),events=[];
  assert.equal(t.begin({dark:false,onCovered:()=>{close(t.snapshot().coverage,1);events.push('covered');},onComplete:()=>events.push('complete')}),true);
  assert.equal(t.begin(),false);assert.equal(t.snapshot().layerDark,true);close(t.duration,.9);
  t.step(.14);assert.equal(t.snapshot().phase,'closing');close(t.snapshot().coverage,.5);assert.equal(t.snapshot().cutProgress,0);assert.deepEqual(events,[]);
  t.step(.14);assert.equal(t.snapshot().phase,'covered');assert.equal(t.snapshot().cutProgress,0);assert.deepEqual(events,['covered']);
  t.step(.12);assert.equal(t.snapshot().phase,'covered');close(t.snapshot().coverage,1);close(t.snapshot().cutProgress,.5);assert.deepEqual(events,['covered']);
  t.step(.12);assert.equal(t.snapshot().phase,'cut-pause');assert.equal(t.snapshot().cutProgress,1);close(t.snapshot().coverage,1);
  t.step(.05);assert.equal(t.snapshot().phase,'cut-pause');close(t.snapshot().coverage,1);
  t.step(.05);t.step(.14);assert.equal(t.snapshot().phase,'opening');close(t.snapshot().coverage,.5);
  assert.equal(t.snapshot().cutProgress,1);
  t.step(.14);assert.equal(t.active,false);assert.deepEqual(events,['covered','complete']);t.step(100);assert.deepEqual(events,['covered','complete']);
  assert.equal(t.begin({dark:true}),true);assert.equal(t.snapshot().layerDark,false);
});
test('reverse geometry, long frames, pause, independent clocks and reduced motion retain callback ordering',()=>{
  for(const u of [.1,.25,.5,.8]){
    const a=new SceneTransition(),b=new SceneTransition();a.begin();b.begin();a.step(SCENE_TRANSITION.close*u);b.step(SCENE_TRANSITION.close+SCENE_TRANSITION.hold+SCENE_TRANSITION.cutPause+SCENE_TRANSITION.open*(1-u));close(a.snapshot().coverage,b.snapshot().coverage);
  }
  const a=new SceneTransition(),b=new SceneTransition();a.begin();b.begin();a.step(.2);for(let i=0;i<12;i++)b.step(1/60);close(a.time,b.time);
  a.paused=true;const frozen=a.snapshot();a.step(5);assert.deepEqual(a.snapshot(),frozen);a.paused=false;
  const calls=[];const long=new SceneTransition();long.begin({onCovered:()=>{close(long.snapshot().coverage,1);calls.push('covered');},onComplete:()=>calls.push('complete')});long.step(10);assert.deepEqual(calls,['covered','complete']);
  const r=new SceneTransition();r.begin({dark:true,reduced:true,onCovered:()=>calls.push('reduced')});assert.ok(r.duration<=.17);r.step(.08);assert.equal(r.snapshot().coverage,1);r.step(.08);assert.equal(r.active,false);
});
test('shared seam is a full-height vertical line in all supported viewports',()=>{
  for(const [w,h]of [[1440,900],[390,844],[844,390],[320,568]]){
    const s=transitionSeam(w,h);assert.equal(s.amplitude,0);assert.deepEqual(s.segments,[['L',w/2,h]]);
    const distance=w/2+s.amplitude+8;assert.ok(s.cx+s.amplitude-distance<0);assert.ok(s.cx-s.amplitude+distance>w);
  }
});
test('renderer reuses one bounded layer with finite canvas commands, two complementary clips and static fade fallback',()=>{
  const ops=[],layers=[];
  const makeContext=()=>new Proxy({},{get:(_,key)=>(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),key);ops.push(key);},set:()=>true});
  const makeCanvas=()=>{const c={getContext:()=>makeContext()};layers.push(c);return c;};
  const renderer=new SceneTransitionRenderer(makeCanvas),ctx=makeContext();
  for(const [width,height]of [[1440,900],[390,844],[844,390]])for(const dark of [false,true])for(const reduced of [false,true]){
    const transition=new SceneTransition();transition.begin({dark,reduced});transition.step(transition.timings.close+transition.timings.hold*.5);
    renderer.draw(ctx,transition.snapshot(),{width,height,dpr:3,sky:new BackgroundSky(1),glyph:{width:100,height:100},path:{}});
  }
  assert.equal(layers.length,1);assert.ok(Math.max(renderer.panel.width,renderer.panel.height)<=2560);assert.ok(ops.includes('clip')&&ops.includes('lineTo')&&ops.includes('drawImage')&&ops.includes('setLineDash')&&ops.includes('stroke'));
});

test('panels remain shut during the cut and the extra .1 second after its tip reaches the bottom',()=>{
  const t=new SceneTransition();t.begin();
  for(const time of [.28,.30,.40,.50,.51999,.52,.56,.60,.61999,.62,.70]){
    t.step(time-t.time);const s=t.snapshot();
    if(s.cutProgress<1){close(s.coverage,1);assert.equal(s.phase,'covered');}
    if(time>=.52&&time<.62){assert.equal(s.phase,'cut-pause');close(s.coverage,1);assert.equal(s.cutProgress,1);}
    if(s.phase==='opening')assert.equal(s.cutProgress,1);
  }
});
