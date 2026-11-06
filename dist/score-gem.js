const TAU=Math.PI*2;
export const GEM_OUTLINE=Object.freeze(Array.from({length:10},(_,i)=>{
  const angle=-Math.PI*.52+i*TAU/10+[0,.018,-.025,.022,-.015,.01,-.018,.02,-.01,.012][i],r=[.51,.49,.505,.475,.51,.49,.515,.48,.5,.485][i];
  return Object.freeze([Math.cos(angle)*r,Math.sin(angle)*r]);
}));
function clip(poly,nx,ny,limit){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny-limit,db=b[0]*nx+b[1]*ny-limit;
    if(da<=1e-9)out.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}
// Equal-distance corner bevels make every convex cell's new angles obtuse.
function bevel(poly){
  return poly.flatMap((p,i)=>{const a=poly[(i+poly.length-1)%poly.length],b=poly[(i+1)%poly.length],la=Math.hypot(a[0]-p[0],a[1]-p[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]),d=Math.min(la,lb)*.18;
    return[[p[0]+(a[0]-p[0])*d/la,p[1]+(a[1]-p[1])*d/la],[p[0]+(b[0]-p[0])*d/lb,p[1]+(b[1]-p[1])*d/lb]];
  });
}
const sites=[[-.04,-.015],[-.24,-.27],[.19,-.29],[.31,.02],[.14,.29],[-.19,.29],[-.31,.015]];
export const GEM_FACETS=Object.freeze(sites.map((p,i)=>{
  let poly=GEM_OUTLINE.map(v=>[...v]);
  for(let j=0;j<sites.length;j++)if(i!==j){const q=sites[j];poly=clip(poly,q[0]-p[0],q[1]-p[1],(q[0]**2+q[1]**2-p[0]**2-p[1]**2)/2);}
  return Object.freeze(bevel(poly).map(v=>Object.freeze(v)));
}));
const hues=[182,285,217,324,165,255,43];
export function gemColorAt(index,time,id=0,shift=0){
  const phase=time*.48+index*1.73+id*.19,hue=(hues[index%hues.length]+Math.sin(phase)*28+shift+360)%360;
  return `hsl(${hue.toFixed(2)} 64% ${(65+Math.sin(phase*.7+index)*10).toFixed(2)}%)`;
}
function polygon(ctx,poly,size){ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));ctx.closePath();}
export function drawScoreGem(ctx,size,time,id=0){
  const base=ctx.createLinearGradient(-size*.5,-size*.45,size*.5,size*.5);base.addColorStop(0,gemColorAt(0,time,id));base.addColorStop(.45,gemColorAt(1,time,id));base.addColorStop(1,gemColorAt(2,time,id));
  ctx.fillStyle=base;polygon(ctx,GEM_OUTLINE,size);ctx.fill();ctx.save();ctx.clip();
  GEM_FACETS.forEach((poly,i)=>{
    const angle=i*2.399+Math.sin(time*.24+i)*.28,dx=Math.cos(angle)*size*.38,dy=Math.sin(angle)*size*.38,g=ctx.createLinearGradient(-dx,-dy,dx,dy);
    g.addColorStop(0,gemColorAt(i,time,id,-17));g.addColorStop(.44,gemColorAt(i+2,time,id,12));g.addColorStop(1,gemColorAt(i+4,time,id,21));
    ctx.fillStyle=g;polygon(ctx,poly,size);ctx.fill();
  });
  ctx.restore();
}
