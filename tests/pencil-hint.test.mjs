import test from 'node:test';
import assert from 'node:assert/strict';
import {HINT,HINT_WRITE_DURATION,PENCIL_STROKES,ERASER_CHUNKS,PencilHint,PencilHintRenderer,pencilHintLayout} from '../dist/pencil-hint.js';
import {viewMetrics,radarFootView} from '../dist/body-geometry.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('opening hint writes individual strokes in order, with the arrow following the letters',()=>{
  const hint=new PencilHint();assert.equal(hint.snapshot(0).stage,'hidden');hint.start(0);
  assert.equal(hint.snapshot(0).completedStrokes,0);
  for(let i=0;i<PENCIL_STROKES.length;i++){
    const s=PENCIL_STROKES[i];assert.ok(s.length>0&&s.end>s.start);if(i)assert.ok(s.start>PENCIL_STROKES[i-1].end);
    assert.equal(hint.snapshot((s.start+s.end)/2).completedStrokes,i);
    assert.ok(s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  }
  const arrow=PENCIL_STROKES.findIndex(s=>s.kind==='arrow');assert.ok(arrow>20);assert.ok(PENCIL_STROKES.slice(arrow).every(s=>s.kind==='arrow'));
  assert.equal(hint.snapshot(HINT_WRITE_DURATION).stage,'shown');
  assert.ok(HINT_WRITE_DURATION<=1.5);
  assert.equal(hint.snapshot(1.5).stage,'shown');
  assert.equal(hint.snapshot(1.5).completedStrokes,PENCIL_STROKES.length);
});

test('first summon freezes incomplete writing and later summons cannot restart or extend erasing',()=>{
  const hint=new PencilHint();hint.start();assert.equal(hint.erase(.4),true);
  const early=hint.snapshot(.4);assert.equal(early.stage,'erasing');assert.ok(early.writeProgress>0&&early.writeProgress<1);
  const during=hint.snapshot(.8);assert.equal(during.writeTime,early.writeTime);assert.ok(during.eraseProgress>0&&during.eraseProgress<1);
  assert.equal(hint.erase(.8),false);assert.equal(hint.snapshot(.4+HINT.eraseDuration+.01).stage,'done');
  assert.equal(hint.snapshot(100).stage,'done');const serial=hint.serial;hint.start(0);assert.equal(hint.serial,serial+1);assert.equal(hint.snapshot(0).stage,'writing');
  const reduced=new PencilHint();reduced.start();assert.equal(reduced.snapshot(0,true).stage,'shown');reduced.erase(.1,true);assert.equal(reduced.snapshot(.1,true).stage,'done');
  hint.setReduced(true);hint.setReduced(false);assert.equal(hint.snapshot(.2).stage,'shown','switching preferences cannot undo written strokes');
  hint.erase(.3);hint.setReduced(true);assert.equal(hint.snapshot(.3).stage,'done');hint.stop();assert.equal(hint.snapshot(180).stage,'hidden');
});

test('eraser blocks cover every drawn centerline with room for the pencil fibers',()=>{
  for(const stroke of PENCIL_STROKES)for(const p of stroke.points){
    const covered=ERASER_CHUNKS.some(e=>{
      const dx=e.width,dy=e.tilt,u=Math.max(0,Math.min(1,((p.x-e.x)*dx+(p.y-e.y)*dy)/(dx*dx+dy*dy)));
      return Math.hypot(p.x-e.x-dx*u,p.y-e.y-dy*u)<e.height/2-3;
    });
    assert.ok(covered,`${p.x},${p.y}`);
  }
});

test('responsive sketch stays inside the scene and its arrow reaches the radar target',()=>{
  for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220]]){
    const v=viewMetrics(width,height),p=radarFootView({type:'antenna',x:-12,y:-76},v,808,{press:0,release:0,scan:0,antenna:0});
    const target={x:p.x-24*v.art,y:p.y-24*v.art},layout=pencilHintLayout(v,target);
    assert.ok(layout.x>=15&&layout.x+layout.width<=width-15);assert.ok(layout.y>=(height<300?15:85));assert.ok(layout.y+layout.height<height);
    close(layout.x+HINT.tip.x*layout.scale,target.x);close(layout.y+HINT.tip.y*layout.scale,target.y);
  }
});

test('pencil caches fixed fibers and destination-out is confined to the hint layer',()=>{
  const layers=[];
  const makeCanvas=()=>{
    const operations=[],ctx=new Proxy({},{get:(_,name)=>(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(name));operations.push({name,args});},set:(_,name,value)=>{operations.push({name,value});return true;}});
    const canvas={getContext:()=>ctx,operations};layers.push(canvas);return canvas;
  };
  const main=[],ctx=new Proxy({},{get:(_,name)=>(...args)=>main.push({name,args}),set:(_,name,value)=>{main.push({name,value});return true;}});
  const painter=new PencilHintRenderer(makeCanvas),hint=new PencilHint();hint.start();
  const layout={x:400,y:200,width:344,height:200};painter.draw(ctx,hint.snapshot(.7),layout);
  const count=layers[0].operations.length;painter.draw(ctx,hint.snapshot(.7),layout);assert.equal(layers[0].operations.length,count);
  hint.erase(.7);painter.draw(ctx,hint.snapshot(1),layout);
  assert.ok(layers[1].operations.some(o=>o.name==='globalCompositeOperation'&&o.value==='destination-out'));
  assert.ok(main.every(o=>o.name!=='globalCompositeOperation'));
});
