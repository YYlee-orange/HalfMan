import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,GameModel} from '../dist/engine.js';
import {meteorView,personView,viewMetrics} from '../dist/body-geometry.js';
import {FlameTracks} from '../dist/flames.js';
import {BLACK_HAWK_ENTRY_DURATION,BLACK_HAWK_PATROL_START,BlackHawkPilot,blackHawkProjector,blackHawkTargets} from '../dist/black-hawk-flight.js';
import {blackHawkHullBottom,blackHawkMounts,drawBlackHawk} from '../dist/black-hawk-art.js';
import {halfHeight} from '../dist/variants.js';
import {BLACK_HAWK_BOMB_SKILL,BLACK_HAWK_MAX_HEALTH,BLACK_HAWK_STAGE_HEALTH} from '../dist/black-hawk-combat.js';
import {BLACK_HAWK_ELBOW_SKILL,ELBOW_DURATION,elbowFrame} from '../dist/black-hawk-elbow.js';
import {radarWorldPoint} from '../dist/radar.js';
import {BlackHawkEffects} from '../dist/black-hawk-effects.js';
import {BOSS_NUCLEAR_RULES,NUCLEAR_RULES,nuclearBombScale} from '../dist/nuclear.js';
import {CRASH_CLOUD_LIFE} from '../dist/nuclear-art.js';
import {RoundEnding} from '../dist/round-ending.js';

test('the entry settles into hover before the first flight accelerates from rest',()=>{
  const pilot=new BlackHawkPilot(()=>.13),view=viewMetrics();
  const arrival=pilot.pose(BLACK_HAWK_ENTRY_DURATION,view);
  pilot.advance(BLACK_HAWK_ENTRY_DURATION+.20);
  assert.equal(pilot.leg.mode,'entryHover');
  assert.equal(pilot.pose(BLACK_HAWK_ENTRY_DURATION+.20,view).x,arrival.x);
  const hover=pilot.pose(BLACK_HAWK_PATROL_START,view);
  pilot.advance(BLACK_HAWK_PATROL_START);
  const departure=pilot.pose(BLACK_HAWK_PATROL_START,view);
  assert.equal(departure.mode,'forward');
  for(const key of ['x','y','vx','vy','pitch','bank','yaw'])assert.ok(Math.abs(departure[key]-hover[key])<1e-10);
  const early=pilot.sample(BLACK_HAWK_PATROL_START+.12),later=pilot.sample(BLACK_HAWK_PATROL_START+.40);
  assert.ok(early.vx>0&&later.vx>early.vx);
  assert.ok(later.x>early.x&&early.x>departure.x/view.width);
});

test('flight AI varies its route and links its pose to each maneuver',()=>{
  const view=viewMetrics(),a=new BlackHawkPilot(()=>.13),b=new BlackHawkPilot(()=>.71);
  const maneuvers=new Set();
  let divergent=false,sawTurn=false;
  for(let t=BLACK_HAWK_PATROL_START;t<55;t+=.07){
    a.advance(t);b.advance(t);
    const p=a.pose(t,view),q=b.pose(t,view);
    divergent||=Math.hypot(p.x-q.x,p.y-q.y)>40;
    maneuvers.add(p.mode);
    if(p.mode==='climb'&&p.vy<-.03)assert.ok(p.bank>.07);
    if(p.mode==='descend'&&p.vy>.03)assert.ok(p.bank<0);
    if(p.mode==='forward'&&p.forwardSpeed>.03)assert.ok(p.pitch>0);
    if(p.mode==='reverse'&&p.forwardSpeed<-.03)assert.ok(p.pitch<0);
    if(p.mode==='turn'){
      const turn=a.pose((a.leg.start+a.leg.end)/2,view);
      assert.ok(Math.abs(turn.yaw-Math.PI/2)<1e-10);sawTurn=true;
    }
  }
  assert.ok(divergent&&sawTurn);
  assert.deepEqual([...maneuvers].sort(),['climb','descend','forward','hover','reverse','turn']);
});

