import { GameModel, CONFIG, meteorFallTime } from './engine.js';
import {BackgroundSky,drawBackground} from './background.js';
import {OpeningScene,OpeningRenderer} from './opening-scene.js';
import {SceneTransition,SceneTransitionRenderer} from './scene-transition.js';
import {LEVELS,LevelSelectScene,drawLevelMap,drawLevelFlames,drawLevelDebris} from './level-select.js';
import {installLevelDrag} from './level-drag.js';
import {drawRiceMark} from './food-mark.js';
import {PencilHint,PencilHintRenderer,pencilHintLayout} from './pencil-hint.js';
import {CUT_DRAWING,cutHintLayout} from './cut-hint.js';
import {TutorialFeedback,PRAISE_DRAWING,BOMB_DRAWING,feedbackHintLayout} from './tutorial-feedback.js';
import {guidanceFor,ChapterGuidance,chapterHintLayout} from './chapter-guidance.js';
import {MechanismGuidance} from './mechanism-guidance.js';
import {FARM_GUIDANCE} from './farm-guidance.js';
import {bombChargeAt,bombletView} from './bomb-physics.js';
import {makeBombBurst,bombBurstDuration,drawBombCharge,drawBombBurst} from './bomb-fx.js';
import { impactShakeAt } from './effects.js';
import {drawPlume,drawExplosion,drawRadio,radioWaves} from './fire.js';
import {foodIdle,shelterIdle} from './facilities.js';
import {FlameTracks} from './flames.js';
import {airHitBurst,fragmentLandingTime} from './fx-physics.js';
import {meteorView,personView,personAge,radarFootView} from './body-geometry.js';
import {cutCameraOffset,swipeStrength,fragmentAngle} from './cut-motion.js';
import {CutFeedback} from './cut-feedback.js';
import {CUT,cutSettingsSnapshot} from './cut-settings.js';
import {installCutTuner} from './cut-tuner.js';
import {ScoreHUD} from './score-hud.js';
import {VARIANTS,variantOf,halfHeight,halfFlip,GRAYS} from './variants.js';
import {radarOriginX,radarLocalPoint,radarIdle,RADAR_SCALE} from './radar.js';
import {jumpProgress} from './movement.js';
import {drawShield} from './shield-art.js';
import {ShieldControl} from './shield-control.js';
import {CANNON,cannonGeometry,cannonRecoil} from './cannon.js';
import {drawCannon,drawCannonReticle,drawCannonHeat,drawCannonBullet,makeCannonDebris,drawCannonDebris} from './cannon-art.js';
import {CannonCoolingHUD} from './cannon-ui.js';
import {RoundEnding} from './round-ending.js';
import {FarmMotion,farmGeometry} from './farm.js';
import {drawFarm} from './farm-art.js';
import {FarmFeedback} from './farm-feedback.js';
import {VolcanoRenderer} from './volcano.js';
import {VolcanoSplash} from './volcano-fx.js';
import {NUCLEAR_GUIDANCE,NuclearWarning,NUCLEAR_WARNING_DRAWING,nuclearWarningLayout} from './nuclear-guidance.js';
import {NUCLEAR_RULES} from './nuclear.js';
import {NuclearEffects,drawNuclearBomb,drawNuclearIcon,nuclearIconFrame} from './nuclear-art.js';
import {NuclearHUD} from './nuclear-hud.js';
const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
const gameContext=ctx,openingCanvas=$('opening-scene'),openingContext=openingCanvas.getContext('2d');
const transitionCanvas=$('scene-transition'),transitionContext=transitionCanvas.getContext('2d');
const nuclearCanvas=$('nuclear-layer'),nuclearContext=nuclearCanvas.getContext('2d');
const model=new GameModel();
const roundEnding=new RoundEnding();
const farmMotion=new FarmMotion();
const farmFeedback=new FarmFeedback();
const volcanoRenderer=new VolcanoRenderer();
const volcanoSplash=new VolcanoSplash();
const nuclearEffects=new NuclearEffects(),nuclearWarning=new NuclearWarning();
const nuclearWarningRenderer=new PencilHintRenderer(undefined,NUCLEAR_WARNING_DRAWING);
const nuclearHud=new NuclearHUD($('nuclear-countdown'),CUT);
const effectTime=()=>model.realTime+roundEnding.elapsed,effectSceneTime=()=>model.sceneTime+roundEnding.elapsed;
const cannonHeatContext=$('cannon-heat-canvas').getContext('2d');$('cannon-heat-canvas').width=$('cannon-heat-canvas').height=84;cannonHeatContext.setTransform(2,0,0,2,0,0);
const cannonCoolingHUD=new CannonCoolingHUD($('cannon-cooling-hud'));
const shieldControl=new ShieldControl($('radar-shield'),()=>{if(model.clickShield()){handleEvents();updateHud(true);render();}});
const sky=new BackgroundSky();
let titleSky=new BackgroundSky();
const opening=new OpeningScene(),openingRenderer=new OpeningRenderer();
const levelScene=new LevelSelectScene(),levelMapContext=$('level-map-canvas').getContext('2d');
let levelSky=new BackgroundSky(),route='title',activeLevel=null;
const levelButtons=new Map(),levelLabels=new Map();
for(const level of LEVELS){
  if(!level.unlocked)continue;
  const button=document.createElement('button'),label=document.createElement('span');
  button.className='level-node';button.type='button';button.disabled=!level.unlocked;button.dataset.level=level.id;
  button.setAttribute('aria-label',`${level.label}，进入关卡`);button.setAttribute('aria-pressed','false');
  label.className='level-node-label';label.textContent=level.label;
  $('level-buttons').append(button,label);levelButtons.set(level.id,button);levelLabels.set(level.id,label);
  button.addEventListener('click',()=>selectLevel(level.id));
}
const sceneTransition=new SceneTransition(),sceneTransitionRenderer=new SceneTransitionRenderer();
const levelDrag=installLevelDrag($('level-select'),$('level-map'),()=>route==='levels'&&opening.mode==='game'&&!sceneTransition.active&&!levelScene.paused);
let transitionSky=new BackgroundSky();
const radarHint=new PencilHint(),radarHintRenderer=new PencilHintRenderer();
const cutHint=new PencilHint(CUT_DRAWING),cutHintRenderer=new PencilHintRenderer(undefined,CUT_DRAWING);
const tutorialFeedback=new TutorialFeedback(cutHint),praiseRenderer=new PencilHintRenderer(undefined,PRAISE_DRAWING),bombHintRenderer=new PencilHintRenderer(undefined,BOMB_DRAWING);
const chapterGuidance=new ChapterGuidance();let chapterRenderer=null;
const mechanismGuidance=new MechanismGuidance({...FARM_GUIDANCE,...NUCLEAR_GUIDANCE});let mechanismRenderer=null;
let tutorialIntroPending=false,earlyTutorial={summoned:false,normal:false,cut:false,bomb:false};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const palette={red:'#da3e3e',redSide:'#982b35',blue:'#3da9db',blueSide:'#236b9b',green:'#43ad64',greenSide:'#287344'};
let glyph=null,glyphPath=null,ready=false,width=1,height=1,dpr=1;
let bombGlyph=null,bombPath=null,bombParts=[];
const glyphs=new Map(),glyphPaths=new Map();
let dark=matchMedia('(prefers-color-scheme: dark)').matches;
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
let ink='#292d2b',paper='#f7f8f5',muted='#646d66',line='#d9dfd8';
let trail=[],bladeActive=false,lastPoint=null,lastPointerStamp=0;
const flames=new FlameTracks();let bursts=[];
const cutFeedback=new CutFeedback();
const scoreHud=new ScoreHUD($('score-panel'),CUT);
let shelterPulse=-10;
let shakeStart=-10,lastLandShake=-10;
let impactShake={time:-10,amplitude:0};
let pauseReason='',lastFrame=performance.now(),hudStamp=-1;
let radarLayoutKey='';
let qaHeld=false;
let camera={z:1,fx:0,fy:0,dx:0,dy:0};
const keys=new Set();let keyboardPoint={x:500,y:250},keyboardVisible=false;
const screenBase=(x,y)=>({x:x/CONFIG.width*width,y:y/CONFIG.height*height});
const artScale=()=>Math.max(.34,Math.min(width/CONFIG.width,height/CONFIG.height));
const charScale=()=>Math.max(.70,Math.min(width/CONFIG.width,height/CONFIG.height));
function project(x,y){const p=screenBase(x,y);return{x:camera.fx+(p.x-camera.fx)*camera.z+camera.dx,y:camera.fy+(p.y-camera.fy)*camera.z+camera.dy};}
function cameraPoint(p){return{x:camera.fx+(p.x-camera.fx)*camera.z+camera.dx,y:camera.fy+(p.y-camera.fy)*camera.z+camera.dy};}
function meteorPoint(m){const p=meteorView(m,model.view);return{...cameraPoint(p),rx:p.rx*camera.z,ry:p.ry*camera.z};}
function glyphColor(tone=0){return GRAYS[dark?'dark':'light'][tone]||GRAYS.light[0];}
function radarPose(){
  return model.radarPose();
}
const buildingTime=()=>model.realTime;
function radarFoot(anchor){
  const pose=radarPose(),q=radarLocalPoint(anchor,pose.press,pose.release,pose),base=project(radarOriginX(pose.scale),CONFIG.ground),s=artScale()*pose.scale*camera.z;
  return{x:base.x+q.x*s,y:base.y+q.y*s};
}
function cameraAt(){
  let z=1,fx=width*.5,fy=height*.5;
  const time=effectTime(),cut=cutCameraOffset(model.cutCue,time,artScale(),reduced);
  let dx=cut.x,dy=cut.y;const a=time-shakeStart;
  if(!reduced&&a>=0&&a<.12){const env=(1-a/.12)**2,lx=Math.sin(a*150)*.5*env,ly=Math.sin(a*95+1)*1.5*env;if(Math.hypot(lx,ly)>Math.hypot(dx,dy)){dx=lx;dy=ly;}}
  if(!reduced){const impact=impactShakeAt(time-impactShake.time,impactShake.amplitude,impactShake.duration??CONFIG.impactDuration);if(impact.envelope>1.5){dx=impact.dx;dy=impact.dy;}}
  const recoil=cannonRecoil(model.cannon,time,reduced);dx+=recoil.x;dy+=recoil.y;
  camera={z,fx,fy,dx,dy};
}
function theme(){
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('theme-toggle').textContent=dark?'切换浅色':'切换深色';
  const css=getComputedStyle(document.documentElement);ink=css.getPropertyValue('--ink').trim();paper=css.getPropertyValue('--paper').trim();muted=css.getPropertyValue('--muted').trim();line=css.getPropertyValue('--line').trim();
}
function motionState(){
  model.reducedMotion=reduced;
  radarHint.setReduced(reduced);
  cutHint.setReduced(reduced);
  tutorialFeedback.setReduced(reduced);
  chapterGuidance.setReduced(reduced);
  $('tuner-motion-note').hidden=!reduced;
  scoreHud.render(reduced);
}
function resize(){
  const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  openingCanvas.width=canvas.width;openingCanvas.height=canvas.height;
  transitionCanvas.width=canvas.width;transitionCanvas.height=canvas.height;
  nuclearCanvas.width=canvas.width;nuclearCanvas.height=canvas.height;
  model.setViewport(width,height);flames.clear();
  bursts=bursts.map(b=>b.type==='victim'?{...b,...airHitBurst(b.x,b.y,b.seed,b.time,model.view,CONFIG.ground)}:b);
  for(const b of bursts)if(b.type==='bombAir'||b.type==='bombGround')b.duration=bombBurstDuration(b,model.view,CONFIG.ground);
  for(const b of bursts)if(b.type==='cannonDebris'){b.groundHeight=Math.max(0,(CONFIG.ground-b.y)*model.view.sy/model.view.art);b.duration=Math.max(...b.pieces.map(p=>fragmentLandingTime(p,b.groundHeight)))+.01;}
  keyboardPoint={x:width*.5,y:height*.35};trail=[];lastPoint=null;
  const base=screenBase(0,CONFIG.ground),s=artScale();
  $('shelter-controls').style.top=`${base.y-144*s-17}px`;
  updateRadarControls();
  render();
}
new ResizeObserver(resize).observe(canvas);
function drawMaster(x,y,size,angle=0,fontId='yahei',tone=0){
  const g=glyphs.get(fontId),path=glyphPaths.get(fontId);if(!path)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size/g.height,size/g.height);ctx.translate(-g.width/2,-g.height/2);ctx.fillStyle=glyphColor(tone);ctx.fill(path);ctx.restore();
}
function drawHalf(part,x,y,size,angle,stretchX=1,stretchY=1,lean=0,fontId='yahei',tone=0,flip=1){
  const g=glyphs.get(fontId),path=glyphPaths.get(fontId);if(!path)return;
  const half=g.halves[part];
  ctx.save();ctx.translate(x,y);ctx.transform(1,0,lean,1,0,0);ctx.scale(stretchX,stretchY*flip);ctx.rotate(angle);ctx.scale(size/g.height,size/g.height);ctx.translate(-half.pivot[0],-half.pivot[1]);
  ctx.beginPath();ctx.rect(...half.clip);ctx.clip();ctx.fillStyle=glyphColor(tone);ctx.fill(path);ctx.restore();
}
function drawShelter(options={}){
  const ctx=options.context??gameContext,p=options.point??project(CONFIG.shelterX,CONFIG.ground),s=options.scale??artScale()*camera.z;
  const age=options.entryAge??model.realTime-shelterPulse,e=options.exit??{dx:0,dy:0,sx:1,sy:1};
  const entry=!reduced&&age>=0&&age<.85?-.30*Math.sin(age*24)*Math.exp(-4.5*age):0;
  const wobble=shelterIdle(options.time??buildingTime(),!reduced)+entry;
  ctx.save();ctx.translate(p.x+e.dx,p.y+e.dy);ctx.scale(s*(1+wobble)*e.sx,s/(1+wobble)*e.sy);
  ctx.fillStyle=palette.blue;ctx.beginPath();ctx.moveTo(-235,0);ctx.bezierCurveTo(-215,-85,-112,-143,-20,-144);ctx.bezierCurveTo(19,-143,38,-113,38,-76);ctx.lineTo(38,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blueSide;ctx.beginPath();ctx.moveTo(-78,0);ctx.lineTo(-78,-70);ctx.bezierCurveTo(-77,-123,-46,-145,-20,-144);ctx.bezierCurveTo(-60,-111,-57,-79,-57,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blue;ctx.beginPath();ctx.moveTo(-58,0);ctx.lineTo(-58,-73);ctx.bezierCurveTo(-58,-138,38,-145,38,-72);ctx.lineTo(38,0);ctx.lineTo(21,0);ctx.lineTo(21,-68);ctx.bezierCurveTo(21,-114,-39,-113,-39,-68);ctx.lineTo(-39,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blueSide;ctx.beginPath();ctx.moveTo(-39,0);ctx.lineTo(-39,-68);ctx.bezierCurveTo(-39,-113,21,-114,21,-68);ctx.lineTo(21,0);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawFood(front=false,options={}){
  const ctx=options.context??gameContext,p=options.point??project(CONFIG.foodX,CONFIG.ground),s=options.scale??artScale()*camera.z,e=options.exit??{dx:0,dy:0,sx:1,sy:1};
  const breathe=foodIdle(options.time??buildingTime(),!reduced);
  ctx.save();ctx.translate(p.x+e.dx,p.y+e.dy);ctx.scale(s*(1+breathe)*e.sx,s*(1-breathe)*e.sy);
  if(!front){
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.ellipse(0,-58,78,22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.greenSide;ctx.beginPath();ctx.ellipse(0,-58,66,15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.ellipse(0,-48,51,7,0,0,Math.PI*2);ctx.fill();
  }else{
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.moveTo(-78,-58);ctx.bezierCurveTo(-76,-9,-69,0,-3,0);ctx.bezierCurveTo(61,0,71,-11,78,-58);ctx.bezierCurveTo(42,-36,-43,-35,-78,-58);ctx.closePath();ctx.fill();
    ctx.fillStyle=palette.greenSide;ctx.beginPath();ctx.moveTo(49,-41);ctx.bezierCurveTo(48,-18,45,-7,38,-2);ctx.bezierCurveTo(64,-6,71,-17,78,-58);ctx.bezierCurveTo(68,-50,61,-45,49,-41);ctx.closePath();ctx.fill();
    ctx.strokeStyle=palette.green;ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,-58,72,17,0,0,Math.PI);ctx.stroke();
    drawRiceMark(ctx,palette.greenSide);
  }
  ctx.restore();
}
function drawRadar(options={}){
  const ctx=options.context??gameContext,p=options.point??project(radarOriginX(model.radarScale),CONFIG.ground),s=options.scale??artScale()*model.radarScale*camera.z,e=options.exit??{dx:0,dy:0,sx:1,sy:1};
  const {press,release,scan,antenna}=options.pose??radarPose();
  ctx.save();ctx.translate(p.x+e.dx,p.y+e.dy);ctx.scale(s*e.sx,s*e.sy);
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-12,-161);ctx.lineTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(48,0);ctx.lineTo(-9,0);ctx.lineTo(2,-10);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(20,-9);ctx.lineTo(-4,-161);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(-10,-165+press*3);ctx.rotate(-.45+press*.018-release*.025+scan);
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(-91,0);ctx.bezierCurveTo(-85,62,83,61,91,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.ellipse(0,0,91,27,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.ellipse(0,-2,78,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-58,13);ctx.bezierCurveTo(-29,-3,18,-5,49,13);ctx.bezierCurveTo(18,28,-29,28,-58,13);ctx.fill();
  ctx.save();ctx.rotate(press*.025-release*.028+antenna);
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-8,9);ctx.lineTo(-16,-67);ctx.lineTo(-6,-69);ctx.lineTo(5,7);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(-6,-69);ctx.lineTo(5,7);ctx.lineTo(0,9);ctx.lineTo(-11,-67);ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.clip();ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.ellipse(-3,-75,9,17,-.2,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.restore();ctx.restore();ctx.restore();
}
function drawPerson(p){
  const variant=variantOf(p.variantId),g=glyphs.get(variant.fontId),part=g.halves[p.part],s=charScale()*camera.z;
  const age=personAge(p,model.sceneTime),birth=ease(age/.27),size=lerp(p.birthSize,p.size,birth)*s;
  let angle=reduced?lerp(p.birthTilt||0,part.rotation,birth):fragmentAngle(p,part.rotation,age),lean=0,sx=1,sy=1;
  const phase=model.sceneTime*Math.PI*2/1.05+p.phase;
  const moving=['toWork','toFood','toShelter','farmExit'].includes(p.state);
  let point=cameraPoint(personView(p,model.view,CONFIG.ground,model.sceneTime,radarPose()));
  if(!reduced){
    if(moving){lean=Math.sin(phase)*.20+(p.direction||1)*.10;sx=1+Math.sin(phase)*.09;sy=1/sx;point.y-=Math.abs(Math.sin(phase))*5*s;}
    if(p.state==='work'||p.state==='farm'){lean=.13+Math.sin(phase*1.2)*.18;sy=1-Math.max(0,Math.sin(phase*1.2))*.11;sx=1/sy;}
    if(p.state==='eat'){lean=Math.sin(phase*1.4)*.13;sy=1-Math.max(0,Math.sin(phase*1.4))*.10;}
    if(p.state==='jump'){
      const j=p.jump,u=jumpProgress(j);
      if(j.elapsed<j.anticipation){sy=1-.22*Math.sin(j.elapsed/j.anticipation*Math.PI*.5);sx=1/sy;point.y+=(1-sy)*halfHeight(p)*s;}
      else {lean=Math.sin(u*Math.PI)*Math.sign(j.toX-j.fromX)*.16;sy=1+.12*Math.sin(u*Math.PI);sx=1/sy;}
    }
    if(p.jumpLandAt!==undefined){const a=model.realTime-p.jumpLandAt;if(a>=0&&a<.27){const squash=.18*Math.sin(a/.27*Math.PI)*Math.exp(-a*5);sy*=1-squash;sx*=1+squash;point.y+=squash*halfHeight(p)*s;}}
    if(p.landedAt!==undefined){const a=model.realTime-p.landedAt;if(a<.3){const squash=.13*Math.sin(a/.3*Math.PI)*Math.exp(-a*5);sy*=1-squash;sx*=1+squash;point.y+=(1-sy)*p.size*s*.25;}}
    if(p.hunger<20&&p.state==='work')sy*=.97;
  }
  ctx.save();
  drawHalf(p.part,point.x,point.y,size,angle,sx,sy,lean,variant.fontId,variant.tone,p.pendingImpulse?1:halfFlip(p.part,age,reduced));
  if(p.hunger<28&&p.state!=='fall'&&p.state!=='toShelter'){
    ctx.fillStyle=ink;ctx.fillRect(point.x-10,point.y-12*s-5,20*clamp(p.hunger/100,0,1),1.5);
  }
  ctx.restore();
}
function drawMeteors(){
  for(const m of model.meteors){
    const p=meteorPoint(m);
    if(m.kind==='bomb'){
      const charge=bombChargeAt(m,model.realTime);
      drawBombOutline(bombPath,p.x,p.y,m.size*charScale()*camera.z,m.tilt,null,charge&&!reduced?(1-charge.expand*.8)*(1-charge.contract):1);
      drawBombCharge(ctx,m,model.realTime,p,artScale()*camera.z,dark,reduced);
    }else drawMaster(p.x,p.y,m.size*charScale()*camera.z,m.tilt,m.fontId,m.tone);
    if(m.arm||m.source==='volcano'&&m.fallStartedAt==null)continue;
    const left=meteorFallTime(Math.max(0,CONFIG.ground-m.y-m.size/2),m.vy,m.gravity??CUT.meteorGravity);
    if(left<.8){
      const ground=project(m.x+m.vx*left,CONFIG.ground),rx=CONFIG.impactRadius*width/CONFIG.width*camera.z;
      ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(ground.x,ground.y+1,Math.max(8,rx),2.5,0,-Math.PI*(1-clamp(left/.8,0,1)),Math.PI);ctx.stroke();
    }
  }
}
function drawBombOutline(path,x,y,size,angle,pivot=null,alpha=1){
  if(!path||!bombGlyph)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size/bombGlyph.height,size/bombGlyph.height);
  ctx.translate(-(pivot?.[0]??bombGlyph.width/2),-(pivot?.[1]??bombGlyph.height/2));
  ctx.globalAlpha=alpha;ctx.fillStyle=dark?'#f4f4f4':'#151515';ctx.fill(path);ctx.restore();
}
function drawBomblets(){
  for(const c of model.bomblets){
    const point=cameraPoint(bombletView(c,model.view)),part=bombGlyph?.parts[c.part];
    if(part)drawBombOutline(bombParts[c.part],point.x,point.y,c.sourceSize*charScale()*camera.z,c.angle,part.pivot);
  }
}
function drawEffects(){
  const t=effectTime(),sceneTime=effectSceneTime();
  const metrics={...model.view,art:artScale()*camera.z,character:charScale()*camera.z,reduced};
  cutFeedback.draw(ctx,t,{meteorPoint,glyphs,paths:glyphPaths,metrics,glyphColor,ink,reduced});
  bursts=bursts.filter(b=>sceneTime-b.time<b.duration);
  for(const b of bursts)if(b.type==='cannonDebris')drawCannonDebris(ctx,b,sceneTime,project,metrics,glyphColor(b.tone));else if(b.type==='bombAir'||b.type==='bombGround')drawBombBurst(ctx,b,sceneTime,project,metrics,CONFIG.ground);else drawExplosion(ctx,b,sceneTime,project,metrics,glyphColor(b.tone));
  drawRadio(ctx,radioState(),metrics,project);
}
function radioState(){return{time:effectTime(),launchTime:model.summonPulse,antennaPoint:anchor=>{
  const p=radarFootView(anchor,model.view,CONFIG.ground,radarPose());return{x:p.x/model.view.sx,y:p.y/model.view.sy};
}};}
function drawTrail(){
  trail=trail.filter(p=>model.realTime-p.time<(p.life??.1));
  if(trail.length<2)return;
  ctx.save();ctx.fillStyle=ink;ctx.strokeStyle=ink;
  if(reduced){ctx.lineWidth=1.5;ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore();return;}
  const last=trail[trail.length-1];let length=0,points=[last];
  for(let i=trail.length-2;i>=0;i--){
    const a=points[0],b=trail[i],segment=Math.hypot(b.x-a.x,b.y-a.y);
    if(length+segment>width*CUT.bladeLength){
      const f=(width*CUT.bladeLength-length)/(segment||1);
      points.unshift({x:lerp(a.x,b.x,f),y:lerp(a.y,b.y,f),time:lerp(a.time,b.time,f),speed:lerp(a.speed,b.speed,f),life:lerp(a.life??.1,b.life??.1,f)});break;
    }
    points.unshift(b);length+=segment;
  }
  if(points.length===2){const [a,b]=points;points.splice(1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,time:(a.time+b.time)/2,speed:b.speed,life:((a.life??.1)+(b.life??.1))/2});}
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    const dx=after.x-before.x,dy=after.y-before.y,l=Math.hypot(dx,dy)||1;
    const youth=1-clamp((model.realTime-p.time)/(p.life??.1),0,1),pos=i/(points.length-1);
    const edge=Math.pow(Math.sin(pos*Math.PI),.65);
    const half=(clamp(1.4+p.speed*.0025,1.4,width<600?3:4.7))*CUT.bladeWidth*youth*edge;
    left.push({x:p.x-dy/l*half,y:p.y+dx/l*half});right.push({x:p.x+dy/l*half,y:p.y-dx/l*half});
  }
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);left.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(last.x,last.y);right.reverse().forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.restore();
}
function drawTitleBuilding(kind,context,exit){
  const scale=artScale(),common={context,exit,time:opening.idleTime,entryAge:-10,scale};
  if(kind==='shelter')drawShelter({...common,point:screenBase(CONFIG.shelterX,CONFIG.ground)});
  if(kind==='food'){const options={...common,point:screenBase(CONFIG.foodX,CONFIG.ground)};drawFood(false,options);drawFood(true,options);}
  if(kind==='radar')drawRadar({...common,point:screenBase(radarOriginX(RADAR_SCALE),CONFIG.ground),scale:scale*RADAR_SCALE,pose:{press:0,release:0,...radarIdle(opening.idleTime,!reduced)}});
}
function renderOpening(){
  const frame=opening.snapshot(width,height,artScale()),field=document.querySelector('.playfield');
  const scene=frame.mode==='game'?route:frame.mode;
  if(field.dataset.scene!==scene)field.dataset.scene=scene;
  const reveal=String(frame.revealing);if(field.dataset.reveal!==reveal)field.dataset.reveal=reveal;
  openingCanvas.hidden=frame.mode==='game';
  if(frame.mode==='game')return;
  $('intro').hidden=frame.uiGone;$('intro').inert=frame.mode==='transition';
  $('intro').style.transform=`translateX(${-frame.uiProgress*(width*.65+280)}px)`;$('intro').style.opacity=String(1-frame.uiProgress);
  $('menu-button').disabled=frame.mode==='transition';
  openingContext.setTransform(dpr,0,0,dpr,0,0);
  openingRenderer.draw(openingContext,frame,{width,height,dpr,dark,reduced,sky:titleSky,glyph,path:glyphPath,drawBuilding:drawTitleBuilding});
}
function renderLevelSelect(){
  const map=$('level-map'),w=map.clientWidth,h=Math.max(1,map.clientHeight),frame=levelScene.snapshot(w,h,reduced),target=$('level-map-canvas');
  drawBackground(ctx,levelSky,{width,height,dark,reduced,drift:frame.drift});
  drawLevelDebris(ctx,frame,{dark,x:-map.scrollLeft,y:map.offsetTop});
  drawLevelFlames(ctx,frame,{reduced,x:-map.scrollLeft,y:map.offsetTop});
  if(target.width!==Math.round(frame.width*dpr)||target.height!==Math.round(h*dpr)){
    target.width=Math.round(frame.width*dpr);target.height=Math.round(h*dpr);
  }
  $('level-track').style.width=`${frame.width}px`;
  levelMapContext.setTransform(dpr,0,0,dpr,0,0);drawLevelMap(levelMapContext,frame,{dark,reduced});
  $('level-select').inert=opening.mode==='transition';
  for(const node of frame.nodes){
    const button=levelButtons.get(node.id);if(!button)continue;
    button.style.width=button.style.height=`${node.radius*2}px`;
    button.style.transform=`translate3d(${node.x-node.radius}px,${node.y-node.radius}px,0)`;
    button.setAttribute('aria-pressed',String(node.selected));
    button.setAttribute('aria-label',`${node.label}，${node.selected?'已选中，再次点击进入关卡':'选择关卡'}`);
    levelLabels.get(node.id).style.transform=`translate3d(${node.x}px,${node.labelY}px,0) translateX(-50%)`;
  }
}
function selectLevel(id,enter=true){
  if(route!=='levels'||sceneTransition.active||opening.mode==='transition'||$('game-menu').open)return false;
  if(enter&&levelScene.selected===id)return enterLevel();
  if(!levelScene.select(id))return false;
  announce(`已选择 ${LEVELS.find(n=>n.id===id).label}，再次点击进入关卡。`);render();return true;
}
function enterLevel(){
  const level=LEVELS.find(n=>n.id===levelScene.selected);
  if(route!=='levels'||!level?.unlocked)return false;
  return changeSceneWithTransition(()=>{activeLevel=level.id;prepareRound();},activateRound);
}
function renderSceneTransition(){
  const frame=sceneTransition.snapshot(),field=document.querySelector('.playfield');
  transitionCanvas.hidden=!frame.active;field.dataset.routeTransition=String(frame.active);
  if(!frame.active)return;
  transitionContext.setTransform(dpr,0,0,dpr,0,0);
  sceneTransitionRenderer.draw(transitionContext,frame,{width,height,dpr,sky:transitionSky,glyph,path:glyphPath});
}
function clearNuclearLayer(){
  nuclearContext.setTransform(1,0,0,1,0,0);nuclearContext.clearRect(0,0,nuclearCanvas.width,nuclearCanvas.height);
  nuclearCanvas.hidden=true;
}
function renderNuclearLayer(){
  const state=model.nuclearState,visible=route==='game'&&(state.bomb||nuclearEffects.blasts.length||nuclearIconFrame(state,model.view,reduced));
  if(!visible){clearNuclearLayer();return;}
  nuclearCanvas.hidden=false;nuclearContext.setTransform(dpr,0,0,dpr,0,0);nuclearContext.clearRect(0,0,width,height);
  drawNuclearBomb(nuclearContext,state,model.view,project);nuclearEffects.draw(nuclearContext,effectSceneTime(),model.view,project,reduced);drawNuclearIcon(nuclearContext,state,model.realTime,model.view,reduced);
  const flash=nuclearEffects.flash(effectSceneTime(),reduced);if(flash>0){nuclearContext.save();nuclearContext.globalAlpha=flash;nuclearContext.fillStyle='#fff';nuclearContext.fillRect(0,0,width,height);nuclearContext.restore();}
}
function render(){
  updateRadarControls();
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);cameraAt();
  const showLevels=route==='levels'||opening.mode==='transition';$('level-select').hidden=!showLevels;
  updateShieldControl();
  updateCannonControls();
  if(showLevels){renderLevelSelect();renderOpening();renderSceneTransition();renderNuclearLayer();return;}
  drawBackground(ctx,sky,{width,height,dark,reduced});
  const volcano=model.volcanoState;
  if(volcano.enabled)volcanoRenderer.draw(ctx,{...volcano,geometry:{...volcano.geometry,...cameraPoint(volcano.geometry),scale:volcano.geometry.scale*camera.z}},dark);
  volcanoSplash.draw(ctx,effectSceneTime(),project,{art:artScale()*camera.z});
  advanceTutorialIntro();
  const nuclear=model.nuclearState,nuclearHint=nuclearWarning.snapshot(model.realTime,reduced),nuclearNotice=['writing','shown','erasing'].includes(nuclearHint.stage);
  if(chapterGuidance.drawing&&!nuclearNotice){
    if(chapterRenderer?.drawing!==chapterGuidance.drawing)chapterRenderer=new PencilHintRenderer(undefined,chapterGuidance.drawing);
    chapterRenderer.draw(ctx,chapterGuidance.snapshot(model.realTime,reduced),chapterHintLayout(model.view,chapterGuidance.drawing),dark);
  }
  const mechanism=mechanismGuidance.snapshot(model.realTime,reduced,model.view,mechanismTargets());
  if(mechanismGuidance.drawing&&!nuclearNotice){
    if(mechanismRenderer?.drawing!==mechanismGuidance.drawing)mechanismRenderer=new PencilHintRenderer(undefined,mechanismGuidance.drawing);
    mechanismRenderer.draw(ctx,mechanism,{x:0,y:0,width,height,scale:1},dark);
  }
  radarHintRenderer.draw(ctx,radarHint.snapshot(model.realTime,reduced),radarHintLayout(),dark);
  const hints=tutorialFeedback.snapshot(model.realTime,reduced);
  if(hints.active==='cut')cutHintRenderer.draw(ctx,cutHint.snapshot(model.realTime,reduced),cutHintLayout(model.view),dark);
  if(hints.active==='praise')praiseRenderer.draw(ctx,hints.praise,feedbackHintLayout(model.view,PRAISE_DRAWING),dark);
  if(hints.active==='warning')bombHintRenderer.draw(ctx,hints.warning,feedbackHintLayout(model.view,BOMB_DRAWING),dark);
  nuclearWarningRenderer.draw(ctx,nuclearHint,nuclearWarningLayout(model.view),dark);
  const a=project(0,CONFIG.ground),b=project(CONFIG.width,CONFIG.ground);
  ctx.strokeStyle=ink;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(a.x,a.y+.5);ctx.lineTo(b.x,b.y+.5);ctx.stroke();
  drawShelter();drawFood(false);drawFood(true);drawRadar();
  const farm=farmFrame(true),farmArt=farm.enabled?{...farm,geometry:{...farm.geometry,...cameraPoint(farm.geometry),scale:farm.geometry.scale*camera.z}}:null;
  if(farmArt)drawFarm(ctx,farmArt,'back');
  if(model.cannon.enabled){const g=cannonGeometry(model.view,CONFIG.ground),p=cameraPoint(g);drawCannon(ctx,model.cannonState,{...g,x:p.x,y:p.y,scale:g.scale*camera.z},model.realTime,reduced);}
  if(roundEnding.phase==='idle')flames.sync(model);
  for(const flame of flames.trails.values())if(!(flame.volcanic&&flame.kind==='meteor'))drawPlume(ctx,flame,effectSceneTime(),project,{...model.view,art:artScale()*camera.z,character:charScale()*camera.z,reduced});
  if(glyph)for(const p of model.people)if(p.state!=='sheltered'&&p.state!=='cannon')drawPerson(p);
  if(farmArt)drawFarm(ctx,farmArt,'front');
  for(const flame of flames.trails.values())if(flame.volcanic&&flame.kind==='meteor')drawPlume(ctx,flame,effectSceneTime(),project,{...model.view,art:artScale()*camera.z,character:charScale()*camera.z,reduced});
  if(glyph){drawMeteors();drawBomblets();}
  if(model.cannon.enabled)for(const b of model.cannon.bullets)drawCannonBullet(ctx,b,project,{...model.view,art:model.view.art*camera.z});
  if(model.shield.enabled){
    const sphere=model.shieldGeometry(1),center=cameraPoint(sphere);
    drawShield(ctx,model.shieldState,{dome:{...center,radius:sphere.radius*camera.z},unit:model.view.art*camera.z});
  }
  drawEffects();
  if(farmArt)farmFeedback.draw(ctx,farmArt.geometry,effectSceneTime(),reduced,dark);
  drawTrail();
  if(model.cannon.enabled&&model.status!=='ended')drawCannonReticle(ctx,model.cannonState,project(model.cannon.aim.x,model.cannon.aim.y),reduced,ink);
  if(keyboardVisible&&model.status==='playing'){
    ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(keyboardPoint.x-5,keyboardPoint.y);ctx.lineTo(keyboardPoint.x+5,keyboardPoint.y);ctx.moveTo(keyboardPoint.x,keyboardPoint.y-5);ctx.lineTo(keyboardPoint.x,keyboardPoint.y+5);ctx.stroke();
  }
  nuclearHud.render(nuclear,model.realTime,reduced,route==='game'&&model.status!=='ended');
  scoreHud.render(reduced);renderOpening();renderSceneTransition();renderNuclearLayer();
}
function radarHintLayout(){
  const p=radarFootView({type:'antenna',x:-12,y:-76},model.view,CONFIG.ground,{press:0,release:0,scan:0,antenna:0,scale:model.radarScale});
  return pencilHintLayout(model.view,{x:p.x-24*model.view.art,y:p.y-24*model.view.art});
}
function announce(message){$('announcement').textContent=message;}
function clearTutorialIntro(){tutorialIntroPending=false;earlyTutorial={summoned:false,normal:false,cut:false,bomb:false};}
function advanceTutorialIntro(){
  if(!tutorialIntroPending||model.status!=='playing'||chapterGuidance.snapshot(model.realTime,reduced).stage!=='done')return;
  tutorialIntroPending=false;const time=model.realTime;
  if(!earlyTutorial.summoned){radarHint.start(time,reduced);announce('直接点按红色雷达召唤陨石。');}
  else if(earlyTutorial.normal&&!earlyTutorial.cut){cutHint.start(time,reduced);announce('按住划动，切开空中的曼字陨石。');}
  if(earlyTutorial.cut)tutorialFeedback.rewardCut(time,reduced);
  if(earlyTutorial.bomb&&tutorialFeedback.onBomb(time,reduced))announce('慢字号陨石，不要打！');
}
function handleEvents(){
  for(const e of model.drainEvents()){
    if(e.type==='scoreChange')scoreHud.receive(e);
    if(e.type==='farmHarvest')farmFeedback.add(e);
    if(e.type==='volcanoErupt')volcanoSplash.add(e);
    if(e.type==='nuclearWarning'){nuclearWarning.start(e.time,reduced);announce(`注意！核弹来袭，${NUCLEAR_RULES.warning}秒后落下，请让小人进入防空洞。`);}
    if(e.type==='nuclearLaunch'){nuclearWarning.clear();announce('核弹正在坠落。');}
    if(e.type==='nuclearBlast'){nuclearEffects.add(e);impactShake={time:e.time,amplitude:NUCLEAR_RULES.shake*(width<600?.8:1),duration:NUCLEAR_RULES.shakeDuration};announce('核弹爆炸，只有防空洞内的小人幸存。');}
    if(e.type==='shieldActivate')announce('雷达护盾已开启，罩内小人受到保护。');
    if(e.type==='cannonMode')announce(e.aiming?'防空炮持续征召，按住画面瞄准射击，雷达和农场工作者不参与。':'退出瞄准，炮内小人继续留岗并消耗饥饿，饿了再去吃饭。');
    if(e.type==='cannonHit'){
      bursts.push(makeCannonDebris(e,model.view,CONFIG.ground));
      const amplitude=(e.kind==='child'?5:9)*(width<600?.7:1),previous=impactShakeAt(e.time-impactShake.time,impactShake.amplitude,impactShake.duration??CONFIG.impactDuration);
      if(amplitude>=previous.envelope)impactShake={time:e.time,amplitude,duration:.22};
    }
    flames.event(e,model);
    if(e.type==='summon'&&guidanceFor(activeLevel).tutorial){
      if(tutorialIntroPending){earlyTutorial.summoned=true;if(e.meteor.kind==='bomb')earlyTutorial.bomb=true;else earlyTutorial.normal=true;}
      else{
        radarHint.erase(e.time,reduced);
        if(e.meteor.kind!=='bomb'&&cutHint.startAt===null&&!tutorialFeedback.praised){cutHint.start(e.time,reduced);announce('按住划动，切开空中的曼字陨石。');}
        if(e.meteor.kind==='bomb'&&tutorialFeedback.onBomb(e.time,reduced))announce('慢字号陨石，不要打！');
      }
    }
    if(e.type==='cut'){cutFeedback.add(e);if(guidanceFor(activeLevel).tutorial){if(tutorialIntroPending)earlyTutorial.cut=true;else tutorialFeedback.onCut(e.time,reduced);}}
    if(e.type==='bombBurst'||e.type==='bombletImpact'){
      const air=e.type==='bombBurst',amplitude=(air?CUT.bombShake:CUT.bombGroundShake)*(width<600?.7:1),duration=air?CUT.bombShakeDuration:.28;
      const previous=impactShakeAt(e.time-impactShake.time,impactShake.amplitude,impactShake.duration??CONFIG.impactDuration);
      if(amplitude>=previous.envelope)impactShake={time:e.time,amplitude,duration};
      const burst=makeBombBurst(e);burst.duration=bombBurstDuration(burst,model.view,CONFIG.ground);bursts.push(burst);
      if(air)announce(`慢字炸弹爆炸，扣除${e.penalty}分，注意六颗子母弹。`);
    }
    if(e.type==='enter')shelterPulse=e.time;
    if(e.type==='land'){
      if(e.time-lastLandShake>=.12){shakeStart=e.time;lastLandShake=e.time;}
      bursts.push({type:'man',x:e.x,y:e.y,seed:e.id,time:e.sceneTime,duration:1.4,tone:e.person?.tone});
    }
    if(e.type==='impact'){
      const strength=clamp(Math.hypot(e.vx,e.vy)/220,.8,1.15),amplitude=CONFIG.impactShake*strength*(width<600?.7:1);
      const previous=impactShakeAt(e.time-impactShake.time,impactShake.amplitude,impactShake.duration??CONFIG.impactDuration);
      if(amplitude>=previous.envelope)impactShake={time:e.time,amplitude,duration:CONFIG.impactDuration};
      const impactCount=bursts.filter(f=>f.type==='meteor').length;
      if(impactCount>=10)bursts.splice(bursts.findIndex(f=>f.type==='meteor'),1);
      bursts.push({type:'meteor',x:e.x,y:e.y,seed:e.id,time:e.sceneTime,duration:1.4,tone:e.tone,count:CONFIG.impactDebris});
    }
    if(e.type==='death'){
      const p=personView(e.person,model.view,CONFIG.ground,e.sceneTime,radarPose());
      bursts.push({...airHitBurst(p.x/model.view.sx,p.y/model.view.sy,e.id,e.sceneTime,model.view,CONFIG.ground),tone:e.tone});
    }
    if(e.type==='recall')announce('召回开始。非工作者立即出发，工作者每隔一秒离岗。');
    if(e.type==='release')announce('小人出洞，恢复自动行动。');
    if(e.type==='end')finish();
  }
}
function updateHud(force=false){
  if(!force&&model.realTime-hudStamp<.07)return;hudStamp=model.realTime;
  document.querySelector('.playfield').dataset.state=model.status;
  const seconds=Math.ceil(model.remaining);$('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  document.querySelector('.time-metric').classList.toggle('urgent',seconds<=10);
  scoreHud.feedback.retarget(model.score);$('cuts').textContent=String(model.cuts);$('alive').textContent=String(model.alive);
  $('shelter-count').textContent=`洞内 ${model.sheltered} 人`;
  $('work-count').textContent=`工作 ${model.workers} 人`;
  updateRadarControls();
  $('charge-fill').style.transform=`scaleX(${clamp(model.chargePercent/100,0,1)})`;
  document.querySelector('.charge-track').setAttribute('aria-valuenow',String(Math.round(clamp(model.chargePercent,0,100))));
  const active=model.status==='playing';$('recall-button').disabled=!active||model.recallActive;
  $('release-button').disabled=!active||(!model.recallActive&&!model.sheltered);
  const resumable=route==='game'&&['playing','paused'].includes(model.status),onTitle=route==='title';
  $('pause-button').hidden=!resumable;$('pause-button').disabled=!resumable;
  const restartable=route==='game'&&['playing','paused','ended'].includes(model.status);
  $('menu-restart-button').hidden=!restartable;$('menu-restart-button').disabled=!restartable;
  $('return-start-button').hidden=onTitle;$('return-start-button').disabled=onTitle;
  $('return-levels-button').hidden=route!=='game';$('return-levels-button').disabled=route!=='game';
  $('recall-button').setAttribute('aria-pressed',String(model.recallActive));
  $('menu-button').disabled=roundEnding.pending;$('tuning-button').disabled=roundEnding.pending;
}
function updateRadarControls(){
  const layoutKey=`${width}:${height}:${model.progression.radarFactor}`;
  if(radarLayoutKey===layoutKey)return;radarLayoutKey=layoutKey;
  const factor=model.progression.radarFactor,w=(width<=700?80:112)*factor;
  const x=radarOriginX(model.radarScale)/CONFIG.width*width,base=screenBase(0,CONFIG.ground);
  $('radar-controls').style.width=`${w}px`;
  $('radar-controls').style.left=`${clamp(x,w/2+16,width-w/2-16)}px`;
  const radarTop=Math.max(114,base.y-266*artScale()*model.radarScale-18);
  $('radar-controls').style.top=`${radarTop}px`;
  scoreHud.layout(width,height);
}
function updateShieldControl(){
  const root=$('radar-shield');root.hidden=route!=='game'||!model.shield.enabled;
  if(root.hidden)return;
  const scale=.82,radarX=radarOriginX(model.radarScale)*model.view.sx;
  const rightOfRadar=radarX+52*model.view.art*model.radarScale+10;
  root.style.left=`${clamp(rightOfRadar,12,width-128*scale-12)}px`;
  root.style.top=`${clamp(CONFIG.ground*model.view.sy-105*model.view.art,12,height-104*scale-12)}px`;
  shieldControl.render(model.shieldState,{available:model.status==='playing'&&!sceneTransition.active});
}
function updateCannonControls(){
  const root=$('cannon-controls');root.hidden=route!=='game'||!model.cannon.enabled;if(root.hidden){cannonCoolingHUD.update(false,reduced,true);return;}
  const g=cannonGeometry(model.view,CONFIG.ground),s=model.cannonState;
  const p=cameraPoint(g.pivot),size=clamp(50*g.scale*camera.z,24,48),compact=width<=620||height<=520;
  root.style.setProperty('--cannon-button-size',`${size}px`);root.style.left=`${clamp(p.x,size/2+3,width-size/2-3)}px`;root.style.top=`${clamp(p.y,size/2+3,height-size/2-(compact?2:7)-(compact?18:20)-3)}px`;
  root.dataset.aiming=String(s.aiming);$('cannon-crew-count').textContent=`${s.crew} / 6`;$('cannon-crew-status').textContent=s.reserved>s.crew?' · 入驻中':'';
  const button=$('cannon-toggle');button.disabled=model.status!=='playing'||sceneTransition.active;button.setAttribute('aria-pressed',String(s.aiming));button.setAttribute('aria-label',s.aiming?'退：退出瞄准并解除征召':'射：征召小人并进入瞄准模式');
  $('cannon-heat').setAttribute('aria-valuenow',String(Math.round(s.heatProgress*100)));$('cannon-heat').setAttribute('aria-label',s.overheated?'防空炮过热，正在冷却':'防空炮过热值');drawCannonHeat(cannonHeatContext,s,s.overheated?'#b52e3e':ink);
  cannonCoolingHUD.update(s.aiming&&['playing','paused'].includes(model.status),reduced);
}
function mechanismTargets(){
  const root=$('radar-shield'),rect=root.querySelector('.energy-toggle').getBoundingClientRect(),g=cannonGeometry(model.view,CONFIG.ground),size=clamp(50*g.scale,24,48),gap=clamp(48*model.view.art,32,48);
  const cannonTop=g.pivot.y-(CANNON.barrel+16)*g.scale;
  return{shield:{x:rect.left+rect.width/2,y:root.getBoundingClientRect().top-gap},cannon:{x:clamp(g.pivot.x,size/2+3,width-size/2-3),y:cannonTop-gap}};
}
function farmFrame(sync=false){
  if(route!=='game'||!model.farmState.enabled)return{enabled:false};
  const geometry=farmGeometry(model.view,model.sceneTime,reduced);
  if(sync){const pose=radarPose(),people=model.people.filter(p=>!['sheltered','cannon','dead'].includes(p.state)).map(p=>({id:p.id,...personView(p,model.view,CONFIG.ground,model.sceneTime,pose)}));farmMotion.sync(people,model.sceneTime,geometry,reduced);}
  return{...model.farmState,...farmMotion.snapshot(model.sceneTime,geometry,reduced),feedback:farmFeedback.snapshot(effectSceneTime(),reduced)};
}
function clearRoundScene(){
  $('results-backdrop').hidden=true;
  roundEnding.reset();
  farmMotion.reset();
  farmFeedback.reset();
  volcanoSplash.clear();
  nuclearEffects.clear();nuclearWarning.clear();nuclearHud.reset();clearNuclearLayer();
  chapterGuidance.stop();
  mechanismGuidance.stop();
  tutorialFeedback.reset();
  clearTutorialIntro();
  scoreHud.reset(model.score);
  radarHint.stop();cutHint.stop();trail=[];bursts=[];flames.clear();cutFeedback.clear();shakeStart=-10;lastLandShake=-10;impactShake={time:-10,amplitude:0};shelterPulse=-10;hudStamp=-1;
  keyboardVisible=false;keys.clear();bladeActive=false;lastPoint=null;pauseReason='';
  canvas.style.cursor='default';lastFrame=performance.now();
}
function prepareRound(){
  route='game';activeLevel??=levelScene.selected??LEVELS[0].id;
  opening.enterGame();model.start(activeLevel);clearRoundScene();model.status='paused';
  $('intro').inert=false;$('intro').style.transform='';$('intro').style.opacity='';$('menu-button').disabled=false;$('start-button').disabled=false;
  $('overlay').hidden=true;$('intro').hidden=false;$('results').hidden=true;
  updateHud(true);
}
function activateRound(){
  model.status='playing';chapterGuidance.start(activeLevel,model.realTime,reduced);
  mechanismGuidance.start(activeLevel,model.realTime,reduced);
  tutorialIntroPending=guidanceFor(activeLevel).tutorial&&!!chapterGuidance.drawing;
  if(guidanceFor(activeLevel).tutorial&&!tutorialIntroPending)radarHint.start(model.realTime,reduced);
  lastFrame=performance.now();updateHud(true);canvas.focus({preventScroll:true});
  announce(guidanceFor(activeLevel).chapter?.config.text.replace('\n','，')??'游戏开始，三分钟。直接点按红色雷达召唤。');
}
function start(){
  if(!ready||sceneTransition.active)return;prepareRound();activateRound();
  render();
}
function restart(){
  if(!ready||route!=='game'||!['playing','paused','ended'].includes(model.status))return false;
  return changeSceneWithTransition(prepareRound,activateRound);
}
function beginOpening(){
  if(!ready||sceneTransition.active||!opening.begin(dark,reduced))return;
  levelScene.reset();levelSky=new BackgroundSky();activeLevel=null;levelDrag.reset();
  $('start-button').disabled=true;keys.clear();bladeEnd();canvas.style.cursor='default';
  if($('game-menu').open)closeMenu();$('cut-tuner').hidden=true;$('tuning-button').setAttribute('aria-expanded','false');
  lastFrame=performance.now();announce('正在进入选关。');render();
}
function stepTitle(dt){
  if(opening.paused||document.hidden)return;
  titleSky.step(dt,reduced);
  if(opening.mode==='transition'){levelScene.step(dt,reduced);levelSky.step(dt,reduced);}
  if(opening.step(dt)){showLevelSelect(false);levelButtons.get(LEVELS[0].id).focus({preventScroll:true});announce('请选择关卡。');}
}
function showLevelSelect(reset=false){
  levelDrag.stop();
  route='levels';model.reset();clearRoundScene();opening.enterGame();
  if(reset){levelScene.reset();levelSky=new BackgroundSky();}
  levelScene.paused=false;$('overlay').hidden=true;$('results').hidden=true;$('intro').hidden=true;
  $('menu-button').disabled=false;lastFrame=performance.now();updateHud(true);
}
function stepLevels(dt){
  levelScene.paused=document.hidden||$('game-menu').open;
  if(levelScene.paused){levelDrag.stop();return;}levelDrag.step(dt,reduced);levelScene.step(dt,reduced);levelSky.step(dt,reduced);
}
function returnToLevels(){
  if(route!=='game')return false;
  return changeSceneWithTransition(()=>showLevelSelect(),()=>{
    const id=levelScene.selected??LEVELS[0].id;levelButtons.get(id).focus({preventScroll:true});announce('已返回选关。');
  });
}
function resetToStart(){
  route='title';activeLevel=null;levelScene.reset();model.reset();clearRoundScene();opening.reset();titleSky=new BackgroundSky();
  $('intro').inert=false;$('intro').style.transform='';$('intro').style.opacity='';$('start-button').disabled=!ready;$('menu-button').disabled=false;
  $('cut-tuner').hidden=true;$('tuning-button').setAttribute('aria-expanded','false');
  $('overlay').hidden=false;$('intro').hidden=false;$('results').hidden=true;
  updateHud(true);
}
function changeSceneWithTransition(changeScene,onComplete=()=>{}){
  if(sceneTransition.active||opening.mode==='transition'||roundEnding.pending)return false;
  const field=document.querySelector('.playfield');
  if(!sceneTransition.begin({dark,reduced,onCovered:changeScene,onComplete:()=>{
    field.inert=false;field.removeAttribute('aria-busy');onComplete();
  }}))return false;
  levelDrag.stop();
  if(model.status==='playing')model.status='paused';
  if($('game-menu').open)$('game-menu').close();
  $('results').hidden=true;
  $('results-backdrop').hidden=true;
  $('menu-button').setAttribute('aria-expanded','false');
  $('cut-tuner').hidden=true;$('tuning-button').setAttribute('aria-expanded','false');
  keys.clear();bladeEnd();trail=[];field.inert=true;field.setAttribute('aria-busy','true');
  transitionSky=new BackgroundSky();lastFrame=performance.now();render();return true;
}
function returnToStart(){
  if(route==='title')return false;
  return changeSceneWithTransition(resetToStart,()=>{$('start-button').focus({preventScroll:true});announce('已返回开始界面。');});
}
function stepSceneTransition(dt){
  if(document.hidden||sceneTransition.paused)return;
  transitionSky.step(dt,sceneTransition.reduced);sceneTransition.step(dt);
}
function openMenu(reason='menu'){
  if(sceneTransition.active||opening.mode==='transition'||roundEnding.pending)return;
  model.cannon.trigger=false;
  levelDrag.stop();
  if(model.status==='playing'){model.status='paused';pauseReason=reason;trail=[];bladeActive=false;lastPoint=null;keys.clear();announce('游戏暂停，计时停止。');}
  if(!$('game-menu').open)$('game-menu').showModal();
  if(route==='levels')levelScene.paused=true;
  $('menu-button').setAttribute('aria-expanded','true');updateHud(true);
}
function closeMenu(){
  if(sceneTransition.active)return;
  if($('game-menu').open)$('game-menu').close();
  $('menu-button').setAttribute('aria-expanded','false');
  if(route==='levels')levelScene.paused=document.hidden;
  if(model.status==='paused'){model.status='playing';pauseReason='';lastFrame=performance.now();announce('继续游戏。');}
  updateHud(true);
}
function setPaused(paused,reason='manual'){
  if(paused&&model.status==='playing')openMenu(reason);
  else if(!paused&&model.status==='paused')closeMenu();
}
function finish(){
  model.cannon.trigger=false;
  nuclearWarning.clear();
  clearTutorialIntro();
  chapterGuidance.stop();
  mechanismGuidance.stop();
  tutorialFeedback.reset();
  scoreHud.settle(model.score);
  radarHint.stop();cutHint.stop();
  bladeActive=false;trail=[];lastPoint=null;keys.clear();keyboardVisible=false;
  const finale=roundEnding.start(model,reduced);
  for(const burst of finale)bursts.push({...makeCannonDebris(burst,model.view,CONFIG.ground),roundEnd:true});
  for(const id of flames.trails.keys())flames.end(id,'roundEnd',model.sceneTime);
  if(finale.length)impactShake={time:model.realTime,amplitude:Math.min(16,8+Math.sqrt(finale.length)*2)*(width<600?.7:1),duration:.32};
  $('cut-tuner').hidden=true;$('tuning-button').setAttribute('aria-expanded','false');
  $('overlay').hidden=true;$('intro').hidden=true;$('results').hidden=true;
  let best=0;try{best=Number(localStorage.getItem('man-best')||0);best=Math.max(best,model.score);localStorage.setItem('man-best',String(best));}catch{best=model.score;}
  $('final-score').textContent=String(model.score);$('final-cuts').textContent=`${model.cuts} × ${model.scoreRules.cutPoints}`;$('final-alive').textContent=`${model.alive} × ${model.scoreRules.survivorPoints}`;$('best-score').textContent=String(best);
  $('final-penalty').textContent=`−${model.bombPenalty}`;
  announce(`时间到，得分${model.score}，存活${model.alive}人。`);updateHud(true);
  $('cannon-result').hidden=!model.cannon.enabled;$('final-cannon').textContent=String(model.cannonBonus);
  $('farm-result').hidden=!model.farmState.enabled;$('final-farm').textContent=String(model.farmBonus);
}
function stepRoundEnding(dt){
  if(document.hidden||$('game-menu').open)return;
  if(roundEnding.step(dt)){
    $('overlay').hidden=false;$('results-backdrop').hidden=false;$('results').hidden=false;updateHud(true);
    $('results-levels-button').focus({preventScroll:true});
  }
}
function localPoint(event){const r=canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
const radarTowerPath=new Path2D('M-12 -161 L6 -165 L35 -9 L48 0 L-9 0 L2 -10 Z');
const radarBowlPath=new Path2D('M-91 0 C-85 62 83 61 91 0 Z');
const radarAntennaPath=new Path2D('M-8 9 L-16 -67 L-6 -69 L5 7 Z');
function inRadar(p){
  const base=project(radarOriginX(model.radarScale),CONFIG.ground),s=artScale()*model.radarScale*camera.z;
  const q={x:(p.x-base.x)/s,y:(p.y-base.y)/s};
  const {press,release,scan,antenna:antennaIdle}=radarPose();
  ctx.save();ctx.resetTransform();ctx.lineWidth=8;
  const hit=path=>ctx.isPointInPath(path,q.x,q.y)||ctx.isPointInStroke(path,q.x,q.y);
  if(hit(radarTowerPath)){ctx.restore();return true;}
  const angle=-.45+press*.018-release*.025+scan,dx=q.x+10,dy=q.y+165-press*3;
  q.x=dx*Math.cos(angle)+dy*Math.sin(angle);q.y=-dx*Math.sin(angle)+dy*Math.cos(angle);
  if(q.x*q.x/(95*95)+q.y*q.y/(31*31)<=1||hit(radarBowlPath)){ctx.restore();return true;}
  const antenna=press*.025-release*.028+antennaIdle,ax=q.x,ay=q.y;
  q.x=ax*Math.cos(antenna)+ay*Math.sin(antenna);q.y=-ax*Math.sin(antenna)+ay*Math.cos(antenna);
  const yes=hit(radarAntennaPath)||Math.hypot(q.x+12,q.y+76)<=19;ctx.restore();return yes;
}
function bladeMove(p,stamp){
  if(lastPoint){
    const distance=Math.hypot(p.x-lastPoint.x,p.y-lastPoint.y),dt=Math.max(.003,(stamp-lastPointerStamp)/1000),speed=distance/dt;
    if(distance>.5){
      const stroke=clamp(1.5+speed*.0025,1.5,width<600?3:4.7);
      model.slice(lastPoint,p,stroke,m=>({...meteorPoint(m),radius:m.size*.52*charScale()*camera.z}),{speed,scaleX:width/CONFIG.width*camera.z,scaleY:height/CONFIG.height*camera.z,visualScale:charScale()*camera.z});
      const strength=swipeStrength(speed,CONFIG.meteorSize*charScale());
      trail.push({...p,time:model.realTime,speed,life:CUT.bladeLife+CUT.bladeExtra*strength});handleEvents();
    }
  }else trail.push({...p,time:model.realTime,speed:0,life:CUT.bladeLife});
  lastPoint=p;lastPointerStamp=stamp;
}
canvas.addEventListener('pointerdown',e=>{
  if(model.status!=='playing'||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);keyboardVisible=false;const p=localPoint(e);
  if(model.cannon.aiming){model.aimCannon(p.x-camera.dx,p.y-camera.dy);model.cannon.trigger=true;bladeActive=false;trail=[];return;}
  if(inRadar(p)){bladeActive=false;lastPoint=null;model.clickRadar();handleEvents();updateHud(true);return;}
  bladeActive=true;lastPoint=null;trail=[];bladeMove(p,e.timeStamp);
});
canvas.addEventListener('pointermove',e=>{
  const p=localPoint(e);canvas.style.cursor=model.status==='playing'&&inRadar(p)?'pointer':'default';
  if(model.cannon.aiming&&model.status==='playing'){model.aimCannon(p.x-camera.dx,p.y-camera.dy);canvas.style.cursor='crosshair';return;}
  if(!bladeActive||model.status!=='playing')return;
  const samples=e.getCoalescedEvents?.();
  for(const sample of samples?.length?samples:[e])bladeMove(localPoint(sample),sample.timeStamp);
  updateHud();
});
function bladeEnd(){bladeActive=false;lastPoint=null;model.cannon.trigger=false;}
canvas.addEventListener('pointerup',bladeEnd);canvas.addEventListener('pointercancel',bladeEnd);
$('recall-button').addEventListener('click',()=>{model.recall();handleEvents();updateHud(true);});
$('release-button').addEventListener('click',()=>{model.release();handleEvents();updateHud(true);});
$('cannon-toggle').addEventListener('click',()=>{
  bladeEnd();trail=[];
  if(model.toggleCannon()){
    const button=$('cannon-toggle');button.getAnimations().forEach(a=>a.cancel());
    if(!reduced)button.animate([{transform:'translateY(2px) scale(.86)'},{transform:'translateY(-1px) scale(1.1)',offset:.55},{transform:'scale(.97)',offset:.8},{transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.3,0,.2,1)'});
    handleEvents();render();
  }
});
$('start-button').addEventListener('click',()=>ready?beginOpening():loadGlyph());
$('menu-restart-button').addEventListener('click',restart);
$('results-levels-button').addEventListener('click',returnToLevels);
$('menu-button').addEventListener('click',()=>openMenu());$('menu-close').addEventListener('click',closeMenu);
$('return-start-button').addEventListener('click',returnToStart);
$('return-levels-button').addEventListener('click',returnToLevels);
$('level-map').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key)||route!=='levels'||sceneTransition.active)return;
  e.preventDefault();levelDrag.stop();const available=LEVELS.filter(n=>n.unlocked),current=available.findIndex(n=>n.id===(document.activeElement.dataset.level??levelScene.selected));
  const node=available[clamp(current+(e.key==='ArrowRight'?1:-1),0,available.length-1)];
  if(selectLevel(node.id,false)){const button=levelButtons.get(node.id);button.focus({preventScroll:true});button.scrollIntoView({block:'nearest',inline:'center',behavior:reduced?'instant':'smooth'});}
});
$('pause-button').addEventListener('click',closeMenu);
$('game-menu').addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
$('game-menu').addEventListener('click',e=>{const r=$('game-menu').getBoundingClientRect();if(e.target===$('game-menu')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))closeMenu();});
$('theme-toggle').addEventListener('click',()=>{dark=!dark;theme();});
motionPreference.addEventListener('change',e=>{reduced=e.matches;motionState();render();});
document.addEventListener('visibilitychange',()=>{opening.paused=document.hidden;sceneTransition.paused=document.hidden;lastFrame=performance.now();if(document.hidden)setPaused(true,'hidden');});
window.addEventListener('blur',()=>{keys.clear();bladeEnd();});
window.addEventListener('keydown',e=>{
  if(sceneTransition.active||opening.mode==='transition'){if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Space','KeyP','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();return;}
  if(e.target.closest?.('#cut-tuner'))return;
  if(e.key.toLowerCase()==='p'&&!e.repeat){setPaused(model.status!=='paused');return;}
  if(e.code==='Space'&&model.status==='playing'&&(e.target===canvas||e.target===document.body)){e.preventDefault();if(model.cannon.aiming){model.cannon.trigger=true;return;}if(!e.repeat){model.clickRadar();handleEvents();updateHud(true);}return;}
  if(model.status==='playing'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Shift'].includes(e.key)){
    e.preventDefault();keys.add(e.key);keyboardVisible=true;
  }
});
window.addEventListener('keyup',e=>{keys.delete(e.key);if(e.code==='Space')model.cannon.trigger=false;if(e.key==='Shift')lastPoint=null;});
function keyboardStep(dt){
  if(!keyboardVisible||model.status!=='playing')return;
  const p={...keyboardPoint},speed=300*dt;
  keyboardPoint.x=clamp(p.x+(keys.has('ArrowRight')?speed:0)-(keys.has('ArrowLeft')?speed:0),0,width);
  keyboardPoint.y=clamp(p.y+(keys.has('ArrowDown')?speed:0)-(keys.has('ArrowUp')?speed:0),0,height);
  if(model.cannon.aiming){model.aimCannon(keyboardPoint.x-camera.dx,keyboardPoint.y-camera.dy);return;}
  if(keys.has('Shift')){if(!lastPoint)lastPoint=p;bladeMove({...keyboardPoint},performance.now());}else lastPoint=null;
}
function tick(now){
  const dt=Math.max(0,(now-lastFrame)/1000);lastFrame=now;
  if(!qaHeld){
    if(sceneTransition.active)stepSceneTransition(dt);
    else if(opening.mode!=='game')stepTitle(dt);
    else if(route==='levels')stepLevels(dt);
    else if(model.status==='playing'){scoreHud.step(dt);sky.step(Math.min(dt,.1),reduced);model.step(dt);keyboardStep(Math.min(dt,.05));handleEvents();updateHud();}
    else if(model.status==='ended')stepRoundEnding(dt);
  }
  render();requestAnimationFrame(tick);
}
async function loadGlyph(){
  $('start-button').disabled=true;$('loading-status').hidden=false;
  try{
    const [response,bombResponse]=await Promise.all([fetch('assets/glyphs.json'),fetch('assets/bomb-glyph.json')]);if(!response.ok||!bombResponse.ok)throw Error('glyph');
    const data=await response.json();bombGlyph=await bombResponse.json();
    if(bombGlyph.parts.length!==6)throw Error('bomb parts');bombPath=new Path2D(bombGlyph.path);bombParts=bombGlyph.parts.map(p=>new Path2D(p.path));
    for(const g of data.glyphs){glyphs.set(g.id,g);glyphPaths.set(g.id,new Path2D(g.path));}
    if(glyphs.size!==3)throw Error('glyph count');glyph=glyphs.get('yahei');glyphPath=glyphPaths.get('yahei');ready=true;
    $('start-button').disabled=false;$('start-button').textContent='开始';$('loading-status').hidden=true;
  }catch{
    ready=false;$('start-button').disabled=false;$('start-button').textContent='重新加载';$('loading-status').textContent='字形资源未能加载，请重试。';
  }
}
// A read-only probe exposes observable state; QA uses real pointer gestures for cuts.
window.__MAN__={get snapshot(){return model.snapshot();},get camera(){return {...camera};},get viewport(){return{width,height,artScale:artScale(),charScale:charScale()};},get reduced(){return reduced;},get pauseReason(){return pauseReason;},get meteors(){return model.meteors.map(m=>({id:m.id,...meteorPoint(m),size:m.size*charScale()*camera.z}));},get effects(){return bursts.map(b=>({type:b.type,particles:b.type==='meteor'?84:b.type==='man'?16:12}));},
  get route(){return route;},get activeLevel(){return activeLevel;},get levelSelection(){return levelScene.snapshot($('level-map').clientWidth,Math.max(1,$('level-map').clientHeight),reduced);},
  get levelDrag(){return levelDrag.snapshot();},
  get shield(){const circle=model.shieldGeometry();return{...model.shieldState,circle:circle?{...cameraPoint(circle),radius:circle.radius*camera.z}:null};},
  get cannon(){return{...model.cannonState,geometry:cannonGeometry(model.view,CONFIG.ground)};},
  get flames(){return [...flames.trails.values()].map(t=>({id:t.id,kind:t.kind,reason:t.reason,ended:t.ended,points:t.points.length,volcanic:!!t.volcanic,ascending:!!t.ascending}));},
  get bursts(){return bursts.map(b=>({...b}));},
  get cutFeedback(){return cutFeedback.snapshot();},
  get scoreFeedback(){return scoreHud.feedback.snapshot(reduced);},
  get tuning(){return cutSettingsSnapshot();},
  get sky(){return(opening.mode==='game'?sky:titleSky).snapshot(width,height,reduced);},
  get opening(){return opening.snapshot(width,height,artScale());},
  get sceneTransition(){return sceneTransition.snapshot();},
  get onboardingHint(){return{...radarHint.snapshot(model.realTime,reduced),layout:radarHintLayout()};},
  get cutHint(){return{...cutHint.snapshot(model.realTime,reduced),layout:cutHintLayout(model.view)};},
  get tutorialFeedback(){return{...tutorialFeedback.snapshot(model.realTime,reduced),praiseLayout:feedbackHintLayout(model.view,PRAISE_DRAWING),warningLayout:feedbackHintLayout(model.view,BOMB_DRAWING)};},
  get chapterHint(){return{...chapterGuidance.snapshot(model.realTime,reduced),layout:chapterGuidance.drawing?chapterHintLayout(model.view,chapterGuidance.drawing):null,tutorial:guidanceFor(activeLevel).tutorial};},
  get mechanismHint(){return mechanismGuidance.snapshot(model.realTime,reduced,model.view,mechanismTargets());},
  get roundEnding(){return roundEnding.snapshot();},
  get farm(){return farmFrame();},
  get volcano(){return{...model.volcanoState,splash:volcanoSplash.snapshot(effectSceneTime()).length};},
  get nuclear(){return{...model.nuclearState,warning:nuclearWarning.snapshot(model.realTime,reduced),flash:nuclearEffects.flash(effectSceneTime(),reduced),clouds:nuclearEffects.blasts.length};},
  get bombs(){return{assetsReady:!!bombPath,parts:bombGlyph?.parts.map(p=>p.label)??[],charges:model.meteors.filter(m=>m.arm).map(m=>({id:m.id,...bombChargeAt(m,model.realTime)}))};},
  get bomblets(){return model.bomblets.map(c=>({id:c.id,part:c.part,...cameraPoint(bombletView(c,model.view)),angle:c.angle}));},
  get blade(){return trail.map(p=>({time:p.time,life:p.life??.1,speed:p.speed}));},
  get people(){return model.people.filter(p=>p.state!=='sheltered').map(p=>({id:p.id,...cameraPoint(personView(p,model.view,CONFIG.ground,model.sceneTime,radarPose()))}));},
  get radio(){return radioWaves(radioState(),{art:artScale()*camera.z,reduced},project);},
  get variants(){return VARIANTS;},get fonts(){return [...glyphs.keys()];},get radar(){return{growth:model.progression.radarFactor,originX:radarOriginX(model.radarScale),pulseTime:model.radarPulse,waves:this.radio.length>0,...radarPose()};}};
