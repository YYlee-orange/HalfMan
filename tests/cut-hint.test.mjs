import test from 'node:test';
import assert from 'node:assert/strict';
import {PencilHint,PencilHintRenderer} from '../dist/pencil-hint.js';
import {CUT_HINT,CUT_DRAWING,cutHintLayout} from '../dist/cut-hint.js';

test('cut instruction completes all lettering and illustration within 1.5 seconds',()=>{
  const hint=new PencilHint(CUT_DRAWING);assert.equal(hint.snapshot(10).stage,'hidden');hint.start(10);
  assert.equal(hint.snapshot(10).completedStrokes,0);
  const during=hint.snapshot(10.4);assert.equal(during.stage,'writing');assert.ok(during.completedStrokes>0);
  assert.ok(CUT_DRAWING.duration<=1.5);
  const complete=hint.snapshot(11.5);assert.equal(complete.stage,'shown');assert.equal(complete.completedStrokes,CUT_DRAWING.strokes.length);
  hint.erase(11.5);assert.equal(hint.snapshot(11.8).stage,'erasing');assert.equal(hint.erase(11.8),false);
  assert.equal(hint.snapshot(12.6).stage,'done');
  hint.stop();assert.equal(hint.snapshot(13).stage,'hidden');hint.start(14,true);assert.equal(hint.snapshot(14).stage,'shown');
  hint.erase(14.1,true);assert.equal(hint.snapshot(14.1).stage,'done');
});

test('centered instruction fits landscape, portrait and shallow viewports',()=>{
  for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220]]){
    const layout=cutHintLayout({width,height});
    assert.ok(layout.x>=19&&layout.y>=15);assert.ok(layout.x+layout.width<=width-19);assert.ok(layout.y+layout.height<=height-15);
    assert.ok(Math.abs(layout.x+layout.width/2-width/2)<1e-7);assert.ok(Math.abs(layout.y+layout.height/2-height/2)<1e-7);
  }
});

test('custom drawing renders on its own sized layers and eraser reaches every stroke',()=>{
  const layers=[],operations=[];
  const makeCanvas=()=>{const canvas={getContext:()=>new Proxy({},{get:(_,name)=>(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)));operations.push(name);},set:()=>true})};layers.push(canvas);return canvas;};
  const renderer=new PencilHintRenderer(makeCanvas,CUT_DRAWING),hint=new PencilHint(CUT_DRAWING);hint.start();
  const ctx={save(){},restore(){},drawImage(){}},layout=cutHintLayout({width:1440,height:900});
  renderer.draw(ctx,hint.snapshot(1.5),layout);assert.equal(renderer.next,CUT_DRAWING.segments.length);
  assert.ok(layers.every(c=>c.width===CUT_HINT.width*2&&c.height===CUT_HINT.height*2));
  hint.erase(1.5);renderer.draw(ctx,hint.snapshot(2),layout,true);assert.ok(operations.includes('stroke'));
  for(const stroke of CUT_DRAWING.strokes)for(const p of stroke.points){
    assert.ok(CUT_DRAWING.eraserChunks.some(e=>{
      const u=Math.max(0,Math.min(1,((p.x-e.x)*e.width+(p.y-e.y)*e.tilt)/(e.width**2+e.tilt**2)));
      return Math.hypot(p.x-e.x-e.width*u,p.y-e.y-e.tilt*u)<e.height/2-3;
    }));
  }
});
