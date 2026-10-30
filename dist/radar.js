import {chooseSpacedAnchor} from './facilities.js';
export const RADAR_X=1250;
export const RADAR_SCALE=1.5;
// Grow toward the sky and left, keeping the dish's right margin near its original position.
export const radarOriginX=(scale=RADAR_SCALE)=>RADAR_X-92*(scale-RADAR_SCALE);
export const RADAR_RESPONSE=Object.freeze({baseFrequency:1.8,maxFrequency:3,maxAmplitude:2.2,rateWindow:.45});
export class RadarResponse{
  constructor(){this.rate=0;this.age=10;this.phase=0;this.amplitude=0;this.frequency=RADAR_RESPONSE.baseFrequency;}
  trigger(weight=1){
    if(this.age>.8&&this.amplitude<.005)this.phase=0;
    this.age=0;this.rate=Math.min(60,this.rate+weight/RADAR_RESPONSE.rateWindow);
  }
  step(dt){
    this.age+=dt;this.rate*=Math.exp(-dt/RADAR_RESPONSE.rateWindow);
    const requested=RADAR_RESPONSE.baseFrequency+this.rate*.12,overflow=Math.max(0,requested-RADAR_RESPONSE.maxFrequency);
    this.frequency=Math.min(RADAR_RESPONSE.maxFrequency,requested);
    const target=Math.min(RADAR_RESPONSE.maxAmplitude,1+this.rate*.025+overflow*.3)*Math.exp(-7*Math.max(0,this.age-.05));
    this.amplitude+=(target-this.amplitude)*(1-Math.exp(-18*dt));
    this.phase+=Math.PI*2*this.frequency*dt;
  }
  snapshot(){return{press:Math.sin(this.phase)*this.amplitude,frequency:this.frequency,amplitude:this.amplitude,phase:this.phase};}
}
export function chooseWorkAnchor(random=Math.random,occupied=[],view=null,scale=RADAR_SCALE){
  const make=i=>{
    const kind=(random()+i*.61803398875)%1,u=(random()+i*.41421356237)%1,v=(random()+i*.73205080757)%1;
    if(kind<.32)return{facility:'radar',type:'ground',x:-125+u*195,y:0};
    if(kind<.60){const y=-12-u*143,t=(-y-12)/143;return{facility:'radar',type:'tower',x:(1-t)*(6+v*24)+t*(-7+v*15),y};}
    if(kind<.88){const x=-85+u*170;return{facility:'radar',type:'dish',x,y:-12+v*(36*Math.sqrt(Math.max(0,1-(x/91)**2))+12)};}
    if(kind<.96)return{facility:'radar',type:'antenna',x:-5-u*7+(v-.5)*7,y:-10-u*56};
    return{facility:'radar',type:'antenna',x:-12+Math.cos(u*Math.PI*2)*13,y:-76+Math.sin(u*Math.PI*2)*13};
  };
  return chooseSpacedAnchor(make,occupied,a=>view?radarScreenPoint(a,view,808,{press:0,release:0,scan:0,antenna:0,scale}):radarWorldPoint(a,808,scale),view);
}
export function radarIdle(time,enabled=true){return{scan:enabled?Math.sin(time*.9)*.028:0,antenna:enabled?Math.sin(time*2.2)*.008:0};}
export function radarLocalPoint(anchor,press=0,release=0,idle={scan:0,antenna:0}){
  if(anchor.type==='tower'||anchor.type==='ground')return{x:anchor.x,y:anchor.y};
  let {x,y}=anchor;
  if(anchor.type==='antenna'){
    const a=press*.025-release*.028+idle.antenna;
    [x,y]=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  }
  const a=-.45+press*.018-release*.025+idle.scan;
  return{x:-10+x*Math.cos(a)-y*Math.sin(a),y:-165+press*3+x*Math.sin(a)+y*Math.cos(a)};
}
export function radarWorldPoint(anchor,ground,scale=RADAR_SCALE){
  const p=radarLocalPoint(anchor);return{x:radarOriginX(scale)+p.x*scale,y:ground+p.y*scale};
}
export function radarScreenPoint(anchor,v,ground,pose={press:0,release:0,scan:0,antenna:0}){
  const scale=pose.scale??RADAR_SCALE,originX=radarOriginX(scale);
  if(anchor.type==='ground')return{x:(originX+anchor.x*scale)*v.sx,y:ground*v.sy};
  const p=radarLocalPoint(anchor,pose.press,pose.release,pose);
  return{x:originX*v.sx+p.x*v.art*scale,y:ground*v.sy+p.y*v.art*scale};
}
