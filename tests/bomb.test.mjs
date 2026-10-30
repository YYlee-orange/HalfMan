import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GameModel,CONFIG} from '../dist/engine.js';
import {SIZE_LEVELS,halfHeight} from '../dist/variants.js';
import {CUT,CUT_DEFAULTS,applyCutSettings,sanitizeCutSettings,cutSettingsFromDraft} from '../dist/cut-settings.js';
import {BOMB_DEFAULTS,BOMB_FIELDS} from '../dist/bomb-settings.js';
import {BOMB_GLYPH} from '../dist/bomb-metrics.js';
import {bombChargeAt,bombletView,advanceBomblet} from '../dist/bomb-physics.js';
import {meteorView,personView} from '../dist/body-geometry.js';
import {FlameTracks} from '../dist/flames.js';
import {bombDebris,bombDebrisAt,makeBombBurst,bombBurstDuration} from '../dist/bomb-fx.js';
const game=()=>{const g=new GameModel(()=>.5);g.start();g.drainEvents();return g;};
const bomb=(g,x=700,y=260)=>g.spawnMeteor(x,y,undefined,'bomb');
const arm=(g,m)=>g.slice({x:m.x-100,y:m.y},{x:m.x+100,y:m.y});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function victim(g,state,extra={}){
  const p={id:g.nextId++,part:1,variantId:1,x:700,y:300,size:64,birthSize:64,born:-10,landed:false,
    vx:0,vy:0,state,hunger:100,phase:0,workX:700,foodX:700,...extra};g.people.push(p);return p;
}

test('bomb outline partitions the real YaHei glyph into six complete, disjoint contour groups',()=>{
  const asset=JSON.parse(fs.readFileSync(new URL('../dist/assets/bomb-glyph.json',import.meta.url),'utf8'));
  assert.equal(asset.text,'慢！');assert.equal(asset.fontFamily,'Microsoft YaHei');assert.equal(asset.fontStyle,'Regular');
  assert.deepEqual(asset.parts.map(p=>p.label),['忄','日','罒','又','！竖笔','！圆点']);
  assert.equal(asset.path,asset.parts.map(p=>p.path).join(''));assert.equal(asset.parts.reduce((n,p)=>n+p.contours,0),13);
  assert.ok(asset.parts.every((p,i)=>p.path.length>20&&p.id===i&&p.width>0&&p.height>0));
  close(BOMB_GLYPH.ratio,asset.width/asset.height);assert.equal(asset.fontSha256.length,64);
});

test('five percent boundary is exact, forced normal preserves the 27-variant bag, bomb size and tone stay fixed',()=>{
  let roll=.049999;const g=new GameModel(()=>roll);g.start();
  assert.equal(g.spawnMeteor(700,100).kind,'bomb');roll=.05;assert.equal(g.spawnMeteor(700,100).kind,'man');
  roll=.9;assert.equal(g.spawnMeteor(700,100).kind,'man');
  try{
    applyCutSettings({bombChance:1},{persist:false});assert.equal(g.spawnMeteor(700,100).kind,'bomb');
    assert.equal(g.spawnMeteor(700,100,undefined,'man').kind,'man');
    applyCutSettings({bombChance:0},{persist:false});assert.equal(g.spawnMeteor(700,100).kind,'man');
    for(let i=0;i<10;i++){const m=bomb(g);assert.equal(m.tone,0);assert.equal(m.size,CONFIG.meteorSize*SIZE_LEVELS.at(-1));}
  }finally{applyCutSettings(CUT_DEFAULTS,{persist:false});}
});

test('whole bomb including punctuation spawns outside every supported screen with an ordinary flame',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,220]]){
    const g=game();g.setViewport(w,h);const m=g.spawnMeteor(undefined,undefined,undefined,'bomb'),q=meteorView(m,g.view),fx=new FlameTracks();
    assert.ok(q.y+q.ry<0);for(const e of g.drainEvents())fx.event(e,g);fx.sync(g);
    const trail=fx.trails.get(m.id);assert.equal(trail.kind,'meteor');assert.equal(trail.palette,undefined);assert.equal(trail.ratio,BOMB_GLYPH.ratio);
  }
});

