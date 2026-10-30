import test from 'node:test';
import assert from 'node:assert/strict';
import {BackgroundSky,starCount,starOpacity,shootingPoint,shootingOpacity,drawBackground} from '../dist/background.js';
test('background has varied star data, breathing opacity and a static reduced-motion fallback',()=>{
  const sky=new BackgroundSky(78);assert.equal(sky.stars.length,140);
  assert.ok(new Set(sky.stars.map(s=>s.light)).size>10);
  const s=sky.stars[0],peak=(Math.PI/2-s.phase+Math.PI*2)/s.frequency,trough=peak+Math.PI/s.frequency;
  assert.ok(starOpacity(s,peak)>starOpacity(s,trough));
  assert.equal(starOpacity(s,0,true),starOpacity(s,10,true));
  assert.equal(starCount(390,844),33);assert.equal(starCount(10000,10000),140);
});
test('shooting stars use a curved path, fade at both ends and expire with a bounded pool',()=>{
  const sky=new BackgroundSky(78);sky.step(sky.nextAt+.5);assert.equal(sky.shooting.length,1);
  const s=sky.shooting[0];assert.deepEqual(shootingPoint(s,0),s.from);assert.deepEqual(shootingPoint(s,1),s.to);
  assert.ok(Math.abs(shootingPoint(s,.5).y-(s.from.y+s.to.y)/2)>.02);
  assert.equal(shootingOpacity(0),0);assert.equal(shootingOpacity(1),0);assert.ok(shootingOpacity(.5)>shootingOpacity(.9));
  sky.step(s.duration);assert.ok(sky.shooting.every(star=>star.id!==s.id));
  for(let i=0;i<600;i++){sky.step(.1);assert.ok(sky.shooting.length<=2);}
  assert.ok(sky.total>=16&&sky.total<=36);
});
test('background scheduling is frame independent and uses its own random source',()=>{
  const a=new BackgroundSky(123),b=new BackgroundSky(123);a.step(60);for(let i=0;i<600;i++)b.step(.1);
  assert.equal(a.total,b.total);assert.ok(Math.abs(a.nextAt-b.nextAt)<1e-9);
  assert.deepEqual(a.stars,b.stars);
  b.step(1,true);assert.deepEqual(b.shooting,[]);assert.deepEqual(b.snapshot(1440,810,true).shooting,[]);
});
test('background canvas commands stay finite in both themes, small viewports and reduced motion',()=>{
  const sky=new BackgroundSky(456);sky.step(sky.nextAt+.6);let strokes=0;
  const ctx=new Proxy({},{get:(_,key)=>(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(key));if(key==='stroke')strokes++;},set:(_,key,value)=>{if(typeof value==='number')assert.ok(Number.isFinite(value),String(key));return true;}});
  for(const dark of [false,true])for(const [width,height] of [[1440,900],[390,844],[844,390]])drawBackground(ctx,sky,{width,height,dark});
  assert.ok(strokes>0);strokes=0;drawBackground(ctx,sky,{width:1440,height:900,reduced:true});assert.equal(strokes,0);
});
