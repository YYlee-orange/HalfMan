import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PreviewModel,metricsFor} from '../dist/preview/model.js';
const glyphs=JSON.parse(readFileSync(new URL('../dist/preview/glyphs.json',import.meta.url),'utf8')).glyphs;
const youyuan=glyphs.find(g=>g.id==='youyuan');
const create=options=>new PreviewModel({ratio:youyuan.width/youyuan.height,...options});
test('preview and production use the same three actual Chinese glyph outlines',()=>{
  assert.deepEqual(glyphs.map(g=>g.id),['yahei','simsun','youyuan']);
  assert.equal(new Set(glyphs.map(g=>g.path)).size,3);
  for(const g of glyphs){
    assert.ok(g.path.length>100);assert.equal(g.splitX,g.width/2);
    assert.equal(g.halves.length,2);
    assert.deepEqual(g.halves[0].clip,[0,0,g.width/2,g.height]);
    assert.deepEqual(g.halves[1].clip,[g.width/2,0,g.width/2,g.height]);
    assert.ok(g.halves.every(h=>h.rotation===-Math.PI/2));
  }
  const main=JSON.parse(readFileSync(new URL('../dist/assets/glyphs.json',import.meta.url),'utf8'));
  assert.deepEqual(main.glyphs.map(g=>g.id),['yahei','simsun','youyuan']);
});
test('all sizes spawn fully outside desktop, portrait and short landscape canvases',()=>{
  for(const [width,height]of [[1440,810],[390,550],[844,200]])for(const scale of [.72,1,1.32]){
    const m=create({width,height,size:82*scale});m.step(1.02);
    assert.equal(m.events.filter(e=>e.type==='spawn').length,1);
    assert.ok(m.events[0].lowestScreenPixel<=-27.99,`${width}/${height}/${scale}`);
    assert.ok(m.meteors[0].vy>64,'gravity accelerates after spawn');
  }
  assert.ok(metricsFor(390,550).character>0);
});
test('cut retains the parent tail and creates both child tails at the cut point',()=>{
  const m=create();m.manual=true;m.step(2.6);const parent={...m.meteors[0]};
  assert.ok(m.cut());assert.equal(m.meteors.length,0);assert.equal(m.people.length,2);assert.equal(m.trails.length,3);
  assert.equal(m.trails[0].reason,'split');assert.equal(m.trails[0].ended,m.time);
  for(const tail of m.trails.slice(1))assert.deepEqual(tail.points[0],{x:parent.x,y:parent.y,time:m.time});
  assert.ok(m.people[0].vx<0&&m.people[1].vx>0);
  assert.ok(m.people.every(p=>p.fontId==='youyuan'));
  m.step(.44);assert.equal(m.trails.length,2);
});
test('meteor landing creates the large explosion before its orphan trail fades',()=>{
  const m=create();m.setMode('impact');
  for(let n=0;n<1100&&!m.events.some(e=>e.type==='meteorLand');n++)m.step(1/120);
  assert.equal(m.meteors.length,0);assert.ok(m.bursts.some(b=>b.type==='meteor'));
  assert.ok(m.trails.some(t=>t.reason==='landing'));
  m.step(.32);assert.equal(m.trails.length,0);assert.ok(m.bursts.some(b=>b.type==='meteor'));
});
test('both man landings keep the people and create small transition explosions',()=>{
  const m=create();
  for(let n=0;n<1050&&m.events.filter(e=>e.type==='manLand').length<2;n++)m.step(1/120);
  assert.equal(m.events.filter(e=>e.type==='manLand').length,2);assert.equal(m.people.length,2);
  assert.ok(m.people.every(p=>p.landed));assert.ok(m.bursts.some(b=>b.type==='man'));
  m.step(1.42);assert.equal(m.trails.length,0);assert.equal(m.bursts.filter(b=>b.type==='man').length,0);
});
test('swept aerial collision kills elevated workers before ground impact',()=>{
  const m=create();m.setMode('collision');m.step(6);
  const hit=m.events.find(e=>e.type==='airHit'),impact=m.events.find(e=>e.type==='meteorLand');
  assert.ok(hit);assert.ok(impact);assert.ok(hit.time<impact.time);assert.ok(hit.y<650);
  assert.ok(m.deaths>0);assert.equal(m.workers.filter(w=>!w.alive).length,m.deaths);
});
test('seeking reproduces events and idle mode never spawns a meteor',()=>{
  const m=create();m.setMode('collision');m.seek(4.5);const first=m.snapshot();m.seek(4.5);
  assert.deepEqual(m.snapshot(),first);m.setMode('idle');m.step(8.6);
  assert.equal(m.events.length,0);assert.equal(m.meteors.length,0);assert.equal(m.workers.length,3);
});
