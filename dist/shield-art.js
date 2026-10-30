export const SHIELD_ART=Object.freeze({active:4,cooldown:15,open:.65,close:.55,thumb:.48,colorShift:.5,readySettle:.45,blue:'#3da9db',deep:'#236b9b'});
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function mixColor(a,b,t){return `rgb(${a.map((n,i)=>Math.round(mix(n,b[i],t))).join(' ')})`;}
// Shared presentation clock; gameplay protection and cooldown live in shield.js.
export function shieldFrame(position,ambient=0,reduced=false){
  const t=Math.max(0,Math.min(19+SHIELD_ART.readySettle,position)),state=t<4?'active':t<19?'cooldown':'ready';
  const opening=smooth(t/SHIELD_ART.open),closing=1-smooth((t-4)/SHIELD_ART.close);
  const shell=reduced?Number(state==='active'):opening*closing;
  const readyMorph=state==='ready'?(reduced?1:smooth((t-19)/SHIELD_ART.readySettle)):0;
  const green=[45,133,72],blue=[35,107,155],red=[181,46,62];
  const toggleColor=state==='ready'?mixColor(red,green,readyMorph):state==='active'?mixColor(green,blue,reduced?1:smooth(t/SHIELD_ART.colorShift)):mixColor(blue,red,reduced?1:smooth((t-4)/SHIELD_ART.colorShift));
  return{position:t,state,remaining:state==='active'?4-t:state==='cooldown'?19-t:0,
    recharge:state==='cooldown'?(t-4)/15:state==='ready'?1:0,shell,opening,shutdown:Math.max(0,t-4),readyMorph,toggleColor,
    growth:reduced?1:Math.max(.02,opening),pulse:reduced?1:.86+.14*Math.sin(ambient*Math.PI*2/1.6),ambient:reduced?0:ambient,reduced};
}
export function drawToggleIcon(ctx,frame){
  ctx.clearRect(0,0,30,30);ctx.save();ctx.strokeStyle=ctx.fillStyle='#f7f8f5';ctx.lineCap=ctx.lineJoin='round';
  if(frame.state==='active'){
    polygon(ctx,Array.from({length:6},(_,i)=>({x:15+13*Math.cos(i*Math.PI/3-Math.PI/2),y:15+13*Math.sin(i*Math.PI/3-Math.PI/2)})));ctx.fill();
  }else if(frame.state==='cooldown'){
    ctx.lineWidth=3.5;ctx.globalAlpha=.2;ctx.beginPath();ctx.arc(15,15,11.5,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    if(frame.recharge>0){ctx.beginPath();ctx.arc(15,15,11.5,-Math.PI/2,-Math.PI/2+Math.PI*2*frame.recharge);ctx.stroke();}
  }else{
    const p=frame.readyMorph,joint=Math.hypot(7,7)/(Math.hypot(7,7)+Math.hypot(14,16));
    ctx.lineWidth=mix(3.5,5.5,p);ctx.beginPath();
    // One continuous stroke opens its closed ring and folds into the check mark.
    for(let i=0;i<=72;i++){
      const u=i/72,a=-Math.PI/2+u*Math.PI*2;
      const tick=u<joint?{x:mix(5,12,u/joint),y:mix(15,22,u/joint)}:{x:mix(12,26,(u-joint)/(1-joint)),y:mix(22,6,(u-joint)/(1-joint))};
      const x=mix(15+11.5*Math.cos(a),tick.x,p),y=mix(15+11.5*Math.sin(a),tick.y,p);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
const hexes=[];
function facetRandom(n){const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);}
function sphereUV(u,v){
  const distance=Math.hypot(u,v),scale=distance>0?Math.sin(Math.min(1,distance)*Math.PI/2)/distance:Math.PI/2;
  return{u:u*scale,v:v*scale};
}
// A regular hex lattice on the angular surface, with a 15% gap between facets.
// Orthographic projection crowds and flattens the rim into a spherical silhouette.
for(let q=-6;q<=6;q++)for(let row=-6;row<=6;row++){
  const u=q*.18,v=(row+q/2)*Math.sqrt(3)*.12;
  if(Math.hypot(u,v)>.99)continue;
  const seed=hexes.length,center=sphereUV(u,v);
  const vertices=Array.from({length:6},(_,i)=>sphereUV(u+.102*Math.cos(i*Math.PI/3),v+.102*Math.sin(i*Math.PI/3)));
  const direction=clamp((center.u+center.v+Math.SQRT2)/(2*Math.SQRT2));
  hexes.push({...center,seed,vertices,closeDelay:.24*direction+.13*facetRandom(seed+1),fadeDuration:.13+.05*facetRandom(seed+97)});
}
export const SHIELD_CELLS=Object.freeze(hexes);
export function shieldPoint(u,v,dome,growth=1){
  const radius=dome.radius*(.82+.18*growth);
  return{x:dome.x+u*radius,y:dome.y+v*radius};
}
export function shieldLight(u,v){return clamp((1.05-u-v)/2.05)**1.25;}
export function shieldCellVisibility(cell,frame){
  if(frame.reduced)return Number(frame.state==='active');
  const reveal=smooth((frame.opening-(cell.u+cell.v+1.7)*.11)/.45);
  return reveal*(1-smooth((frame.shutdown-cell.closeDelay)/cell.fadeDuration));
}
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
export function drawShield(ctx,frame,layout){
  if(frame.shell<=0)return;
  const d=layout.dome,g=frame.growth,p=frame.pulse,unit=layout.unit;
  ctx.save();
  for(const cell of SHIELD_CELLS){
    const exposure=shieldLight(cell.u,cell.v),visibility=shieldCellVisibility(cell,frame);
    const points=cell.vertices.map(v=>shieldPoint(v.u,v.v,d,g));
    const glint=.78+.22*Math.sin(frame.ambient*3.3+cell.seed);
    polygon(ctx,points);ctx.fillStyle=cell.seed%5===0?SHIELD_ART.deep:SHIELD_ART.blue;
    ctx.globalAlpha=(cell.seed%7===0?.42:.25)*exposure*glint*visibility*p;ctx.fill();
    ctx.strokeStyle=SHIELD_ART.blue;ctx.globalAlpha=.14*exposure*glint*visibility*p;ctx.lineWidth=Math.max(.5,unit*.65);ctx.stroke();
  }
  ctx.restore();
}