test('swipe freezes only the bomb, circle expands then contracts and brightens, score drops once and six parts launch',()=>{
  const g=game(),m=bomb(g),position={x:m.x,y:m.y};g.cuts=12;
  assert.deepEqual(arm(g,m),[]);const armed=g.drainEvents().filter(e=>e.type==='bombArm');assert.equal(armed.length,1);
  g.step(.1);assert.equal(m.x,position.x);assert.equal(m.y,position.y);assert.equal(g.people.length,0);assert.equal(g.cuts,12);
  const a=bombChargeAt(m,g.realTime);assert.ok(a.radius>0&&a.expand<1&&a.contract===0);
  arm(g,m);assert.ok(!g.drainEvents().some(e=>e.type==='bombArm'));
  g.step(.08);const wide=bombChargeAt(m,g.realTime);close(wide.radius,CUT.bombChargeRadius);
  g.step(.1);const shrink=bombChargeAt(m,g.realTime);assert.ok(shrink.radius<wide.radius&&shrink.brightness>0);
  g.status='paused';g.step(10);close(g.realTime,.28);assert.equal(g.bomblets.length,0);g.status='playing';g.step(.14);
  assert.equal(g.meteors.length,0);assert.equal(g.bomblets.length,6);assert.equal(g.score,700);assert.equal(g.bombPenalty,500);
  assert.equal(g.bombExplosions,1);assert.deepEqual(g.bomblets.map(c=>c.part),[0,1,2,3,4,5]);
  assert.equal(new Set(g.bomblets.map(c=>c.id)).size,6);assert.equal(g.drainEvents().filter(e=>e.type==='bombBurst').length,1);
  g.step(.01);assert.equal(g.bombPenalty,500);assert.equal(g.people.length,0);
});

test('uncut landing follows normal impact without a bomb detonation, split, or score penalty',()=>{
  const g=game(),m=bomb(g,700,CONFIG.ground-20);g.cuts=8;g.step(.1);
  const events=g.drainEvents();assert.ok(events.some(e=>e.type==='impact'&&e.id===m.id));
  assert.ok(!events.some(e=>e.type==='bombBurst'));assert.equal(g.bomblets.length,0);assert.equal(g.bombPenalty,0);assert.equal(g.score,800);
});

test('penalty is capped by the current score and children cannot be sliced or generate people',()=>{
  const g=game();g.cuts=2;const m=bomb(g);arm(g,m);g.step(.5);
  assert.equal(g.score,0);assert.equal(g.bombPenalty,200);assert.equal(g.cuts,2);
  const before=g.bomblets.length;for(const c of g.bomblets)g.slice({x:c.x-100,y:c.y},{x:c.x+100,y:c.y});
  assert.equal(g.bomblets.length,before);assert.equal(g.people.length,0);assert.equal(g.cuts,2);
  const normal=g.spawnMeteor(300,100,1);g.slice({x:normal.x-80,y:normal.y},{x:normal.x+80,y:normal.y});assert.equal(g.score,110,'zero score does not create future debt');
});

test('child sweep kills falling, jumping, mounted and walking people while shelter stays safe on narrow screens',()=>{
  for(const [width,height]of [[1440,810],[390,844],[844,220]])for(const state of ['fall','jump','work','eat','toWork','sheltered']){
    const g=game();g.setViewport(width,height);const m=bomb(g);arm(g,m);g.step(.5);const c=g.bomblets[1];g.bomblets=[c];
    const p=victim(g,state);
    if(state==='jump'){p.state='toWork';p.y=CONFIG.ground-halfHeight(p);p.landed=true;g.jumpPerson(p,760,CONFIG.ground-140,'work',{duration:1});g.step(.2);}
    if(state==='work'){p.onRadar=true;p.workAnchor={type:'antenna',x:-12,y:-76};p.landed=true;}
    if(state==='eat'){p.onFood=true;p.foodAnchor={facility:'food',type:'rim',x:52,y:-60};p.landed=true;p.hunger=30;}
    if(state==='toWork'){p.landed=true;p.y=CONFIG.ground-halfHeight(p);}
    const q=personView(p,g.view,CONFIG.ground,g.sceneTime,g.radarPose());
    c.x=q.x/g.view.sx;c.y=(q.y-160)/g.view.sy;c.vx=0;c.vy=2400/g.view.sy;
    g.step(.08);assert.equal(g.deaths,state==='sheltered'?0:1,`${width} ${height} ${state}`);
  }
});

