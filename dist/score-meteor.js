import {SCORE_METEOR} from './score-meteor-rules.js';
import {meteorView} from './body-geometry.js';
import {CUT} from './cut-settings.js';
import {shardExtent} from './score-shard.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
export function scoreFocusFrame(cue,time,reduced=false){
  const exit=cue?.endedAt==null?0:clamp((time-cue.endedAt)/.48,0,1),strength=cue?ease((time-cue.startedAt)/.2)*(1-ease(exit)):0;
  const zoom=cue?scoreZoomAt(cue,Math.min(time,cue.endedAt??time)):1;
  return{strength,zoom:reduced?1:1+(zoom-1)*(1-exit)**3,blur:(reduced?Math.min(2,CUT.frenzyBlur):CUT.frenzyBlur)*strength,cue};
}
export function scoreZoomAt(state,time){const t=clamp((time-state.lastCutAt)/.14,0,1);return Math.min(CUT.frenzyZoom,(state.zoomFrom??1)+((state.zoomTarget??1)-(state.zoomFrom??1))*(1-(1-t)**3));}
export function scoreFocusCue(m){return{id:m.id,x:m.x,y:m.y,size:m.size,bodyScale:m.bodyScale,startedAt:m.frenzy.startedAt,lastCutAt:m.frenzy.lastCutAt,zoomFrom:m.frenzy.zoomFrom,zoomTarget:m.frenzy.zoomTarget,cuts:m.frenzy.cuts,endedAt:null};}
export function advanceScoreSpin(m,dt){const f=m.frenzy;if(!f)return;const decay=Math.exp(-3.5*dt);f.rotation+=(f.angularVelocity??0)*(1-decay)/3.5;f.angularVelocity*=decay;}
export function scoreCutLimit(random=Math.random){return SCORE_METEOR.cutLimitMin+Math.min(SCORE_METEOR.cutLimitMax-SCORE_METEOR.cutLimitMin,Math.floor(random()*(SCORE_METEOR.cutLimitMax-SCORE_METEOR.cutLimitMin+1)));}
export function scoreChargeAt(m,time){
  const startedAt=m.frenzy?.chargeStartedAt;
  const progress=startedAt==null?0:clamp((time-startedAt)/SCORE_METEOR.chargeDuration,0,1);
  const expand=clamp(progress/.42,0,1),contract=clamp((progress-.42)/.58,0,1);
  return{progress,expand,contract,radius:(1-(1-expand)**3)*(1-contract)**1.2,opacity:progress===0?0:.26+.68*contract};
}

export function strikeScoreMeteor(m,time,direction,offset={x:0,y:0}){
  const state=m.frenzy;
  if(state&&(state.chargeStartedAt!=null||time>=state.deadline-1e-9||state.cuts>=state.cutLimit||time-state.lastCutAt<SCORE_METEOR.minimumCutGap))return false;
  const zoomFrom=state?scoreZoomAt(state,time):1;
  if(!state)m.frenzy={startedAt:time,deadline:time+SCORE_METEOR.idleTimeout,cutLimit:m.cutLimit??44,cuts:0,lastCutAt:-Infinity,rotation:0,angularVelocity:0};
  const f=m.frenzy,lever=offset.x*direction.y-offset.y*direction.x,torque=Math.abs(lever)>.035?lever*22:direction.x*4.8-direction.y*2.4;
  f.cuts++;
  f.zoomFrom=zoomFrom;
  f.zoomTarget=1+(CUT.frenzyZoom-1)*f.cuts/f.cutLimit;
  f.angularVelocity=clamp(f.angularVelocity*.45+torque,-12,12);
  f.lastCutAt=time;f.deadline=time+SCORE_METEOR.idleTimeout;f.direction={...direction};f.cutOffset={...offset};return true;
}

export function makeScoreFragments(m,view,nextId,random=Math.random){
  const count=SCORE_METEOR.fragmentMin+Math.min(SCORE_METEOR.fragmentMax-SCORE_METEOR.fragmentMin,Math.floor(random()*(SCORE_METEOR.fragmentMax-SCORE_METEOR.fragmentMin+1)));
  const p=meteorView(m,view),unit=view.art;
  return Array.from({length:count},(_,i)=>{
    const angle=-Math.PI+(i+.2+random()*.6)/count*Math.PI*2,speed=(190+random()*250)*unit;
    return{id:nextId(),kind:'scoreFragment',x:(p.x+Math.cos(angle)*m.size*view.character*.18)/view.sx,y:(p.y+Math.sin(angle)*m.size*view.character*.18)/view.sy,
      vx:Math.cos(angle)*speed/view.sx,vy:(Math.sin(angle)*speed-100*unit)/view.sy,gravity:460*unit/view.sy,
      size:m.size*(.16+random()*.11),ratio:1.1,angle:random()*Math.PI*2,spin:(random()-.5)*5,tone:0,shape:i%6,gemSeed:m.id,facetIndex:i%7};
  });
}
export function scoreFragmentView(f,view){const shape=shardExtent(f);return{x:f.x*view.sx,y:f.y*view.sy,rx:f.size*view.character*shape.rx,ry:f.size*view.character*shape.ry};}
export function advanceScoreFragment(f,dt,view,ground){
  if(f.landed)return false;
  f.x+=f.vx*dt;f.y+=f.vy*dt+.5*f.gravity*dt*dt;f.vy+=f.gravity*dt;f.angle+=f.spin*dt;
  const bounds=scoreFragmentView(f,view),radius=bounds.rx/view.sx,left=radius+8/view.sx,right=1440-left;
  if(f.x<left||f.x>right){f.x=clamp(f.x,left,right);f.vx*=-.65;}
  const floor=ground-bounds.ry/view.sy;
  if(f.y>=floor){f.y=floor;f.landed=true;return true;}return false;
}
