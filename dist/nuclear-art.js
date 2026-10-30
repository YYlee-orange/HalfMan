import {NUCLEAR_RULES,nuclearBombScale} from './nuclear.js';
import {drawRadiation} from './radiation.js';
import {CUT} from './cut-settings.js';
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>1-(1-clamp(n))**3;
export const NUCLEAR_COLORS=Object.freeze({body:'#858967',side:'#4b5142',cloud:'#48275f',cloudLight:'#68407e',icon:'#ffe344'});
export function drawNuclearBomb(ctx,state,view,project){
  if(!state.bomb)return;const p=project(state.bomb.x,state.bomb.y),s=nuclearBombScale(view),c=NUCLEAR_COLORS;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
  ctx.fillStyle=c.side;ctx.beginPath();ctx.moveTo(-16,-36);ctx.lineTo(-47,-73);ctx.lineTo(-45,-29);ctx.lineTo(-24,-13);ctx.lineTo(24,-13);ctx.lineTo(45,-29);ctx.lineTo(47,-73);ctx.lineTo(16,-36);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.body;ctx.beginPath();ctx.moveTo(-15,-82);ctx.lineTo(15,-82);ctx.lineTo(22,-42);ctx.bezierCurveTo(49,-23,47,38,25,64);ctx.quadraticCurveTo(12,78,0,82);ctx.quadraticCurveTo(-12,78,-25,64);ctx.bezierCurveTo(-47,38,-49,-23,-22,-42);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.side;ctx.beginPath();ctx.moveTo(11,-82);ctx.lineTo(15,-82);ctx.lineTo(22,-42);ctx.bezierCurveTo(49,-23,47,38,25,64);ctx.quadraticCurveTo(12,78,0,82);ctx.bezierCurveTo(26,50,33,1,11,-42);ctx.closePath();ctx.fill();
  drawRadiation(ctx,-5,8,22,c.side);ctx.restore();
}
export function drawNuclearIcon(ctx,state,time,view,reduced=false){
  const frame=nuclearIconFrame(state,view,reduced);if(!frame)return;
  ctx.save();ctx.globalAlpha=frame.alpha;drawRadiation(ctx,view.width/2,view.height/2,frame.size/2,NUCLEAR_COLORS.icon);ctx.restore();
}
export function nuclearIconFrame(state,view,reduced=false){
  if(state.phase!=='warning'||state.remaining>NUCLEAR_RULES.iconWarning||state.remaining<=0)return null;
  const elapsed=NUCLEAR_RULES.iconWarning-state.remaining,size=Math.max(130,Math.min(300,view.width*.4,view.height*.46));
  const wave=Math.sin(Math.PI*elapsed/NUCLEAR_RULES.iconPeriod),alpha=reduced?.65:Math.abs(wave)<1e-10?0:.78*wave*wave;
  return{size,alpha};
}
export function nuclearCloudFrame(b,time,view,project,reduced=false){
  const age=time-b.sceneTime,p=project(b.x,b.y),rise=ease(age/(reduced?.5:1.85)),w=Math.min(view.width*.88,1100)*(.2+.8*ease(age/1.05)),h=view.height*.76*rise;
  const u=clamp((NUCLEAR_RULES.cloudLife-age)/1.05),overscan=Math.min(20,Math.max(10,view.art*12));
  return{age,x:p.x,y:view.height+overscan,w,h,footHeight:Math.max(28,h*.115),alpha:u*u*(3-2*u)};
}
function paintCloud(ctx,f){
  const {x,y,w,h,footHeight}=f,cap=-h,c=NUCLEAR_COLORS;ctx.save();ctx.translate(x,y);ctx.globalAlpha=1;
  ctx.fillStyle=c.cloud;ctx.beginPath();ctx.moveTo(-w*.22,0);ctx.bezierCurveTo(-w*.06,-h*.13,-w*.1,-h*.54,-w*.21,cap+h*.12);ctx.lineTo(w*.2,cap+h*.12);ctx.bezierCurveTo(w*.09,-h*.55,w*.07,-h*.13,w*.25,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.cloudLight;ctx.beginPath();ctx.moveTo(-w*.12,0);ctx.bezierCurveTo(-w*.04,-h*.2,-w*.05,-h*.55,-w*.12,cap+h*.13);ctx.lineTo(w*.03,cap+h*.13);ctx.bezierCurveTo(w*.02,-h*.55,w*.03,-h*.14,w*.13,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.cloud;ctx.beginPath();ctx.moveTo(-w*.49,cap+h*.13);ctx.bezierCurveTo(-w*.56,cap-h*.01,-w*.4,cap-h*.17,-w*.27,cap-h*.14);ctx.bezierCurveTo(-w*.18,cap-h*.3,w*.02,cap-h*.31,w*.12,cap-h*.23);ctx.bezierCurveTo(w*.27,cap-h*.28,w*.41,cap-h*.16,w*.4,cap-h*.08);ctx.bezierCurveTo(w*.59,cap-h*.02,w*.53,cap+h*.18,w*.36,cap+h*.19);ctx.bezierCurveTo(w*.15,cap+h*.3,-w*.27,cap+h*.29,-w*.49,cap+h*.13);ctx.fill();
  ctx.fillStyle=c.cloudLight;ctx.beginPath();ctx.ellipse(-w*.12,cap-h*.055,w*.3,Math.max(1,h*.16),-.06,0,Math.PI*2);ctx.fill();
  // The flat baseline sits beyond the viewport, including during camera shake.
  ctx.fillStyle=c.cloud;ctx.beginPath();ctx.ellipse(0,0,w*.5,footHeight,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle=c.cloudLight;ctx.beginPath();ctx.ellipse(-w*.08,0,w*.32,footHeight*.7,0,Math.PI,Math.PI*2);ctx.fill();ctx.restore();
}
export class NuclearEffects{
  constructor(makeCanvas=()=>document.createElement('canvas')){this.makeCanvas=makeCanvas;this.layer=null;this.clear();}
  clear(){this.blasts=[];}
  add(event){this.blasts.push({...event});if(this.blasts.length>3)this.blasts.shift();}
  flash(time,reduced=false){const b=this.blasts.at(-1),age=b?time-b.sceneTime:Infinity,d=b?.flashDuration??0;return age<0||d<=0||age>=d?0:Math.pow(1-age/d,1.55)*(reduced?.65:1);}
  draw(ctx,time,view,project,reduced=false){
    this.blasts=this.blasts.filter(b=>time-b.sceneTime<=NUCLEAR_RULES.cloudLife);
    for(const b of this.blasts){
      const f=nuclearCloudFrame(b,time,view,project,reduced);if(f.age<0||f.alpha<=0)continue;
      this.layer??=this.makeCanvas();const ratio=Math.min(2,Math.max(1,(ctx.canvas?.width??view.width)/view.width)),width=Math.round(view.width*ratio),height=Math.round(view.height*ratio);
      if(this.layer.width!==width||this.layer.height!==height){this.layer.width=width;this.layer.height=height;}
      const cloud=this.layer.getContext('2d');cloud.setTransform(ratio,0,0,ratio,0,0);cloud.clearRect(0,0,view.width,view.height);paintCloud(cloud,f);
      // Composite the finished opaque artwork once. Individual planes must not
      // become transparent against each other while the whole cloud dissolves.
      ctx.save();ctx.globalAlpha=f.alpha*CUT.nuclearCloudOpacity;ctx.drawImage(this.layer,0,0,width,height,0,0,view.width,view.height);ctx.restore();
      if(f.age<.65){const u=ease(f.age/.65);ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1-f.age/.65;ctx.strokeStyle=NUCLEAR_COLORS.cloudLight;ctx.lineWidth=Math.max(1,14*(1-u));ctx.beginPath();ctx.ellipse(0,-3,view.width*.65*u,Math.max(2,view.height*.055*u),0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore();}
    }
  }
}
