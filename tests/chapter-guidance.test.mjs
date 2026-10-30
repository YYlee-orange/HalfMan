import test from 'node:test';
import assert from 'node:assert/strict';
import {PencilHintRenderer} from '../dist/pencil-hint.js';
import {CHAPTER_ONE,CHAPTER_TWO,ChapterGuidance,guidanceFor,createChapterDrawing,chapterHintLayout} from '../dist/chapter-guidance.js';

test('onboarding is first-level only and future chapters reuse the two-line heading template',()=>{
  assert.equal(guidanceFor('man-1').tutorial,true);assert.equal(guidanceFor('man-1').chapter,CHAPTER_ONE);assert.deepEqual(CHAPTER_ONE.config.lines,['曼之一','切！']);
  assert.equal(guidanceFor('man-2').tutorial,false);assert.equal(guidanceFor('man-2').chapter,CHAPTER_TWO);
  assert.equal(guidanceFor('man-3').tutorial,false);assert.equal(guidanceFor('future-level').tutorial,false);
  assert.deepEqual(CHAPTER_TWO.config.lines,['曼之二','防空']);
  assert.deepEqual(createChapterDrawing({order:'三',name:'防空'}).config.lines,['曼之三','防空']);
  assert.throws(()=>createChapterDrawing({order:'三',name:'未知'}),/Missing handwritten/);
});
test('a chapter writes, holds and erases on the game clock, then restarts with a fresh serial',()=>{
  const cue=new ChapterGuidance();assert.equal(cue.snapshot(0).stage,'hidden');cue.start('man-2',10);
  assert.equal(cue.snapshot(10).stage,'writing');assert.ok(cue.snapshot(10.6).writeProgress>0&&cue.snapshot(10.6).writeProgress<1);
  assert.equal(cue.snapshot(11.31).stage,'shown');assert.equal(cue.snapshot(12.91).stage,'erasing');assert.equal(cue.snapshot(14).stage,'done');
  const serial=cue.snapshot(14).serial;cue.stop();assert.equal(cue.snapshot(14).stage,'hidden');cue.start('man-2',0);assert.equal(cue.snapshot(0).serial,serial+1);
  cue.start('man-1',0);assert.equal(cue.snapshot(0).stage,'writing');assert.equal(cue.drawing,CHAPTER_ONE);
});
test('reduced motion preserves the complete title with a finite hold and instant erasing',()=>{
  const cue=new ChapterGuidance();cue.start('man-2',0,true);assert.equal(cue.snapshot(0,true).stage,'shown');
  assert.deepEqual(cue.snapshot(0,true).lines,['曼之二','防空']);assert.equal(cue.snapshot(1.61,true).stage,'done');
  cue.start('man-2');cue.setReduced(true);assert.equal(cue.snapshot(.1).stage,'shown');
});
test('chapter strokes are ordered, finite, erasable and fit all supported viewports',()=>{
  const drawing=CHAPTER_TWO,split=drawing.strokes.findIndex(s=>s.kind==='chapter-name');assert.ok(split>0);
  assert.ok(drawing.strokes.slice(0,split).every(s=>s.kind==='chapter-number'));assert.ok(drawing.strokes.slice(split).every(s=>s.kind==='chapter-name'));
  assert.ok(drawing.duration<=1.5);for(const stroke of drawing.strokes)for(const p of stroke.points){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=8&&p.x<=drawing.config.width-8&&p.y>=8&&p.y<=drawing.config.height-8);
    assert.ok(drawing.eraserChunks.some(e=>{const u=Math.max(0,Math.min(1,((p.x-e.x)*e.width+(p.y-e.y)*e.tilt)/(e.width**2+e.tilt**2)));return Math.hypot(p.x-e.x-u*e.width,p.y-e.y-u*e.tilt)<e.height/2-5;}));
  }
  for(const [width,height]of [[1440,900],[390,844],[844,390],[844,220]]){const l=chapterHintLayout({width,height},drawing);assert.ok(l.x>=19&&l.y>=17&&l.x+l.width<=width-19&&l.y+l.height<=height-17);}
});
test('chapter renderer actually uses thicker graphite while preserving isolated erasing layers',()=>{
  const widths=[],composites=[],make=()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:(_,k,v)=>{if(k==='lineWidth')widths.push(v);if(k==='globalCompositeOperation')composites.push(v);return true;}})});
  const cue=new ChapterGuidance();cue.start('man-2');const painter=new PencilHintRenderer(make,CHAPTER_TWO),ctx={save(){},restore(){},drawImage(){}},layout=chapterHintLayout({width:1440,height:900},CHAPTER_TWO);
  painter.draw(ctx,cue.snapshot(1.31),layout);assert.ok(widths.some(w=>Math.abs(w-2.3*1.9)<1e-10));
  painter.draw(ctx,cue.snapshot(3),layout);assert.ok(composites.includes('destination-out'));
});
