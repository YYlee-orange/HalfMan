import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG} from '../dist/engine.js';
import {RadarResponse,RADAR_RESPONSE,chooseWorkAnchor,radarWorldPoint,radarScreenPoint} from '../dist/radar.js';
import {chooseFoodAnchor,chooseSpacedAnchor,foodWorldPoint,foodScreenPoint} from '../dist/facilities.js';
import {personView,viewMetrics,radarFootView} from '../dist/body-geometry.js';
import {halfHeight} from '../dist/variants.js';
import {radioWaves,drawRadio,RADIO} from '../dist/fire.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(){const g=new GameModel(()=>.5);g.start();g.spawnMeteor(700,200,13);g.slice({x:600,y:200},{x:800,y:200});g.drainEvents();return g;}
function grounded(p,x,state){Object.assign(p,{x,y:CONFIG.ground-halfHeight(p),state,landed:true,cutMotion:false,born:-10,onRadar:false,onFood:false,hunger:20});}

test('radar phase never restarts under dense input; frequency and amplitude remain capped',()=>{
  const run=interval=>{
    const response=new RadarResponse();let maximum=0,lastPhase=0;
    for(let i=0;i<1440;i++){
      if(i%interval===0){const before=response.phase;response.trigger();if(i>1)close(response.phase,before);}
      response.step(1/240);const s=response.snapshot();
      assert.ok(s.frequency<=RADAR_RESPONSE.maxFrequency);assert.ok(s.amplitude<=RADAR_RESPONSE.maxAmplitude);
      assert.ok(Math.abs(s.press)<=RADAR_RESPONSE.maxAmplitude);assert.ok((s.phase-lastPhase)/(Math.PI*2)*240<=RADAR_RESPONSE.maxFrequency+1e-9);
      maximum=Math.max(maximum,s.amplitude);lastPhase=s.phase;
    }
    return{response,maximum};
  };
  const slow=run(80),fast=run(2);assert.ok(fast.maximum>slow.maximum+.5);
  for(let i=0;i<480;i++)fast.response.step(1/240);assert.ok(fast.response.amplitude<.001);
});

test('progress accounting stays exact when visual response saturates',()=>{
  const g=new GameModel(()=>.5);g.start();g.addCharge(1000);g.step(.1);
  assert.equal(g.meteors.length,10);assert.equal(g.charge,0);
  assert.equal(g.drainEvents().filter(e=>e.type==='radarProgress').length,100);
  assert.ok(g.radarPose().frequency<=3);assert.ok(g.radarPose().amplitude<=2.2);
  g.reducedMotion=true;assert.equal(g.radarPose().press,0);
});

test('destination selection avoids reserved neighbors and offers both ground and building positions',()=>{
  const picked=chooseSpacedAnchor(i=>({x:i}),[{x:0}],a=>({x:a.x,y:0}));assert.equal(picked.x,63);
  for(const [w,h]of [[1440,810],[390,844],[844,220]]){
    const v=viewMetrics(w,h),work=[],food=[];
    for(let i=0;i<32;i++){work.push(chooseWorkAnchor(()=>.5,work,v));food.push(chooseFoodAnchor(()=>.5,food,v));}
    assert.equal(new Set(work.map(a=>JSON.stringify(a))).size,32);assert.equal(new Set(food.map(a=>JSON.stringify(a))).size,32);
    assert.ok(work.some(a=>a.type==='ground')&&work.some(a=>a.type!=='ground'));
    assert.ok(food.some(a=>a.type==='ground')&&food.some(a=>a.type!=='ground'));
    for(const a of work){const p=radarScreenPoint(a,v,808);assert.ok(p.x>=24&&p.x<=w-24);}
  }
});

test('ground workers walk directly into work without a jump and still produce charge',()=>{
  const g=setup(),p=g.people[0];g.people=[p];p.workAnchor={facility:'radar',type:'ground',x:-90,y:0};
  p.workX=radarWorldPoint(p.workAnchor,808).x;grounded(p,p.workX,'toWork');g.step(.02);
  assert.equal(p.state,'work');assert.equal(p.onRadar,false);assert.ok(!g.drainEvents().some(e=>e.type==='jump'));
  const before=p.hunger;g.step(1);assert.ok(p.hunger<before);assert.ok(g.charge>0);
});

