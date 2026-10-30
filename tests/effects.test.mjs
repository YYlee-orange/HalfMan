import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebris,debrisAt,impactShakeAt} from '../dist/effects.js';

test('impact emits many deterministic fragments with a broad range of sizes and velocities',()=>{
  const a=createDebris(17);assert.equal(a.length,56);assert.deepEqual(a,createDebris(17));
  assert.notDeepEqual(a,createDebris(18));assert(Math.min(...a.map(p=>p.size))<2);
  assert(Math.max(...a.map(p=>p.size))>12);assert(a.every(p=>p.vy<0));
  assert(a.some(p=>p.vx<0)&&a.some(p=>p.vx>0));
});
test('fragments follow gravity, bounce and remain at or above the ground',()=>{
  const p={vx:120,vy:-300,angle:.3,spin:4};
  const q=debrisAt(p,.2);assert.equal(q.x,24);assert.equal(q.y,-42);assert.equal(q.angle,1.1);
  assert(debrisAt(p,.7).y<0);assert.equal(debrisAt(p,2).y,0);
});
test('strong impact shake is brief, bounded and settles exactly to zero',()=>{
  const values=Array.from({length:350},(_,i)=>impactShakeAt(i/1000,22));
  assert(Math.max(...values.map(q=>Math.abs(q.dy)))>15);
  assert(values.every(q=>Math.abs(q.dx)<=22*.7&&Math.abs(q.dy)<=22));
  assert.deepEqual(impactShakeAt(.34,22),{dx:0,dy:0,envelope:0});
});