test('black hawk meshes and hang points remain finite and inside the viewport across all patrol poses',()=>{
  let drawn=0;
  const ctx=new Proxy({},{
    get:(_,key)=>(...args)=>{if(key==='fill')drawn++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},
    set:()=>true,
  });
  for(const [w,h] of [[1440,900],[390,844],[844,390],[844,220]]){
    const view=viewMetrics(w,h),pilot=new BlackHawkPilot(()=>.37);
    for(let t=BLACK_HAWK_ENTRY_DURATION;t<38;t+=.3){
      pilot.advance(t);const frame=pilot.pose(t,view);
      drawBlackHawk(ctx,frame,t<4);
      for(const p of blackHawkMounts(frame))assert.ok(p.x>=0&&p.x<=w&&p.y>=0&&p.y<=h);
    }
  }
  assert.ok(drawn>0);
});

test('level six runs the flight on the scene clock and keeps the final round untimed and unscored',()=>{
  const game=new GameModel(()=>.5);
  game.start('man-6');
  const initial=game.blackHawkState;
  assert.ok(initial&&game.shield.enabled&&game.cannon.enabled&&game.volcanoState.enabled);
  assert.equal(initial.mode,'entry');assert.ok(initial.x<0);
  game.step(BLACK_HAWK_ENTRY_DURATION*.75);
  assert.equal(game.blackHawkState.mode,'entry');assert.ok(game.blackHawkState.x>0);
  assert.equal(game.farmState.enabled,false);
  assert.equal(game.snapshot().scoreMeteorsEnabled,false);
  assert.equal(game.spawnMeteor(undefined,undefined,undefined,'score'),null);
  game.cuts=9;assert.equal(game.score,0);
  game.step(2.55);
  const moving=game.blackHawkState;
  assert.notDeepEqual(moving,initial);
  game.status='paused';game.step(30);assert.deepEqual(game.blackHawkState,moving);
  game.status='playing';game.blackHawk.nextSkillAt=Infinity;game.step(180);
  assert.equal(game.status,'playing');assert.equal(game.remaining,Infinity);
  game.start('man-6');assert.deepEqual(game.blackHawkState,initial);
  game.start('man-5');assert.equal(game.blackHawkState,null);assert.equal(game.remaining,300);
});

function bossGame(weapon='cannon'){
  const g=new GameModel(()=>.5);g.setWeapon(weapon);g.start('man-6');
  g.step(BLACK_HAWK_PATROL_START+.02);return g;
}

test('the boss winds up and launches exactly eight separate offscreen bombs without pulsing the radar',()=>{
  const g=bossGame(),{windup,count,interval,spacing,speed}=BLACK_HAWK_BOMB_SKILL;
  const due=g.blackHawk.nextSkillAt;
  g.step(due-g.sceneTime-.03);
  assert.equal(g.blackHawkState.skillAge,null);
  g.step(.51);
  const frame=g.blackHawkState,patrol=g.blackHawk.pilot.pose(g.sceneTime,g.view);
  assert.ok(frame.skillAge>.4&&frame.skillAge<windup);
  assert.ok(Math.hypot(frame.yaw-patrol.yaw,frame.pitch-patrol.pitch,frame.bank-patrol.bank)>.02);
  assert.equal(g.meteors.length,0);
  g.status='paused';g.step(20);assert.equal(g.blackHawkState.skillAge,frame.skillAge);g.status='playing';
  const start=g.blackHawk.skill.start;
  assert.equal(windup,2);assert.equal(speed,150);
  g.step(start+windup-g.sceneTime-.02);
  assert.equal(g.meteors.length,0);
  g.step(windup+count*interval);
  const launches=g.drainEvents().filter(e=>e.type==='summon');
  assert.equal(launches.length,8);
  assert.ok(launches[0].sceneTime-start>=windup&&launches[0].sceneTime-start<windup+.02);
  for(const [i,event] of launches.entries()){
    assert.equal(event.meteor.kind,'bomb');assert.equal(event.meteor.source,'boss');assert.equal(event.meteor.vy,speed);
    const point=meteorView(event.meteor,g.view);
    assert.ok(point.y+point.ry<0);
    if(i){
      const previous=launches[i-1];
      assert.ok(Math.abs(event.sceneTime-previous.sceneTime-interval)<.02);
      assert.equal(Math.abs(event.x-previous.x),spacing);
    }
  }
  assert.equal(g.blackHawkState.skillAge,null);
  assert.equal(g.summonPulse,-10);
  assert.equal(g.summonWaves,0);
});

