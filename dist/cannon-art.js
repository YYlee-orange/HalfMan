import {CANNON,cannonGeometry} from './cannon.js';
import {createDebris} from './effects.js';
import {fragmentLandingTime,airHitFragmentAt} from './fx-physics.js';
const clamp=n=>Math.max(0,Math.min(1,n)),light='#d6a34b',side='#89602e';
export function cannonBodyStretch(frame,time,reduced=false){const age=frame.entryAge,jelly=reduced?0:age>=0&&age<.85?-.32*Math.sin(age*23)*Math.exp(-4.5*age):0,idle=reduced?0:Math.sin(time*2.1)*.035,x=1+jelly+idle;return{x,y:1/x};}
export function drawCannon(ctx,frame,geometry,time,reduced=false){
  const {x,y,scale:s}=geometry,stretch=cannonBodyStretch(frame,time,reduced);
  ctx.save();ctx.translate(x,y);ctx.scale(s*stretch.x,s*stretch.y);
  ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(0,-6,76,14,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-67,-8);ctx.lineTo(-52,-56);ctx.bezierCurveTo(-43,-84,38,-84,49,-56);ctx.lineTo(68,-8);ctx.bezierCurveTo(34,9,-34,8,-67,-8);ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(24,-72);ctx.bezierCurveTo(39,-69,47,-62,49,-56);ctx.lineTo(68,-8);ctx.bezierCurveTo(52,-1,34,2,21,2);ctx.lineTo(24,-72);ctx.fill();
  ctx.restore();ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  // A fixed sleeve and a sliding two-tone barrel make the recoil legible.
  ctx.save();ctx.translate(0,-79);ctx.rotate(frame.angle);
  ctx.fillStyle=side;ctx.beginPath();ctx.roundRect(-13,-22,65,44,13);ctx.fill();
  const recoil=reduced?0:frame.shotAge>=0&&frame.shotAge<.38?20*Math.exp(-10*frame.shotAge)*Math.cos(frame.shotAge*9):0;
  ctx.translate(-recoil,0);ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(23,-13);ctx.lineTo(CANNON.barrel,-11);ctx.lineTo(CANNON.barrel,11);ctx.lineTo(23,14);ctx.closePath();ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(23,3);ctx.lineTo(CANNON.barrel,2);ctx.lineTo(CANNON.barrel,11);ctx.lineTo(23,14);ctx.fill();
  ctx.fillStyle=light;ctx.beginPath();ctx.ellipse(CANNON.barrel,0,6,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(CANNON.barrel+1,0,3,8,0,0,Math.PI*2);ctx.fill();
  if(frame.shotAge>=0&&frame.shotAge<.15){
    const f=(1-frame.shotAge/.15)**.7;ctx.save();ctx.translate(CANNON.barrel+4,0);ctx.globalAlpha=.9*f;ctx.fillStyle='#f04416';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(32,-24*f);ctx.lineTo(28,-8);ctx.lineTo(76*f+10,0);ctx.lineTo(29,9);ctx.lineTo(39,23*f);ctx.lineTo(0,6);ctx.closePath();ctx.fill();
    ctx.globalAlpha=f;ctx.fillStyle='#ffcd29';ctx.beginPath();ctx.moveTo(0,-5);ctx.quadraticCurveTo(16,-12,49*f+8,0);ctx.quadraticCurveTo(15,12,0,5);ctx.fill();ctx.restore();
  }
  ctx.restore();ctx.fillStyle=light;ctx.beginPath();ctx.arc(0,-79,25,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(0,-79,25,0,Math.PI*2);ctx.clip();ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(16,-77,12,29,-.2,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();
}
export function drawCannonReticle(ctx,frame,point,reduced,ink){
  const age=Math.max(0,frame.modeAge),p=reduced?Number(frame.aiming):frame.aiming?clamp(age/.28):1-clamp(age/.18);
  if(p<=0)return;const scale=reduced?1:1+(1-p)*.6,r=18*scale;
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(reduced?0:(1-p)*.4);ctx.globalAlpha=p;ctx.strokeStyle=ink;ctx.lineWidth=1.8;ctx.lineCap='round';
  for(const [sx,sy]of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(sx*r,sy*(r-9));ctx.lineTo(sx*r,sy*r);ctx.lineTo(sx*(r-9),sy*r);ctx.stroke();}
  ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.stroke();ctx.restore();
}
export function drawCannonHeat(ctx,frame,ink){
  ctx.clearRect(0,0,42,42);ctx.save();ctx.strokeStyle=ctx.fillStyle=ink;ctx.lineWidth=3;ctx.globalAlpha=.18;ctx.beginPath();ctx.arc(21,21,18,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  if(frame.heatProgress>0){ctx.beginPath();ctx.arc(21,21,18,-Math.PI/2,-Math.PI/2+frame.heatProgress*Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(21,10);ctx.bezierCurveTo(24,16,18,17,26,20);ctx.bezierCurveTo(32,27,24,34,18,30);ctx.bezierCurveTo(10,26,18,20,17,17);ctx.bezierCurveTo(21,19,22,15,21,10);ctx.fill();ctx.restore();
}
export function makeCannonDebris(e,view,ground){
  const pieces=createDebris(e.id+711,32).map(p=>({...p,vx:p.vx,vy:p.vy*.75,size:p.size*1.15})),groundHeight=Math.max(0,(ground-e.y)*view.sy/view.art);
  return{type:'cannonDebris',x:e.x,y:e.y,time:e.sceneTime,seed:e.id,tone:e.tone,kind:e.kind,groundHeight,pieces,duration:Math.max(...pieces.map(p=>fragmentLandingTime(p,groundHeight)))+.01};
}
export function drawCannonDebris(ctx,b,time,project,view,ink){
  const age=time-b.time,p=project(b.x,b.y),s=view.art;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=ink;
  if(age>=0&&age<.32){
    const fade=(1-age/.32)**1.4,grow=1-(1-clamp(age/.07))**3,colors=b.kind==='man'?['#f04416','#ffcd29']:['#247bdc','#a8deff'];
    for(let layer=0;layer<2;layer++){const r=92*s*grow*(layer?.55:1);ctx.globalAlpha=(layer?.8:.58)*fade;ctx.fillStyle=colors[layer];ctx.beginPath();for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,lobe=1+.07*Math.sin(a*7+b.seed),x=Math.cos(a)*r*lobe,y=Math.sin(a)*r*lobe;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.fill();}
    ctx.strokeStyle=colors[1];ctx.lineWidth=3*s;ctx.globalAlpha=.7*fade;ctx.beginPath();ctx.arc(0,0,(32+96*grow)*s,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=ink;
  }
  for(const piece of b.pieces){const q=airHitFragmentAt(piece,age,b.groundHeight);if(!q)continue;const z=piece.size*s;ctx.save();ctx.translate(q.x*s,q.y*s);ctx.rotate(q.angle);ctx.beginPath();ctx.moveTo(-z*.7,-z*.4);ctx.lineTo(z*.5,-z*.3);ctx.lineTo(z*.7,z*.3);ctx.lineTo(-z*.3,z*.5);ctx.fill();ctx.restore();}
  ctx.restore();
}
export function drawCannonBullet(ctx,b,project,view){
  const p=project(b.x,b.y),a=Math.atan2(b.vy*view.sy,b.vx*view.sx),s=Math.max(.7,view.art);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.scale(s,s);
  ctx.globalAlpha=.45;ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-9,-3);ctx.lineTo(-46,0);ctx.lineTo(-9,3);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-11,-5);ctx.lineTo(4,-5);ctx.quadraticCurveTo(13,-4,15,0);ctx.quadraticCurveTo(13,4,4,5);ctx.lineTo(-11,5);ctx.closePath();ctx.fill();
  ctx.restore();
}
