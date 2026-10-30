import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTER_THREE,ChapterGuidance,guidanceFor,chapterHintLayout} from '../dist/chapter-guidance.js';
import {MechanismGuidance,MECHANISM_TIMING,mechanismLead} from '../dist/mechanism-guidance.js';
import {FARM_CUES,FARM_GUIDANCE,createFarmGuidanceDrawing} from '../dist/farm-guidance.js';
import {farmGuidanceArea} from '../dist/farm-guidance-layout.js';
import {farmGeometry} from '../dist/farm.js';
import {FARM_BOUNDS} from '../dist/farm-rowing.js';
import {viewMetrics} from '../dist/body-geometry.js';
import {PencilHintRenderer} from '../dist/pencil-hint.js';
const view={width:1440,height:900},period=MECHANISM_TIMING.write+MECHANISM_TIMING.hold+MECHANISM_TIMING.erase;
const texts=['老大，我们引入了高级的分数生产设备','只要让小人降落在上面就可以生产分数！','虽然有点危险...','但是老大很厉害','所以没问题！'];
test('third chapter writes the agriculture title, then the exact five cues in order with the corrected boss wording',()=>{
  assert.equal(guidanceFor('man-3').chapter,CHAPTER_THREE);assert.equal(guidanceFor('man-3').tutorial,false);assert.deepEqual(CHAPTER_THREE.config.lines,['曼之三','农业']);assert.deepEqual(FARM_CUES.map(c=>c.text),texts);
  const chapter=new ChapterGuidance(),hints=new MechanismGuidance(FARM_GUIDANCE),read=t=>hints.snapshot(t,false,view);chapter.start('man-3');hints.start('man-3');const lead=mechanismLead(false,CHAPTER_THREE);
  assert.equal(read(lead-.01).stage,'hidden');assert.equal(chapter.snapshot(lead+.001).stage,'done');
  for(let i=0;i<texts.length;i++){const t=lead+i*period;assert.equal(read(t).text,texts[i]);assert.equal(read(t).stage,'writing');assert.equal(read(t+1.41).stage,'shown');assert.equal(read(t+3.11).stage,'erasing');}
  assert.equal(read(lead+period*texts.length+.01).stage,'done');assert.equal(hints.drawing,null);
});
test('farm cues freeze on the paused clock, restart with a new serial, resize without replay, and retain reduced-motion timing',()=>{
  const hints=new MechanismGuidance(FARM_GUIDANCE),lead=mechanismLead(false,CHAPTER_THREE);hints.start('man-3');const a=hints.snapshot(lead+.6,false,view);assert.deepEqual(hints.snapshot(lead+.6,false,view),a);
  const b=hints.snapshot(lead+.6,false,{width:390,height:844});assert.equal(a.writeProgress,b.writeProgress);assert.equal(a.serial,b.serial);hints.stop();assert.equal(hints.snapshot(lead+.6,false,view).stage,'hidden');hints.start('man-3');assert.ok(hints.snapshot(lead+.6,false,view).serial>a.serial);
  hints.start('man-3',0,true);assert.equal(hints.snapshot(1.59,true,view).stage,'hidden');for(let i=0;i<texts.length;i++){const f=hints.snapshot(1.61+i*1.7,true,view);assert.equal(f.text,texts[i]);assert.equal(f.stage,'shown');assert.equal(f.writeProgress,1);}
  assert.equal(hints.snapshot(10.11,true,view).stage,'done');hints.start('man-1');assert.equal(hints.snapshot(100,false,view).stage,'hidden');
});
test('all handwriting and the thumb stay in the viewport, retain eraser coverage and avoid the complete farm route',()=>{
  for(const [width,height]of [[1440,900],[1920,1080],[390,844],[844,390],[844,220],[320,220]]){
    const v={width,height},area=farmGuidanceArea(v),layout=chapterHintLayout(v,CHAPTER_THREE),bounds=[{left:layout.x,right:layout.x+layout.width,top:layout.y,bottom:layout.y+layout.height}];
    for(let i=0;i<FARM_CUES.length;i++){
      const drawing=createFarmGuidanceDrawing(i,v),points=drawing.strokes.flatMap(s=>s.points);assert.equal(drawing.config.text,texts[i]);assert.ok(Math.abs(drawing.duration-1.4)<1e-9);assert.ok(drawing.config.lines.every(line=>line!=='.'&&line!=='..'));assert.equal(drawing.strokes.some(s=>s.kind==='thumb'),i===4);
      for(const p of points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);assert.ok(drawing.eraserChunks.some(e=>{const u=Math.max(0,Math.min(1,((p.x-e.x)*e.width+(p.y-e.y)*e.tilt)/(e.width**2+e.tilt**2)));return Math.hypot(p.x-e.x-u*e.width,p.y-e.y-u*e.tilt)<e.height/2;}));}
      bounds.push({left:Math.min(...points.map(p=>p.x))-5,right:Math.max(...points.map(p=>p.x))+5,top:Math.min(...points.map(p=>p.y))-5,bottom:Math.max(...points.map(p=>p.y))+5});
    }
    for(let t=0;t<180;t+=.73){const g=farmGeometry(viewMetrics(width,height),t),farm={left:g.x-FARM_BOUNDS.left*g.scale*g.sx,right:g.x+FARM_BOUNDS.right*g.scale*g.sx,top:g.y-FARM_BOUNDS.top*g.scale*g.sy,bottom:g.y+FARM_BOUNDS.bottom*g.scale*g.sy};for(const b of bounds)assert.ok(b.right<farm.left||b.left>farm.right||b.bottom<farm.top||b.top>farm.bottom,`${width}x${height} ${area.placement} overlaps farm at ${t}`);}
  }
});
test('farm wording and thumbs-up use the same pencil renderer without font or emoji substitution',()=>{
  const make=()=>({getContext:()=>new Proxy({},{get:(_,key)=>{if(key==='fillText'||key==='strokeText')return()=>{throw Error('handwriting replaced with font');};return()=>{};},set:()=>true})}),ctx={save(){},restore(){},drawImage(){}};
  for(let i=0;i<FARM_CUES.length;i++){const drawing=createFarmGuidanceDrawing(i,view),renderer=new PencilHintRenderer(make,drawing);renderer.draw(ctx,{stage:'shown',serial:i,writeTime:1.4},{x:0,y:0,...view});renderer.draw(ctx,{stage:'erasing',serial:i,writeTime:1.4,eraseProgress:.5},{x:0,y:0,...view});}
});
