import {blackHawkProjector,blackHawkMounts} from './black-hawk-flight.js';
export {blackHawkMounts} from './black-hawk-flight.js';

const TAU=Math.PI*2;
const CABIN_PROFILE=[[-74,-20,10,14],[-52,-32,23,24],[25,-32,23,27],[66,-27,22,25],[93,-17,17,21],[110,-5,13,13],[116,2,10,7]];
const TAIL_PROFILE=[[-175,-16,-9,3],[-153,-15,-5,5],[-99,-13,3,8],[-62,-20,12,14]];
const CROSS_SECTION=[[-.62,0],[.62,0],[1,.24],[1,.72],[.64,1],[-.64,1],[-1,.72],[-1,.24]];
const SIDE_COLORS=[0,0,0,1,1,1,0,0];
const THEMES={light:['#525e64','#242d32'],dark:['#79868c','#424e55']};

const face=(points,tone=0,decals=[],alpha=1)=>({points,tone,decals,alpha});
const mixPoint=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t);
function panel(points,corners){
  const [a,b,c,d]=points;
  return corners.map(([u,v])=>mixPoint(mixPoint(a,b,u),mixPoint(d,c,u),v));
}
function windows(segment,side,points){
  if(side===2||side===6){
    const patch=corners=>panel(points,corners.map(([u,v])=>[u,side===6?1-v:v]));
    if(segment===1)return[
      patch([[.17,.13],[.40,.13],[.40,.67],[.17,.67]]),
      patch([[.49,.13],[.84,.13],[.84,.67],[.49,.67]]),
    ];
    if(segment===2)return[patch([[.42,.10],[.94,.15],[.94,.72],[.48,.65]])];
    if(segment===3)return[patch([[.03,.15],[.83,.10],[.97,.67],[.04,.76]])];
  }
  if(side===0&&segment===3)return[
    panel(points,[[.24,.10],[.94,.12],[.92,.45],[.25,.45]]),
    panel(points,[[.25,.55],[.92,.55],[.94,.88],[.24,.90]]),
  ];
  return [];
}
function signalLamps(segment,side,points){
  if(side!==2&&side!==6)return [];
  const strip=(u,v,width,height)=>panel(points,[[u,v],[u+width,v],[u+width,v+height],[u,v+height]]
    .map(([a,b])=>[a,side===6?1-b:b]));
  if(segment===1)return [strip(.20,.80,.075,.12),strip(.76,.80,.075,.12)];
  if(segment===3||segment===4)return [strip(.74,.75,.13,.15)];
  return [];
}
function hull(stations,decorate=()=>[],lights=()=>[]){
  const rings=stations.map(([x,top,bottom,width])=>CROSS_SECTION.map(([z,y])=>[x,top+(bottom-top)*y,z*width]));
  const surfaces=[face(rings[0],1),face(rings.at(-1))];
  for(let i=0;i<rings.length-1;i++){
    const a=rings[i],b=rings[i+1];
    for(let side=0;side<CROSS_SECTION.length;side++){
      const next=(side+1)%CROSS_SECTION.length,points=[a[side],b[side],b[next],a[next]];
      surfaces.push({...face(points,SIDE_COLORS[side],decorate(i,side,points)),lamps:lights(i,side,points)});
    }
  }
  return surfaces;
}
function slab(profile,halfDepth){
  const near=profile.map(([x,y])=>[x,y,halfDepth]),far=profile.map(([x,y])=>[x,y,-halfDepth]);
  return [face(near),face(far),...near.map((point,i)=>{
    const j=(i+1)%near.length;
    return face([point,near[j],far[j],far[i]],1);
  })];
}
function wheel(x,y,z,r,width){
  const ring=offset=>Array.from({length:12},(_,i)=>{
    const a=i*TAU/12;return[x+r*Math.cos(a),y+r*Math.sin(a),z+offset];
  });
  const near=ring(width/2),far=ring(-width/2);
  return [face(near,1),face(far,1),...near.map((point,i)=>{
    const j=(i+1)%near.length;return face([point,near[j],far[j],far[i]],1);
  })];
}
const BODY=[
  ...hull(TAIL_PROFILE),
  ...slab([[-178,-13],[-177,-47],[-160,-54],[-151,-20],[-144,-11]],5),
  face([[-160,-14,-25],[-131,-14,-26],[-124,-14,26],[-158,-14,25]]),
  ...hull(CABIN_PROFILE,windows,signalLamps),
  ...hull([[-49,-27,-19,15],[-32,-43,-24,20],[14,-45,-26,19],[34,-38,-24,13]]),
  ...hull([[-7,-56,-41,4],[4,-56,-41,4]]),
  face([[48,18,-20],[55,38,-30],[62,38,-30],[55,18,-20]],1),
  face([[48,18,20],[55,38,30],[62,38,30],[55,18,20]],1),
  face([[-148,-7,0],[-142,22,0],[-137,21,0],[-142,-6,0]],1),
  ...wheel(58,37,-30,8,9),...wheel(58,37,30,8,9),...wheel(-140,20,0,5.7,6),
];
// Pieces retain the cabin, tail and rotor silhouettes through the breakup.
const WRECKAGE=[
  [0,[[60,-28,18],[95,-17,12],[115,1,4],[104,12,10],[73,9,24],[82,-2,24],[65,-11,24]]],
  [1,[[14,-29,22],[60,-27,23],[66,-10,24],[48,-4,26],[52,15,23],[9,17,25],[18,-3,27]]],
  [0,[[-65,-18,15],[-44,-30,23],[-8,-29,27],[3,-12,25],[-14,-3,24],[-5,16,18],[-46,17,19],[-59,6,18]]],
  [1,[[-144,-15,6],[-98,-13,8],[-70,-19,13],[-60,-2,11],[-86,6,9],[-104,-4,7],[-144,-5,6]]],
  [0,[[-177,-47,1],[-160,-54,5],[-151,-20,4],[-141,-10,8],[-170,-10,5]]],
  [0,[[-33,-41,17],[13,-45,18],[34,-37,14],[21,-24,17],[-17,-25,19]]],
  [1,[[-8,-58,-2],[61,-58,-18],[97,-55,-25],[69,-53,-17],[-10,-53,1]]],
  [1,[[-21,-55,7],[-60,-58,19],[-129,-55,33],[-95,-51,24],[-43,-52,11]]],
  [1,[[39,17,23],[50,15,29],[66,34,32],[69,43,27],[53,44,31],[48,36,25]]],
  [0,[[-36,1,-23],[-17,4,-19],[-12,17,-10],[-30,22,-18],[-42,14,-25]]],
  [0,[[10,-28,-14],[38,-32,-21],[48,-21,-18],[36,-14,-26],[14,-19,-22]]],
  [1,[[-143,-9,2],[-134,2,3],[-131,22,6],[-144,28,5],[-149,17,2]]],
];

