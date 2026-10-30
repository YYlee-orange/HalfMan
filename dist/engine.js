import {VARIANTS,variantOf,halfHeight,SIZE_LEVELS} from './variants.js';
import {BOMB_GLYPH} from './bomb-metrics.js';
import {makeBomblets,advanceBomblet,bombletView} from './bomb-physics.js';
import {chooseWorkAnchor,radarWorldPoint,radarIdle,RadarResponse,RADAR_SCALE} from './radar.js';
import {progressionAt} from './progression.js';
import {FOOD_X,chooseFoodAnchor,foodWorldPoint,groundAnchor} from './facilities.js';
import {jumpProgress} from './movement.js';
import {viewMetrics,meteorView,personView} from './body-geometry.js';
import {CUT,cutKinematics,advanceCutFragment,advanceCutPose} from './cut-motion.js';
import {SCORE_RULES,scoreTotal,scoreSource,scoreChange} from './score-rules.js';
import {SHIELD,RadarShield,shieldCircle,shieldContains,shieldContact} from './shield.js';
import {CANNON,Cannon,cannonBulletRadius,shotIntersects} from './cannon.js';
import {FARM_CROPS,farmGeometry} from './farm.js';
import {FARM_RULES,onFarm,farmFoot,farmContact,farmYield,emptyCrop,farmEnabled} from './farm-physics.js';
import {levelFeatures,levelRoundSeconds,DEFAULT_ROUND_SECONDS} from './level-rules.js';
import {volcanoFrame} from './volcano.js';
import {VOLCANO_RULES,volcanoLaunch} from './volcano-physics.js';
import {NuclearStrike} from './nuclear.js';
export const CONFIG = Object.freeze({
  width:1440, height:810, ground:808, roundSeconds:DEFAULT_ROUND_SECONDS,
  chargeMax:100, clickCharge:12, workerCharge:3.2,
  hungerMax:100, hungerDrain:4, foodRate:42, walkSpeed:48,
  recallInterval:1, ...SCORE_RULES,
  meteorSize:82, personSize:64, meteorSpeed:30, meteorGravity:34, meteorDrift:48, impactRadius:72,
  impactDebris:84, impactShake:22, impactDuration:.34,
  foodX:FOOD_X, shelterX:303, workMinX:1000, workMaxX:1390,
  focusDuration:.11,
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Stable for zero acceleration and zero initial speed, including a suspended meteor.
export function meteorFallTime(distance,velocity,gravity){
  if(distance<=0)return 0;
  const denominator=Math.sqrt(velocity*velocity+2*gravity*distance)+velocity;
  return denominator>0?2*distance/denominator:Infinity;
}
export function segmentDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d,0,1):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export class GameModel {
  constructor(random=Math.random,scoreRules=SCORE_RULES){this.random=random;this.scoreRules={...SCORE_RULES,...scoreRules};this.view=viewMetrics();this.reducedMotion=false;this.reset();}
  get ground(){return CONFIG.ground;}
  setViewport(width,height){this.view=viewMetrics(width,height);if(this.cannon?.enabled)this.cannon.setAim(this.cannon.aim.x*this.view.sx,this.cannon.aim.y*this.view.sy,this.view,CONFIG.ground);}
  radarPose(){
    const response=this.radarResponse.snapshot(),enabled=!this.reducedMotion;
    return{...response,press:enabled?response.press:0,release:0,reduced:this.reducedMotion,scale:this.radarScale,...radarIdle(this.realTime,enabled)};
  }
  reset(){
    this.status='ready';this.realTime=0;this.sceneTime=0;this.roundSeconds=CONFIG.roundSeconds;this.remaining=this.roundSeconds;
    this.levelId=null;this.shield=new RadarShield();this.cannon=new Cannon();this.cannonBonus=0;this.cannonKills=0;this.farmBonus=0;this.farmHarvests=0;
    this.charge=0;this.cuts=0;this.deaths=0;this.clicks=0;this.people=[];this.meteors=[];this.bomblets=[];this.bombPenalty=0;this.bombExplosions=0;
    this.events=[];this.nextId=1;this.recallActive=false;this.recallQueue=[];
    this.nextDeparture=0;this.focus=null;this.recallGeneration=0;
    this.variantBag=[];this.totalCharge=0;this.summonWaves=0;this.previousRadarScale=RADAR_SCALE;
    this.radarPulse=-10;this.summonPulse=-10;this.radarResponse=new RadarResponse();
    this.cutStopUntil=-10;this.cutCooldownUntil=-10;this.cutCue=null;
    this.volcanoPulse=-10;this.volcanoEruptions=0;
    this.nuclear=new NuclearStrike();
  }
  start(levelId='man-1'){this.reset();this.levelId=levelId;this.roundSeconds=levelRoundSeconds(levelId);this.remaining=this.roundSeconds;const features=levelFeatures(levelId);this.shield=new RadarShield(features.shield);this.cannon=new Cannon(features.cannon);this.nuclear=new NuclearStrike(features.nuclear);this.status='playing';this.emit('start');}
  emit(type,extra={}){
    if(type==='radar'||type==='radarProgress'){
      this.radarResponse.trigger();this.radarPulse=this.realTime;
    }
    if(type==='summon'){this.summonPulse=this.realTime;this.radarResponse.trigger(.5);}
    if(type==='volcanoErupt'){this.volcanoPulse=this.sceneTime;this.volcanoEruptions++;}
    this.events.push({type,time:this.realTime,sceneTime:this.sceneTime,...extra});
  }
  drainEvents(){return this.events.splice(0);}
  get alive(){return this.people.filter(p=>p.state!=='dead').length;}
  get sheltered(){return this.people.filter(p=>p.state==='sheltered').length;}
  get workers(){return this.people.filter(p=>p.state==='work').length;}
  get score(){return scoreTotal({cuts:this.cuts,alive:this.alive,penalty:this.bombPenalty,bonus:this.cannonBonus+this.farmBonus},this.scoreRules);}
  get farmWorkers(){return this.people.filter(p=>p.state==='farm');}
  get volcanoState(){return{...volcanoFrame(this.levelId,this.view,this.sceneTime,this.reducedMotion,this.volcanoPulse),eruptionCount:this.volcanoEruptions};}
  get nuclearState(){return this.nuclear.snapshot(this.realTime);}
  requestNuclear(force=false){if(this.status!=='playing'||!this.nuclear.request(this.realTime,force))return false;this.emit('nuclearWarning',this.nuclearState);return true;}
  noteNuclearBomb(id){if(this.nuclear.noteBomb(id,this.realTime))this.emit('nuclearWarning',this.nuclearState);}
  stepNuclear(){
    for(const event of this.nuclear.step(this.realTime,this.view,CONFIG.ground)){
      if(event.type==='nuclearBlast'){
        for(const p of this.people)if(p.state!=='dead'&&p.state!=='sheltered')this.killPerson(p,false);
        this.meteors=[];this.bomblets=[];
      }
      this.emit(event.type,{...event,flashDuration:CUT.nuclearFlash});
    }
  }
  get farmState(){return{enabled:farmEnabled(this.levelId),capacity:FARM_RULES.capacity,workers:this.farmWorkers.length,bonus:this.farmBonus,harvests:this.farmHarvests,crops:this.farmWorkers.map(p=>({id:p.id,cropId:p.farm.cropId,progress:p.farm.progress/FARM_RULES.cycle}))};}
  get cannonCrew(){return this.people.filter(p=>p.state==='cannon');}
  get cannonState(){return this.cannon.snapshot(this.realTime,this.cannonCrew.length,this.people.filter(p=>p.state==='cannon'||p.state!=='dead'&&p.cannonDraft).length);}
  aimCannon(x,y){if(this.status==='playing'&&this.cannon.aiming)this.cannon.setAim(x,y,this.view,CONFIG.ground);}
  toggleCannon(){
    if(this.status!=='playing'||!this.cannon.toggle(this.realTime))return false;
    if(this.cannon.aiming){this.cannon.setAim(this.cannon.aim.x*this.view.sx,this.cannon.aim.y*this.view.sy,this.view,CONFIG.ground);this.fillCannon();}
    else for(const p of this.people)if(p.cannonDraft){
      delete p.cannonDraft;
      if(p.state==='cannon')continue;
      if(p.state==='toCannon')p.state='toWork';
      else if(p.state==='jump'&&p.jump.nextState==='toCannon')p.jump.nextState='toWork';
      if(p.state!=='dead'&&p.hunger<=0&&p.state!=='fall'){this.planFood(p);if(p.state==='jump')p.jump.nextState='toFood';else p.state='toFood';}
      if(this.recallActive)this.goalShelter(p);
    }
    this.emit('cannonMode',{aiming:this.cannon.aiming});return true;
  }
  fillCannon(){
    if(!this.cannon.aiming)return;
    const slots=CANNON.capacity-this.people.filter(p=>p.state==='cannon'||p.state!=='dead'&&p.cannonDraft).length;
    const candidates=this.people.filter(p=>!p.cannonDraft&&!onFarm(p)&&!['dead','work','cannon'].includes(p.state)).sort((a,b)=>Math.abs(a.x-CANNON.x)-Math.abs(b.x-CANNON.x));
    for(const p of candidates.slice(0,Math.max(0,slots))){
      p.cannonDraft=true;p.evacuate=false;
      if(p.state==='sheltered'){p.x=CONFIG.shelterX+12;p.y=CONFIG.ground-halfHeight(p);p.landed=true;}
      if(p.state==='fall')continue;
      if(p.onFood)this.leaveFood(p,'toCannon');
      else if(p.state==='jump')this.jumpPerson(p,p.x,CONFIG.ground,'toCannon',{height:48,duration:.6});
      else p.state='toCannon';
    }
  }
  stepCannon(dt){
    if(!this.cannon.enabled)return;
    this.fillCannon();this.cannon.step(dt,this.realTime,this.cannonCrew.length,this.view,CONFIG.ground,this.random,(type,data)=>this.emit(type,data));
    for(const b of this.cannon.bullets){
      const a={x:b.x*this.view.sx,y:b.y*this.view.sy};b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;
      const end={x:b.x*this.view.sx,y:b.y*this.view.sy};
      const targets=[...this.meteors.map(body=>({body,view:meteorView(body,this.view),kind:body.kind})),...this.bomblets.map(body=>({body,view:bombletView(body,this.view),kind:'child'}))].filter(t=>!t.body.shotDown&&!t.body.impacted&&!t.body.exploded).sort((x,y)=>Math.hypot(x.view.x-a.x,x.view.y-a.y)-Math.hypot(y.view.x-a.x,y.view.y-a.y));
      const hit=targets.find(t=>shotIntersects(a,end,t.view,cannonBulletRadius(this.view)));if(!hit)continue;
      b.hit=true;hit.body.shotDown=true;const before=this.score,points=hit.kind==='man'?this.scoreRules.cutPoints*.75:hit.kind==='bomb'?50:0;
      this.cannonBonus+=points;this.cannonKills++;this.emit('cannonHit',{id:hit.body.id,x:hit.view.x/this.view.sx,y:hit.view.y/this.view.sy,kind:hit.kind,tone:hit.body.tone??0,body:{...hit.body}});
      if(hit.kind==='bomb')this.noteNuclearBomb(hit.body.id);
      if(points)this.recordScore(before,hit.kind==='man'?'cannonMan':'cannonBomb',points);
    }
    this.cannon.bullets=this.cannon.bullets.filter(b=>!b.hit&&b.age<CANNON.bulletLife&&b.y>-200&&b.x>-200&&b.x<1640);
    this.meteors=this.meteors.filter(m=>!m.shotDown);this.bomblets=this.bomblets.filter(c=>!c.shotDown);
  }
  recordScore(before,source,value=0){this.emit('scoreChange',scoreChange(before,this.score,typeof source==='string'?scoreSource(source,this.scoreRules,value):source));}
  get timeScale(){return 1;}
  get progression(){return progressionAt(this.realTime);}
  get radarScale(){return RADAR_SCALE*this.progression.radarFactor;}
  get chargeMax(){return CONFIG.chargeMax*this.progression.radarFactor;}
  get chargePercent(){return this.charge/this.chargeMax*100;}
  get shieldState(){return this.shield.snapshot(this.realTime,this.reducedMotion);}
  shieldGeometry(growth=this.shieldState.growth){return this.shield.enabled?shieldCircle(this.view,CONFIG.ground,this.radarScale,growth):null;}
  clickShield(){
    if(this.status!=='playing'||!this.shield.activate(this.realTime))return false;
    this.emit('shieldActivate');return true;
  }
  isShieldProtected(p,point=null){
    if(!this.shield.enabled||!this.shieldState.active)return false;
    const q=point??personView(p,this.view,CONFIG.ground,this.sceneTime,this.radarPose());
    return shieldContains(q,this.shieldGeometry());
  }
  interceptShield(a,b){return this.shield.enabled&&this.shieldState.active?shieldContact(a,b,this.shieldGeometry()):null;}
  clickRadar(){if(this.status!=='playing')return false;this.clicks++;this.addCharge(CONFIG.clickCharge*this.progression.radarFactor);this.emit('radar');return true;}
  addCharge(value){
    if(value<=0||!Number.isFinite(value))return;
    const maximum=this.chargeMax,before=Math.floor((this.charge/maximum*100+1e-8)/10);this.totalCharge+=value;
    const after=Math.floor(((this.charge+value)/maximum*100+1e-8)/10);
    for(let bucket=before+1;bucket<=after;bucket++)this.emit('radarProgress',{percent:((bucket-1)%10+1)*10});
    this.charge+=value;
    while(this.charge+1e-8>=maximum){this.charge=Math.max(0,this.charge-maximum);this.summonWave();}
  }
  summonWave(){
    const growth=this.progression,count=growth.guaranteed+(growth.extraChance>0&&this.random()<growth.extraChance?1:0);
    this.summonWaves++;for(let i=0;i<count;i++)this.spawnMeteor();
    this.emit('summonWave',{count,multiplier:growth.summonMultiplier});return count;
  }
  syncRadarGrowth(){
    const scale=this.radarScale,previous=this.previousRadarScale;if(scale===previous)return;
    for(const p of this.people){
      if(p.workAnchor){
        const a=radarWorldPoint(p.workAnchor,CONFIG.ground,previous),b=radarWorldPoint(p.workAnchor,CONFIG.ground,scale);
        if(Number.isFinite(p.workX))p.workX+=b.x-a.x;
        if(p.state==='work'&&p.onRadar){p.x=b.x;p.y=b.y-halfHeight(p);}
      }
      if(p.state==='jump'&&p.jump.toAnchor?.facility==='radar'){
        const b=radarWorldPoint(p.jump.toAnchor,CONFIG.ground,scale);p.jump.toX=b.x;p.jump.toY=b.y;
      }
    }
    this.previousRadarScale=scale;this.emit('radarGrowth',{...this.progression});
  }
  takeVariant(){
    if(!this.variantBag.length){
      this.variantBag=VARIANTS.map(v=>v.id);
      for(let i=this.variantBag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.variantBag[i],this.variantBag[j]]=[this.variantBag[j],this.variantBag[i]];}
    }
    return this.variantBag.pop();
  }
  spawnMeteor(x,y,variantId,kind,options={}){
    if(x==null&&y==null&&this.nuclear.chance(this.realTime,this.random))this.emit('nuclearWarning',this.nuclearState);
    const bomb=kind==='bomb'||(kind!=='man'&&variantId==null&&this.random()<CUT.bombChance);
    const variant=variantOf(bomb?2:variantId??this.takeVariant()),size=CONFIG.meteorSize*(bomb?SIZE_LEVELS.at(-1):variant.sizeScale),ratio=bomb?BOMB_GLYPH.ratio:variant.ratio;
    const volcanic=levelFeatures(this.levelId).volcano&&(options.source==='volcano'||options.source!=='sky'&&x==null&&y==null&&this.random()<VOLCANO_RULES.chance);
    if(volcanic){
      const launch=volcanoLaunch(this.view,this.sceneTime,this.reducedMotion,this.volcanoPulse,{size,ratio},CUT.meteorGravity,this.random);
      const meteor={id:this.nextId++,kind:bomb?'bomb':'man',ratio,variantId:variant.id,fontId:variant.fontId,tone:bomb?0:variant.tone,sizeLevel:variant.sizeLevel,size,...launch};
      this.meteors.push(meteor);this.emit('volcanoErupt',{id:meteor.id,x:launch.mouth.x/this.view.sx,y:launch.mouth.y/this.view.sy});this.emit('summon',{id:meteor.id,x:meteor.x,y:meteor.y,meteor:{...meteor}});return meteor;
    }
    const startX=x??(105+this.random()*1230);
    let vx=(this.random()<.5?-1:1)*(CONFIG.meteorDrift+this.random()*18);
    const tilt=Math.sign(vx)*(.18+this.random()*.12),v=this.view;
    const extent=meteorView({x:startX,y:0,size,tilt,variantId:variant.id,ratio},v);
    const startY=y??(-28-this.random()*25-extent.ry-size*.5*(v.sy-v.character))/v.sy;
    const distance=Math.max(0,CONFIG.ground-size*.5-startY);
    const flight=meteorFallTime(distance,CUT.meteorSpeed,CUT.meteorGravity);
    if(Number.isFinite(flight)&&(startX+vx*flight<70||startX+vx*flight>1370))vx=-vx;
    const meteor={id:this.nextId++,kind:bomb?'bomb':'man',ratio,variantId:variant.id,fontId:variant.fontId,tone:bomb?0:variant.tone,sizeLevel:variant.sizeLevel,x:startX,y:startY,vx,vy:CUT.meteorSpeed,size,tilt:Math.sign(vx)*Math.abs(tilt)};
    this.meteors.push(meteor);this.emit('summon',{id:meteor.id,x:meteor.x,y:meteor.y,meteor:{...meteor}});return meteor;
  }
  slice(a,b,radius=3,project=null,gesture={}){
    if(this.status!=='playing'||this.cannon.aiming||Math.hypot(b.x-a.x,b.y-a.y)<.5)return [];
    const targets=this.meteors.filter(m=>{
      if(m.arm)return false;
      const p=project?project(m):m;
      if(m.kind==='bomb'){
        const rx=(p.rx??m.size*m.ratio/2)+radius,ry=(p.ry??m.size/2)+radius;
        return segmentDistance({x:p.x/rx,y:p.y/ry},{x:a.x/rx,y:a.y/ry},{x:b.x/rx,y:b.y/ry})<=1;
      }
      return segmentDistance(p,a,b)<=(p.radius??m.size*.52)+radius;
    });
    for(const m of targets)if(m.kind==='bomb'){
      m.arm={time:this.realTime,expand:CUT.bombExpand,contract:CUT.bombContract,radius:CUT.bombChargeRadius,opacity:CUT.bombChargeOpacity};
      this.emit('bombArm',{id:m.id,meteor:{...m}});
    }
    const hits=targets.filter(m=>m.kind!=='bomb');
    if(!hits.length)return hits;
    const ids=new Set(hits.map(m=>m.id));this.meteors=this.meteors.filter(m=>!ids.has(m.id));
    let releaseAt=this.realTime;
    if(this.realTime<this.cutStopUntil)releaseAt=this.cutStopUntil;
    else if(this.realTime>=this.cutCooldownUntil){releaseAt=this.realTime+CUT.hitStop;this.cutStopUntil=releaseAt;this.cutCooldownUntil=this.realTime+CUT.hitCooldown;}
    if(!this.focus||this.realTime-this.focus.time>=CONFIG.focusDuration)this.focus={time:this.realTime,x:hits[0].x,y:hits[0].y,size:hits[0].size};
    for(const m of hits){
      const scoreBefore=this.score;
      this.cuts++;
      const variant=variantOf(m.variantId);
      const kinematics=cutKinematics(m,a,b,gesture,this.random),origin=meteorView(m,this.view);
      if(!this.cutCue||this.realTime-this.cutCue.time>=CUT.cameraDuration)this.cutCue={time:this.realTime,dir:kinematics.dir,strength:kinematics.strength};
      else if(kinematics.strength>this.cutCue.strength)this.cutCue={...this.cutCue,dir:kinematics.dir,strength:kinematics.strength};
      const children=[];
      for(let part=0;part<2;part++){
        const workAnchor=chooseWorkAnchor(this.random,this.people.filter(p=>p.state!=='dead').map(p=>p.workAnchor),this.view,this.radarScale),spot=radarWorldPoint(workAnchor,CONFIG.ground,this.radarScale);
        children.push(this.nextId);
        const size=CONFIG.personSize*variant.sizeScale,offset=(part?1:-1)*m.size*variant.ratio/4*this.view.character,half=size*variant.ratio/4;
        this.people.push({id:this.nextId++,part,variantId:variant.id,fontId:variant.fontId,tone:variant.tone,sizeLevel:variant.sizeLevel,
          x:(origin.x+Math.cos(m.tilt)*offset)/this.view.sx,y:(origin.y+Math.sin(m.tilt)*offset-half*(this.view.sy-this.view.character))/this.view.sy,
          vx:0,vy:0,size,birthSize:m.size,cutMotion:true,motionAge:0,spinAngle:0,angularVelocity:0,
          releaseAt,pendingImpulse:kinematics.impulses[part],
          birthX:m.x,birthY:m.y,born:this.sceneTime,birthTilt:m.tilt,state:'fall',hunger:CONFIG.hungerMax,phase:this.random()*Math.PI*2,
          volcanoTrail:m.source==='volcano',
          workAnchor,workX:groundAnchor(workAnchor)?spot.x:clamp(spot.x-40+this.random()*80,CONFIG.workMinX,CONFIG.workMaxX),onRadar:false,
          foodAnchor:null,onFood:false,foodX:CONFIG.foodX-48+this.random()*96,evacuate:this.recallActive,landed:false});
      }
      this.emit('cut',{x:m.x,y:m.y,id:m.id,dx:b.x-a.x,dy:b.y-a.y,meteor:{...m},children,releaseAt,kinematics});
      this.recordScore(scoreBefore,'cut');
    }
    return hits;
  }
  goalShelter(p){
    if(onFarm(p))return;
    if(this.cannon.aiming&&(p.cannonDraft||p.state==='cannon'))return;
    if(p.state==='sheltered'||p.state==='dead')return;
    p.evacuate=true;
    if(p.state==='fall')return;
    if(p.state==='jump'){
      if(p.jump.toAnchor)this.jumpPerson(p,p.x,CONFIG.ground,'toShelter',{duration:.6,height:65});
      else p.jump.nextState='toShelter';
    }else if(p.onRadar)this.leaveWork(p,'toShelter');
    else if(p.onFood)this.leaveFood(p,'toShelter');
    else p.state='toShelter';
    this.emit('depart',{id:p.id,x:p.x});
  }
  recall(){
    if(this.status!=='playing'||this.recallActive)return false;
    this.recallActive=true;this.recallGeneration++;this.recallQueue=[];
    for(const p of this.people){
      if(p.state==='work')this.recallQueue.push(p.id);
      else if(p.state!=='sheltered')this.goalShelter(p);
    }
    this.nextDeparture=this.realTime;this.processRecall();this.emit('recall');return true;
  }
  release(){
    if(this.status!=='playing')return false;
    this.recallActive=false;this.recallQueue=[];
    for(const p of this.people){
      p.evacuate=false;
      if(p.state==='jump'&&p.jump.nextState==='toShelter'){
        if(p.hunger<=0)this.planFood(p);
        p.jump.nextState=p.hunger<=0?'toFood':'toWork';
      }
      if(p.state==='sheltered'||p.state==='toShelter'){
        p.x=Math.max(p.x,CONFIG.shelterX+9);if(p.hunger<=0)this.planFood(p);
        p.state=p.hunger<=0?'toFood':'toWork';this.emit('exit',{id:p.id});
      }
    }
    this.emit('release');return true;
  }
  processRecall(){
    if(!this.recallActive)return;
    while(this.recallQueue.length&&this.realTime+1e-8>=this.nextDeparture){
      const id=this.recallQueue.shift();
      const p=this.people.find(p=>p.id===id);
      if(!p||p.state!=='work')continue;
      this.goalShelter(p);this.nextDeparture+=CONFIG.recallInterval;
    }
  }
  move(p,target,dt){
    const d=target-p.x;
    p.direction=Math.sign(d)||p.direction||1;
    if(Math.abs(d)<=CONFIG.walkSpeed*dt){p.x=target;return true;}
    p.x+=Math.sign(d)*CONFIG.walkSpeed*dt;return false;
  }
  jumpPerson(p,toX,toFootY,nextState='toWork',options={}){
    if(p.state==='jump'){
      const q=personView(p,this.view,CONFIG.ground,this.sceneTime,this.radarPose());
      p.x=q.x/this.view.sx;p.y=(q.y+halfHeight(p)*this.view.character)/this.view.sy-halfHeight(p);
    }
    const fromFootY=p.y+halfHeight(p),fromAnchor=p.onRadar?p.workAnchor:p.onFood?p.foodAnchor:null;
    const duration=Math.max(.12,options.duration??clamp(.65+Math.abs(toFootY-fromFootY)/800,.65,1.25));
    p.jump={fromX:p.x,fromY:fromFootY,toX,toY:toFootY,
      fromAnchor,toAnchor:options.toAnchor||null,
      duration,anticipation:clamp(options.anticipation??.1,0,duration*.3),height:options.height??100,elapsed:0,nextState};
    p.onRadar=false;p.onFood=false;p.state='jump';this.emit('jump',{id:p.id});
  }
  planFood(p){
    const occupied=this.people.filter(q=>q.id!==p.id&&q.foodAnchor&&(q.state==='toFood'||q.state==='eat'||(q.state==='jump'&&['eat','toFood'].includes(q.jump.nextState)))).map(q=>q.foodAnchor);
    p.foodAnchor=chooseFoodAnchor(this.random,occupied,this.view);
    const spot=foodWorldPoint(p.foodAnchor,CONFIG.ground);
    p.foodX=groundAnchor(p.foodAnchor)?spot.x:clamp(spot.x-28+this.random()*56,CONFIG.foodX-142,CONFIG.foodX+142);
  }
  leaveWork(p,nextState){
    if(nextState==='toFood')this.planFood(p);
    if(p.onRadar)this.jumpPerson(p,clamp(p.x-35,CONFIG.workMinX,CONFIG.workMaxX),CONFIG.ground,nextState,{height:65});
    else p.state=nextState;
  }
  leaveFood(p,nextState){
    if(p.onFood)this.jumpPerson(p,clamp(p.x+30,CONFIG.foodX-142,CONFIG.foodX+142),CONFIG.ground,nextState,{height:48});
    else p.state=nextState;
    p.foodAnchor=null;
  }
  killPerson(p,shieldable=false){
    if(p.state==='dead'||p.state==='sheltered'||shieldable&&(p.state==='cannon'||this.isShieldProtected(p)))return;
    const scoreBefore=this.score;
    const person={...p,...(p.farm?{farm:{...p.farm}}:{})};p.state='dead';this.deaths++;this.emit('death',{id:p.id,x:p.x,y:p.y,part:p.part,tone:p.tone,person});
    this.recordScore(scoreBefore,'death');
  }
  farmGeometryAt(time=this.sceneTime){return farmGeometry(this.view,time,this.reducedMotion);}
  interceptFarm(a,b,dt){return farmEnabled(this.levelId)?farmContact(a,b,this.farmGeometryAt(this.sceneTime-dt),this.farmGeometryAt()):null;}
  interceptSurface(a,b,dt){
    const shield=this.interceptShield(a,b),farm=this.interceptFarm(a,b,dt);
    return !shield?farm:!farm?shield:shield.t<=farm.t?shield:farm;
  }
  syncFarmPosition(p){
    const q=farmFoot(p,this.view,this.sceneTime,this.reducedMotion);p.x=q.x/this.view.sx;p.y=q.y/this.view.sy-halfHeight(p);
  }
  boardFarm(p,a,b,dt){
    if(p.skipFarm||b.y<=a.y||!farmEnabled(this.levelId))return false;
    const contact=this.interceptFarm(a,b,dt);if(!contact)return false;
    const crop=this.farmWorkers.length<FARM_RULES.capacity?emptyCrop(this.people,contact.localX):null;
    p.farm={cropId:crop?.id??null,x:contact.localX,y:FARM_RULES.deckY,progress:0,ready:false,exit:contact.localX<0?-1:1,entered:this.realTime};
    p.state=crop?'farm':'farmExit';p.evacuate=false;p.onRadar=false;p.onFood=false;p.landed=true;p.landedAt=this.realTime;p.vx=0;p.vy=0;
    delete p.cannonDraft;delete p.jump;delete p.pendingImpulse;this.syncFarmPosition(p);
    const foot=farmFoot(p,this.view,this.sceneTime,this.reducedMotion);
    this.emit('land',{id:p.id,x:foot.x/this.view.sx,y:foot.y/this.view.sy,surface:'farm',person:{...p,farm:{...p.farm}}});this.emit('farmEnter',{id:p.id,working:!!crop});return true;
  }
  stepFarmPerson(p,dt){
    const f=p.farm;p.hunger=Math.min(CONFIG.hungerMax,p.hunger+FARM_RULES.hungerRate*dt);
    if(p.state==='farm'){
      const crop=FARM_CROPS.find(c=>c.id===f.cropId),target=crop.x+Math.sin(this.sceneTime*.9+p.phase)*10,d=target-f.x;
      p.direction=Math.sign(d)||p.direction||1;f.x+=clamp(d,-FARM_RULES.walkSpeed*dt,FARM_RULES.walkSpeed*dt);f.y+=clamp(crop.y-f.y,-20*dt,20*dt);
      if(Math.abs(f.x-crop.x)<18&&Math.abs(f.y-crop.y)<2)f.ready=true;
    }else if(this.realTime-f.entered>=.2){
      p.direction=f.exit;f.x+=f.exit*FARM_RULES.exitSpeed*dt;
      if(Math.abs(f.x)>FARM_RULES.halfWidth+18){
        this.syncFarmPosition(p);const g=this.farmGeometryAt();p.vx=g.row.velocity*(g.route.max-g.route.min)/this.view.sx+f.exit*24;p.vy=12;
        p.state='fall';p.landed=false;p.skipFarm=true;p.noTrail=true;delete p.farm;return;
      }
    }
    this.syncFarmPosition(p);
  }
  settleFarm(dt){
    const workers=this.farmWorkers,n=workers.length;
    for(const p of workers){
      if(!p.farm.ready)continue;p.farm.progress+=dt;
      while(p.farm.progress+1e-8>=FARM_RULES.cycle){
        p.farm.progress=Math.max(0,p.farm.progress-FARM_RULES.cycle);const before=this.score,points=farmYield(n,this.random);
        this.farmBonus+=points;this.farmHarvests++;this.recordScore(before,'farm',points);
        this.emit('farmHarvest',{id:p.id,cropId:p.farm.cropId,points,harvest:this.farmHarvests});
      }
    }
  }
  sweepMeteor(m,previous){
    if(m.source==='volcano'&&m.fallStartedAt==null)return;
    const a=meteorView(previous,this.view),b=meteorView(m,this.view),pose=this.radarPose();
    for(const p of this.people){
      if(p.state==='dead'||p.state==='sheltered')continue;
      const q=personView(p,this.view,CONFIG.ground,this.sceneTime,pose),rx=Math.max(a.rx,b.rx)+q.rx,ry=Math.max(a.ry,b.ry)+q.ry;
      if(segmentDistance({x:q.x/rx,y:q.y/ry},{x:a.x/rx,y:a.y/ry},{x:b.x/rx,y:b.y/ry})<=1)this.killPerson(p,true);
    }
  }
  blastPeople(x,y,radius){
    const v=this.view,pose=this.radarPose();
    for(const p of this.people){
      if(p.state==='dead'||p.state==='sheltered')continue;
      const q=personView(p,v,CONFIG.ground,this.sceneTime,pose),dx=Math.max(0,Math.abs(q.x-x)-q.rx),dy=Math.max(0,Math.abs(q.y-y)-q.ry);
      if(Math.hypot(dx,dy)<=radius)this.killPerson(p,true);
    }
  }
  impactMeteor(m,contact=null){
    if(m.source==='volcano'&&m.fallStartedAt==null)return;
    const v=this.view,x=contact?contact.x/v.sx:m.x,y=contact?contact.y/v.sy:CONFIG.ground;
    m.impacted=true;this.emit('impact',{id:m.id,x,y,vx:m.vx,vy:m.vy,size:m.size,tone:m.tone,meteor:{...m},surface:contact?.surface??(contact?'shield':'ground'),normal:contact?.normal});
    if(contact)this.blastPeople(contact.x,contact.y,CONFIG.impactRadius*v.art);
    else for(const p of this.people)if(p.state!=='dead'&&p.state!=='sheltered'&&p.state!=='fall'&&p.state!=='jump'&&!onFarm(p)&&!p.onRadar&&!p.onFood&&Math.abs(p.x-m.x)<=CONFIG.impactRadius)this.killPerson(p,true);
  }
  explodeBomb(m){
    const scoreBefore=this.score;
    const penalty=Math.min(this.score,CUT.bombPenalty);this.bombPenalty+=penalty;this.bombExplosions++;
    const children=makeBomblets(m,this.view,()=>this.nextId++,this.random,CONFIG.ground);
    for(const c of children){c.born=this.sceneTime;this.bomblets.push(c);}
    m.exploded=true;const p=meteorView(m,this.view);
    this.emit('bombBurst',{id:m.id,x:p.x/this.view.sx,y:p.y/this.view.sy,penalty,meteor:{...m},children:children.map(c=>({...c}))});
    this.noteNuclearBomb(m.id);
    this.recordScore(scoreBefore,'bomb',penalty);
  }
  sweepBomblet(c,previous){
    const a=bombletView(previous,this.view,CUT.bombChildHitScale),b=bombletView(c,this.view,CUT.bombChildHitScale),pose=this.radarPose();
    for(const p of this.people){
      if(p.state==='dead'||p.state==='sheltered')continue;
      const q=personView(p,this.view,CONFIG.ground,this.sceneTime,pose),rx=Math.max(a.rx,b.rx)+q.rx,ry=Math.max(a.ry,b.ry)+q.ry;
      if(segmentDistance({x:q.x/rx,y:q.y/ry},{x:a.x/rx,y:a.y/ry},{x:b.x/rx,y:b.y/ry})<=1)this.killPerson(p,true);
    }
  }
  blastBomblet(c,contact=null){
    const v=this.view,center=contact??{x:c.x*v.sx,y:CONFIG.ground*v.sy};
    this.blastPeople(center.x,center.y,CUT.bombGroundRadius*v.art);
    c.impacted=true;this.emit('bombletImpact',{id:c.id,x:center.x/v.sx,y:center.y/v.sy,child:{...c},radius:CUT.bombGroundRadius,surface:contact?.surface??(contact?'shield':'ground'),normal:contact?.normal});
  }
  advanceMeteor(m,dt){
    if(m.arm){if(this.realTime-m.arm.time+1e-9>=m.arm.expand+m.arm.contract)this.explodeBomb(m);return;}
    const gravity=m.source==='volcano'?m.gravity:CUT.meteorGravity;let ds=dt;
    if(m.source==='volcano'&&m.fallStartedAt==null){
      const up=m.vy<0?Math.min(ds,-m.vy/gravity):0;
      m.x+=m.vx*up;m.y+=m.vy*up+.5*gravity*up*up;m.vy+=gravity*up;ds-=up;
      if(m.vy<-1e-8)return;
      m.vy=Math.max(0,m.vy);m.fallStartedAt=this.sceneTime-ds;
      if(ds<1e-12)return;
    }
    const previous={...m},nextY=m.y+m.vy*ds+.5*gravity*ds*ds,lands=nextY+m.size*.5>=CONFIG.ground;
    const travel=lands?meteorFallTime(Math.max(0,CONFIG.ground-m.size*.5-m.y),m.vy,gravity):ds;
    m.x+=m.vx*travel;m.y=lands?CONFIG.ground-m.size*.5:nextY;m.vy+=gravity*travel;
    const contact=this.interceptSurface(meteorView(previous,this.view),meteorView(m,this.view),ds);
    if(contact){const hit=travel*contact.t;m.x=previous.x+previous.vx*hit;m.y=previous.y+previous.vy*hit+.5*gravity*hit*hit;m.vy=previous.vy+gravity*hit;this.sweepMeteor(m,previous);this.impactMeteor(m,contact);}
    else{this.sweepMeteor(m,previous);if(lands)this.impactMeteor(m);}
  }
  advance(dt){
    this.realTime+=dt;this.remaining=Math.max(0,this.roundSeconds-this.realTime);
    const ds=dt*this.timeScale;this.sceneTime+=ds;this.radarResponse.step(ds);this.syncRadarGrowth();this.processRecall();this.stepCannon(ds);
    for(const m of this.meteors)this.advanceMeteor(m,ds);
    this.meteors=this.meteors.filter(m=>!m.impacted&&!m.exploded);
    for(const p of this.people){
      if(p.state==='dead'||p.state==='sheltered')continue;
      let fragmentDt=ds;
      if(p.cutMotion){
        fragmentDt=Math.max(0,this.realTime-Math.max(this.realTime-dt,p.releaseAt));
        if(fragmentDt>0&&p.pendingImpulse){
          p.vx=p.pendingImpulse.vx;p.vy=p.pendingImpulse.vy;p.angularVelocity=p.pendingImpulse.angularVelocity;delete p.pendingImpulse;
          this.emit('cutRelease',{id:p.id});
        }
        if(p.state!=='fall')advanceCutPose(p,fragmentDt);
      }
      if(p.state==='fall'){
        const previous=personView(p,this.view,CONFIG.ground,this.sceneTime-ds,this.radarPose()),footRadius=halfHeight(p)*this.view.character;
        if(p.cutMotion)advanceCutFragment(p,fragmentDt);
        else{p.y+=p.vy*ds+.5*175*ds*ds;p.vy+=175*ds;p.x+=p.vx*ds;p.vx*=Math.exp(-1.6*ds);}
        if(!p.cutMotion||fragmentDt>0)p.x=clamp(p.x,30,1410);
        const current=personView(p,this.view,CONFIG.ground,this.sceneTime,this.radarPose());
        if((!p.cutMotion||fragmentDt>0)&&this.boardFarm(p,{...previous,rx:0,ry:footRadius},{...current,rx:0,ry:footRadius},ds))continue;
        if((!p.cutMotion||fragmentDt>0)&&p.y>=CONFIG.ground-halfHeight(p)){
          p.y=CONFIG.ground-halfHeight(p);p.landed=true;p.landedAt=this.realTime;
          p.state=p.cannonDraft&&this.cannon.aiming?'toCannon':'toWork';if(p.skipFarm&&p.hunger<=0){this.planFood(p);p.state='toFood';}delete p.skipFarm;this.emit('land',{id:p.id,x:p.x,y:CONFIG.ground,person:{...p}});
          if(this.recallActive)this.goalShelter(p);
        }
      }else if(p.state==='jump'){
        const previous=personView(p,this.view,CONFIG.ground,this.sceneTime-ds,this.radarPose()),footRadius=halfHeight(p)*this.view.character;
        const j=p.jump;j.elapsed=Math.min(j.duration,j.elapsed+ds);const t=jumpProgress(j);
        p.x=j.fromX+(j.toX-j.fromX)*t;p.y=j.fromY+(j.toY-j.fromY)*t-4*j.height*t*(1-t)-halfHeight(p);
        const current=personView(p,this.view,CONFIG.ground,this.sceneTime,this.radarPose());
        if(this.boardFarm(p,{...previous,rx:0,ry:footRadius},{...current,rx:0,ry:footRadius},ds))continue;
        if(t>=1){
          p.state=j.nextState;p.onRadar=p.state==='work'&&!!j.toAnchor;p.onFood=p.state==='eat'&&j.toAnchor?.facility==='food';
          p.jumpLandAt=this.realTime;delete p.jump;this.emit('jumpLand',{id:p.id});
          if(p.state==='eat')this.emit('eat',{id:p.id});
          if(this.recallActive&&(p.state==='work'||p.state==='eat'))this.goalShelter(p);
        }
      }else if(onFarm(p)){
        this.stepFarmPerson(p,ds);
      }else if(p.state==='toCannon'){
        if(!this.cannon.aiming||!p.cannonDraft){delete p.cannonDraft;p.state='toWork';}
        else if(this.move(p,CANNON.x,ds)){p.state='cannon';p.y=CONFIG.ground-halfHeight(p);p.onRadar=false;p.onFood=false;this.cannon.entered=this.realTime;this.emit('cannonEnter',{id:p.id});}
      }else if(p.state==='cannon'){
        // Leaving aim mode keeps the garrison; only normal mode consumes hunger.
        if(!this.cannon.aiming){
          p.hunger=Math.max(0,p.hunger-CONFIG.hungerDrain*ds);
          if(p.hunger<=0){
            delete p.cannonDraft;p.x=CANNON.x-28+this.random()*56;p.y=CONFIG.ground-halfHeight(p);p.landed=true;
            this.planFood(p);p.state='toFood';if(this.recallActive)this.goalShelter(p);
          }
        }
      }else if(p.state==='toWork'){
        if(this.move(p,p.workX,ds)){
          if(p.hunger<=0){this.planFood(p);p.state='toFood';}
          else if(!groundAnchor(p.workAnchor)){const spot=radarWorldPoint(p.workAnchor,CONFIG.ground,this.radarScale);this.jumpPerson(p,spot.x,spot.y,'work',{toAnchor:p.workAnchor});}
          else {p.state='work';p.onRadar=false;p.y=CONFIG.ground-halfHeight(p);}
        }
      }else if(p.state==='work'){
        p.hunger=Math.max(0,p.hunger-CONFIG.hungerDrain*ds);this.addCharge(CONFIG.workerCharge*ds);
        if(p.hunger<=0){this.leaveWork(p,'toFood');if(this.recallActive)this.goalShelter(p);}
      }else if(p.state==='toFood'){
        if(this.move(p,p.foodX,ds)){
          if(!groundAnchor(p.foodAnchor)){const spot=foodWorldPoint(p.foodAnchor,CONFIG.ground);this.jumpPerson(p,spot.x,spot.y,'eat',{toAnchor:p.foodAnchor,height:65});}
          else {p.state='eat';p.onFood=false;p.y=CONFIG.ground-halfHeight(p);this.emit('eat',{id:p.id});}
        }
      }else if(p.state==='eat'){
        p.hunger=Math.min(CONFIG.hungerMax,p.hunger+CONFIG.foodRate*ds);
        if(p.hunger>=CONFIG.hungerMax){this.leaveFood(p,'toWork');this.emit('fed',{id:p.id,x:p.x});if(this.recallActive)this.goalShelter(p);}
      }else if(p.state==='toShelter'){
        if(this.move(p,CONFIG.shelterX-18,ds)){p.state='sheltered';p.evacuate=false;this.emit('enter',{id:p.id});}
      }
    }
    for(const c of this.bomblets){
      const previous={...c},elapsed=Math.max(0,this.sceneTime-Math.max(this.sceneTime-ds,c.born));
      if(!elapsed)continue;
      advanceBomblet(c,elapsed,this.reducedMotion);
      const q=bombletView(c,this.view),floor=CONFIG.ground*this.view.sy;
      const contact=this.interceptSurface(bombletView(previous,this.view),q,ds);
      if(contact){c.x=previous.x+(c.x-previous.x)*contact.t;c.y=previous.y+(c.y-previous.y)*contact.t;this.sweepBomblet(c,previous);this.blastBomblet(c,contact);}
      else if(q.y+q.ry>=floor){c.y=(floor-q.ry)/this.view.sy;this.sweepBomblet(c,previous);this.blastBomblet(c);}
      else this.sweepBomblet(c,previous);
    }
    this.bomblets=this.bomblets.filter(c=>!c.impacted);this.people=this.people.filter(p=>p.state!=='dead');
    this.settleFarm(ds);
    this.stepNuclear();this.people=this.people.filter(p=>p.state!=='dead');
    if(this.remaining<=1e-8){this.remaining=0;this.status='ended';this.emit('end',{score:this.score,cuts:this.cuts,alive:this.alive});}
  }
  step(dt){
    if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    const time=Math.min(dt,this.remaining);const count=Math.ceil(time/(1/60));const h=time/count;
    for(let i=0;i<count&&this.status==='playing';i++)this.advance(h);
  }
  snapshot(){return {status:this.status,realTime:this.realTime,sceneTime:this.sceneTime,roundSeconds:this.roundSeconds,remaining:this.remaining,
    charge:this.charge,chargeMax:this.chargeMax,chargePercent:this.chargePercent,progression:this.progression,summonWaves:this.summonWaves,cuts:this.cuts,deaths:this.deaths,clicks:this.clicks,alive:this.alive,workers:this.workers,
    sheltered:this.sheltered,capacity:null,score:this.score,bombPenalty:this.bombPenalty,bombExplosions:this.bombExplosions,timeScale:this.timeScale,
    recallActive:this.recallActive,queued:this.recallQueue.length,levelId:this.levelId,shield:{...this.shieldState,circle:this.shieldGeometry()},cannon:this.cannonState,cannonBonus:this.cannonBonus,cannonKills:this.cannonKills,farm:this.farmState,farmBonus:this.farmBonus,volcano:this.volcanoState,nuclear:this.nuclearState,
    meteors:this.meteors.map(m=>({...m})),bomblets:this.bomblets.map(c=>({...c})),people:this.people.map(p=>({...p}))};}
}
