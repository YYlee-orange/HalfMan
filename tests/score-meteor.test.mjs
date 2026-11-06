import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {CUT} from '../dist/cut-settings.js';
import {SCORE_METEOR} from '../dist/score-meteor-rules.js';
import {meteorView} from '../dist/body-geometry.js';
import {scoreFragmentView} from '../dist/score-meteor.js';
import {FlameTracks} from '../dist/flames.js';
import {drawPlume} from '../dist/fire.js';
import {drawScoreMeteor,drawScoreFragment,ScoreMeteorEffects} from '../dist/score-meteor-art.js';
import {RoundEnding} from '../dist/round-ending.js';
import {loadScoreMeteors} from '../dist/weapon-choice.js';
const game=(level='man-1')=>{const g=new GameModel(()=>.5);g.start(level);g.drainEvents();return g;};
const rock=g=>g.spawnMeteor(700,280,undefined,'score');
const cut=g=>g.slice({x:500,y:280},{x:900,y:280});

test('score chance is exactly two percentage points, does not reduce bomb chance, and the saved opt-out persists across rounds',()=>{
  let roll=.049999;const g=new GameModel(()=>roll);g.start();assert.equal(g.spawnMeteor(700,100).kind,'bomb');
  for(roll of [CUT.bombChance,CUT.bombChance+.019999])assert.equal(g.spawnMeteor(700,100).kind,'score');
  roll=CUT.bombChance+.02;assert.equal(g.spawnMeteor(700,100).kind,'man');assert.equal(g.setScoreMeteors(false),false);
  g.reset();g.setScoreMeteors(false);g.start();roll=.06;assert.equal(g.spawnMeteor(700,100).kind,'man');assert.equal(g.scoreMeteorsEnabled,false);roll=.01;assert.equal(g.spawnMeteor(700,100).kind,'bomb');
  const forced=g.spawnMeteor(undefined,undefined,undefined,'score');assert.equal(forced.kind,'score');assert.equal(forced.size,CONFIG.meteorSize*1.32);assert.ok(meteorView(forced,g.view).y+meteorView(forced,g.view).ry<0);
  assert.equal(loadScoreMeteors({getItem:()=>null}),true);assert.equal(loadScoreMeteors({getItem:()=> 'false'}),false);assert.equal(loadScoreMeteors({getItem:()=>{throw Error();}}),true);
});
test('first strike suspends the score meteor, pays 17 without people, and slows the world while the real deadline and game timer continue',()=>{
  const g=game(),m=rock(g),other=g.spawnMeteor(1000,100,1,'man');other.vx=0;const x=m.x,y=m.y;
  assert.equal(cut(g).length,1);assert.equal(g.score,17);assert.equal(g.people.length,0);assert.equal(g.cuts,0);assert.equal(m.frenzy.deadline,.8);
  g.step(.3);assert.ok(Math.abs(g.timeScale-CUT.frenzySlowScale)<1e-9);assert.equal(m.x,x);assert.equal(m.y,y);assert.ok(other.y<105);assert.ok(Math.abs(g.realTime-.3)<1e-9);assert.ok(Math.abs(g.remaining-(g.roundSeconds-.3))<1e-8);
  assert.ok(g.scoreFocus.zoom>1&&g.scoreFocus.zoom<CUT.frenzyZoom);assert.equal(g.scoreFocus.blur,CUT.frenzyBlur);
  g.status='paused';const scene=g.sceneTime;g.step(10);assert.equal(g.realTime,.3);assert.equal(g.sceneTime,scene);assert.equal(m.frenzy.deadline,.8);
  g.status='playing';g.step(.49);assert.equal(m.frenzy.chargeStartedAt,undefined);g.step(.02);assert.equal(m.frenzy.chargeStartedAt,.8);assert.equal(g.scoreFragments.length,0);
  g.step(SCORE_METEOR.chargeDuration);assert.equal(g.meteors.some(n=>n.id===m.id),false);assert.ok(g.scoreFragments.length>=6&&g.scoreFragments.length<=9);g.step(.5);assert.equal(g.timeScale,1);assert.equal(g.scoreFocus.zoom,1);assert.equal(g.scoreFocus.blur,0);
});
test('one pass has no sampled-point duplicates; reentry and new strokes count, and the cut limit locks input for charging',()=>{
  const g=game(),m=rock(g);
  g.slice({x:500,y:280},{x:690,y:280},3,null,{strokeId:1});g.step(.08);g.slice({x:690,y:280},{x:710,y:280},3,null,{strokeId:1});assert.equal(m.frenzy.cuts,1);
  g.slice({x:710,y:280},{x:900,y:280},3,null,{strokeId:1});g.step(.08);g.slice({x:900,y:280},{x:690,y:280},3,null,{strokeId:1});assert.equal(m.frenzy.cuts,2);
  g.step(.08);g.slice({x:690,y:280},{x:700,y:280},3,null,{strokeId:2});assert.equal(m.frenzy.cuts,3);
  g.slice({x:500,y:0},{x:900,y:0});
  for(let i=0;i<20;i++){g.step(.08);cut(g);}
  assert.equal(m.frenzy.extra,undefined);assert.ok(Math.abs(m.frenzy.deadline-g.realTime-.8)<1e-8);assert.equal(g.scoreCutBonus,m.frenzy.cuts*SCORE_METEOR.cutPoints);
  while(m.frenzy.cuts<m.frenzy.cutLimit-1){g.step(.08);cut(g);}assert.equal(m.frenzy.chargeStartedAt,undefined);
  g.step(.08);cut(g);assert.equal(m.frenzy.chargeStartedAt,g.realTime);assert.equal(g.scoreCutBonus,m.frenzy.cutLimit*SCORE_METEOR.cutPoints);assert.equal(cut(g).length,0);assert.equal(g.scoreFragments.length,0);
  g.step(SCORE_METEOR.chargeDuration);assert.equal(m.exploded,true);assert.ok(g.scoreFragments.length>=6);
});
test('score meteors and their safe scoring fragments use blue trails and pay each landing once',()=>{
  for(const weapon of ['cannon','laser']){
    const g=game('man-2');g.weaponType=weapon;
    g.spawnMeteor(700,150,1,'man');g.slice({x:500,y:150},{x:900,y:150});
    for(const p of g.people){p.state='work';p.x=700;p.onRadar=false;p.landed=true;p.y=CONFIG.ground-16;}
    const alive=g.alive,m=rock(g);g.cannonHit({body:m,kind:'score',view:meteorView(m,g.view)});const count=g.scoreFragments.length,fx=new FlameTracks();
    for(const e of g.drainEvents())fx.event(e,g);fx.sync(g);assert.equal(g.scoreCutBonus,0);assert.equal(g.cannonBonus,0);assert.equal(g.cannonKills,1);assert.equal(g.bomblets.length,0);assert.equal(g.bombPenalty,0);
    assert.equal(fx.trails.get(m.id).palette,'blue');
    assert.ok(g.scoreFragments.every(f=>fx.trails.get(f.id).kind==='scoreFragment'&&fx.trails.get(f.id).palette==='blue'));
    g.step(12);assert.equal(g.alive,alive);assert.equal(g.scoreFragments.length,0);assert.equal(g.scoreFragmentBonus,count*13);
    const paid=g.drainEvents().filter(e=>e.type==='scoreChange'&&e.source.key==='scoreFragment');assert.equal(paid.length,count);assert.ok(paid.every(e=>e.delta===13&&e.source.label==='分数碎片'));g.step(2);assert.equal(g.scoreFragmentBonus,count*13);
  }
  const g=game(),m=g.spawnMeteor(700,700,undefined,'score');m.vx=0;m.vy=800;g.step(1);assert.ok(g.scoreFragments.length>0);assert.equal(g.deaths,0);assert.equal(g.scoreCutBonus,0);
});
test('reset, time-up and nuclear blast clear frenzy and fragments without unearned floor payouts',()=>{
  const g=game('man-5'),m=rock(g);cut(g);g.burstScoreMeteor(m);const score=g.score;g.status='ended';const ending=new RoundEnding();ending.start(g);assert.equal(g.scoreFragments.length,0);assert.equal(g.scoreFocusCue,null);g.step(10);assert.equal(g.score,score);
  g.start('man-5');const n=rock(g);cut(g);g.burstScoreMeteor(n);g.requestNuclear(true);g.nuclear.phase='falling';g.nuclear.bomb={x:720,y:CONFIG.ground,fromY:CONFIG.ground,born:g.realTime,vy:80};g.step(.01);assert.equal(g.scoreFragments.length,0);assert.equal(g.scoreFocusCue,null);assert.equal(g.scoreFragmentBonus,0);
  g.start();assert.equal(g.scoreCutBonus,0);assert.equal(g.scoreFragmentBonus,0);assert.equal(g.scoreMeteorCuts,0);assert.equal(g.timeScale,1);
});
test('score meteor geometry, sharp effects and fragment trails remain finite on portrait, landscape, reduced motion and both themes',()=>{
  const ctx=new Proxy({},{get:(_,key)=> (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));if(key==='createLinearGradient')return{addColorStop(){}};},set:(_,key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value),key);return true;}});
  for(const [w,h]of [[1440,900],[390,844],[844,390]])for(const reduced of [false,true])for(const dark of [false,true]){
    const g=game();g.reducedMotion=reduced;g.setViewport(w,h);const m=rock(g),p=meteorView(m,g.view),effects=new ScoreMeteorEffects(),fx=new FlameTracks(),project=(x,y)=>({x:x*g.view.sx,y:y*g.view.sy});
    drawScoreMeteor(ctx,m,p,m.size*m.bodyScale*g.view.character,0,reduced);cut(g);g.step(.2);drawScoreMeteor(ctx,m,p,m.size*m.bodyScale*g.view.character,g.realTime,reduced);g.burstScoreMeteor(m);
    for(const e of g.drainEvents()){effects.event(e);fx.event(e,g);}fx.sync(g);
    for(const f of g.scoreFragments){const q=scoreFragmentView(f,g.view);assert.ok(Number.isFinite(q.x+q.y));drawScoreFragment(ctx,f,g.view,project);drawPlume(ctx,fx.trails.get(f.id),g.sceneTime,project,{...g.view,reduced});}
    effects.draw(ctx,g.realTime,project,g.view,reduced,dark);g.step(12);for(const e of g.drainEvents())effects.event(e);effects.draw(ctx,g.realTime+.3,project,g.view,reduced,dark);effects.draw(ctx,g.realTime+3,project,g.view,reduced,dark);assert.equal(effects.numbers.length,0);
  }
});
