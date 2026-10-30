import test from 'node:test';
import assert from 'node:assert/strict';
import {PencilHint,PencilHintRenderer} from '../dist/pencil-hint.js';
import {CUT_DRAWING} from '../dist/cut-hint.js';
import {TutorialFeedback,PRAISE_DRAWING,BOMB_DRAWING,PRAISE_HINT,BOMB_HINT,feedbackHintLayout} from '../dist/tutorial-feedback.js';
const setup=()=>{const cut=new PencilHint(CUT_DRAWING);cut.start(0);return{cut,hints:new TutorialFeedback(cut)};};

test('a cut completed during the chapter can be rewarded once afterward without replaying an obsolete cut instruction',()=>{
  const cut=new PencilHint(CUT_DRAWING),hints=new TutorialFeedback(cut);assert.equal(hints.rewardCut(4),true);assert.equal(cut.startAt,null);assert.equal(hints.snapshot(4).active,'praise');assert.equal(hints.rewardCut(4.1),false);
  assert.equal(hints.onBomb(4.2),true);const frozen=hints.snapshot(4.2).praise;assert.equal(hints.snapshot(5).active,'warning');assert.equal(hints.snapshot(5).praise.writeProgress,frozen.writeProgress);hints.reset();assert.equal(hints.rewardCut(10),true);
});

test('praise waits for the cut instruction to finish erasing, writes once, then erases automatically',()=>{
  const {hints}=setup();assert.equal(hints.snapshot(1.5).active,'cut');hints.onCut(1.5);
  assert.equal(hints.snapshot(2).praise.stage,'hidden');const start=1.5+CUT_DRAWING.config.eraseDuration;
  let s=hints.snapshot(start+1e-6);assert.equal(s.active,'praise');assert.equal(s.praise.stage,'writing');assert.equal(s.praised,true);
  const born=hints.praise.startAt;assert.equal(hints.snapshot(born+.81).praise.stage,'shown');assert.equal(hints.snapshot(born+1.91).praise.stage,'erasing');
  assert.equal(hints.snapshot(born+3).praise.stage,'done');hints.onCut(born+3.1);assert.equal(hints.snapshot(born+4).praise.serial,1);
});
test('only the first bomb warns, warning takes priority, and deferred praise follows without overlap',()=>{
  const {hints}=setup();assert.equal(hints.onBomb(0),true);const serial=hints.warning.serial;assert.equal(hints.onBomb(.1),false);assert.equal(hints.warning.serial,serial);
  hints.onCut(.2);assert.equal(hints.snapshot(1.5).active,'warning');assert.equal(hints.snapshot(1.5).praisePending,true);assert.equal(hints.praise.startAt,null);
  assert.equal(hints.snapshot(BOMB_HINT.writeDuration+BOMB_HINT.hold+.1).warning.stage,'erasing');
  const end=BOMB_HINT.writeDuration+BOMB_HINT.hold+BOMB_HINT.eraseDuration;
  const s=hints.snapshot(end+.001);assert.equal(s.warning.stage,'done');assert.equal(s.active,'praise');assert.equal(s.praise.stage,'writing');assert.equal(s.bombSeen,true);
});
test('warning temporarily suspends praise and resumes its original pen progression without replay',()=>{
  const {hints}=setup();hints.onCut(.1);hints.snapshot(1.151);const born=hints.praise.startAt;
  hints.onBomb(born+.3);const frozen=hints.snapshot(born+.3).praise;assert.equal(hints.snapshot(born+1.5).praise.writeProgress,frozen.writeProgress);
  const end=born+.3+BOMB_HINT.writeDuration+BOMB_HINT.hold+BOMB_HINT.eraseDuration;
  const resumed=hints.snapshot(end+.001);assert.equal(resumed.active,'praise');assert.equal(resumed.praise.serial,frozen.serial);assert.ok(Math.abs(resumed.praise.writeProgress-frozen.writeProgress)<.003);
});
test('reduced motion keeps the words and finite display lifetime; reset enables both cues next round',()=>{
  const {hints}=setup();hints.onCut(.1,true);assert.equal(hints.snapshot(.1,true).praise.stage,'shown');assert.equal(hints.onBomb(.2,true),true);assert.equal(hints.snapshot(.2,true).warning.stage,'shown');
  assert.equal(hints.snapshot(.2+BOMB_HINT.hold+.01,true).warning.stage,'done');
  hints.reset();assert.equal(hints.warning.snapshot(10).stage,'hidden');assert.equal(hints.praise.snapshot(10).stage,'hidden');assert.equal(hints.bombSeen,false);assert.equal(hints.onBomb(11,true),true);
});
test('both drawings have finite pen segments, fit responsive bounds, and are fully reachable by their erasers',()=>{
  assert.equal(PRAISE_HINT.text,'不赖');assert.ok(PRAISE_HINT.angle<0);assert.ok(BOMB_DRAWING.strokes.some(s=>s.kind==='hand'));assert.ok(BOMB_DRAWING.strokes.some(s=>s.kind==='crease'));
  for(const drawing of [PRAISE_DRAWING,BOMB_DRAWING]){
    assert.ok(drawing.duration<=1.5);assert.ok(drawing.segments.every(s=>Number.isFinite(s.time)&&[s.a.x,s.a.y,s.b.x,s.b.y].every(Number.isFinite)));
    for(const stroke of drawing.strokes)for(const p of stroke.points)assert.ok(drawing.eraserChunks.some(e=>{
      const u=Math.max(0,Math.min(1,((p.x-e.x)*e.width+(p.y-e.y)*e.tilt)/(e.width**2+e.tilt**2)));return Math.hypot(p.x-e.x-e.width*u,p.y-e.y-e.tilt*u)<e.height/2-3;
    }),`${drawing.config.text}: ${p.x},${p.y}`);
    for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220]]){const p=feedbackHintLayout({width,height},drawing);assert.ok(p.x>=19&&p.y>=15&&p.x+p.width<=width-19&&p.y+p.height<=height-15);}
    const calls=[],make=()=>({getContext:()=>new Proxy({},{get:(_,key)=>(...args)=>{assert.ok(args.every(x=>typeof x!=='number'||Number.isFinite(x)));calls.push(key);},set:()=>true})});
    const renderer=new PencilHintRenderer(make,drawing),hint=new PencilHint(drawing);hint.start();const ctx={save(){},restore(){},drawImage(){}},layout=feedbackHintLayout({width:1440,height:900},drawing);
    renderer.draw(ctx,hint.snapshot(1.5),layout);assert.equal(renderer.next,drawing.segments.length);hint.erase(1.5);renderer.draw(ctx,hint.snapshot(2),layout,true);assert.ok(calls.includes('stroke'));
  }
});