export function blackHawkWreckage(frame,view){
  const project=blackHawkProjector(frame);
  return WRECKAGE.map(([tone,mesh])=>{
    const points=mesh.map(project);
    const x=points.reduce((sum,p)=>sum+p.x,0)/points.length,y=points.reduce((sum,p)=>sum+p.y,0)/points.length;
    return {x:x/view.sx,y:y/view.sy,tone,points:points.map(p=>({x:(p.x-x)/frame.scale,y:(p.y-y)/frame.scale}))};
  });
}
export function blackHawkHullBottom(frame){
  const project=blackHawkProjector(frame);
  return Math.max(...BODY.flatMap(face=>face.points.map(p=>project(p).y-frame.y)));
}
function rotor(center,radius,phase,tail=false){
  const point=(x,y)=>tail?[center[0]+x,center[1]+y,center[2]]:[center[0]+x,center[1],center[2]+y];
  const disk=Array.from({length:36},(_,i)=>{
    const angle=i*TAU/36;return point(radius*Math.cos(angle),radius*Math.sin(angle));
  });
  const surfaces=[face(disk,0,[],tail?.17:.19)];
  for(let i=0;i<4;i++){
    const angle=phase+i*TAU/4,c=Math.cos(angle),s=Math.sin(angle);
    const blade=[[radius*.075,-radius*.026],[radius*.96,-radius*.032],[radius,radius*.006],[radius*.105,radius*.021]];
    surfaces.push(face(blade.map(([x,y])=>point(x*c-y*s,x*s+y*c)),1,[],tail?.78:.82));
  }
  return surfaces;
}
function fillPolygon(ctx,points,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.closePath();ctx.fill();
}
export function drawBlackHawkShard(ctx,piece,dark){
  const colors=THEMES[dark?'dark':'light'],[a,b,c]=piece.points;
  fillPolygon(ctx,piece.points,colors[piece.tone]);
  fillPolygon(ctx,[a,b,{x:(a.x+c.x)*.5,y:(a.y+c.y)*.5}],colors[1-piece.tone]);
}
export function drawBlackHawk(ctx,frame,dark=false,opacity=1){
  const colors=THEMES[dark?'dark':'light'],project=blackHawkProjector(frame);
  const surfaces=[...BODY,...rotor([-1,-56,0],159,frame.rotorPhase),...rotor([-165,-32,6],22,frame.tailPhase,true)];
  const projected=surfaces.map(surface=>{
    const points=surface.points.map(project);
    return{surface,points,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length};
  }).sort((a,b)=>a.depth-b.depth);
  const phase=(frame.time??0)%4.7;
  const casting=frame.skillAge!=null;
  const lampAlpha=frame.reduced?1:frame.staggered?.28+.72*(.5+.5*Math.cos(frame.staggerAge*15))**2
    :casting?.20+.8*(.5+.5*Math.cos(frame.skillAge*18))**2
    :phase>4.48?.40+.6*Math.abs(Math.cos((phase-4.48)*31)):1;
  const signal=frame.staggered?'#ff4c58':casting?'#ffcf45':dark?'#75efa1':'#68e08c';
  ctx.save();
  for(const {surface,points} of projected){
    ctx.globalAlpha=surface.alpha*opacity;
    fillPolygon(ctx,points,colors[surface.tone]);
    for(const decal of surface.decals)fillPolygon(ctx,decal.map(project),colors[1]);
    if(opacity===1&&!frame.crashing)for(const lamp of surface.lamps??[]){
      const corners=lamp.map(project),a=corners[0],b=corners[2];
      ctx.globalAlpha=lampAlpha*.24;ctx.fillStyle=signal;ctx.beginPath();
      ctx.arc((a.x+b.x)/2,(a.y+b.y)/2,Math.max(1.9,Math.hypot(a.x-b.x,a.y-b.y)*.82),0,TAU);ctx.fill();
      ctx.globalAlpha=lampAlpha;fillPolygon(ctx,corners,signal);
    }
  }
  if(opacity===1){
    ctx.globalAlpha=1;ctx.lineCap='round';
    for(const b of blackHawkMounts(frame)){
      if(frame.detached?.[b.index])continue;
      const a=b.root;
      ctx.strokeStyle=dark?'#ad3b49':'#982939';ctx.lineWidth=Math.max(1.4,4.1*b.scale);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.strokeStyle=dark?'#ff7481':'#e74453';ctx.lineWidth=Math.max(1.5,3.5*b.scale);
      ctx.beginPath();ctx.arc(b.x,b.y,Math.max(3.3,6.8*b.scale),0,TAU);ctx.stroke();
    }
  }
  ctx.restore();
}
