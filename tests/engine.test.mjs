import test from 'node:test';
import assert from 'node:assert/strict';
import { GameModel, CONFIG, segmentDistance } from '../dist/engine.js';

function game(){const g=new GameModel(()=>.5);g.start();g.drainEvents();return g;}
function person(g,state='work',extra={}){
  const p={id:g.nextId++,part:0,x:1150,y:CONFIG.ground-CONFIG.personSize*.2492,state,hunger:100,workX:1150,foodX:708,
    born:0,birthSize:CONFIG.meteorSize,size:CONFIG.personSize,phase:0,vx:0,vy:0,landed:true,denied:false,evacuate:false,...extra};
  g.people.push(p);return p;
}

test('continuous swipe accepts any direction, no speed threshold, one cut per meteor',()=>{
  for(const [a,b] of [[{x:250,y:100},{x:350,y:100}],[{x:300,y:40},{x:300,y:160}],
    [{x:340,y:140},{x:260,y:60}],[{x:300,y:100},{x:301,y:100}]]){
    const g=game();g.spawnMeteor(300,100);assert.equal(g.slice(a,b).length,1);
    assert.equal(g.people.length,2);assert.deepEqual(g.people.map(p=>p.part),[0,1]);
    assert.equal(g.cuts,1);assert.equal(g.slice(a,b).length,0);assert.equal(g.score,110);
  }
  assert.equal(segmentDistance({x:5,y:0},{x:0,y:0},{x:10,y:0}),0);
});

test('cut uses presented screen position after camera transform',()=>{
  const g=game();g.spawnMeteor(300,100);
  assert.equal(g.slice({x:570,y:200},{x:630,y:200},2,m=>({x:m.x*2,y:m.y*2,radius:44})).length,1);
});

test('nine clicks summon and retain excess charge',()=>{
  const g=game();for(let i=0;i<9;i++)g.clickRadar();
  assert.equal(g.meteors.length,1);assert.equal(g.charge,8);
  g.addCharge(210);assert.equal(g.meteors.length,3);assert.equal(g.charge,18);
});

test('nonworkers head to shelter immediately, workers depart one second apart',()=>{
  const g=game();const workers=[person(g),person(g),person(g)];
  const nonworkers=['toWork','toFood','eat'].map(state=>person(g,state));
  g.recall();assert(nonworkers.every(p=>p.state==='toShelter'));
  assert.equal(workers[0].state,'toShelter');assert.equal(workers[1].state,'work');
  assert.equal(g.recall(),false,'repeated button cannot bypass the departure interval');
  g.step(.99);assert.equal(workers[1].state,'work');
  g.step(.01);assert.equal(workers[1].state,'toShelter');assert.equal(workers[2].state,'work');
  g.step(1);assert.equal(workers[2].state,'toShelter');
  const times=g.drainEvents().filter(e=>e.type==='depart'&&workers.some(p=>p.id===e.id)).map(e=>e.time);
  assert.equal(times.length,3);assert(Math.abs(times[1]-times[0]-1)<1e-7);assert(Math.abs(times[2]-times[1]-1)<1e-7);
});

test('shelter accepts all travelers without a capacity limit and releases them normally',()=>{
  const g=game();for(let i=0;i<48;i++)person(g,'toWork',{x:286});
  g.recall();g.step(.1);assert.equal(g.sheltered,48);assert.equal(g.snapshot().capacity,null);
  assert(g.people.every(p=>p.state==='sheltered'));assert(!g.drainEvents().some(e=>e.type==='denied'));
  g.release();assert.equal(g.sheltered,0);assert(g.people.every(p=>p.state==='toWork'&&!p.evacuate));
});

test('falling people wait until landing to walk toward shelter',()=>{
  const g=game();const m=g.spawnMeteor(800,600);g.slice({x:770,y:600},{x:830,y:600});
  g.recall();assert(g.people.every(p=>p.state==='fall'&&p.evacuate));
  for(let i=0;i<300&&g.people.some(p=>p.state==='fall');i++)g.step(1/60);
  assert(g.people.every(p=>p.state==='toShelter'&&p.landed));
});

test('hunger stops work, food replenishes, worker returns',()=>{
  const g=game();const p=person(g,'work',{hunger:.01,x:800,workX:800,foodX:708});
  g.step(.1);assert.equal(p.state,'toFood');
  for(let i=0;i<100&&p.state!=='eat';i++)g.step(.1);assert.equal(p.state,'eat');
  g.step(2.5);assert.equal(p.hunger,100);assert.ok(['jump','toWork'].includes(p.state));
  for(let i=0;i<100&&p.state!=='work';i++)g.step(.1);assert.equal(p.state,'work');
});