test('food supports direct ground eating and a jump onto the bowl, then an anchored jump down',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,220]]){
    const g=setup();g.setViewport(w,h);const [a,b]=g.people;
    a.foodAnchor={facility:'food',type:'ground',x:-100,y:0};b.foodAnchor={facility:'food',type:'rim',x:52,y:-60};
    for(const p of [a,b]){p.foodX=foodWorldPoint(p.foodAnchor,808).x;grounded(p,p.foodX,'toFood');}
    g.step(.02);assert.equal(a.state,'eat');assert.equal(a.onFood,false);assert.equal(b.state,'jump');
    const hunger=b.hunger;g.step(.2);assert.equal(b.hunger,hunger,'food only replenishes after reaching the bowl');
    g.step(1);assert.equal(b.state,'eat');assert.equal(b.onFood,true);
    const q=personView(b,g.view,808,g.sceneTime,g.radarPose()),foot=foodScreenPoint(b.foodAnchor,g.view,808,g.sceneTime);
    close(q.x,foot.x);close(q.y+halfHeight(b)*g.view.character,foot.y);
    const ground=personView(a,g.view,808,g.sceneTime,g.radarPose());close(ground.y+halfHeight(a)*g.view.character,808*g.view.sy);
    b.hunger=99.9;g.step(.02);assert.equal(b.state,'jump');assert.equal(b.jump.nextState,'toWork');assert.equal(b.jump.fromAnchor.facility,'food');
    g.step(1);assert.equal(b.state,'toWork');assert.equal(b.onFood,false);
  }
});

test('recall redirects an ascent continuously and evacuates bowl eaters to the unlimited shelter',()=>{
  const g=setup();g.setViewport(390,844);const [a,b]=g.people;
  a.workAnchor={facility:'radar',type:'dish',x:-50,y:12};a.workX=radarWorldPoint(a.workAnchor,808).x;grounded(a,a.workX,'toWork');
  b.foodAnchor={facility:'food',type:'rim',x:0,y:-58};const food=foodWorldPoint(b.foodAnchor,808);
  grounded(b,food.x,'eat');b.y=food.y-halfHeight(b);b.onFood=true;
  g.step(.25);assert.equal(a.state,'jump');const before=personView(a,g.view,808,g.sceneTime,g.radarPose());
  g.recall();const after=personView(a,g.view,808,g.sceneTime,g.radarPose());close(before.x,after.x);close(before.y,after.y);
  assert.equal(a.jump.nextState,'toShelter');assert.equal(b.jump.nextState,'toShelter');assert.equal(b.jump.fromAnchor.facility,'food');
  g.step(25);assert.equal(g.sheltered,2);
});

test('radio arcs follow the actual antenna axis across viewports and poses, and draw the expanded radii',()=>{
  for(const [w,h]of [[1440,810],[390,844],[844,220]])for(const press of [-2.2,0,2.2]){
    const v=viewMetrics(w,h),pose={press,release:0,scan:.028,antenna:.008},project=(x,y)=>({x:x*v.sx,y:y*v.sy});
    const state={time:.75,launchTime:0,antennaPoint:a=>{const p=radarFootView(a,v,808,pose);return{x:p.x/v.sx,y:p.y/v.sy};}};
    const arcs=[],ctx={save(){},restore(){},beginPath(){},stroke(){},arc(...args){arcs.push(args);}};
    drawRadio(ctx,state,{art:v.art},project);assert.equal(arcs.length,4);
    const head=state.antennaPoint({type:'antenna',x:-12,y:-76}),base=state.antennaPoint({type:'antenna',x:-1,y:8});
    const dx=(head.x-base.x)*v.sx,dy=(head.y-base.y)*v.sy,length=Math.hypot(dx,dy);
    for(const [x,y,r,a,b]of arcs){close(x,head.x*v.sx);close(y,head.y*v.sy);close(Math.cos((a+b)/2)*dx/length+Math.sin((a+b)/2)*dy/length,1);assert.ok(r>0);}
    assert.ok(arcs[0][2]>180*v.art);assert.equal(radioWaves({...state,time:2},{art:v.art},project).length,0);
    assert.ok(RADIO.maxRadius>200);
  }
});
