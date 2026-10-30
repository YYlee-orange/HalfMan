export const FOOD_X=708;
export const groundAnchor=anchor=>!anchor||anchor.type==='ground';
export const foodIdle=(time,enabled=true)=>enabled?Math.sin(time*2.1)*.085:0;
export const shelterIdle=(time,enabled=true)=>enabled?Math.sin(time*1.6)*.065:0;
export function foodLocalPoint(anchor,time=0,enabled=true){
  const breathe=foodIdle(time,enabled);
  return{x:anchor.x*(1+breathe),y:anchor.y*(1-breathe)};
}
export function foodWorldPoint(anchor,ground){return{x:FOOD_X+anchor.x,y:ground+anchor.y};}
export function foodScreenPoint(anchor,v,ground,time=0,enabled=true){
  if(groundAnchor(anchor))return{x:(FOOD_X+anchor.x)*v.sx,y:ground*v.sy};
  const p=foodLocalPoint(anchor,time,enabled);
  return{x:FOOD_X*v.sx+p.x*v.art,y:ground*v.sy+p.y*v.art};
}
// Reserve destinations as well as occupied positions, then favor the largest screen-space gap.
export function chooseSpacedAnchor(make,occupied,toPoint,view){
  const points=occupied.filter(Boolean).map(toPoint);let best=null,bestScore=-Infinity;
  for(let i=0;i<64;i++){
    const candidate=make(i),q=toPoint(candidate);
    if(view&&(q.x<24||q.x>view.width-24))continue;
    let score=Infinity;
    for(const p of points)score=Math.min(score,((q.x-p.x)/60)**2+((q.y-p.y)/34)**2);
    if(!best||score>bestScore){best=candidate;bestScore=score;}
    if(!points.length&&best)break;
  }
  return best??make(64);
}
export function chooseFoodAnchor(random=Math.random,occupied=[],view=null){
  const make=i=>{
    const kind=(random()+i*.61803398875)%1,u=(random()+i*.41421356237)%1,v=(random()+i*.73205080757)%1;
    if(kind<.45)return{facility:'food',type:'ground',x:-142+u*284,y:0};
    if(kind<.85){const angle=u*Math.PI*2;return{facility:'food',type:'rim',x:Math.cos(angle)*72,y:-58+Math.sin(angle)*17};}
    return{facility:'food',type:'bowl',x:-48+u*96,y:-57+v*11};
  };
  return chooseSpacedAnchor(make,occupied,a=>view?foodScreenPoint(a,view,808):foodWorldPoint(a,808),view);
}