test('ground impact preserves the shelter and people away from the falling path',()=>{
  const g=game();person(g,'toWork',{x:300});person(g,'sheltered',{x:300});
  person(g,'fall',{x:300,y:100,landed:false});person(g,'toWork',{x:500});
  g.spawnMeteor(300,CONFIG.ground-CONFIG.meteorSize*.5-.1);g.step(.05);
  assert.equal(g.deaths,1);assert.equal(g.alive,3);assert.equal(g.sheltered,1);assert.equal(g.meteors.length,0);
});

test('meteor moves diagonally under gravity with a frame-independent trajectory',()=>{
  const a=game(),b=game(),m=a.spawnMeteor(300,100),n=b.spawnMeteor(300,100);
  const vx=m.vx;a.step(2);for(let i=0;i<120;i++)b.step(1/60);
  assert.notEqual(vx,0);assert(Math.abs(m.x-(300+vx*2))<1e-7);
  assert(Math.abs(m.y-(100+CONFIG.meteorSpeed*2+.5*CONFIG.meteorGravity*4))<1e-7);
  assert(Math.abs(m.vy-(CONFIG.meteorSpeed+CONFIG.meteorGravity*2))<1e-7);
  assert(Math.abs(m.x-n.x)<1e-7&&Math.abs(m.y-n.y)<1e-7);
});

test('impact location is the ballistic landing point, and impact carries fragment/shake data',()=>{
  const g=game(),m=g.spawnMeteor(300,100);
  const t=(Math.sqrt(m.vy*m.vy+2*CONFIG.meteorGravity*(CONFIG.ground-m.size*.5-m.y))-m.vy)/CONFIG.meteorGravity;
  const expected=m.x+m.vx*t;g.step(8);
  const impact=g.drainEvents().find(e=>e.type==='impact');
  assert(impact);assert(Math.abs(impact.x-expected)<1e-6);assert.equal(impact.y,CONFIG.ground);
  assert.equal(impact.size,CONFIG.meteorSize);assert(impact.vy>CONFIG.meteorSpeed*5);assert.equal(g.meteors.length,0);
});

test('target hitstop leaves world work, the timer and recall schedule running',()=>{
  const g=game();const p=person(g);const q=person(g);g.spawnMeteor(300,100);
  g.slice({x:270,y:100},{x:330,y:100});g.recall();
  const before=q.hunger;g.step(.075);assert(Math.abs(g.realTime-.075)<1e-7);
  assert(Math.abs(g.sceneTime-.075)<1e-7);assert(Math.abs(q.hunger-(before-CONFIG.hungerDrain*.075))<1e-7);
  assert.equal(p.state,'toShelter');g.step(.925);assert.equal(q.state,'toShelter');
  assert(Math.abs(g.remaining-179)<1e-7);
});

test('multiple cuts preserve the first feedback target without global slow motion',()=>{
  const g=game();g.spawnMeteor(300,100);g.slice({x:280,y:100},{x:320,y:100});
  const focus=g.focus;g.step(.05);g.spawnMeteor(900,100);g.slice({x:880,y:100},{x:920,y:100});
  assert.equal(g.focus,focus);assert.equal(g.focus.x,300);g.step(.15);assert.equal(g.timeScale,1);
});

test('paused clock freezes, round ends exactly at 180 real seconds, ended input is locked',()=>{
  const g=game();g.step(10);g.status='paused';g.step(80);assert(Math.abs(g.remaining-170)<1e-7);
  g.status='playing';g.step(200);assert.equal(g.status,'ended');assert.equal(g.remaining,0);
  assert(Math.abs(g.realTime-180)<1e-7);assert.equal(g.clickRadar(),false);assert.equal(g.recall(),false);
  assert.deepEqual(g.slice({x:0,y:0},{x:100,y:100}),[]);
});

test('deterministic full round with production remains finite and ends with correct score',()=>{
  const g=game();let nextClick=0;
  for(let t=0;t<180;t+=.1){
    if(t>=nextClick){g.clickRadar();nextClick+=.2;}
    for(const m of [...g.meteors])if(m.id%5!==0)g.slice({x:m.x-30,y:m.y},{x:m.x+30,y:m.y});
    if(t>90&&t<90.1)g.recall();if(t>130&&t<130.1)g.release();g.step(.1);g.drainEvents();
  }
  assert.equal(g.status,'ended');assert(g.cuts>30);assert(g.alive>0);assert(g.sheltered<=g.alive);
  assert.equal(g.score,Math.max(0,g.cuts*100+g.alive*5-g.bombPenalty));assert(g.people.every(p=>Number.isFinite(p.x)&&p.hunger>=0&&p.hunger<=100));
});
