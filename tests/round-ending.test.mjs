import test from 'node:test';
import assert from 'node:assert/strict';
import {GameModel} from '../dist/engine.js';
import {RoundEnding} from '../dist/round-ending.js';
import {meteorView} from '../dist/body-geometry.js';
import {bombletView} from '../dist/bomb-physics.js';

test('all existing and future levels end with stationary cosmetic bursts and frozen results including farm income',()=>{
  for(const level of ['man-1','man-2','man-3','man-4','man-5','future-level'])for(const [w,h]of [[1440,900],[390,844],[844,390]]){
    const g=new GameModel(()=>.5);g.start(level);g.setViewport(w,h);g.cuts=7;g.bombPenalty=90;g.cannonBonus=125;
    if(level==='man-3'||level==='man-4'||level==='man-5'){g.farmBonus=279;g.farmHarvests=9;}
    g.spawnMeteor(450,120,1,'man');const bomb=g.spawnMeteor(700,200,undefined,'bomb');bomb.arm={time:0,expand:1,contract:1};
    g.bomblets.push({id:999,part:0,sourceSize:90,size:24,width:24,height:24,x:620,y:340,vx:180,vy:100,angle:0,spin:2,born:0});
    const points=[...g.meteors.map(m=>meteorView(m,g.view)),bombletView(g.bomblets[0],g.view)];g.people.push({id:1000,state:'fall',x:450,y:120,hunger:80});g.cannon.bullets.push({id:1});g.cannon.aiming=g.cannon.trigger=true;g.status='ended';g.remaining=0;g.drainEvents();
    const before={score:g.score,cuts:g.cuts,deaths:g.deaths,alive:g.alive,penalty:g.bombPenalty,bonus:g.cannonBonus,farm:g.farmBonus,harvests:g.farmHarvests,real:g.realTime,scene:g.sceneTime},ending=new RoundEnding(),bursts=ending.start(g);
    assert.equal(bursts.length,3);bursts.forEach((b,i)=>{assert.ok(Math.hypot(b.x*g.view.sx-points[i].x,b.y*g.view.sy-points[i].y)<1e-8);});
    assert.deepEqual(bursts.map(b=>b.kind),['man','bomb','child']);assert.equal(g.meteors.length+g.bomblets.length+g.cannon.bullets.length,0);assert.equal(g.cannon.aiming,false);assert.equal(g.cannon.trigger,false);assert.equal(ending.step(.99),false);assert.equal(ending.step(.01),true);assert.equal(ending.step(3),false);g.step(100);
    assert.deepEqual({score:g.score,cuts:g.cuts,deaths:g.deaths,alive:g.alive,penalty:g.bombPenalty,bonus:g.cannonBonus,farm:g.farmBonus,harvests:g.farmHarvests,real:g.realTime,scene:g.sceneTime},before);assert.deepEqual(g.drainEvents(),[]);assert.deepEqual(ending.start(g),[]);
  }
});
test('empty skies and reduced motion settle promptly; the cosmetic clock is reset for the next round',()=>{
  const g=new GameModel(),ending=new RoundEnding();g.start('man-1');assert.deepEqual(ending.start(g),[]);assert.equal(ending.phase,'idle');g.status='ended';ending.start(g);assert.equal(ending.step(.28),true);ending.reset();assert.deepEqual(ending.snapshot(),{phase:'idle',elapsed:0,delay:0,count:0});
  g.spawnMeteor(500,200,1,'man');ending.start(g,true);assert.equal(ending.delay,.24);assert.equal(ending.step(.24),true);const time=ending.elapsed;ending.step(NaN);ending.step(-2);assert.equal(ending.elapsed,time);
});
