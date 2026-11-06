import {impactShakeAt} from './effects.js';
import {airHitFragmentAt,fragmentLandingTime} from './fx-physics.js';
import {blackHawkHullBottom,blackHawkWreckage,drawBlackHawkShard} from './black-hawk-art.js';
import {drawElbowImpact,ELBOW_HIT_DURATION} from './black-hawk-elbow.js';
import {blackHawkProjector} from './black-hawk-flight.js';
import {CRASH_CLOUD_LIFE,drawCrashCloud} from './nuclear-art.js';
const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
const sample=n=>{const x=Math.sin(n*1.823+13.7)*43758.5453;return x-Math.floor(x);};
const CHASSIS=[[-152,-22,5],[-68,4,-12],[2,-35,9],[74,9,17],[108,5,8],[-28,16,18]];
const STAGE_BLASTS=[
  {delay:0,life:.48,size:1.04},
  {delay:.12,life:.48,size:1.15},
  {delay:.25,life:.44,size:1.28},
];
const BLAST_ORANGE='#ef6632',BLAST_GOLD='#ffd553',BLAST_CORE='#fff0a0';
const WRECKAGE_SETTLE=.38;
const CRASH_FALL=1.32;

function sparks(ctx,p,age,life,size,count,seed,angle=null){
  if(age<0||age>=life)return;
  const u=age/life;
  ctx.save();
  for(let i=0;i<count;i++){
    const n=seed*81+i*9.37;
    const a=angle===null?sample(n)*TAU:angle+(sample(n)-.5)*2.5;
    const c=Math.cos(a),s=Math.sin(a),speed=(56+sample(n+1)*252)*size;
    const duration=life*(.54+.46*sample(n+2));
    if(age>=duration)continue;
    const x=p.x+c*speed*age,y=p.y+s*speed*age+230*age*age*size;
    const length=(4+11*sample(n+3))*size*(1-.58*u),width=(1.1+2.2*sample(n+4))*size;
    ctx.fillStyle=i%3===0?'#fa6b2f':'#ffd553';
    ctx.globalAlpha=(1-age/duration)**1.2;
    ctx.beginPath();ctx.moveTo(x+c*length,y+s*length);
    ctx.lineTo(x-s*width,y+c*width);ctx.lineTo(x-c*length*.44,y-s*length*.44);
    ctx.lineTo(x+s*width,y-c*width);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function blastRadius(age,size,growth){
  return size*(16+70*(1-(1-clamp(age/growth))**3));
}

function fireLobes(ctx,p,radius,seed,color,opacity){
  ctx.globalAlpha=opacity;
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.arc(p.x,p.y,radius*.57,0,TAU);
  for(let i=0;i<6;i++){
    const n=seed*13+i*5.2,a=i*TAU/6+sample(seed)*TAU;
    const d=radius*(.43+.08*sample(n)),r=radius*(.39+.17*sample(n+1));
    const x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;
    ctx.moveTo(x+r,y);
    ctx.arc(x,y,r,0,TAU);
  }
  ctx.fill();
}

function blastSparks(ctx,p,age,life,size,seed,reduced,growth){
  const count=reduced?18:36;
  for(let i=0;i<count;i++){
    const n=seed*81+i*9.37;
    const delay=.018+sample(n)*.069,flight=age-delay;
    const duration=(life-delay)*(.49+.51*sample(n+1));
    if(flight<0||flight>=duration)continue;
    const t=flight/duration,a=(i+sample(n+2)*.94)*TAU/count+sample(seed)*TAU;
    const c=Math.cos(a),s=Math.sin(a);
    const rim=blastRadius(delay,size,growth)*(.75+sample(n+3)*.25);
    const speed=(175+sample(n+4)*250)*size,gravity=320*size;
    const distance=rim+speed*flight;
    const x=p.x+c*distance,y=p.y+s*distance+gravity*flight**2/2;
    const angle=Math.atan2(s*speed+gravity*flight,c*speed);
    const dx=Math.cos(angle),dy=Math.sin(angle);
    const length=(8+22*sample(n+5))*size*(1-.54*t),width=(1.2+2.7*sample(n+6))*size*(1-.47*t);
    ctx.globalAlpha=(1-t)**1.25;
    ctx.fillStyle=i%4===0?BLAST_ORANGE:i%3===0?BLAST_CORE:BLAST_GOLD;
    ctx.beginPath();
    ctx.moveTo(x+dx*width,y+dy*width);
    ctx.lineTo(x-dy*width,y+dx*width);
    ctx.lineTo(x-dx*length,y-dy*length);
    ctx.lineTo(x+dy*width,y-dx*width);
    ctx.closePath();
    ctx.fill();
  }
}

function executionBlast(ctx,p,age,life,size,seed,reduced){
  if(age<0||age>=life)return;
  const growth=.24,radius=blastRadius(age,size,growth);
  const fade=1-clamp((age-.12)/(life-.12));
  ctx.save();
  if(!reduced&&age<growth){
    const t=age/growth,r=radius*(1.04+.45*t);
    ctx.globalAlpha=.64*(1-t)**2;
    ctx.strokeStyle=BLAST_GOLD;
    ctx.lineWidth=(6-4*t)*size;
    ctx.beginPath();
    ctx.arc(p.x,p.y,r,0,TAU);
    ctx.stroke();
  }
  fireLobes(ctx,p,radius,seed,BLAST_ORANGE,fade);
  fireLobes(ctx,p,radius*.66,seed,BLAST_GOLD,fade**1.55);
  const flash=1-clamp(age/.15);
  if(flash>0)fireLobes(ctx,p,radius*.47,seed,BLAST_CORE,flash*(reduced?.45:1));
  blastSparks(ctx,p,age,life,size,seed,reduced,growth);
  ctx.restore();
}

function crashPose(crash,t,view,scale){
  const {frame,origin,center,ground,facing}=crash;
  const dive=t*(2-t);
  const pose={...frame,scale,detached:[true,true,true],crashing:true,skillAge:null,staggered:false,
    yaw:frame.yaw+facing*.29*dive,pitch:frame.pitch+.61*dive,
    bank:frame.bank-.21*dive,
    rotorPhase:frame.rotorPhase+CRASH_FALL*t*(15-4.2*t),tailPhase:frame.tailPhase+CRASH_FALL*t*(27-8*t)};
  const floor=ground*view.sy-blackHawkHullBottom(pose);
  pose.x=(origin.x+(center-origin.x)*t*t)*view.sx;
  pose.y=origin.y*view.sy+(floor-origin.y*view.sy)*t*t;
  return pose;
}

function makeCrash({frame,view,ground,sceneTime:time},seed){
  const origin={x:frame.x/view.sx,y:frame.y/view.sy},facing=Math.cos(frame.yaw)>=0?1:-1;
  const center=Math.max(305,Math.min(1135,origin.x+facing*175));
  const breakAt=time+CRASH_FALL,end=breakAt+CRASH_CLOUD_LIFE;
  const crash={frame,time,origin,center,ground,facing,breakAt,end};
  const impact=crashPose(crash,1,view,frame.scale);
  const pieces=blackHawkWreckage(impact,view).map((piece,i)=>{
    const n=seed*41+i*8.1,start=breakAt+i%4*.035;
    const y=Math.min(piece.y,ground-9),height=ground-y;
    const vy=-755-280*sample(n),fall=fragmentLandingTime({vy},height);
    const spin=(sample(n+1)<.5?-1:1)*(2.1+4.8*sample(n+2)),angle=0;
    const side=i%2===0?-1:1,spread=145+sample(n+3)*320;
    const landX=Math.max(68,Math.min(1372,piece.x+side*spread));
    return {...piece,y,start,height,fall,landX,vx:(landX-piece.x)/fall,vy,angle,spin};
  });
  return {...crash,pieces};
}

function drawWreckage(ctx,finale,time,project,scale,dark,reduced){
  if(!finale||time<finale.breakAt||time>=finale.end)return;
  const floor=project(0,finale.ground).y;
  for(const piece of finale.pieces){
    const age=time-piece.start,landed=age-piece.fall;
    if(age<0||landed>=WRECKAGE_SETTLE)continue;
    const flight=airHitFragmentAt(piece,age,piece.height);
    const point=flight?project(piece.x+flight.x,piece.y+flight.y):project(piece.landX,finale.ground);
    const angle=flight?.angle??piece.angle+piece.spin*piece.fall,c=Math.cos(angle),s=Math.sin(angle);
    const bottom=Math.max(...piece.points.map(p=>p.x*s+p.y*c))*scale;
    ctx.save();
    if(landed>=0&&!reduced){
      const puff=clamp(landed/.24);
      ctx.globalAlpha=.58*(1-puff)**2;ctx.fillStyle=BLAST_ORANGE;
      ctx.beginPath();ctx.ellipse(point.x,floor-2*scale,(8+25*puff)*scale,(3+4*puff)*scale,0,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1-clamp((landed-.13)/(WRECKAGE_SETTLE-.13));
    ctx.translate(point.x,Math.min(point.y,floor-bottom));ctx.rotate(angle);ctx.scale(scale,scale);
    drawBlackHawkShard(ctx,piece,dark);
    ctx.restore();
  }
}

export class BlackHawkEffects{
  constructor(makeCanvas=()=>document.createElement('canvas')){this.makeCanvas=makeCanvas;this.cloudLayer=null;this.clear();}
  clear(){this.bursts=[];this.serial=0;this.finale=null;this.elbowImpact=null;}
  event(e){
    if(e.type==='blackHawkElbowHit'){
      this.elbowImpact=e;
    }else if(e.type==='blackHawkDetach'||e.type==='blackHawkHit'){
      const detach=e.type==='blackHawkDetach';
      this.bursts.push({x:e.x,y:e.y,time:e.sceneTime,life:detach?.62:.44,
        count:detach?27:19,size:detach?1.19:1,angle:detach?Math.PI/2:Math.atan2(-e.dy,-e.dx),seed:++this.serial});
    }else if(e.type==='blackHawkFinish'){
      e.points.forEach((point,i)=>{
        const {delay,life,size}=STAGE_BLASTS[i];
        this.bursts.push({...point,time:e.sceneTime+delay,life,size,boom:true,seed:++this.serial});
      });
    }else if(e.type==='blackHawkCrash'){
      this.finale=makeCrash(e,++this.serial);
    }
  }
  crashFrame(time,view,scale){
    const f=this.finale;
    return f&&time>=f.time&&time<f.breakAt?crashPose(f,(time-f.time)/CRASH_FALL,view,scale):null;
  }
  victoryDelay(time){return this.finale?Math.max(0,this.finale.end-time):0;}
  crashImpactActive(time){return !!this.finale&&time>=this.finale.breakAt&&time<this.finale.end;}
  crashShakeAt(time,reduced,art){
    const crash=this.finale,age=time-(crash?.breakAt??Infinity),duration=.72;
    if(reduced||age<0||age>=duration)return null;
    const attack=.028,t=Math.max(0,age-attack);
    const strength=Math.max(.58,Math.min(1.15,art))*clamp(age/attack)*(1-age/duration)**1.8;
    return {x:crash.facing*52*strength*Math.sin(51*t+.53),y:78*strength*Math.cos(35*t)};
  }
  shakeAt(time,reduced){
    if(reduced)return {x:0,y:0};
    let x=0,y=0;
    const hitAge=time-(this.elbowImpact?.sceneTime??-Infinity),push=.036,returnTime=.284;
    if(hitAge>=0&&hitAge<push+returnTime){
      const t=(hitAge-push)/returnTime;
      const kick=t<0?1-(1-hitAge/push)**2:Math.cos(Math.PI*1.33*t)*(1-t*t)**2;
      x-=10*kick;
    }
    for(const burst of this.bursts){
      if(!burst.boom)continue;
      const shake=impactShakeAt(time-burst.time,burst.size*22,.29);
      x+=shake.dx;y+=shake.dy;
    }
    return {x:Math.max(-30,Math.min(30,x)),y:Math.max(-40,Math.min(40,y))};
  }
  drawCrashImpact(ctx,time,project,view,art,aircraftScale,reduced,dark){
    const finale=this.finale,age=time-finale.breakAt,point=project(finale.center,finale.ground);
    this.cloudLayer??=this.makeCanvas();
    drawCrashCloud(ctx,this.cloudLayer,age,view,point,reduced);
    sparks(ctx,point,age,.85,art*1.38,reduced?14:38,421,-Math.PI/2);
    drawWreckage(ctx,finale,time,project,aircraftScale,dark,reduced);
  }
  draw(ctx,time,project,scale,frame,reduced){
    this.bursts=this.bursts.filter(b=>time-b.time<=b.life);
    for(const b of this.bursts){
      const p=project(b.x,b.y),age=time-b.time,size=b.size*scale;
      if(b.boom)executionBlast(ctx,p,age,b.life,size,b.seed,reduced);
      else sparks(ctx,p,age,b.life,size,reduced?Math.ceil(b.count/2):b.count,b.seed,b.angle);
    }
    if(this.elbowImpact){
      const hit=this.elbowImpact,age=time-hit.sceneTime;
      if(age>=ELBOW_HIT_DURATION)this.elbowImpact=null;
      else if(age>=0)drawElbowImpact(ctx,project(hit.x,hit.y),age,scale,reduced);
    }
    if(!frame?.staggered||frame.destroyed||reduced)return;
    const projectHull=blackHawkProjector(frame),tick=Math.floor(frame.staggerAge/.10);
    for(let i=Math.max(0,tick-3);i<=tick;i++){
      const point=projectHull(CHASSIS[(i*5)%CHASSIS.length]),age=frame.staggerAge-i*.10;
      sparks(ctx,point,age,.39,scale*.69,5,1000+i);
    }
  }
}