test('the editor schedules a single full skill after entry and can bypass the cooldown again',()=>{
  const {windup,count,interval}=BLACK_HAWK_BOMB_SKILL;
  const g=new GameModel(()=>.5);g.start('man-6');
  assert.equal(g.requestBlackHawkSkill(),true);
  assert.equal(g.requestBlackHawkSkill(),false);
  g.step(BLACK_HAWK_ENTRY_DURATION-.03);
  assert.equal(g.blackHawkState.skillAge,null);
  g.step(.08);assert.ok(g.blackHawkState.skillAge!==null);
  assert.equal(g.requestBlackHawkSkill(),false);
  g.step(windup+(count-1)*interval+.1);
  assert.equal(g.drainEvents().filter(e=>e.type==='summon'&&e.meteor.source==='boss').length,8);
  assert.equal(g.requestBlackHawkSkill(),true);
  g.blackHawk.staggeredAt=g.sceneTime;
  g.step(1.5);
  assert.equal(g.blackHawkState.skillAge,null);
  assert.equal(g.requestBlackHawkSkill(),false);
  assert.ok(!g.drainEvents().some(e=>e.type==='summon'));
  g.start('man-5');
  assert.equal(g.requestBlackHawkSkill(),false);
});

test('the next cast waits eight seconds after the last boss bomblets are gone',()=>{
  const g=bossGame(),{windup,count,interval,cooldown}=BLACK_HAWK_BOMB_SKILL;
  g.requestBlackHawkSkill();g.step(windup+(count-1)*interval+.06);
  assert.equal(g.blackHawk.nextSkillAt,null);
  g.explodeBomb(g.meteors.at(-1));g.meteors=[];
  g.step(.15);
  assert.ok(g.bomblets.length&&g.bomblets.every(c=>c.source==='boss'));
  assert.equal(g.blackHawk.nextSkillAt,null);
  for(let i=0;i<70&&g.bomblets.length;i++)g.step(.10);
  assert.equal(g.bomblets.length,0);
  const due=g.blackHawk.nextSkillAt;
  assert.equal(cooldown,8);
  assert.ok(due-g.sceneTime>cooldown-.11&&due-g.sceneTime<=cooldown);
  g.step(due-g.sceneTime-.02);assert.equal(g.blackHawkState.skillAge,null);
  g.step(.05);assert.equal(g.blackHawkState.skillKind,'elbow');
});

test('the right-to-left elbow sweep knocks radar workers into normal flight once and leaves ground staff alone',()=>{
  for(const [width,height] of [[1440,900],[390,844],[844,390]]){
    const g=bossGame();g.setViewport(width,height);
    const work=[
      {type:'dish',x:65,y:0},
      {type:'antenna',x:-12,y:-76},
      {type:'tower',x:14,y:-24},
      {type:'ground',x:0,y:0},
    ].map(anchor=>{
      const workAnchor={...anchor,facility:'radar'},spot=radarWorldPoint(workAnchor,CONFIG.ground,g.radarScale);
      return {id:g.nextId++,state:'work',workAnchor,workX:spot.x,x:spot.x,y:spot.y-16,onRadar:anchor.type!=='ground',
        size:64,birthSize:64,born:-10,part:1,variantId:1,phase:0,hunger:100,landed:true};
    });
    g.people=work;
    assert.equal(g.requestBlackHawkSkill('elbow'),true);
    assert.equal(g.requestBlackHawkSkill('bomb'),false);
    const {windup,thrust}=BLACK_HAWK_ELBOW_SKILL;
    const entry=elbowFrame(windup,g.view,g.ground,g.radarScale),end=elbowFrame(windup+thrust,g.view,g.ground,g.radarScale);
    assert.ok(entry.x>width&&end.x<entry.x);
    g.step(windup-.02);assert.ok(work.every(p=>p.state==='work'));
    g.step(thrust+.04);
    assert.equal(g.blackHawkState.skillKind,'elbow');
    for(const p of work.slice(0,3)){
      assert.equal(p.state,'fall');
      assert.ok(p.vx<0&&p.vy<0&&!p.onRadar&&p.noTrail);
      assert.ok(-p.vx*Math.exp(1.6*(g.sceneTime-p.elbowLaunchAt))>=509);
    }
    assert.equal(work[3].state,'work');
    assert.equal(g.deaths,0);
    const launches=work.slice(0,3).map(p=>p.elbowLaunchAt);
    g.step(ELBOW_DURATION-windup-thrust+.04);
    assert.equal(g.blackHawkState.skillKind,null);
    assert.deepEqual(work.slice(0,3).map(p=>p.elbowLaunchAt),launches);
    const impacts=g.drainEvents().filter(e=>e.type==='blackHawkElbowHit');
    assert.equal(impacts.length,1);
    const effects=new BlackHawkEffects();
    effects.event(impacts[0]);
    const time=impacts[0].sceneTime,kick=effects.shakeAt(time+.036,false);
    assert.ok(kick.x<-9&&kick.y===0);
    assert.deepEqual(effects.shakeAt(time+.036,true),{x:0,y:0});
    assert.deepEqual(effects.shakeAt(time+.4,false),{x:0,y:0});
    assert.ok(g.blackHawk.nextSkillAt-g.sceneTime>7.8);
  }
});

