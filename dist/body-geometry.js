import {variantOf,halfHeight} from './variants.js';
import {radarScreenPoint} from './radar.js';
import {foodScreenPoint} from './facilities.js';
import {jumpProgress} from './movement.js';
import {onFarm,farmFoot} from './farm-physics.js';
const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t;
export function personAge(p,sceneTime){return p.cutMotion?p.motionAge:sceneTime-p.born;}
export function viewMetrics(width=1440,height=810){
  const sx=width/1440,sy=height/810;
  return{width,height,sx,sy,art:Math.max(.34,Math.min(sx,sy)),character:Math.max(.70,Math.min(sx,sy))};
}
export function meteorView(m,v){
  const ratio=m.ratio??variantOf(m.variantId).ratio,a=m.tilt||0,size=m.size*v.character;
  return{x:m.x*v.sx,y:m.y*v.sy+m.size*.5*(v.sy-v.character),
    rx:size*(Math.abs(Math.cos(a))*ratio+Math.abs(Math.sin(a)))*.5,
    ry:size*(Math.abs(Math.sin(a))*ratio+Math.abs(Math.cos(a)))*.5};
}
export function radarFootView(anchor,v,ground,pose){
  return radarScreenPoint(anchor,v,ground,pose);
}
export function facilityFootView(anchor,v,ground,sceneTime,pose){return anchor.facility==='food'?foodScreenPoint(anchor,v,ground,sceneTime,!pose.reduced):radarFootView(anchor,v,ground,pose);}
export function personView(p,v,ground,sceneTime,pose={press:0,release:0,scan:0,antenna:0}){
  const half=halfHeight(p),age=personAge(p,sceneTime),birth=1-(1-clamp(age/.27))**3;
  let point={x:p.x*v.sx,y:p.y*v.sy};
  if(onFarm(p)){point=farmFoot(p,v,sceneTime,pose.reduced);point.y-=half*v.character;}
  else if(p.state==='work'&&p.onRadar){point=radarFootView(p.workAnchor,v,ground,pose);point.y-=half*v.character;}
  else if(p.state==='eat'&&p.onFood){point=foodScreenPoint(p.foodAnchor,v,ground,sceneTime,!pose.reduced);point.y-=half*v.character;}
  else if(p.state==='jump'){
    const j=p.jump,t=jumpProgress(j),a=j.fromAnchor?facilityFootView(j.fromAnchor,v,ground,sceneTime,pose):{x:j.fromX*v.sx,y:j.fromY*v.sy};
    const b=j.toAnchor?facilityFootView(j.toAnchor,v,ground,sceneTime,pose):{x:j.toX*v.sx,y:j.toY*v.sy};
    point={x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)-4*j.height*t*(1-t)*v.art-half*v.character};
  }else if(p.landed)point.y=ground*v.sy-half*v.character;
  else point.y+=half*(v.sy-v.character);
  if(!p.cutMotion&&birth<1&&p.birthX!==undefined){
    const center=meteorView({x:p.birthX,y:p.birthY,size:p.birthSize,variantId:p.variantId,tilt:p.birthTilt},v),offset=(p.part?1:-1)*p.birthSize*variantOf(p.variantId).ratio/4*v.character;
    point.x=mix(center.x+Math.cos(p.birthTilt||0)*offset,point.x,birth);
    point.y=mix(center.y+Math.sin(p.birthTilt||0)*offset,point.y,birth);
  }
  const size=mix(p.birthSize??p.size,p.size,birth)*v.character;
  return{...point,rx:size*.58,ry:birth<1||(p.cutMotion&&p.state==='fall')?size*.58:half*v.character*1.4};
}
