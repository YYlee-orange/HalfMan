import test from 'node:test';
import assert from 'node:assert/strict';
import {LevelDragMotion} from '../dist/level-drag.js';
import {GameModel} from '../dist/engine.js';
import {levelRoundSeconds} from '../dist/level-rules.js';
const motion=()=>{const m=new LevelDragMotion();m.setBounds(1000);m.setPosition(400);return m;};
test('a tap stays clickable, horizontal drags follow the pointer and release decays with inertia',()=>{
  const m=motion();m.begin(500,100,0);assert.equal(m.move(497,101,.02),false);assert.equal(m.end(.03),false);assert.equal(m.position,400);m.begin(500,100,1);assert.equal(m.move(400,100,1.1),true);assert.equal(m.move(300,100,1.2),true);assert.equal(m.position,600);assert.equal(m.end(1.21),true);const v=m.velocity;assert.ok(v>0);m.step(.1);assert.ok(m.position>600&&m.velocity<v);for(let i=0;i<60;i++)m.step(1/60);assert.equal(m.velocity,0);
});
test('inertial positions agree across frame rates, remain bounded and stop immediately when caught again',()=>{
  const states=[];for(const fps of [30,60,120]){const m=motion();m.begin(500,100,0);m.move(350,100,.2);m.end(.21);for(let i=0;i<fps/2;i++)m.step(1/fps);states.push(m.position);}assert.ok(Math.max(...states)-Math.min(...states)<1e-8);
  const m=motion();m.begin(100,100,0);m.move(-900,100,.1);m.end(.11);m.step(.1);assert.equal(m.position,1000);assert.equal(m.velocity,0);m.begin(200,100,1);m.move(260,100,1.1);assert.equal(m.position,940);m.end(1.11);m.begin(100,100,1.12);assert.equal(m.velocity,0);m.stop();assert.equal(m.gesture,null);m.setBounds(0);assert.equal(m.position,0);
});
test('holding still before release, cancellation and reduced motion suppress unwanted coasting',()=>{
  const m=motion();m.begin(400,100,0);m.move(300,100,.1);m.end(1);m.step(.1);assert.equal(m.velocity,0);m.begin(400,100,2);m.move(300,100,2.1);m.end(2.11,true);assert.equal(m.velocity,0);m.begin(400,100,3);m.move(300,100,3.1);m.end(3.11);const x=m.position;m.step(.1,true);assert.equal(m.position,x);assert.equal(m.velocity,0);
});
test('only the fifth level lasts five minutes; pause and restart preserve the selected duration',()=>{
  for(const level of ['man-1','man-2','man-3','man-4','future-level']){const g=new GameModel(()=>.5);g.start(level);assert.equal(levelRoundSeconds(level),180);assert.equal(g.remaining,180);}
  const g=new GameModel(()=>.5);g.start('man-5');assert.equal(g.remaining,300);assert.equal(g.snapshot().roundSeconds,300);g.step(1);g.status='paused';g.step(120);assert.ok(Math.abs(g.remaining-299)<1e-8);g.start('man-5');assert.equal(g.remaining,300);g.start('man-4');assert.equal(g.remaining,180);
});
test('the fifth level continues after three minutes and ends exactly once at five minutes',()=>{
  const g=new GameModel(()=>.5);g.start('man-5');g.drainEvents();g.step(180);assert.equal(g.status,'playing');assert.ok(Math.abs(g.remaining-120)<1e-7);assert.equal(g.drainEvents().filter(e=>e.type==='end').length,0);g.step(120);assert.equal(g.status,'ended');assert.equal(g.remaining,0);assert.ok(Math.abs(g.realTime-300)<1e-7);assert.equal(g.drainEvents().filter(e=>e.type==='end').length,1);g.step(10);assert.equal(g.drainEvents().length,0);
});
