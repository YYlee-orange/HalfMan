import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {VARIANTS,halfHeight} from '../dist/variants.js';
import {meteorView,personView,viewMetrics} from '../dist/body-geometry.js';
import {FlameTracks} from '../dist/flames.js';
import {plumeRadius,plumePath,drawPlume} from '../dist/fire.js';
import {airHitBurst,airHitFragments,airHitFragmentAt,fragmentLandingTime,strongestShake} from '../dist/fx-physics.js';
const game=()=>{const g=new GameModel(()=>.5);g.start();g.drainEvents();return g;};
function person(g,state,extra={}){
  const p={id:g.nextId++,part:1,variantId:19,size:64,birthSize:82,born:-10,x:700,y:300,vx:0,vy:0,
    landed:false,state,hunger:100,phase:0,workX:700,foodX:708,...extra};g.people.push(p);return p;
}
test('all 27 production meteors spawn completely above every supported viewport',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,200]]){
    const g=game();g.setViewport(w,h);
    for(const variant of VARIANTS){const m=g.spawnMeteor(undefined,undefined,variant.id),p=meteorView(m,g.view);assert.ok(p.y+p.ry<=-27.999);}
  }
});
test('swept collision hits falling, jumping and radar-mounted people but protects the shelter',()=>{
  for(const state of ['fall','jump','work','eat','sheltered']){
    const g=game(),p=person(g,state);
    if(state==='jump'){p.state='toWork';p.landed=true;p.y=CONFIG.ground-halfHeight(p);g.jumpPerson(p,750,CONFIG.ground-250,'work',{duration:1});g.step(.5);}
    if(state==='work'){p.onRadar=true;p.workAnchor={type:'antenna',x:-12,y:-88};p.landed=true;}
    if(state==='eat'){p.onFood=true;p.foodAnchor={facility:'food',type:'rim',x:52,y:-60};p.landed=true;p.hunger=40;}
    const q=personView(p,g.view,CONFIG.ground,g.sceneTime,g.radarPose());
    const m=g.spawnMeteor(q.x,q.y-140,1);m.vx=0;m.vy=2000;g.step(.06);
    if(state==='sheltered'){assert.equal(g.deaths,0);assert.equal(g.alive,1);}
    else{assert.equal(g.deaths,1,state);assert.ok(g.meteors.length,'aerial strike does not consume the meteor');assert.ok(g.drainEvents().some(e=>e.type==='death'&&e.person.state===state));}
  }
});
test('aerial collision uses the same screen geometry as mounted workers on narrow screens',()=>{
  for(const [w,h]of [[390,844],[844,220]]){
    const g=game();g.setViewport(w,h);const p=person(g,'work',{onRadar:true,landed:true,workAnchor:{type:'dish',x:-40,y:10}});
    const q=personView(p,g.view,CONFIG.ground,0,g.radarPose());
    const m=g.spawnMeteor(q.x/g.view.sx,0,1);m.y=(q.y-100-m.size*.5*(g.view.sy-g.view.character))/g.view.sy;m.vx=0;m.vy=2000/g.view.sy;
    g.step(.08);assert.equal(g.deaths,1,`${w}×${h}`);
  }
});
test('each aerial fragment stays ballistic and alive until it reaches the actual ground',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,200]]){
    const v=viewMetrics(w,h),b=airHitBurst(600,200,17,0,v,CONFIG.ground),pieces=airHitFragments(17);
    assert.ok(b.duration>.4,'does not expire on the old short timer');
    for(const piece of pieces){
      const end=fragmentLandingTime(piece,b.groundHeight),q=airHitFragmentAt(piece,end-1e-6,b.groundHeight);
      assert.ok(q);assert.ok(q.y<b.groundHeight);assert.ok(Math.abs(q.y-b.groundHeight)<.003);
      assert.equal(airHitFragmentAt(piece,end,b.groundHeight),null);assert.ok(end<=b.duration+1e-9);
      const a=airHitFragmentAt(piece,.05,b.groundHeight),c=airHitFragmentAt(piece,.1,b.groundHeight),d=airHitFragmentAt(piece,.15,b.groundHeight);
      assert.ok(Math.abs((d.y-c.y)-(c.y-a.y)-900*.05**2)<1e-8);
    }
  }
});
test('flame heads enclose complete glyphs, including the initial unrotated half size',()=>{
  for(const variant of VARIANTS){
    const v=viewMetrics(),size=82*variant.sizeScale,trail={kind:'meteor',size,ratio:variant.ratio,born:0};
    assert.ok(plumeRadius(trail,1,v)>=Math.hypot(size*variant.ratio/2,size/2));
    const child={kind:'man',size:64*variant.sizeScale,birthSize:size,ratio:variant.ratio,born:0};
    assert.ok(plumeRadius(child,0,v)>=Math.hypot(size*variant.ratio/4,size/2));
  }
});
test('production cut forks the live trail, then landing overlaps residual flame with a burst event',()=>{
  const g=game(),fx=new FlameTracks();
  const flush=()=>{for(const e of g.drainEvents())fx.event(e,g);fx.sync(g);};
  const m=g.spawnMeteor(700,300,19);flush();g.step(.1);flush();
  g.slice({x:m.x-100,y:m.y},{x:m.x+100,y:m.y});flush();
  assert.equal(fx.trails.size,3);assert.equal(fx.trails.get(m.id).reason,'split');
  const branches=[...fx.trails.values()].filter(t=>t.kind==='man');assert.equal(branches.length,2);
  assert.deepEqual(branches[0].points[0],branches[1].points[0]);
  let landed=0;
  for(let i=0;i<500&&!landed;i++){g.step(.01);const events=g.drainEvents();for(const e of events){fx.event(e,g);if(e.type==='land'){landed++;assert.equal(fx.trails.get(e.id).reason,'landing');}}fx.sync(g);}
  assert.ok(landed);
});

