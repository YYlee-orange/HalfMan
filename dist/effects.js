// Seed each impact independently so fragments can be inspected at a pinned time.
export function createDebris(seed,count=56){
  let state=(seed*2654435761)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return Array.from({length:count},(_,i)=>{
    const size=i<8?8+random()*7:i<25?4+random()*4:1.5+random()*2.5;
    const angle=-Math.PI*.12-random()*Math.PI*.76,speed=140+random()*380;
    return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size,
      angle:random()*Math.PI*2,spin:(random()-.5)*18,shape:i%3,
      life:.72+random()*.65};
  });
}
export function debrisAt(p,t,drift=0){
  const gravity=900,landing=-2*p.vy/gravity;
  if(t<=landing)return{x:(p.vx+drift*.3)*t,y:p.vy*t+.5*gravity*t*t,angle:p.angle+p.spin*t};
  const a=t-landing,v=-Math.abs(p.vy)*.24;
  return{x:(p.vx+drift*.3)*landing+(p.vx*.42+drift*.15)*a,
    y:Math.min(0,v*a+.5*gravity*a*a),angle:p.angle+p.spin*(landing+a*.4)};
}
export function impactShakeAt(age,amplitude,duration=.34){
  if(age<0||age>=duration)return {dx:0,dy:0,envelope:0};
  const envelope=amplitude*(1-age/duration)**1.5;
  return{dx:Math.sin(age*117+.8)*envelope*.7,dy:Math.sin(age*83+1.3)*envelope,envelope};
}
