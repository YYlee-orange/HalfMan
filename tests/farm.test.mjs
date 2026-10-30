import test from 'node:test';
import assert from 'node:assert/strict';
import {FARM,FARM_CROPS,FarmMotion,farmGeometry} from '../dist/farm.js';
import {drawFarm} from '../dist/farm-art.js';
import {viewMetrics} from '../dist/body-geometry.js';
import {ROWING,FARM_BOUNDS,rowingAt,farmRoute} from '../dist/farm-rowing.js';

test('floating farm geometry stays inside the viewport, has two depth sizes, and stops idle motion when reduced',()=>{
  assert.equal(FARM.colors.length,2);const back=FARM_CROPS.filter(c=>c.layer==='back'),front=FARM_CROPS.filter(c=>c.layer==='front');assert.equal(FARM_CROPS.length,9);assert.ok(front.every(c=>c.height===FARM.millHeight*.5));assert.ok(Math.min(...front.map(c=>c.height))>Math.max(...back.map(c=>c.height)));assert.ok(back.every(c=>!front.some(f=>f.x===c.x)));
  for(const [w,h]of [[1440,900],[390,844],[844,390],[844,220],[320,568]]){
    const v=viewMetrics(w,h),g=farmGeometry(v,2);assert.ok(g.x-245*g.scale*g.sx>=0&&g.x+245*g.scale*g.sx<=w);assert.ok(g.y-190*g.scale*g.sy>=0&&g.y+52*g.scale*g.sy<h);
    assert.notDeepEqual(g,farmGeometry(v,3));assert.deepEqual(farmGeometry(v,2,true),farmGeometry(v,3,true));
  }
});
test('a man brushing either way produces a matching damped crop response, while stationary or distant men do not',()=>{
  const g={x:0,y:0,scale:1,sx:1,sy:1,width:1000,height:800},crop=FARM_CROPS.find(c=>c.layer==='front');
  for(const direction of [-1,1]){
    const motion=new FarmMotion(),sample=x=>[{id:1,x,y:crop.y-crop.height*.5,rx:2,ry:2}];motion.sync(sample(crop.x-90*direction),0,g);motion.sync(sample(crop.x+10*direction),.1,g);const frame=motion.snapshot(.2,g),hit=frame.crops.find(c=>c.id===crop.id);assert.equal(Math.sign(hit.reaction),direction);assert.ok(Math.abs(hit.reaction)<.34);assert.equal(motion.snapshot(2,g).crops.find(c=>c.id===crop.id).reaction,0);
    const paused=motion.snapshot(.2,g);motion.sync(sample(crop.x+10*direction),.1,g);assert.deepEqual(motion.snapshot(.2,g),paused);motion.reset();assert.ok(motion.snapshot(.2,g).crops.every(c=>c.reaction===0));
  }
  for(const y of [crop.y-crop.height*.5,-500]){const motion=new FarmMotion(),p={id:1,x:crop.x,y,rx:2,ry:2};motion.sync([p],0,g);motion.sync([{...p,x:y===-500?crop.x+40:crop.x}],.1,g);assert.ok(motion.snapshot(.2,g).crops.every(c=>c.reaction===0));}
});
test('windmill rotation is clock based; resizing does not create a false collision; render uses two colors and finite transforms',()=>{
  const motion=new FarmMotion(),v=viewMetrics(1440,900),g=farmGeometry(v),a=motion.snapshot(1,g),b=motion.snapshot(3,g);assert.ok(b.rotor>a.rotor);assert.equal(motion.snapshot(3,g,true).rotor,0);
  motion.sync([{id:1,x:100,y:400}],0,g);motion.sync([{id:1,x:350,y:300}],1,farmGeometry(viewMetrics(390,844)));assert.ok(motion.snapshot(1,g).crops.every(c=>c.reaction===0));
  const colors=new Set();let calls=0;const ctx=new Proxy({},{get:()=> (...args)=>{calls++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},set:(_,key,value)=>{if(key==='fillStyle'||key==='strokeStyle')colors.add(value);return true;}});
  for(const reduced of [false,true])for(const [w,h]of [[1440,900],[390,844],[844,220]]){const frame=motion.snapshot(3,farmGeometry(viewMetrics(w,h),3,reduced),reduced);drawFarm(ctx,frame,'back');drawFarm(ctx,frame,'front');}
  assert.deepEqual([...colors].sort(),[...FARM.colors].sort());assert.ok(calls>300);
  colors.clear();drawFarm(ctx,motion.snapshot(3,g),'front');assert.deepEqual([...colors],[FARM.colors[0]]);
});
test('side-view working blades push opposite the boat with narrow faces, then turn face-on during coasting recovery',()=>{
  const a=rowingAt(.7),b=rowingAt(1.4),r=rowingAt(2.3),end=rowingAt(3.1);assert.equal(a.phase,'power');assert.equal(b.phase,'power');assert.ok(b.angle>a.angle);assert.ok(b.progress>a.progress);assert.ok(b.velocity>a.velocity);
  assert.equal(r.phase,'recover');assert.ok(end.progress>r.progress);assert.ok(end.velocity<r.velocity);assert.ok(a.bladeWidth<.3&&b.bladeWidth<.3&&r.bladeWidth===1&&r.lift===1);
  const leg=ROWING.stroke*ROWING.strokesPerLeg,span=leg+ROWING.turn,turn=rowingAt(leg+.3);assert.equal(turn.phase,'turn');assert.equal(turn.velocity,0);assert.equal(turn.progress,1);assert.equal(turn.lift,1);
  assert.ok(Math.abs(rowingAt(span-1e-5).progress-rowingAt(span+1e-5).progress)<1e-6);assert.ok(rowingAt(span+2).velocity<0);assert.ok(rowingAt(span+2).progress<1);assert.deepEqual(rowingAt(1,true),rowingAt(99,true));
  for(const offset of [0,span]){const start=rowingAt(offset+.7),end=rowingAt(offset+1.4),bladeDx=-Math.sin(end.angle)+Math.sin(start.angle);assert.ok(bladeDx*start.direction<0);assert.equal(end.bladeWidth,start.bladeWidth);}
  for(const boundary of [.12,.56,.68]){const t=boundary*ROWING.stroke;assert.ok(Math.abs(rowingAt(t-1e-5).bladeWidth-rowingAt(t+1e-5).bladeWidth)<1e-6);}
});
test('the whole moving hull, oars and enlarged windmill stay within the screen and outside the maximum radar envelope',()=>{
  const b=FARM_BOUNDS;
  const desktop=farmRoute(viewMetrics(1440,900));assert.ok(desktop.max>680,'desktop right endpoint should use the newly available space');
  for(const [w,h]of [[1440,900],[1920,1080],[390,844],[844,390],[844,220],[320,568],[320,220],[620,620]]){
    const v=viewMetrics(w,h),route=farmRoute(v);assert.ok(route.max>=route.min,`${w}x${h} invalid route`);
    for(let t=0;t<180;t+=.13){const g=farmGeometry(v,t),left=g.x-b.left*g.scale*g.sx,right=g.x+b.right*g.scale*g.sx,top=g.y-b.top*g.scale*g.sy,bottom=g.y+b.bottom*g.scale*g.sy;
      assert.ok(left>=0&&right<=w&&top>=0&&bottom<=h,`${w}x${h} outside at ${t}`);assert.ok(right<route.radar.left||bottom<route.radar.top,`${w}x${h} radar overlap at ${t}`);
    }
  }
});
