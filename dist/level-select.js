import {drawPlume} from './fire.js';
import {AVAILABLE_LEVEL_COUNT} from './level-rules.js';
// Increase the available count for each new chapter; one broken future node follows.
export const createLevelList=count=>Object.freeze(Array.from({length:count+1},(_,i)=>Object.freeze({id:`man-${i+1}`,label:`曼-${i+1}`,unlocked:i<count})));
export const LEVELS=createLevelList(AVAILABLE_LEVEL_COUNT);
export const LEVEL_MOTION=Object.freeze({idleSpin:.105,selectedSpin:1.1,spinFollow:6,flameGrow:.65,flameFade:.24,jellyLife:.7,driftX:28,driftY:-18});
const rockStyles=[
  {size:.94,pattern:'grooves',seed:.4,light:['#a6afa5','#69786b'],dark:['#bdc7bd','#7f9082']},
  {size:1.04,pattern:'pits',seed:1.7,light:['#a2afb3','#6d7d86'],dark:['#b9c7cd','#81939e']},
  {size:.98,pattern:'bands',seed:2.9,light:['#b8ad91','#7d745c'],dark:['#cfc4a7','#998c6e']},
  {size:1.01,pattern:'pits',seed:4.2,light:['#aaa7a4','#6a6564'],dark:['#c4bcb7','#867c78']},
  {size:1.05,pattern:'bands',seed:5.6,light:['#aaa0b5','#6b5d7b'],dark:['#c8b8d5','#8c779e']},
];
export const LEVEL_ART=Object.freeze(Object.fromEntries(LEVELS.map((n,i)=>[n.id,n.unlocked?rockStyles[i%rockStyles.length]:{size:1,light:['#d7dcd6','#bdc7bf'],dark:['#4d5850','#39463d']}])));
export const LOCKED_FRAGMENTS=Object.freeze([
  {x:-.65,y:-.48,angle:-.22,points:[[-.34,-.20],[.19,-.28],[.36,.06],[-.08,.36],[-.37,.10]]},
  {x:.11,y:-.78,angle:.34,points:[[-.13,-.32],[.11,-.28],[.16,.20],[-.12,.33],[-.23,.02]]},
  {x:.84,y:-.34,angle:-.18,points:[[-.15,-.12],[.25,.02],[-.10,.21]]},
  {x:-.20,y:.10,angle:.15,points:[[-.29,-.14],[.13,-.27],[.28,-.04],[.02,.27],[-.22,.22]]},
  {x:.72,y:.41,angle:-.47,points:[[-.32,-.12],[.26,-.17],[.35,.07],[-.21,.16]]},
  {x:-.70,y:.67,angle:.28,points:[[-.29,-.08],[-.05,-.32],[.27,-.06],[.16,.30],[-.25,.24]]},
  {x:.08,y:.83,angle:.62,points:[[-.10,-.10],[.15,-.04],[.04,.12]]},
]);
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const routeDots={minRadius:5,maxRadius:9.4,spacing:[82,62,96,70],color:'#b9c0bb',breath:.035};
const seeded=i=>{const n=Math.sin((i+1)*12.9898)*43758.5453;return n-Math.floor(n);};
const gapWeight=i=>{const n=Math.sin((i+1)*12.9898)*43758.5453;return .82+(n-Math.floor(n))*.48;};
export function levelMapLayout(width,height){
  const radius=Math.max(39,Math.min(76,height*.19)),edge=Math.max(110,radius*1.05+36);
  const gap=Math.max(280,width*.29),weights=LEVELS.slice(1).map((_,i)=>gapWeight(i)),total=weights.reduce((a,b)=>a+b,0);
  const trackWidth=edge*2+gap*total;
  let offset=0;
  const nodes=LEVELS.map((level,i)=>{
    if(i)offset+=weights[i-1];
    const r=radius*LEVEL_ART[level.id].size,top=r+12,bottom=Math.max(top,height-r-74);
    const y=top+(bottom-top)*[.58,.05,.94,.28,.78,.12][i%6];
    return{...level,x:edge+gap*offset,y,labelY:y+r+18,radius:r};
  });
  const slopes=nodes.slice(1).map((n,i)=>(n.y-nodes[i].y)/(n.x-nodes[i].x));
  return{width:trackWidth,height,radius,nodes:nodes.map((node,i)=>{
    const incoming=slopes[i-1],outgoing=slopes[i];
    // A shared tangent at each centre joins both neighbouring curves smoothly.
    const slope=i===0?outgoing:i===nodes.length-1?incoming:incoming*outgoing<=0?0:Math.sign(incoming)*Math.min(Math.abs(incoming),Math.abs(outgoing));
    return{...node,slope};
  })};
}
export function levelJelly(age,reduced=false){
  const n=reduced||age<0||age>LEVEL_MOTION.jellyLife?0:.52*Math.exp(-5.5*age)*Math.sin(19*age);
  return{sx:1+n,sy:1/(1+n)};
}
export class LevelSelectScene{
  constructor(){this.reset();}
  reset(){this.time=0;this.selected=null;this.paused=false;this.nodes=LEVELS.map(level=>({...level,angle:0,speed:LEVEL_MOTION.idleSpin,flame:0,pickedAt:-10}));}
  select(id){const node=this.nodes.find(n=>n.id===id);if(!node?.unlocked||this.paused)return false;this.selected=id;node.pickedAt=this.time;return true;}
  step(dt,reduced=false){
    if(this.paused||!Number.isFinite(dt)||dt<=0)return;
    this.time+=dt;
    for(const node of this.nodes){
      const selected=node.id===this.selected,target=selected?LEVEL_MOTION.selectedSpin:LEVEL_MOTION.idleSpin,k=LEVEL_MOTION.spinFollow;
      if(!reduced){node.angle+=target*dt+(node.speed-target)*(1-Math.exp(-k*dt))/k;node.speed=target+(node.speed-target)*Math.exp(-k*dt);}
      node.flame=selected?Math.min(1,node.flame+dt/LEVEL_MOTION.flameGrow):Math.max(0,node.flame-dt/LEVEL_MOTION.flameFade);
    }
  }
  snapshot(width,height,reduced=false){
    const layout=levelMapLayout(width,height);
    const nodes=layout.nodes.map((n,i)=>{const state=this.nodes[i],selected=n.id===this.selected;
      return{...n,...levelJelly(this.time-state.pickedAt,reduced),selected,angle:reduced?0:state.angle,
        y:n.y+(reduced?0:4*Math.sin(this.time*(.90+i*.13)+i*1.8)),
        flame:reduced?Number(selected):smooth(state.flame),
        fragments:Array.from({length:7},(_,j)=>({dy:reduced?0:(2.2+j*.24)*Math.sin(this.time*(.82+j*.11)+j*1.7),phase:j*1.7}))};
    });
    return{...layout,anchors:layout.nodes,time:this.time,paused:this.paused,selected:this.selected,nodes,
      drift:reduced?{x:0,y:0}:{x:this.time*LEVEL_MOTION.driftX,y:this.time*LEVEL_MOTION.driftY},
      links:nodes.slice(1).flatMap((n,i)=>n.unlocked&&nodes[i].unlocked?[{from:nodes[i].id,to:n.id}]:[])};
  }
}
function rockPath(ctx,radius,seed){
  ctx.beginPath();
  for(let i=0;i<=32;i++){
    const a=i/32*Math.PI*2,r=radius*(1+.024*Math.sin(a*5+seed)+.019*Math.cos(a*9+seed));
    const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath();
}
function paintRock(ctx,radius,colors,art){
  rockPath(ctx,radius,art.seed);ctx.fillStyle=colors[0];ctx.fill();ctx.save();ctx.clip();
  ctx.fillStyle=colors[1];ctx.beginPath();ctx.ellipse(radius*.80,radius*.25,radius*.55,radius*1.1,-.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=colors[1];ctx.lineWidth=Math.max(3,radius*.072);ctx.lineCap='round';
  if(art.pattern==='grooves')for(const [x,y,l]of [[-.40,-.05,.38],[-.02,.18,.56],[.31,-.24,.26]]){
    ctx.beginPath();ctx.moveTo(radius*x,radius*(y-l*.5));ctx.lineTo(radius*(x-.16),radius*(y+l*.5));ctx.stroke();
  }else if(art.pattern==='bands'){
    for(const y of [-.38,-.02,.34]){ctx.beginPath();ctx.moveTo(-radius*.58,radius*y);ctx.bezierCurveTo(-radius*.22,radius*(y-.16),radius*.15,radius*(y+.18),radius*.47,radius*(y+.07));ctx.stroke();}
  }else{
    for(const [x,y,rx,ry]of [[-.35,-.27,.17,.12],[.17,.23,.13,.19]]){ctx.beginPath();ctx.ellipse(radius*x,radius*y,radius*rx,radius*ry,-.4,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-radius*.40,radius*.27);ctx.quadraticCurveTo(-radius*.17,radius*.15,-radius*.05,radius*.42);ctx.stroke();
  }
  ctx.restore();
}
function paintFragments(ctx,node,colors){
  const r=node.radius;
  for(const [i,piece]of LOCKED_FRAGMENTS.entries()){
    ctx.save();ctx.translate(piece.x*r,piece.y*r+node.fragments[i].dy);ctx.rotate(piece.angle);
    ctx.beginPath();piece.points.forEach(([x,y],j)=>j?ctx.lineTo(x*r,y*r):ctx.moveTo(x*r,y*r));
    ctx.closePath();ctx.fillStyle=colors[0];ctx.fill();ctx.clip();ctx.fillStyle=colors[1];ctx.fillRect(-r,.04*r,r*2,r);ctx.restore();
  }
}
export function levelFlame(node,time,reduced=false){
  const grow=node.flame;if(grow<=0)return null;
  // The first tiny tongue starts on the lower-left rim, then envelops the rear
  // of the stone while its tail grows up-right. No minimum-length pop-in.
  const root=(1-grow)*node.radius*.70,head={x:node.x-root*.707,y:node.y+root*.707};
  const length=node.radius*3.7*grow;
  return{trail:{id:100+LEVELS.findIndex(n=>n.id===node.id),kind:'level',size:node.radius*1.5*grow,ratio:1,born:0,ended:null,opacity:grow,
    points:[{x:head.x+length*.707,y:head.y-length*.707},{x:head.x+length*.30+Math.sin(reduced?0:time*2)*node.radius*.12*grow,y:head.y-length*.40},head]},opacity:grow};
}
export function drawLevelFlames(ctx,frame,{reduced=false,x=0,y=0}={}){
  ctx.save();ctx.translate(x,y);
  for(const node of frame.nodes){const plume=levelFlame(node,frame.time,reduced);if(plume)drawPlume(ctx,plume.trail,frame.time,(x,y)=>({x,y}),{character:1,reduced});}
  ctx.restore();
}
export function levelLinkCurve(a,b){
  const dx=b.x-a.x,secant=(b.y-a.y)/(dx||1),ha=Math.max(dx/3,a.radius+42),hb=Math.max(dx/3,b.radius+42);
  const c1={x:a.x+ha,y:a.y+(a.slope??secant)*ha},c2={x:b.x-hb,y:b.y-(b.slope??secant)*hb};
  // Trim along each centre-to-control ray, preserving a radial endpoint tangent.
  const da=Math.hypot(c1.x-a.x,c1.y-a.y)||1,db=Math.hypot(c2.x-b.x,c2.y-b.y)||1;
  const start={x:a.x+(c1.x-a.x)*(a.radius+24)/da,y:a.y+(c1.y-a.y)*(a.radius+24)/da};
  const end={x:b.x+(c2.x-b.x)*(b.radius+24)/db,y:b.y+(c2.y-b.y)*(b.radius+24)/db};
  return{start,end,c1,c2};
}
export function drawLevelMap(ctx,frame,{dark=false,reduced=false}={}){
  ctx.clearRect(0,0,frame.width,frame.height);
  ctx.save();ctx.fillStyle=routeDots.color;
  for(const [index,link]of frame.links.entries()){
    // Route anchors belong to the map, independently of rock float and jelly.
    const a=frame.anchors.find(n=>n.id===link.from),b=frame.anchors.find(n=>n.id===link.to);
    const {start,end,c1,c2}=levelLinkCurve(a,b);
    const samples=[{...start,length:0}];
    // Equal curve parameters bunch up at the ends. Sample arc length instead.
    for(let i=1;i<=80;i++){
      const t=i/80,u=1-t,x=u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x;
      const y=u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y,previous=samples.at(-1);
      samples.push({x,y,length:previous.length+Math.hypot(x-previous.x,y-previous.y)});
    }
    const spacing=routeDots.spacing[index%routeDots.spacing.length],arcLength=samples.at(-1).length,count=Math.max(2,Math.floor(arcLength/spacing));
    let segment=1;
    for(let i=0;i<count;i++){
      const distance=(i+.5)*arcLength/count;
      while(segment<samples.length-1&&samples[segment].length<distance)segment++;
      const p=samples[segment-1],q=samples[segment],t=(distance-p.length)/(q.length-p.length||1);
      const seed=index*97+i*7,base=routeDots.minRadius+(routeDots.maxRadius-routeDots.minRadius)*seeded(seed+11);
      const period=5.8+seeded(seed+31)*2.6,phase=seeded(seed+59)*Math.PI*2;
      const radius=base*(1+(reduced?0:routeDots.breath*Math.sin(frame.time*Math.PI*2/period+phase)));
      ctx.beginPath();ctx.arc(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t,radius,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
  for(const node of frame.nodes){
    const art=LEVEL_ART[node.id],colors=art[dark?'dark':'light'];
    ctx.save();ctx.translate(node.x,node.y);ctx.scale(node.sx,node.sy);
    if(node.unlocked){ctx.rotate(node.angle);paintRock(ctx,node.radius,colors,art);}else paintFragments(ctx,node,colors);
    ctx.restore();
  }
}