function fallingMan(game,anchor){
  const p={id:game.nextId++,size:64,variantId:1,part:1,born:-1,state:'fall',hunger:100,landed:false,
    x:anchor.x/game.view.sx,y:0,vx:0,vy:8400/game.view.sy};
  p.y=(anchor.y-65-halfHeight(p)*(game.view.sy-game.view.character))/game.view.sy;
  game.people.push(p);
  return p;
}

test('swept capture chains airborne people in order and releases all eight on detach',()=>{
  const g=bossGame();
  const chain=[];
  for(let i=0;i<8;i++){
    const anchor=blackHawkMounts(g.blackHawkState)[0];
    const p=fallingMan(g,anchor);chain.push(p);
    g.step(1/60);
    if(i<7){
      assert.equal(p.state,'hawkMounted');
      assert.deepEqual(g.blackHawk.hooks[0].links,chain);
      assert.equal(g.blackHawkState.staggered,false);
    }
    if(i===1){
      g.step(.55);
      assert.ok(chain[1].y>chain[0].y);
      g.recall();assert.ok(chain.every(member=>member.state==='hawkMounted'));
      g.toggleCannon();assert.ok(chain.every(member=>!member.cannonDraft));
    }
  }
  assert.ok(g.blackHawkState.staggered&&g.blackHawkState.detached[0]);
  assert.equal(g.blackHawk.hooks[0].links.length,0);
  assert.ok(chain.every(p=>p.state==='fall'&&!p.hawkLink));
  assert.equal(g.drainEvents().filter(e=>e.type==='blackHawkDetach').length,1);
  g.killPerson(chain[0],true);
  assert.equal(chain[0].state,'dead');
  g.step(5);
  assert.ok(chain.every(p=>p.state!=='fall'));
});

test('the expanded hook catches at its new edge, removes only the caught trail and protects the mounted person',()=>{
  const g=bossGame();
  const anchor=blackHawkMounts(g.blackHawkState)[0];
  const p=fallingMan(g,{...anchor,x:anchor.x+anchor.radius+2});
  const trails=new FlameTracks(),other=g.spawnMeteor(130,40,1,'man');
  trails.sync(g);assert.ok(trails.trails.has(p.id));
  g.step(1/60);
  assert.equal(p.state,'hawkMounted');
  for(const e of g.drainEvents())trails.event(e,g);
  trails.sync(g);
  assert.equal(trails.trails.has(p.id),false);
  assert.ok(trails.trails.has(other.id));
  const q=personView(p,g.view,g.ground,g.sceneTime);
  const hit=g.spawnMeteor(q.x/g.view.sx,q.y/g.view.sy,1,'man');
  g.sweepMeteor(hit,hit);
  g.blastPeople(q.x,q.y,0);
  g.killPerson(p,false);
  assert.equal(p.state,'hawkMounted');
  assert.equal(g.deaths,0);
});

test('projectile sweeps trigger a dodge with afterimages and patrol continues from the new position',()=>{
  const g=bossGame();
  const startX=g.blackHawkState.x,hit=blackHawkTargets(g.blackHawkState)[0];
  const bullet={id:1,x:hit.x/g.view.sx,y:(hit.y+65)/g.view.sy,vx:0,vy:-8300/g.view.sy,age:0};
  g.cannon.bullets.push(bullet);
  g.step(1/60);
  assert.ok(g.blackHawkState.dodging&&bullet.hawkThreat);
  assert.ok(g.cannon.bullets.includes(bullet));
  g.step(.13);
  assert.ok(Math.abs(g.blackHawkState.x-startX)>50);
  assert.equal(g.blackHawk.ghosts(g.sceneTime,g.view,false).length,2);
  assert.equal(g.blackHawk.ghosts(g.sceneTime,g.view,true).length,0);
  const dodge=g.blackHawk.dodge.leg;
  g.step(dodge.end-g.sceneTime+.06);
  assert.equal(g.blackHawkState.dodging,false);
  assert.equal(g.blackHawk.pilot.leg,dodge.exit);
  assert.ok(g.blackHawkState.x>=dodge.to.x*g.view.width);
  assert.ok(g.blackHawkState.x>startX);
  assert.ok(Math.hypot(g.blackHawkState.vx,g.blackHawkState.vy)>0);
});

