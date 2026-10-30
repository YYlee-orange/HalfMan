import test from 'node:test';
import assert from 'node:assert/strict';
import {MechanismGuidance,MECHANISM_CUES,MECHANISM_TIMING,mechanismLead,createMechanismDrawing} from '../dist/mechanism-guidance.js';
import {PencilHintRenderer} from '../dist/pencil-hint.js';
const view={width:1440,height:900},targets={shield:{x:1375,y:800},cannon:{x:500,y:760}},period=MECHANISM_TIMING.write+MECHANISM_TIMING.hold+MECHANISM_TIMING.erase;

test('six cues begin only after the chapter erases, with writing, holding and erasing in order',()=>{
  const hints=new MechanismGuidance(),read=t=>hints.snapshot(t,false,view,targets);hints.start('man-2',5);const lead=5+mechanismLead(false);assert.equal(read(lead-.01).stage,'hidden');
  for(let i=0;i<MECHANISM_CUES.length;i++){
    const t=lead+i*period,frame=read(t);assert.equal(frame.cue,MECHANISM_CUES[i].id);assert.equal(frame.text,MECHANISM_CUES[i].text);assert.equal(frame.stage,'writing');assert.equal(read(t+1.41).stage,'shown');assert.equal(read(t+3.11).stage,'erasing');
  }
  assert.deepEqual(MECHANISM_CUES.slice(-2).map(c=>c.text),['现在空中已不构成威胁','优势在我！']);assert.equal(read(lead+period*MECHANISM_CUES.length+.01).stage,'done');assert.equal(hints.drawing,null);
});
test('level scope, pause clock, restart and reduced motion preserve the sequence',()=>{
  const hints=new MechanismGuidance(),read=(t,r=false)=>hints.snapshot(t,r,view,targets);hints.start('man-1');assert.equal(read(10).stage,'hidden');hints.start('man-2');const t=mechanismLead(false)+.5,frame=read(t);assert.deepEqual(read(t),frame);hints.stop();assert.equal(read(t).stage,'hidden');hints.start('man-2');assert.ok(read(t).serial>frame.serial);
  hints.start('man-2',0,true);assert.equal(read(1.59,true).stage,'hidden');for(let i=0;i<MECHANISM_CUES.length;i++){const frame=read(1.6+i*MECHANISM_TIMING.hold+.01,true);assert.equal(frame.index,i);assert.equal(frame.stage,'shown');assert.equal(frame.writeProgress,1);}assert.equal(read(1.61+MECHANISM_CUES.length*MECHANISM_TIMING.hold,true).stage,'done');
});
test('responsive drawings retain ordered pencil strokes, exact arrow targets and complete eraser coverage',()=>{
  for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220]])for(let i=0;i<MECHANISM_CUES.length;i++){
    const v={width,height},aim={shield:{x:width-65,y:height-95},cannon:{x:width*.35,y:height-70}},drawing=createMechanismDrawing(i,v,aim);
    assert.ok(Math.abs(drawing.duration-1.4)<1e-9);assert.ok(drawing.strokes.some(s=>s.kind==='letter'));
    for(const stroke of drawing.strokes)for(const p of stroke.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height);assert.ok(drawing.eraserChunks.some(e=>{const u=Math.max(0,Math.min(1,((p.x-e.x)*e.width+(p.y-e.y)*e.tilt)/(e.width**2+e.tilt**2)));return Math.hypot(p.x-e.x-u*e.width,p.y-e.y-u*e.tilt)<e.height/2;}));}
    if(MECHANISM_CUES[i].target){const tip=drawing.strokes.find(s=>s.kind==='arrow').points.at(-1),target=aim[MECHANISM_CUES[i].target];assert.ok(Math.hypot(tip.x-target.x,tip.y-target.y)<1e-8);}else if(MECHANISM_CUES[i].sketch)assert.ok(drawing.strokes.some(s=>s.kind===(['shield','rock'][i===2?1:0])));
  }
});
test('resizing retargets the drawing while preserving its current pen or eraser progress',()=>{
  const hints=new MechanismGuidance();hints.start('man-2');const time=mechanismLead(false)+period+.7,a=hints.snapshot(time,false,view,targets),old=hints.drawing;
  const next={shield:{x:310,y:690},cannon:{x:140,y:730}},b=hints.snapshot(time,false,{width:390,height:844},next);assert.equal(a.writeProgress,b.writeProgress);assert.notEqual(hints.drawing,old);assert.deepEqual(b.target,next.shield);
});
test('pencil renderer draws each cue with isolated erasing and never uses font text',()=>{
  const make=()=>({getContext:()=>new Proxy({},{get:(_,key)=>{if(key==='fillText'||key==='strokeText')return()=>{throw Error('font text substituted for handwriting');};return()=>{};},set:()=>true})}),ctx={save(){},restore(){},drawImage(){}};
  for(let i=0;i<MECHANISM_CUES.length;i++){const d=createMechanismDrawing(i,view,targets),renderer=new PencilHintRenderer(make,d);renderer.draw(ctx,{stage:'shown',serial:i,writeTime:1.4},{x:0,y:0,width:1440,height:900});renderer.draw(ctx,{stage:'erasing',serial:i,writeTime:1.4,eraseProgress:.5},{x:0,y:0,width:1440,height:900});}
});
