import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {NuclearStrike,NUCLEAR_RULES,nuclearBombScale} from '../dist/nuclear.js';
import {levelFeatures,AVAILABLE_LEVEL_COUNT} from '../dist/level-rules.js';
import {guidanceFor} from '../dist/chapter-guidance.js';
import {MechanismGuidance,mechanismLead} from '../dist/mechanism-guidance.js';
import {NUCLEAR_CUES,NUCLEAR_GUIDANCE,NUCLEAR_WARNING_DRAWING,NuclearWarning} from '../dist/nuclear-guidance.js';
import {NuclearEffects,drawNuclearBomb,drawNuclearIcon,nuclearIconFrame,nuclearCloudFrame} from '../dist/nuclear-art.js';
import {RoundEnding} from '../dist/round-ending.js';
import {CUT,CUT_DEFAULTS,sanitizeCutSettings,applyCutSettings} from '../dist/cut-settings.js';
import {FlameTracks} from '../dist/flames.js';
import {makeBomblets} from '../dist/bomb-physics.js';
import {meteorView,viewMetrics} from '../dist/body-geometry.js';
const game=()=>{const g=new GameModel(()=>.5);g.start('man-5');g.drainEvents();return g;};
const launchTime=NUCLEAR_RULES.warning+NUCLEAR_RULES.launchGap;
const blastCheckTime=launchTime+2.5;
test('fifth level retains all fourth-level mechanisms, adds nuclear strikes and has its own heading and two handwritten hints',()=>{
  assert.equal(AVAILABLE_LEVEL_COUNT,6);assert.deepEqual({...levelFeatures('man-5'),nuclear:false},levelFeatures('man-4'));assert.deepEqual(guidanceFor('man-5').chapter.config.lines,['曼之五','! 核平 !']);assert.equal(guidanceFor('man-5').tutorial,false);assert.ok(guidanceFor('man-5').chapter.strokes.some(s=>s.kind==='radiation'));
  const g=game();assert.ok(g.farmState.enabled&&g.cannon.enabled&&g.shield.enabled&&g.volcanoState.enabled&&g.nuclearState.enabled);
  const hints=new MechanismGuidance(NUCLEAR_GUIDANCE);for(const [w,h]of [[1440,900],[390,844],[844,390],[844,220]])for(const reduced of [false,true]){hints.start('man-5',0,reduced);for(let i=0;i<2;i++){const frame=hints.snapshot(mechanismLead(reduced,guidanceFor('man-5').chapter)+i*(reduced?1.7:4.15)+.01,reduced,viewMetrics(w,h));assert.equal(frame.text,NUCLEAR_CUES[i].text);assert.ok(hints.drawing.segments.length>0);}}
});
test('point-three-percent chance has an exact boundary and each ordinary summon still creates its meteor',()=>{
  for(const [r,expected]of [[.002999,true],[.003,false]]){const g=game();g.random=()=>r;g.spawnMeteor(undefined,undefined,1,'man',{source:'sky'});assert.equal(g.meteors.length,1);assert.equal(g.nuclearState.phase==='warning',expected);}
  for(const level of ['man-1','man-2','man-3','man-4']){const g=game();g.start(level);g.random=()=>0;g.spawnMeteor(undefined,undefined,1,'man');assert.equal(g.nuclearState.enabled,false);assert.equal(g.nuclearState.phase,'idle');}
  const g=game();g.random=()=>0;g.spawnMeteor(500,50,1,'man');assert.equal(g.nuclearState.phase,'idle');
});
test('the eighth distinct handled bomb triggers once and the cooldown still lasts thirty seconds',()=>{
  const n=new NuclearStrike(true);for(let i=1;i<=7;i++)assert.equal(n.noteBomb(i,0),false);assert.equal(n.handled,7);assert.equal(n.noteBomb(1,0),false);assert.equal(n.handled,7);assert.equal(n.noteBomb(8,0),true);assert.equal(n.handled,0);assert.equal(n.cooldownUntil,30);
  n.step(launchTime,viewMetrics(),808);assert.equal(n.phase,'falling');assert.equal(n.canTrigger(launchTime),false);
  n.step(blastCheckTime,viewMetrics(),808);assert.equal(n.explosions,1);
  for(let i=9;i<40;i++)assert.equal(n.noteBomb(i,29.99),false);
  assert.equal(n.handled,0);assert.equal(n.chance(29.99,()=>0),false);assert.equal(n.noteBomb(40,30),false);assert.equal(n.handled,1);assert.equal(n.chance(30,()=>0),true);
});
test('only actual cannon interceptions and cut-triggered bomb detonations count; natural ground impacts do not',()=>{
  const g=game();for(let i=0;i<4;i++){const m=g.spawnMeteor(400,200,undefined,'bomb');g.slice({x:m.x-100,y:m.y},{x:m.x+100,y:m.y});g.step(.5);g.meteors=[];g.bomblets=[];}assert.equal(g.nuclear.handled,4);
  for(let i=0;i<4;i++){const m=g.spawnMeteor(600,180,undefined,'bomb'),q=meteorView(m,g.view);g.cannon.bullets.push({id:900+i,x:q.x/g.view.sx-40,y:q.y/g.view.sy,vx:5000,vy:0,age:0});g.step(.02);}assert.equal(g.nuclearState.phase,'warning');assert.equal(g.nuclearState.reason,'bombs');
  const h=game();for(let i=0;i<9;i++){const m=h.spawnMeteor(100,800,undefined,'bomb');h.impactMeteor(m);}assert.equal(h.nuclear.handled,0);assert.equal(h.nuclearState.phase,'idle');
});
test('ten-second test warning precedes an offscreen falling bomb and editor refresh replaces falling strikes',()=>{
  assert.equal(NUCLEAR_RULES.warning,10);
  for(const [w,h]of [[1440,900],[390,844],[844,390],[844,220]]){
    const n=new NuclearStrike(true),v=viewMetrics(w,h),start=10,end=start+NUCLEAR_RULES.warning,launch=start+launchTime,refresh=launch+.2;
    n.request(start,true);assert.deepEqual(n.step(end-.001,v,808),[]);assert.equal(n.snapshot(end-.001).phase,'warning');
    assert.deepEqual(n.step(end,v,808),[]);assert.equal(n.phase,'retracting');assert.equal(n.bomb,null);
    assert.deepEqual(n.step(launch-.001,v,808),[]);assert.equal(n.step(launch,v,808)[0].type,'nuclearLaunch');
    assert.ok(n.bomb.y*v.sy+NUCLEAR_RULES.bombHeight*nuclearBombScale(v)/2<0);assert.equal(n.step(refresh,v,808).length,0);assert.ok(n.bomb.vy>80);
    n.request(refresh,true);assert.equal(n.bomb,null);assert.ok(Math.abs(n.snapshot(refresh).remaining-NUCLEAR_RULES.warning)<1e-8);assert.equal(n.cooldownUntil,refresh+30);
  }
});
test('nuclear damage bypasses shield and cannon safety, kills air and farm workers, and preserves sheltered people and buildings',()=>{
  const g=game();g.cuts=5;g.requestNuclear(true);g.realTime=g.sceneTime=blastCheckTime;g.clickShield();assert.equal(g.shieldState.active,true);
  g.people=['sheltered','cannon','farm','work','fall','jump','eat'].map((state,i)=>({id:100+i,state,x:1250,y:600,size:64,variantId:1,hunger:80,phase:0,part:0}));
  g.stepNuclear();assert.equal(g.nuclear.explosions,1);assert.equal(g.people.filter(p=>p.state!=='dead').length,1);assert.equal(g.people[0].state,'sheltered');assert.equal(g.deaths,6);assert.equal(g.score,505);assert.equal(g.bombPenalty,0);assert.equal(g.shield.enabled,true);assert.equal(g.cannon.enabled,true);assert.ok(g.drainEvents().find(e=>e.type==='nuclearBlast'));
});
test('pause freezes the strike, timers and repeated editor schedules; reset and end cancel pending nuclear damage',()=>{
  const g=game();g.requestNuclear(true);g.step(5);const state=g.nuclearState;g.status='paused';g.step(100);assert.deepEqual(g.nuclearState,state);g.status='playing';g.requestNuclear(true);assert.ok(Math.abs(g.nuclearState.remaining-NUCLEAR_RULES.warning)<1e-8);g.step(NUCLEAR_RULES.warning);assert.equal(g.nuclear.explosions,0);g.status='ended';new RoundEnding().start(g);assert.equal(g.nuclear.phase,'idle');g.step(100);assert.equal(g.deaths,0);g.start('man-5');assert.equal(g.nuclearState.serial,0);assert.equal(g.nuclearState.cooldown,0);
});
test('warning uses bold red pencil strokes, completes promptly and erases; flash defaults to half a second and settings are bounded',()=>{
  const warning=new NuclearWarning();warning.start(0);assert.equal(warning.snapshot(.3).stage,'writing');assert.ok(NUCLEAR_WARNING_DRAWING.config.strokeScale>2);assert.ok(NUCLEAR_WARNING_DRAWING.config.colors.light);assert.ok(NUCLEAR_WARNING_DRAWING.strokes.some(s=>s.kind==='radiation'));assert.equal(NUCLEAR_RULES.gravity,480);assert.equal(NUCLEAR_RULES.iconWarning,10);assert.equal(warning.snapshot(1.1).stage,'shown');assert.equal(warning.snapshot(5).stage,'done');warning.start(6);assert.equal(warning.snapshot(6).stage,'writing');assert.equal(CUT_DEFAULTS.nuclearFlash,.5);assert.equal(CUT_DEFAULTS.nuclearCloudOpacity,1);assert.equal(sanitizeCutSettings({nuclearCloudOpacity:2}).nuclearCloudOpacity,1);assert.equal(sanitizeCutSettings({nuclearCloudOpacity:-1}).nuclearCloudOpacity,0);assert.equal(sanitizeCutSettings({nuclearFlash:100}).nuclearFlash,2);assert.equal(sanitizeCutSettings({nuclearFlash:-1}).nuclearFlash,0);
  const fx=new NuclearEffects();fx.add({x:720,y:808,sceneTime:0,flashDuration:.5});assert.equal(fx.flash(0),1);assert.ok(fx.flash(.25)>0);assert.equal(fx.flash(.5),0);assert.equal(fx.flash(.51),0);fx.clear();assert.equal(fx.flash(0),0);
});
test('a falling nuclear bomb joins the cosmetic round ending with a finite debris seed and no nuclear damage',()=>{
  const g=game();g.requestNuclear(true);g.realTime=g.sceneTime=launchTime;g.stepNuclear();assert.ok(g.nuclear.bomb);g.status='ended';g.remaining=0;const ending=new RoundEnding(),bursts=ending.start(g);assert.equal(bursts.length,1);assert.equal(bursts[0].kind,'nuclear');assert.ok(Number.isFinite(bursts[0].id));assert.equal(g.nuclear.bomb,null);assert.equal(g.nuclear.explosions,0);assert.equal(g.deaths,0);
});
test('nuclear blasts clear sky, rising volcanic, armed bomb and bomblet hazards and their trails without triggering bomb penalties or rewards',()=>{
  const g=game(),trails=new FlameTracks();g.requestNuclear(true);g.spawnMeteor(500,100,1,'man');const bomb=g.spawnMeteor(600,100,undefined,'bomb');bomb.arm={time:0,expand:100,contract:100,radius:150,opacity:.2};g.spawnMeteor(undefined,undefined,1,'man',{source:'volcano'});g.bomblets=makeBomblets(bomb,g.view,()=>g.nextId++,()=>.5,808);trails.sync(g);assert.ok(trails.trails.size>0);
  g.realTime=g.sceneTime=blastCheckTime;g.stepNuclear();for(const e of g.drainEvents())trails.event(e,g);assert.equal(g.meteors.length,0);assert.equal(g.bomblets.length,0);assert.equal(trails.trails.size,0);assert.equal(g.bombPenalty,0);assert.equal(g.cuts+g.cannonKills+g.bombExplosions,0);g.step(2);assert.equal(g.bombExplosions,0);assert.equal(g.nuclear.explosions,1);
});
test('larger radiation warning spans ten seconds and completes five two-second pulses with fully transparent troughs',()=>{
  const state=remaining=>({phase:'warning',remaining});for(const [w,h]of [[1440,900],[390,844],[844,390],[844,220]]){
    const v=viewMetrics(w,h);assert.equal(nuclearIconFrame(state(10.01),v),null);assert.equal(nuclearIconFrame(state(0),v),null);
    for(const seconds of [10,8,6,4,2])assert.equal(nuclearIconFrame(state(seconds),v).alpha,0);for(const seconds of [9,7,5,3,1])assert.ok(Math.abs(nuclearIconFrame(state(seconds),v).alpha-.78)<1e-8);
    const previousSize=Math.max(130,Math.min(300,w*.4,h*.46));
    assert.ok(nuclearIconFrame(state(5),v).size>previousSize*1.25);
  }
});
test('cloud base covers the lower screen edge regardless of camera shake and the complete opaque group fades in one composite',()=>{
  for(const [w,h]of [[1440,900],[390,844],[844,390],[844,220]])for(const age of [0,.2,1.8,5.5])for(const dy of [-200,0,200]){const v=viewMetrics(w,h),f=nuclearCloudFrame({x:720,y:808,sceneTime:0},age,v,(x,y)=>({x:x*v.sx+dy,y:y*v.sy+dy}));assert.ok(f.y>=h);assert.ok(f.y-f.footHeight<h);assert.equal(f.wordX,720*v.sx);}
  const view=viewMetrics(),blast={x:720,y:808,sceneTime:0},project=(x,y)=>({x,y});
  const fading=nuclearCloudFrame(blast,5.3,view,project),late=nuclearCloudFrame(blast,5.9,view,project);
  assert.ok(late.h>fading.h&&late.roll>fading.roll&&late.alpha<fading.alpha);
  assert.equal(nuclearCloudFrame(blast,5.9,view,project,true).roll,0);
  const opacities=[],composites=[],contours=[];let alpha=1,allocations=0;
  const source=new Proxy({fill(){opacities.push(this.globalAlpha);},fillText(){opacities.push(this.globalAlpha);},translate(...points){contours.at(-1).push(...points);},clearRect(){contours.push([]);}},{get:(t,k)=>k in t?t[k]:(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
  const target={canvas:{width:1440},save(){},restore(){},set globalAlpha(v){alpha=v;},drawImage(){composites.push(alpha);}};
  const fx=new NuclearEffects(()=>{allocations++;return{width:0,height:0,getContext:()=>source};});fx.add({x:720,y:808,sceneTime:0});for(const age of [5.3,5.7])fx.draw(target,age,viewMetrics(1440,900),(x,y)=>({x,y}));
  assert.equal(allocations,1);assert.equal(composites.length,2);assert.ok(composites[0]>composites[1]&&composites[0]<1&&composites[1]>0);assert.ok(opacities.length>0&&opacities.every(a=>a===1));
  assert.equal(contours[0].length,contours[1].length);assert.notDeepEqual(contours[0],contours[1]);
});
test('DOOM word persists for the full cloud lifetime and all blast drawing coordinates stay finite',()=>{
  const letters=[];
  const ctx=new Proxy({},{get:(_,key)=>(...args)=>{
    for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));
    if(key==='fillText')letters.push(args[0]);
  },set:()=>true});
  for(const [w,h] of [[1440,900],[390,844],[844,390],[844,220]]){
    const v=viewMetrics(w,h),project=(x,y)=>({x:x*v.sx,y:y*v.sy}),n=new NuclearStrike(true);
    const fx=new NuclearEffects(()=>({width:0,height:0,getContext:()=>ctx}));
    n.request(0,true);n.step(launchTime,v,808);
    drawNuclearBomb(ctx,n.snapshot(launchTime),v,project);
    drawNuclearIcon(ctx,{phase:'warning',remaining:4.5},10.5,v);
    fx.add({x:720,y:808,sceneTime:0,flashDuration:.5});
    for(const age of [0,.1,.6,1.6,4.9,5.9,NUCLEAR_RULES.cloudLife,6.1]){
      letters.length=0;
      fx.draw(ctx,age,v,project);
      assert.equal(letters.join(''),age<NUCLEAR_RULES.cloudLife?'DOOM!!':'');
    }
    assert.equal(fx.blasts.length,0);
  }
});
test('cloud opacity defaults to full opacity and live tuning changes only the final whole-cloud composite',()=>{
  const previous=CUT.nuclearCloudOpacity,composites=[];let alpha=1;
  const source=new Proxy({},{get:()=>()=>{},set:()=>true}),target={canvas:{width:1440},save(){},restore(){},set globalAlpha(v){alpha=v;},drawImage(){composites.push(alpha);}};
  const fx=new NuclearEffects(()=>({width:0,height:0,getContext:()=>source}));fx.add({x:720,y:808,sceneTime:0});
  try{applyCutSettings({nuclearCloudOpacity:1},{persist:false});fx.draw(target,2,viewMetrics(),(x,y)=>({x,y}));applyCutSettings({nuclearCloudOpacity:.35},{persist:false});fx.draw(target,2.1,viewMetrics(),(x,y)=>({x,y}));assert.deepEqual(composites,[1,.35]);}finally{applyCutSettings({nuclearCloudOpacity:previous},{persist:false});}
});
