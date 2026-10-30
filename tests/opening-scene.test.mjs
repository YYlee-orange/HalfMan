import test from 'node:test';
import assert from 'node:assert/strict';
import {OpeningScene,OpeningRenderer,OPENING,buildingExit,inversionEdges,inversionAlpha} from '../dist/opening-scene.js';
import {BackgroundSky} from '../dist/background.js';
import {drawRiceMark} from '../dist/food-mark.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('opening has overlapping ordered exits, a background-only beat, glyph, cut, inversion and doors under 2.5 seconds',()=>{
  const o=new OpeningScene();assert.equal(o.mode,'title');assert.equal(o.begin(false),true);assert.equal(o.begin(true),false);
  assert.ok(OPENING.duration<2.5);assert.ok(OPENING.radar.start<OPENING.food.charge+OPENING.food.exit);assert.ok(OPENING.shelter.start<OPENING.radar.start+OPENING.radar.charge+OPENING.radar.exit);
  const food=buildingExit('food',.06,1440,900,1),radar=buildingExit('radar',.18,1440,900,1),shelter=buildingExit('shelter',.30,1440,900,1);
  assert.ok(food.dy<0&&food.sy<1&&food.sx>1);assert.ok(radar.dx<0&&radar.sx<1);assert.ok(shelter.dx>0&&shelter.sx<1);
  o.step(.76);let s=o.snapshot(1440,900);assert.equal(s.backgroundOnly,true);assert.equal(s.uiGone,true);assert.ok(Object.values(s.buildings).every(p=>!p.visible));
  o.step(.24);s=o.snapshot(1440,900);assert.equal(s.glyphVisible,true);assert.ok(s.glyphProgress>0&&s.glyphProgress<1);
  o.step(.42);s=o.snapshot(1440,900);assert.ok(s.cutProgress>0&&s.invertProgress>0);assert.equal(s.fromDark,false);assert.equal(s.toDark,true);
  o.step(.48);s=o.snapshot(1440,900);assert.ok(s.revealing&&s.doorProgress>0&&s.doorProgress<1);
  assert.equal(o.step(.4),true);close(o.time,OPENING.duration);o.enterGame();assert.equal(o.mode,'game');o.reset();assert.equal(o.mode,'title');
});
test('title idle and transition clocks are independent, pausable, frame independent and have a reduced-motion exit',()=>{
  const a=new OpeningScene(),b=new OpeningScene();a.step(100);assert.equal(a.mode,'title');assert.equal(a.time,0);assert.equal(a.idleTime,100);
  a.begin(true);b.begin(true);a.step(.8);for(let i=0;i<48;i++)b.step(1/60);close(a.time,b.time);
  a.paused=true;assert.equal(a.step(50),false);close(a.time,.8);a.paused=false;assert.equal(a.step(10),true);
  const r=new OpeningScene();r.begin(false,true);assert.equal(r.duration,.18);r.step(.09);const s=r.snapshot(390,844);assert.equal(s.glyphVisible,false);assert.ok(Object.values(s.buildings).every(p=>p.sx===1&&p.sy===1&&p.dx===0&&p.dy===0));assert.equal(r.step(.09),true);
});
test('opening renderer reuses its scene layers and small alpha mask in both themes and viewports',()=>{
  const layers=[],ops=[];
  const makeContext=()=>new Proxy({createImageData(width,height){return{data:new Uint8ClampedArray(width*height*4)};},createLinearGradient(...values){assert.ok(values.every(Number.isFinite));return{addColorStop(n){assert.ok(n>=0&&n<=1);}};}},{
    get:(target,key)=>key in target?target[key]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),key);ops.push(key);},
    set:()=>true,
  });
  const makeCanvas=()=>{const ctx=makeContext(),c={getContext:()=>ctx};layers.push(c);return c;};
  const renderer=new OpeningRenderer(makeCanvas),target=makeContext(),sky=new BackgroundSky(17);
  for(const [width,height]of [[1440,900],[390,844],[844,390]])for(const dark of [false,true]){
    const scene=new OpeningScene();scene.begin(dark);
    for(const t of [0,.06,.18,.3,.76,1,1.42,1.9,2.3]){
      scene.time=t;renderer.draw(target,scene.snapshot(width,height,.7),{width,height,dpr:2,dark,sky,glyph:{width:100,height:100},path:{},drawBuilding(kind,ctx,pose){assert.ok(['food','radar','shelter'].includes(kind));assert.ok(Object.values(pose).every(n=>typeof n!=='number'||Number.isFinite(n)));}});
    }
  }
  assert.equal(layers.length,3);assert.ok(ops.includes('clip')&&ops.includes('drawImage')&&ops.includes('putImageData'));assert.ok(renderer.mask.width<=256&&renderer.mask.height<=256);
});
test('wave mask endpoints fully clear and fill, with finite asymmetric contours and continuous intermediate alpha',()=>{
  for(const [w,h]of [[1440,900],[390,844],[844,390]]){
    const rows=[0,h*.25,h*.5,h*.75,h];
    for(const y of rows)for(const x of [0,w*.25,w*.5,w*.75,w]){
      assert.equal(inversionAlpha(x,inversionEdges(0,y,w,h),w),0);assert.equal(inversionAlpha(x,inversionEdges(1,y,w,h),w),1);
    }
    const fronts=rows.map(y=>inversionEdges(.4,y,w,h));assert.ok(new Set(fronts.map(p=>p.left)).size>1);
    assert.ok(fronts.some(p=>Math.abs((w/2-p.left)-(p.right-w/2))>1));
    const edge=fronts[2];assert.ok(inversionAlpha(edge.left+edge.feather*.5,edge,w)>0&&inversionAlpha(edge.left+edge.feather*.5,edge,w)<1);
    for(const p of fronts)assert.ok(Object.values(p).every(Number.isFinite));
  }
});
test('hand-drawn rice mark inherits the bowl transform and uses one existing color',()=>{
  const colors=[],calls=[];
  const ctx=new Proxy({},{get:(_,key)=>(...args)=>{assert.ok(!['setTransform','resetTransform','translate','scale'].includes(key));assert.ok(args.every(n=>typeof n!=='number'||Number.isFinite(n)));calls.push(key);},set:(_,key,value)=>{if(key==='strokeStyle')colors.push(value);return true;}});
  drawRiceMark(ctx,'#287344');assert.deepEqual(colors,['#287344']);assert.equal(calls.filter(k=>k==='stroke').length,7);
});
