const fract=n=>n-Math.floor(n),clamp=n=>Math.max(0,Math.min(1,n));
export function cutLineAt(event,size){
  const d=event.direction,n={x:-d.y,y:d.x},offset=event.cutOffset??{x:0,y:0},perp=offset.x*n.x+offset.y*n.y;
  const half=Math.sqrt(Math.max(.02,.34-perp*perp))*size;
  return{x:offset.x*size,y:offset.y*size,dx:d.x,dy:d.y,nx:n.x,ny:n.y,half};
}
export function cutSparksAt(event,age,size,unit=1){
  const line=cutLineAt(event,size),seed=event.id*.713+event.cuts*.381;
  return Array.from({length:10},(_,i)=>{
    const u=fract(seed+i*.618),v=fract(seed*.43+i*.379),delay=v*.045,life=.10+u*.15,t=age-delay;
    if(t<0||t>=life)return null;
    const along=(u-.5)*line.half*1.7,perp=(v-.5)*size*.055+(i%2?1:-1)*t*(28+u*80)*unit;
    return{x:line.x+line.dx*along+line.nx*perp,y:line.y+line.dy*along+line.ny*perp,radius:(3.5+v*4)*unit,rotation:(v-.5)*.6,opacity:(1-t/life)**1.5};
  }).filter(Boolean);
}
export function cutScoreOffset(event){
  const angle=event.cuts*2.399+event.id*.37,radius=.64+fract(event.cuts*.731)*.4;
  let x=Math.cos(angle)*radius,y=Math.sin(angle)*radius*.8;
  if(x>.3&&Math.abs(y)<.4)x=-x;
  return{x,y,rotation:(fract(event.cuts*.618+event.id*.13)-.5)*.48,scale:.74+fract(event.cuts*.377)*.78};
}
export const cutNumberOpacity=age=>clamp(age/.025)*clamp((.68-age)/.18);