if(new URLSearchParams(location.search).has('qa')){
  window.__MAN_QA__={model,reset:start,hold:value=>{qaHeld=value;lastFrame=performance.now();},finishOpening:()=>{if(opening.mode==='transition')stepTitle(opening.duration-opening.time);updateHud(true);render();},finishSceneTransition:()=>{if(sceneTransition.active)stepSceneTransition(sceneTransition.duration-sceneTransition.time);updateHud(true);render();},step:dt=>{if(sceneTransition.active)stepSceneTransition(dt);else if(opening.mode!=='game')stepTitle(dt);else if(route==='levels')stepLevels(dt);else if(model.status==='ended')stepRoundEnding(dt);else{if(model.status==='playing'){scoreHud.step(dt);sky.step(dt,reduced);}model.step(dt);handleEvents();}updateHud(true);render();},spawn:(x,y,type)=>model.spawnMeteor(x,y,type),spawnBomb:(x,y)=>model.spawnMeteor(x,y,undefined,'bomb')};
}
function tuningSummon(kind){if(!ready||sceneTransition.active||roundEnding.pending)return false;if(model.status==='ready'||model.status==='ended')start();else if(model.status==='paused')closeMenu();model.spawnMeteor(undefined,undefined,undefined,kind);handleEvents();updateHud(true);return true;}
function tuningNuclear(){if(!ready||sceneTransition.active||roundEnding.pending||!model.nuclear.enabled)return false;if(model.status==='paused')closeMenu();if(!model.requestNuclear(true))return false;handleEvents();updateHud(true);render();return true;}
installCutTuner({summon:()=>tuningSummon('man'),summonBomb:()=>tuningSummon('bomb'),launchNuclear:tuningNuclear,enableMotion:()=>{reduced=false;motionState();},onChange:()=>{if(ready)render();}});
theme();motionState();resize();loadGlyph();requestAnimationFrame(tick);updateHud(true);