test('child ground blast kills nearby people, spares distant and sheltered people, and ends the blue trail',()=>{
  const g=game(),fx=new FlameTracks(),m=bomb(g);arm(g,m);g.step(.5);const c=g.bomblets[0];g.bomblets=[c];
  for(const e of g.drainEvents())fx.event(e,g);fx.sync(g);assert.equal(fx.trails.get(c.id).palette,'blue');
  const near=victim(g,'toWork',{x:730,y:CONFIG.ground-halfHeight({size:64,variantId:1}),landed:true});
  const far=victim(g,'toWork',{x:1000,y:CONFIG.ground-20,landed:true});victim(g,'sheltered',{x:700});
  c.x=700;c.y=CONFIG.ground-5;c.vy=100;c.vx=0;g.step(.04);
  const events=g.drainEvents();for(const e of events)fx.event(e,g);fx.sync(g);
  assert.equal(near.state,'dead');assert.equal(far.state,'toWork');assert.equal(g.sheltered,1);
  const impact=events.find(e=>e.type==='bombletImpact');assert.ok(impact);assert.equal(impact.y,CONFIG.ground);assert.equal(impact.radius,78);
  assert.equal(fx.trails.get(c.id).reason,'landing');assert.equal(g.bomblets.length,0);
});

test('fragment motion is frame independent, reduced motion suppresses only decorative spin, debris reaches ground',()=>{
  const a={x:0,y:0,vx:300,vy:-50,angle:0,spin:5},b={...a},c={...a};advanceBomblet(a,1);
  for(let i=0;i<60;i++)advanceBomblet(b,1/60);close(a.x,b.x);close(a.y,b.y);close(a.angle,b.angle);
  advanceBomblet(c,1,true);close(c.x,a.x);close(c.y,a.y);assert.equal(c.angle,0);
  for(const p of bombDebris(17,80,480,8)){
    const end=(Math.sqrt(p.vy*p.vy+2*900*600)-p.vy)/900;
    assert.ok(bombDebrisAt(p,end-1e-6,600,900));assert.equal(bombDebrisAt(p,end+1e-6,600,900),null);
  }
  const burst=makeBombBurst({type:'bombBurst',id:1,x:700,y:300,sceneTime:0});assert.ok(bombBurstDuration(burst,game().view,CONFIG.ground)>.5);
});

test('old parameter files gain bomb defaults, all bomb parameters are bounded, reset clears the whole hazard state',()=>{
  const old=cutSettingsFromDraft({version:1,defaultsRevision:1,values:{normalBase:6}});assert.equal(old.normalBase,6);
  for(const f of BOMB_FIELDS)assert.equal(old[f.key],BOMB_DEFAULTS[f.key]);
  const extreme=sanitizeCutSettings(Object.fromEntries(BOMB_FIELDS.map(f=>[f.key,f.max+1000])));
  for(const f of BOMB_FIELDS)assert.equal(extreme[f.key],f.max);
  const g=game(),m=bomb(g);g.cuts=8;arm(g,m);g.step(.5);assert.ok(g.bomblets.length);g.reset();
  assert.equal(g.bomblets.length,0);assert.equal(g.bombPenalty,0);assert.equal(g.bombExplosions,0);assert.equal(g.score,0);
});
