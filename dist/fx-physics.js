import {createDebris,impactShakeAt} from './effects.js';
const GRAVITY=900,cache=new Map();
export function airHitFragments(seed){
  if(!cache.has(seed))cache.set(seed,createDebris(Math.abs(seed)+13,12).map(p=>({...p,vx:p.vx*.5,vy:p.vy*.48,size:p.size*.32})));
  if(cache.size>128)cache.delete(cache.keys().next().value);
  return cache.get(seed);
}
export function fragmentLandingTime(piece,height){return(-piece.vy+Math.sqrt(piece.vy**2+2*GRAVITY*Math.max(0,height)))/GRAVITY;}
export function airHitFragmentAt(piece,age,height){
  if(age<0||age>=fragmentLandingTime(piece,height))return null;
  return{x:piece.vx*age,y:piece.vy*age+.5*GRAVITY*age*age,angle:piece.angle+piece.spin*age};
}
export function airHitBurst(x,y,seed,time,metrics,ground){
  const groundHeight=Math.max(0,(ground-y)*metrics.sy/metrics.art);
  return{type:'victim',x,y,seed,time,groundHeight,duration:Math.max(...airHitFragments(seed).map(p=>fragmentLandingTime(p,groundHeight)))};
}
export function strongestShake(events,time,reduced=false){
  let chosen={x:0,y:0},strength=0;if(reduced)return chosen;
  for(const e of events){
    if(!['meteorLand','manLand'].includes(e.type))continue;
    const big=e.type==='meteorLand',a=impactShakeAt(time-e.time,big?22:1.8,big?.38:.14);
    if(a.envelope>strength){strength=a.envelope;chosen={x:a.dx,y:a.dy};}
  }
  return chosen;
}