test('only man tails are halved about the head and faded fifteen percent, including landing',()=>{
  const project=(x,y)=>({x:x*2,y:y*3}),history=[{x:0,y:0},{x:12,y:22},{x:80,y:100}];
  for(const points of [history,[{x:79,y:99},{x:80,y:100}]]){
    const before=structuredClone(points),width=18,head=project(80,100);
    const normal=plumePath({kind:'man-before',points},project,width),man=plumePath({kind:'man',points},project,width);
    assert.equal(normal.length,man.length);
    for(let i=0;i<man.length;i++){
      assert.equal(man[i].x-head.x,(normal[i].x-head.x)/2);
      assert.equal(man[i].y-head.y,(normal[i].y-head.y)/2);
    }
    assert.deepEqual(points,before,'rendering never edits tracked physics/history');assert.deepEqual(man.at(-1),head);
  }
  for(const kind of ['meteor','bomblet']){
    assert.deepEqual(plumePath({kind,points:history},project,18),history.map(p=>project(p.x,p.y)));
  }
  const measure=(kind,ended)=>{
    const fills=[],ctx={globalAlpha:1,fill(){fills.push(this.globalAlpha);}};
    for(const name of ['save','restore','beginPath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','closePath','clip'])ctx[name]=()=>{};
    drawPlume(ctx,{kind,points:history,size:64,born:0,ratio:1,id:1,ended,reason:'landing'},1,project,{character:1});return fills;
  };
  assert.deepEqual(measure('meteor',null),[.50,.64]);assert.deepEqual(measure('bomblet',null),[.50,.64]);
  for(const ended of [null,.85]){
    const original=measure('meteor',ended),man=measure('man',ended);
    for(let i=0;i<2;i++)assert.ok(Math.abs(man[i]/original[i]-.85)<1e-12);
  }
  assert.deepEqual(measure('man',.5),[],'the original landing fade still completes');
});
test('preview impact shake uses finite renderer coordinates and does not sum simultaneous impacts',()=>{
  const event={type:'meteorLand',time:1},a=strongestShake([event],1.02),b=strongestShake([event,event],1.02);
  assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(Math.hypot(a.x,a.y)>1);assert.deepEqual(a,b);
  assert.deepEqual(strongestShake([event],1.02,true),{x:0,y:0});assert.deepEqual(strongestShake([event],2),{x:0,y:0});
});