test('dodging between moving patrol legs matches position, velocity and pose at both boundaries',()=>{
  const pilot=new BlackHawkPilot(()=>.13),view=viewMetrics();
  let start=BLACK_HAWK_PATROL_START;
  for(;start<30;start+=.03){
    pilot.advance(start);
    const {vx,vy}=pilot.sample(start);
    if(Math.hypot(vx,vy)>.1)break;
  }
  assert.ok(start<30);
  const entry=pilot.pose(start,view);
  const leg=pilot.dodge(start,entry.x/view.width<.5?.12:-.12,.04);
  const active=pilot.pose(start,view);
  for(const key of ['x','y','vx','vy','pitch','bank','yaw'])assert.equal(active[key],entry[key]);
  const epsilon=1e-5;
  for(let time=start+.01;time<leg.end-.01;time+=.01){
    const before=pilot.sample(time-epsilon),current=pilot.sample(time),after=pilot.sample(time+epsilon);
    assert.ok(Math.abs((after.x-before.x)/(2*epsilon)-current.vx)<1e-5);
    assert.ok(Math.abs((after.y-before.y)/(2*epsilon)-current.vy)<1e-5);
  }
  const end=pilot.pose(leg.end,view);
  pilot.advance(leg.end);
  const resumed=pilot.pose(leg.end,view);
  for(const key of ['x','y','vx','vy','pitch','bank','yaw'])assert.ok(Math.abs(resumed[key]-end[key])<1e-10);
  assert.ok(Math.hypot(resumed.vx,resumed.vy)>.001);
});

test('the patrol can keep moving at either horizontal dodge boundary',()=>{
  for(const direction of [-1,1]){
    const pilot=new BlackHawkPilot(()=>.5);
    pilot.advance(BLACK_HAWK_PATROL_START);
    const leg=pilot.dodge(BLACK_HAWK_PATROL_START,direction*.5,.03);
    pilot.advance(leg.end);
    const resumed=pilot.sample(leg.end);
    assert.equal(resumed.x,leg.to.x);
    assert.equal(resumed.vx,0);
    assert.ok(Math.abs(resumed.vy)>.001);
  }
});

test('an active laser ray can trigger one dodge and moving the viewport keeps chains attached',()=>{
  const g=bossGame('laser');
  const anchor=blackHawkMounts(g.blackHawkState)[0],p=fallingMan(g,anchor);
  g.step(1/60);assert.equal(p.state,'hawkMounted');g.step(.4);
  const target=blackHawkTargets(g.blackHawkState)[0];
  g.toggleCannon();g.aimCannon(target.x,target.y);g.cannon.trigger=true;g.cannon.charge=.999;
  g.step(.035);
  assert.ok(g.blackHawkState.dodging);
  const started=g.blackHawk.dodge.time;
  g.step(.86);assert.equal(g.blackHawk.dodge.time,started);
  assert.ok(Math.abs(p.hawkLink.angle)>.005);
  g.setViewport(390,844);
  const moved=blackHawkMounts(g.blackHawkState)[0];
  assert.ok(Math.hypot(p.x*g.view.sx-moved.x,p.y*g.view.sy-moved.y)<40);
  g.start('man-6');assert.equal(g.blackHawk.hooks[0].links.length,0);
});

function fillHook(game,index){
  for(let i=0;i<8;i++){
    fallingMan(game,blackHawkMounts(game.blackHawkState)[index]);
    game.step(1/60);
  }
  assert.ok(game.blackHawkState.staggered);
}

function slashHull(game,strokeId){
  const target=blackHawkTargets(game.blackHawkState)[0],v=game.view;
  const from={x:(target.x-target.rx-35)/v.sx,y:target.y/v.sy};
  const to={x:(target.x+target.rx+35)/v.sx,y:target.y/v.sy};
  game.slice(from,to,3,null,{strokeId});
}

