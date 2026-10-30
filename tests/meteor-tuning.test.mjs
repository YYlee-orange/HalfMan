import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel,CONFIG,meteorFallTime} from '../dist/engine.js';
import {CUT_DEFAULTS,applyCutSettings} from '../dist/cut-settings.js';
const game=()=>{const g=new GameModel(()=>.5);g.start();return g;};
test('meteor initial speed applies to new summons and acceleration changes existing flight',()=>{
  try{
    applyCutSettings({meteorSpeed:60,meteorGravity:80},{persist:false});
    const g=game(),m=g.spawnMeteor(700,100,13);m.vx=0;
    assert.equal(m.vy,60);g.step(1);assert.ok(Math.abs(m.y-200)<1e-7);assert.ok(Math.abs(m.vy-140)<1e-7);
    applyCutSettings({meteorSpeed:120,meteorGravity:20},{persist:false});
    const n=g.spawnMeteor(1000,100,13);n.vx=0;assert.equal(n.vy,120);assert.ok(Math.abs(m.vy-140)<1e-7);
    g.step(1);assert.ok(Math.abs(m.y-350)<1e-7);assert.ok(Math.abs(m.vy-160)<1e-7);
    assert.ok(Math.abs(n.y-230)<1e-7);assert.ok(Math.abs(n.vy-140)<1e-7);
  }finally{applyCutSettings(CUT_DEFAULTS,{persist:false});}
});
test('zero acceleration gives linear flight and an exact finite impact point',()=>{
  try{
    applyCutSettings({meteorSpeed:200,meteorGravity:0},{persist:false});
    const g=game(),m=g.spawnMeteor(700,100,13),flight=meteorFallTime(CONFIG.ground-m.size/2-m.y,m.vy,0),x=m.x+m.vx*flight;
    g.step(1);assert.ok(Math.abs(m.y-300)<1e-7);assert.equal(m.vy,200);
    g.step(4);const impact=g.drainEvents().find(e=>e.type==='impact');assert.ok(impact);
    assert.ok(Math.abs(impact.x-x)<1e-7);assert.equal(impact.vy,200);
    applyCutSettings({meteorSpeed:0},{persist:false});const suspended=g.spawnMeteor(700,100,13);g.step(1);
    assert.equal(suspended.y,100);assert.equal(suspended.vy,0);assert.equal(meteorFallTime(100,0,0),Infinity);
    assert.equal(meteorFallTime(0,0,0),0);
  }finally{applyCutSettings(CUT_DEFAULTS,{persist:false});}
});
