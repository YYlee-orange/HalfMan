import {CUT} from './cut-settings.js';
export {CUT} from './cut-settings.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function swipeStrength(speed,diameter){
  return clamp(((Number.isFinite(speed)?Math.max(0,speed):diameter*5)/Math.max(1,diameter)-.8)/Math.max(.2,CUT.speedFull-.8),0,1);
}
export function cutKinematics(m,a,b,gesture={},random=Math.random){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,dir={x:dx/length,y:dy/length},normal={x:-dir.y,y:dir.x};
  const scaleX=gesture.scaleX??1,scaleY=gesture.scaleY??1,diameter=m.size*(gesture.visualScale??1);
  const strength=swipeStrength(gesture.speed,diameter),drag=diameter*(CUT.alongBase+CUT.alongExtra*strength);
  const leftSign=normal.x*-Math.cos(m.tilt||0)+normal.y*-Math.sin(m.tilt||0)>=0?1:-1;
  const impulses=[0,1].map(part=>{
    const sign=part? -leftSign:leftSign,separation=diameter*(CUT.normalBase+CUT.normalExtra*strength)*(1-CUT.variation+random()*CUT.variation*2);
    return{vx:m.vx*CUT.inherit+(normal.x*sign*separation+dir.x*drag)/scaleX,
      vy:m.vy*CUT.inherit+(normal.y*sign*separation+dir.y*drag)/scaleY,
      angularVelocity:(part?1:-1)*(CUT.spinBase+CUT.spinExtra*strength)*Math.PI/180*(1-CUT.variation*.8+random()*CUT.variation*1.6)*(part?1.04:.96),
      separation,sign};
  });
  return{dir,normal,strength,diameter,scaleX,scaleY,impulses,particleCount:Math.round(CUT.particleBase+strength*CUT.particleExtra),bladeLife:CUT.bladeLife+CUT.bladeExtra*strength};
}
function settleSpin(p,dt){
  const k=CUT.spinRecovery,a=p.spinAngle||0,w=p.angularVelocity||0,c=(w+k*a)*dt,decay=Math.exp(-k*dt);
  p.spinAngle=(a+c)*decay;p.angularVelocity=(w-k*c)*decay;
}
export function advanceCutPose(p,dt){
  if(dt<=0)return;settleSpin(p,dt);p.motionAge+=dt;
}
export function fragmentAngle(p,target,age){
  const t=clamp((age-(p.cutMotion?CUT.burst:0))/CUT.formation,0,1),formation=1-(1-t)**3;
  return(p.birthTilt||0)+(target-(p.birthTilt||0))*formation+(p.spinAngle||0);
}
export function advanceCutFragment(p,dt){
  if(dt<=0)return;
  const age=p.motionAge;
  if(age<CUT.burst&&age+dt>CUT.burst+1e-10){const first=CUT.burst-age;advanceCutFragment(p,first);advanceCutFragment(p,dt-first);return;}
  if(age<CUT.burst-1e-10){p.x+=p.vx*dt;p.spinAngle+=(p.angularVelocity||0)*dt;}
  else{const decay=Math.exp(-CUT.drag*dt);p.x+=CUT.drag>1e-8?p.vx*(1-decay)/CUT.drag:p.vx*dt;p.vx*=decay;settleSpin(p,dt);}
  p.y+=p.vy*dt+.5*CUT.gravity*dt*dt;p.vy+=CUT.gravity*dt;p.motionAge+=dt;
}
export function cutCameraOffset(cue,time,scale=1,reduced=false){
  if(!cue||reduced)return{x:0,y:0};
  const age=time-cue.time;if(age<0||age>=CUT.cameraDuration)return{x:0,y:0};
  const attackTime=Math.min(.008,CUT.cameraDuration*.1),attack=clamp(age/attackTime,0,1),decay=(1-age/CUT.cameraDuration)**2;
  const amount=(CUT.cameraBase+CUT.cameraExtra*cue.strength)*scale*attack*decay/(1-attackTime/CUT.cameraDuration)**2;
  return{x:cue.dir.x*amount,y:cue.dir.y*amount};
}
