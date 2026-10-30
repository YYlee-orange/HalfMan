import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,LEVEL_ART,LOCKED_FRAGMENTS,LevelSelectScene,createLevelList,levelJelly,levelFlame,levelLinkCurve,drawLevelMap,drawLevelFlames,drawLevelDebris} from '../dist/level-select.js';
test('five playable levels precede one broken future node; new chapters preserve this roster pattern',()=>{
  const scene=new LevelSelectScene();assert.deepEqual(LEVELS.map(n=>[n.label,n.unlocked]),[['曼-1',true],['曼-2',true],['曼-3',true],['曼-4',true],['曼-5',true],['曼-6',false]]);
  assert.equal(scene.select('man-6'),false);assert.equal(scene.select('missing'),false);assert.equal(scene.selected,null);
  assert.deepEqual(scene.snapshot(1440,650).links,[{from:'man-1',to:'man-2'},{from:'man-2',to:'man-3'},{from:'man-3',to:'man-4'},{from:'man-4',to:'man-5'}]);
  assert.equal(scene.select('man-4'),true);scene.select('man-6');assert.equal(scene.selected,'man-4');scene.reset();assert.equal(scene.selected,null);
  const future=createLevelList(5);assert.equal(future.length,6);assert.equal(future.filter(n=>n.unlocked).length,5);assert.deepEqual(future.at(-1),{id:'man-6',label:'曼-6',unlocked:false});
});
test('selection grows flame continuously from zero, jelly recovers, and switching fades the old tail',()=>{
  const scene=new LevelSelectScene();scene.select('man-1');
  let frame=scene.snapshot(1440,650);assert.equal(levelFlame(frame.nodes[0],0),null);
  let previous=0;
  for(let i=0;i<65;i++){scene.step(.01);frame=scene.snapshot(1440,650);const n=frame.nodes[0],f=levelFlame(n,scene.time);assert.ok(n.flame>=previous);assert.ok(n.flame<=1);assert.ok(f.trail.opacity>0);previous=n.flame;}
  assert.equal(previous,1);assert.ok(levelJelly(.06).sx>1.3);assert.ok(levelJelly(.24).sx<1);assert.deepEqual(levelJelly(.8),{sx:1,sy:1});
  scene.select('man-2');scene.step(.12);frame=scene.snapshot(1440,650);assert.ok(frame.nodes[0].flame>0&&frame.nodes[0].flame<1);assert.ok(frame.nodes[1].flame>0&&frame.nodes[1].flame<1);
  scene.step(.13);assert.equal(scene.snapshot(1440,650).nodes[0].flame,0);
  scene.step(1);scene.select('man-2');scene.step(.01);assert.equal(scene.snapshot(1440,650).nodes[1].flame,1,'reclick does not snap a full tail off');
});
test('ambient phases differ, selected spin accelerates, pause freezes and reduced motion remains selectable',()=>{
  const scene=new LevelSelectScene();scene.select('man-1');scene.step(.4);const f=scene.snapshot(1440,650);
  assert.ok(f.nodes[0].angle>f.nodes[1].angle);assert.ok(new Set(f.nodes[2].fragments.map(p=>p.dy)).size>5);assert.ok(f.drift.x>0&&f.drift.y<0);
  scene.paused=true;scene.step(20);assert.deepEqual(scene.snapshot(1440,650),{...f,paused:true});assert.equal(scene.select('man-2'),false);
  scene.paused=false;assert.equal(scene.select('man-2'),true);const reduced=scene.snapshot(1440,650,true);assert.deepEqual(reduced.drift,{x:0,y:0});
  assert.ok(reduced.nodes.every(n=>n.angle===0&&n.sx===1&&n.sy===1&&n.fragments.every(p=>p.dy===0)));assert.equal(reduced.nodes[1].flame,1);
});
test('spin acceleration and flame growth agree at different frame rates',()=>{
  const frames=[];for(const fps of [30,60,120]){const scene=new LevelSelectScene();scene.select('man-1');for(let i=0;i<fps;i++)scene.step(1/fps);frames.push(scene.snapshot(1440,650));}
  for(const frame of frames){assert.ok(Math.abs(frame.nodes[0].angle-frames[0].nodes[0].angle)<1e-10);assert.equal(frame.nodes[0].flame,1);}
});
test('horizontal maps reserve real touch sizes and label clearance across supported screens',()=>{
  for(const [width,height]of [[1440,653],[390,573],[844,222],[320,297]]){
    const f=new LevelSelectScene().snapshot(width,height);assert.ok(f.width>=width);
    assert.ok(f.nodes[4].x-f.nodes[4].radius>width,'five playable nodes extend beyond a single viewport');
    for(const n of f.nodes){assert.ok(n.radius*2>=44);assert.ok(n.x-n.radius>=0&&n.x+n.radius<=f.width);assert.ok(n.y-n.radius>=0&&n.y+n.radius+61<=height);}
  }
});
test('both themes and motion modes draw finite coordinates for intact rocks, fragments, paths and flames',()=>{
  let operations=0;const ctx=new Proxy({},{get:()=> (...args)=>{operations++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},set:()=>true});
  for(const dark of [false,true])for(const reduced of [false,true]){
    const scene=new LevelSelectScene();scene.select('man-2');scene.step(.2,reduced);const f=scene.snapshot(844,222,reduced);
    drawLevelDebris(ctx,f,{dark,x:-100,y:70});
    drawLevelFlames(ctx,f,{dark,reduced,x:-100,y:70});drawLevelMap(ctx,f,{dark,reduced});
  }
  assert.ok(operations>300);
});
test('captions and belt positions stay fixed while rocks animate and belt sizes breathe',()=>{
  const scene=new LevelSelectScene(),a=scene.snapshot(1440,650);scene.step(.5);const b=scene.snapshot(1440,650);
  assert.equal(a.nodes[0].labelY,b.nodes[0].labelY);assert.notEqual(a.nodes[0].y,b.nodes[0].y);
  assert.notEqual(a.nodes[0].radius,a.nodes[1].radius);assert.notEqual(LEVEL_ART['man-1'].pattern,LEVEL_ART['man-2'].pattern);
  for(const theme of ['light','dark']){assert.equal(LEVEL_ART['man-1'][theme].length,2);assert.notDeepEqual(LEVEL_ART['man-1'][theme],LEVEL_ART['man-2'][theme]);}
  const arcs=[],ctx=new Proxy({arc(...args){arcs.push(args);}},{get:(target,key)=>key in target?target[key]:()=>{},set:()=>true});
  drawLevelMap(ctx,a);assert.ok(arcs.length>=a.links.length*2);assert.ok(arcs.every(p=>p[2]>=4.8&&p[2]<=9.8));
  const fixed=arcs.splice(0),positions=points=>points.map(p=>p.slice(0,2));drawLevelMap(ctx,b);const breathing=arcs.splice(0);
  assert.deepEqual(positions(breathing),positions(fixed));assert.notDeepEqual(breathing.map(p=>p[2]),fixed.map(p=>p[2]));
  const sizeRatios=breathing.map((p,i)=>p[2]/fixed[i][2]);assert.ok(Math.max(...sizeRatios)-Math.min(...sizeRatios)>.005,'individual stones breathe out of phase');
  scene.select('man-2');scene.step(.06);drawLevelMap(ctx,scene.snapshot(1440,650));assert.deepEqual(positions(arcs.splice(0)),positions(fixed));
  drawLevelMap(ctx,a,{reduced:true});const still=arcs.splice(0);drawLevelMap(ctx,b,{reduced:true});assert.deepEqual(arcs.splice(0),still);
  for(const [index,link]of a.links.entries()){
    const from=a.anchors.find(n=>n.id===link.from),to=a.anchors.find(n=>n.id===link.to),curve=levelLinkCurve(from,to);
    for(const [centre,end,control]of [[from,curve.start,curve.c1],[to,curve.end,curve.c2]]){
      const x=end.x-centre.x,y=end.y-centre.y,cx=control.x-centre.x,cy=control.y-centre.y;
      assert.ok(Math.abs(x*cy-y*cx)<1e-7,'endpoint tangent aligns with the button centre');assert.ok(x*cx+y*cy>0);
    }
    if(index<a.links.length-1){
      const next=a.anchors.find(n=>n.id===a.links[index+1].to),following=levelLinkCurve(to,next);
      const ax=curve.end.x-curve.c2.x,ay=curve.end.y-curve.c2.y,bx=following.c1.x-following.start.x,by=following.c1.y-following.start.y;
      assert.ok(Math.abs(ax*by-ay*bx)<1e-7,'adjacent segments share a tangent through the hidden centre');assert.ok(ax*bx+ay*by>0);
    }
  }
  assert.equal(b.drift.x,14);assert.equal(b.drift.y,-9);
  const areas=LOCKED_FRAGMENTS.map(p=>Math.abs(p.points.reduce((n,[x,y],i)=>{const [nx,ny]=p.points[(i+1)%p.points.length];return n+x*ny-y*nx;},0))/2);
  assert.ok(Math.max(...areas)/Math.min(...areas)>5);assert.ok(new Set(LOCKED_FRAGMENTS.map(p=>p.points.length)).size>=3);
});
