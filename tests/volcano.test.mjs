import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AVAILABLE_LEVEL_COUNT,levelFeatures} from '../dist/level-rules.js';
import {GameModel,CONFIG} from '../dist/engine.js';
import {FARM_CROPS} from '../dist/farm.js';
import {farmEnabled,FARM_RULES} from '../dist/farm-physics.js';
import {guidanceFor} from '../dist/chapter-guidance.js';
import {MechanismGuidance} from '../dist/mechanism-guidance.js';
import {FARM_GUIDANCE} from '../dist/farm-guidance.js';
import {VOLCANO,VOLCANO_SHAPES,VolcanoRenderer,volcanoFrame,volcanoGeometry,volcanoSvg} from '../dist/volcano.js';
import {viewMetrics} from '../dist/body-geometry.js';
import {halfHeight} from '../dist/variants.js';
test('fourth level shares every third-level mechanism and has its own title without the agriculture teaching sequence',()=>{
  assert.equal(AVAILABLE_LEVEL_COUNT,5);assert.deepEqual({...levelFeatures('man-4'),volcano:false},levelFeatures('man-3'));assert.equal(levelFeatures('man-4').volcano,true);
  const g=new GameModel(()=>.5);g.start('man-4');assert.equal(g.shield.enabled,true);assert.equal(g.cannon.enabled,true);assert.equal(farmEnabled('man-4'),true);assert.equal(g.farmState.enabled,true);assert.equal(g.remaining,180);assert.equal(g.farmState.capacity,9);
  assert.deepEqual(guidanceFor('man-4').chapter.config.lines,['曼之四','火山']);assert.equal(guidanceFor('man-4').tutorial,false);const hints=new MechanismGuidance(FARM_GUIDANCE);hints.start('man-4');assert.equal(hints.snapshot(10,false,g.view).stage,'hidden');
  assert.equal(farmEnabled('man-2'),false);assert.equal(levelFeatures('man-3').volcano,false);
});
test('fourth-level falling people board, heal and produce the same income; shield and cannon remain usable without drafting farmers',()=>{
  const g=new GameModel(()=>.5);g.start('man-4');g.reducedMotion=true;const f=g.farmGeometryAt(),p={id:g.nextId++,part:0,variantId:1,x:(f.x+42*f.scale)/g.view.sx,y:0,size:64,birthSize:64,born:-10,phase:0,vx:0,vy:500,hunger:10,state:'fall',landed:false,workX:1250,foodX:708};
  p.y=(f.y+FARM_RULES.deckY*f.scale-35)/g.view.sy-halfHeight(p);g.people.push(p);g.step(.2);assert.equal(p.state,'farm');const crop=FARM_CROPS.find(c=>c.id===p.farm.cropId);p.farm.x=crop.x;p.farm.y=crop.y;p.farm.ready=true;p.farm.progress=11.99;g.step(.02);assert.equal(g.farmBonus,15);assert.ok(p.hunger>10);
  assert.equal(g.clickShield(),true);g.step(.7);assert.equal(g.shieldState.active,true);g.toggleCannon();g.cannon.trigger=true;g.step(.02);assert.equal(g.cannon.shots,1);assert.equal(g.cannonCrew.length,0);assert.equal(p.state,'farm');g.recall();assert.equal(p.state,'farm');
});
test('the export and opaque canvas renderer share five base shapes and three flat colors, with finite geometry',()=>{
  assert.equal(fs.readFileSync(new URL('../dist/assets/volcano.svg',import.meta.url),'utf8'),volcanoSvg());const svg=volcanoSvg();assert.ok(!/gradient|filter|<image|<text|stroke=/i.test(svg));assert.equal(new Set(Object.values(VOLCANO.colors)).size,3);assert.equal((svg.match(/<path /g)||[]).length,5);
  const colors=new Set(),fills=[],alpha=[],renderer=new VolcanoRenderer(d=>d),ctx=new Proxy({fill(path){fills.push(path);},stroke(){throw Error('volcano should use flat fills');}},{get:(t,k)=>k in t?t[k]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},set:(_,k,v)=>{if(k==='fillStyle')colors.add(v);if(k==='globalAlpha')alpha.push(v);return true;}});
  for(const [w,h]of [[1440,900],[390,844],[844,390],[320,220]])for(const dark of [false,true])for(const reduced of [false,true]){
    const view=viewMetrics(w,h),g=volcanoGeometry(view),f=volcanoFrame('man-4',view,2,reduced);assert.ok(g.x>0&&g.x<w&&g.width>0&&g.y-g.height>=0&&g.y<=h);renderer.draw(ctx,f,dark);if(reduced)assert.equal(f.drift,0);
    assert.equal(volcanoFrame('man-3',view).enabled,false);
  }
  assert.deepEqual([...colors].sort(),Object.values(VOLCANO.colors).sort());assert.deepEqual(fills.slice(0,4),VOLCANO_SHAPES.slice(0,4).map(s=>s.d));assert.equal(fills[4],volcanoFrame('man-4',viewMetrics(1440,900),2).magma);assert.ok(alpha.every(a=>a===1));
});