test('only staggered hits lower the yellow-trailed health, with three executions and a delayed final win',()=>{
  const g=bossGame();
  slashHull(g,1);assert.equal(g.blackHawkState.health,BLACK_HAWK_MAX_HEALTH);
  for(let phase=0;phase<3;phase++){
    fillHook(g,phase);
    const initialHealth=BLACK_HAWK_MAX_HEALTH-phase*BLACK_HAWK_STAGE_HEALTH;
    slashHull(g,phase*100+2);
    assert.equal(g.blackHawkState.health,initialHealth-10);
    assert.equal(g.blackHawkState.trailHealth,initialHealth);
    g.step(.12);
    assert.ok(g.blackHawk.camera(g.sceneTime,g.view,false).zoom>1);
    assert.ok(g.blackHawk.camera(g.sceneTime,g.view,false).dx>0);
    for(let i=0;i<47;i++){slashHull(g,phase*100+3+i);g.step(.1);}
    assert.ok(!g.blackHawk.finisher);
    slashHull(g,phase*100+50);g.step(.1);
    const finish=g.drainEvents().find(e=>e.type==='blackHawkFinish');
    if(phase===1)assert.equal(g.nuclearState.phase,'idle');
    assert.equal(finish?.points.length,phase===2?undefined:3);
    assert.equal(g.blackHawkState.health,initialHealth-BLACK_HAWK_STAGE_HEALTH);
    slashHull(g,phase*100+9);assert.equal(g.blackHawkState.health,initialHealth-BLACK_HAWK_STAGE_HEALTH);
    assert.equal(g.status,'playing');
    if(phase<2){
      g.step(.65);
      assert.equal(g.blackHawkState.staggered,false);
      slashHull(g,phase*100+9);assert.equal(g.blackHawkState.health,initialHealth-BLACK_HAWK_STAGE_HEALTH);
    }else{
      g.step(.12);
      assert.equal(g.status,'playing');
      g.step(.04);
      assert.equal(g.status,'ended');
      assert.equal(g.blackHawkState.destroyed,true);
      const events=g.drainEvents();
      assert.deepEqual(events.map(e=>e.type),['blackHawkCrash','end']);
      assert.equal(events[1].bossDefeated,true);
    }
  }
});

test('the editor ends the fight through a ground crash and settlement waits for the cap to clear',()=>{
  for(const [width,height] of [[1440,900],[390,844],[844,390]]){
    const g=new GameModel(()=>.5),effects=new BlackHawkEffects(),ending=new RoundEnding();
    g.start('man-5');assert.equal(g.requestBlackHawkDeath(),false);
    g.start('man-6');g.setViewport(width,height);
    assert.equal(g.requestBlackHawkDeath(),false);
    g.step(BLACK_HAWK_ENTRY_DURATION+.04);
    const before=g.blackHawkState;
    assert.equal(g.requestBlackHawkDeath(),true);
    assert.equal(g.requestBlackHawkDeath(),false);
    assert.equal(g.blackHawkState.health,0);
    assert.equal(g.status,'ended');
    const events=g.drainEvents().slice(-2);
    assert.deepEqual(events.map(e=>e.type),['blackHawkCrash','end']);
    events.forEach(e=>effects.event(e));
    const {time,breakAt,end,pieces}=effects.finale;
    const pose=at=>effects.crashFrame(at,g.view,before.scale),nearGround=pose(breakAt-1e-5);
    assert.equal(pose(time).y,before.y);
    assert.ok(pose(time+.6).y>pose(time+.3).y);
    assert.ok(Math.abs(nearGround.y+blackHawkHullBottom(nearGround)-CONFIG.ground*g.view.sy)<.1);
    assert.equal(pose(breakAt),null);
    assert.ok(pieces.every(p=>p.start>=breakAt&&p.vy<-700&&p.start+p.fall+.38<end));
    assert.ok(pieces.some(p=>p.vx<0)&&pieces.some(p=>p.vx>0));
    const shake=age=>effects.crashShakeAt(breakAt+age,false,g.view.art);
    assert.equal(shake(-.001),null);
    assert.ok(shake(.028).y>=40&&shake(.12).y<0);
    assert.equal(shake(.73),null);
    assert.equal(effects.crashShakeAt(breakAt+.028,true,g.view.art),null);
    assert.ok(Math.abs(end-breakAt-CRASH_CLOUD_LIFE)<1e-9);
    ending.start(g,false,effects.victoryDelay(g.sceneTime));
    assert.equal(ending.step(breakAt-time+.5),false);
    assert.equal(ending.step(CRASH_CLOUD_LIFE-.51),false);
    assert.equal(ending.step(.011),true);
  }
});

