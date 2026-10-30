import {createDebris,debrisAt} from './effects.js';
import {airHitFragments,airHitFragmentAt} from './fx-physics.js';
import {CUT} from './cut-settings.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const FIRE=Object.freeze(['#f04416','#ffcd29']);
export const FIRE_BLUE=Object.freeze(['#247bdc','#a8deff']);
export function plumeColors(trail){
  return trail.palette==='blue'?FIRE_BLUE:FIRE;
}
export const MAN_PLUME=Object.freeze({length:.5,opacity:.85});
export const VOLCANO_PLUME=Object.freeze({ascentLength:.5});
export function plumeRadius(trail,time,metrics){
  const age=Math.max(0,time-(trail.born??trail.points[0].time)),t=clamp(age/.27,0,1),birth=1-(1-t)**3;
  const size=trail.kind==='man'?(trail.birthSize??trail.size)+(trail.size-(trail.birthSize??trail.size))*birth:trail.size;
  const ratio=trail.ratio??1,halfWidth=trail.kind==='man'?ratio/4:ratio/2;
  // A circular head encloses the entire glyph rectangle at every rotation.
  return size*metrics.character*Math.hypot(halfWidth,.5)*1.04;
}
function curvedEdge(ctx,points){
  for(let i=0;i<points.length-1;i++){
    const p=points[i],next=points[i+1];ctx.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);
  }
  const last=points.at(-1);ctx.lineTo(last.x,last.y);
}
function ribbon(ctx,points,width,time,seed,paint=true){
  if(points.length<2)return;
  const pts=points.length===2?[points[0],{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},points[1]]:points;
  const a=[],b=[];
  for(let i=0;i<pts.length;i++){
    const p=pts[i],before=pts[Math.max(0,i-1)],after=pts[Math.min(pts.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,l=Math.hypot(dx,dy)||1,t=i/(pts.length-1);
    const wave=1+(.12*Math.sin(t*23-time*21+seed)+.06*Math.sin(t*37+time*17))*Math.sin(t*Math.PI);
    const w=width*Math.pow(t,.57)*wave,shift=Math.sin(t*19-time*17+seed)*width*.14*(1-t);
    a.push({x:p.x-dy/l*(w+shift),y:p.y+dx/l*(w+shift)});
    b.push({x:p.x+dy/l*(w-shift),y:p.y-dx/l*(w-shift)});
  }
  const head=pts.at(-1),previous=pts.at(-2),dx=head.x-previous.x,dy=head.y-previous.y,l=Math.hypot(dx,dy)||1;
  const tx=dx/l,ty=dy/l,nx=-ty,ny=tx,front={x:head.x+tx*width,y:head.y+ty*width},k=.55228475;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);curvedEdge(ctx,a);
  const left=a.at(-1),right=b.at(-1);
  ctx.bezierCurveTo(left.x+tx*width*k,left.y+ty*width*k,front.x+nx*width*k,front.y+ny*width*k,front.x,front.y);
  ctx.bezierCurveTo(front.x-nx*width*k,front.y-ny*width*k,right.x+tx*width*k,right.y+ty*width*k,right.x,right.y);
  curvedEdge(ctx,b.reverse());ctx.closePath();if(paint)ctx.fill();
}
export function plumePath(trail,project,width){
  const points=trail.points.map(p=>project(p.x,p.y));
  if(points.length<2)return points;
  const head=points.at(-1),old=points[0],distance=Math.hypot(head.x-old.x,head.y-old.y),minLength=width*(trail.kind==='meteor'?3.4:trail.kind==='bomblet'?Math.min(2.7,CUT.bombChildTrail*7):2.7);
  if(distance<minLength){
    const dx=head.x-old.x,dy=head.y-old.y,l=distance||1;
    points.unshift({x:head.x-(distance?dx/l:0)*minLength,y:head.y-(distance?dy/l:1)*minLength});
  }
  // Length compression preserves head coverage and shared landing/split fades.
  const length=trail.kind==='man'?MAN_PLUME.length:trail.kind==='meteor'&&trail.volcanic&&trail.ascending?VOLCANO_PLUME.ascentLength:1;
  if(length!==1)return points.map(p=>({x:head.x+(p.x-head.x)*length,y:head.y+(p.y-head.y)*length}));
  return points;
}
export function drawPlume(ctx,trail,time,project,metrics){
  if(time<(trail.visibleAt??-Infinity))return;
  let alpha=(trail.kind==='man'?MAN_PLUME.opacity:1)*(trail.opacity??1);
  if(trail.ended!==null)alpha*=Math.pow(clamp(1-(time-trail.ended)/(trail.reason==='split'?.42:.30),0,1),1.3);
  if(alpha<=0)return;
  const width=plumeRadius(trail,time,metrics)*(trail.kind==='bomblet'?CUT.bombChildTrailWidth:1),points=plumePath(trail,project,width);
  if(points.length<2)return;
  if(metrics.reduced){alpha*=.65;time=0;}
  const colors=plumeColors(trail);
  ctx.save();ribbon(ctx,points,width,time,trail.id,false);ctx.clip();
  ctx.globalAlpha=.50*alpha;ctx.fillStyle=colors[0];ctx.fill();
  // Keep the inner flame inside the shared outer silhouette; detached thin
  // triangles previously produced colored hairlines beside the trail.
  ctx.globalAlpha=.64*alpha;ctx.fillStyle=colors[1];ribbon(ctx,points.slice(Math.floor(points.length*.28)),width*.38,time,trail.id);
  ctx.restore();
}
const debrisCache=new Map();
function shard(ctx,x,y,size,angle,shape){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-size*.7,-size*.3);ctx.lineTo(size*.55,-size*.5);
  if(shape)ctx.lineTo(size*.7,size*.3);ctx.lineTo(-size*.2,size*.5);ctx.closePath();ctx.fill();ctx.restore();
}
export function drawExplosion(ctx,burst,time,project,metrics,ink){
  const age=time-burst.time;if(age<0||age>burst.duration)return;
  const big=burst.type==='meteor',victim=burst.type==='victim',p=project(burst.x,burst.y),s=metrics.art;
  ctx.save();ctx.translate(p.x,p.y);
  if(victim){
    ctx.fillStyle=ink;
    for(const piece of airHitFragments(burst.seed)){
      const q=airHitFragmentAt(piece,age,burst.groundHeight);if(q)shard(ctx,q.x*s,q.y*s,piece.size*s,q.angle,piece.shape);
    }
    ctx.restore();return;
  }
  const flashDuration=big?.44:.28,radius=(big?186:51)*s*(metrics.reduced?.65:1),grow=1-(1-clamp(age/(big?.085:.065),0,1))**4;
  if(age<flashDuration){
    const fade=(1-age/flashDuration)**1.35;
    for(let layer=0;layer<2;layer++){
      const r=radius*grow*(layer?.58:1),points=[];
      ctx.globalAlpha=(layer?.70:.58)*fade;ctx.fillStyle=FIRE[layer];
      for(let i=0;i<=28;i++){
        const a=Math.PI+i/28*Math.PI,lobe=1+.09*Math.sin(a*7+burst.seed)+.05*Math.sin(a*11-burst.seed);
        points.push({x:Math.cos(a)*r*lobe,y:Math.sin(a)*r*(big?.78:.70)*lobe});
      }
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);curvedEdge(ctx,points);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=.34*fade;ctx.fillStyle=FIRE[0];ctx.beginPath();ctx.ellipse(0,-radius*.025,radius*grow*1.15,radius*grow*.10,0,0,Math.PI*2);ctx.fill();
  }
  if(age<(big?.30:.20)){
    const u=age/(big?.30:.20),r=radius*(.2+1.4*(1-(1-u)**3));
    ctx.globalAlpha=.8*(1-u);ctx.strokeStyle=FIRE[1];ctx.lineWidth=(big?6:2.5)*s*(1-u)+.5;
    ctx.beginPath();ctx.ellipse(0,0,r,r*.09,0,Math.PI,Math.PI*2);ctx.stroke();
  }
  const count=metrics.reduced?(big?20:8):(burst.count??(big?84:16)),key=`${burst.type}/${burst.seed}/${count}`;
  if(!debrisCache.has(key))debrisCache.set(key,createDebris(Math.abs(burst.seed)+13,count));
  ctx.fillStyle=ink;
  for(const original of debrisCache.get(key)){
    if(age>original.life)continue;
    const speed=big?1.5:.5,piece={...original,vx:original.vx*speed,vy:original.vy*(big?1.15:.5)},q=debrisAt(piece,age),size=original.size*s*(big?1:.45);
    ctx.globalAlpha=clamp((original.life-age)/.16,0,1);shard(ctx,q.x*s,q.y*s,size,q.angle,original.shape);
  }
  ctx.restore();if(debrisCache.size>128)debrisCache.delete(debrisCache.keys().next().value);
}
export const RADIO=Object.freeze({count:4,duration:1.0,stagger:.13,startRadius:32,maxRadius:235,halfAngle:.58});
export function radioWaves(state,metrics,project){
  const t=state.time-state.launchTime;if(t<0||t>RADIO.duration+(RADIO.count-1)*RADIO.stagger)return [];
  const p=state.antennaPoint({type:'antenna',x:-12,y:-76}),q=state.antennaPoint({type:'antenna',x:-1,y:8});
  const head=project(p.x,p.y),base=project(q.x,q.y),angle=Math.atan2(head.y-base.y,head.x-base.x),waves=[];
  for(let i=0;i<RADIO.count;i++){
    const age=t-i*RADIO.stagger;if(age<0||age>RADIO.duration)continue;
    const radius=(metrics.reduced?RADIO.startRadius+i*36:RADIO.startRadius+(RADIO.maxRadius-RADIO.startRadius)*age/RADIO.duration)*metrics.art;
    waves.push({x:head.x,y:head.y,baseX:base.x,baseY:base.y,radius,angle,start:angle-RADIO.halfAngle,end:angle+RADIO.halfAngle,alpha:.85*(1-age/RADIO.duration)});
  }
  return waves;
}
export function drawRadio(ctx,state,metrics,project){
  ctx.save();ctx.strokeStyle='#da3e3e';ctx.lineWidth=3*Math.max(.6,metrics.art);ctx.lineCap='round';
  for(const w of radioWaves(state,metrics,project)){
    ctx.globalAlpha=w.alpha;ctx.beginPath();ctx.arc(w.x,w.y,w.radius,w.start,w.end);ctx.stroke();
  }
  ctx.restore();
}