test('the second execution schedules a fifteen-second warning and a centered drop from the helicopter',()=>{
  for(const [width,height,staggered] of [[1440,900,false],[390,844,true]]){
    const g=bossGame();g.setViewport(width,height);
    fillHook(g,0);g.blackHawk.health=2*BLACK_HAWK_STAGE_HEALTH+10;slashHull(g,1);g.step(.72);
    fillHook(g,1);g.blackHawk.health=BLACK_HAWK_STAGE_HEALTH+10;slashHull(g,2);
    g.step(.69);assert.equal(g.blackHawkNuclearAt,null);assert.equal(g.nuclearState.phase,'idle');
    g.step(.03);
    const due=g.blackHawkNuclearAt;
    assert.ok(due-g.realTime>BOSS_NUCLEAR_RULES.delay-.04);
    assert.ok(due-g.realTime<=BOSS_NUCLEAR_RULES.delay);
    g.people=[];
    g.blackHawk.nextSkillAt=Infinity;
    const until=time=>g.step(time-g.realTime);
    until(due-.02);assert.equal(g.nuclearState.phase,'idle');
    g.status='paused';g.step(20);assert.equal(g.nuclearState.phase,'idle');g.status='playing';
    until(due+.004);
    const warning=g.nuclearState;
    assert.equal(warning.reason,'blackHawk');assert.equal(warning.warningAt,due);
    assert.equal(warning.countdownAt-warning.warningAt,15);
    assert.ok(g.drainEvents().some(e=>e.type==='nuclearWarning'&&e.serial===warning.serial));
    if(staggered){fillHook(g,2);g.people=[];}
    until(warning.launchAt-1);
    assert.equal(g.blackHawkState.mode,'nuclearApproach');
    assert.equal(g.blackHawkState.staggered,staggered);
    until(warning.launchAt-.01);
    const frame=g.blackHawkState,belly=blackHawkProjector(frame)([0,21,0]);
    assert.ok(Math.abs(frame.x-width/2)<6);
    assert.equal(g.nuclearState.bomb,null);
    until(warning.launchAt+.01);
    const bomb=g.nuclearState.bomb;
    assert.ok(bomb&&g.nuclearState.phase==='falling');
    assert.ok(Math.abs(bomb.x*g.view.sx-belly.x)<4);
    assert.ok(Math.abs(bomb.fromY*g.view.sy-NUCLEAR_RULES.bombHeight*nuclearBombScale(g.view)/2-belly.y)<4);
    assert.equal(g.blackHawk.nuclearFlight,null);
    g.step(2);assert.equal(g.nuclearState.explosions,1);assert.equal(g.foodHealth,60);
  }
});

test('a cannon hit from below is consumed by the hull and banks the staggered aircraft inward',()=>{
  const g=bossGame();fillHook(g,0);
  const v=g.view,target=blackHawkTargets(g.blackHawkState)[0],at=g.sceneTime+1/60+.08;
  const before=g.blackHawk.pose(at,v,false).bank;
  const bullet={id:1,x:target.x/v.sx,y:(target.y+65)/v.sy,vx:0,vy:-8300/v.sy,age:0};
  g.cannon.bullets.push(bullet);
  g.step(1/60);
  assert.equal(g.blackHawkState.health,BLACK_HAWK_MAX_HEALTH-48);
  assert.ok(!g.cannon.bullets.includes(bullet));
  assert.ok(g.blackHawk.pose(at,v,false).bank<before-.1);
  const hit=g.drainEvents().find(e=>e.type==='blackHawkHit');
  assert.equal(hit.source,'cannon');assert.ok(hit.dy<0);
});

test('a held laser damages the staggered hull at intervals',()=>{
  const g=bossGame('laser');fillHook(g,0);
  const target=blackHawkTargets(g.blackHawkState)[0];
  g.toggleCannon();g.aimCannon(target.x,target.y);g.cannon.trigger=true;g.cannon.charge=.999;
  g.step(.04);assert.equal(g.blackHawkState.health,BLACK_HAWK_MAX_HEALTH-24);
  g.step(.10);assert.equal(g.blackHawkState.health,BLACK_HAWK_MAX_HEALTH-24);
  g.step(.15);assert.equal(g.blackHawkState.health,BLACK_HAWK_MAX_HEALTH-48);
});
