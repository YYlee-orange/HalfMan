import {SHIELD_ART,shieldFrame} from './shield-art.js';
import {radarOriginX} from './radar.js';
export const SHIELD=Object.freeze({level:'man-2',duration:4,cooldown:15,x:-2,y:-175,radius:118});
export class RadarShield{
  constructor(enabled=false){this.enabled=enabled;this.activatedAt=null;}
  snapshot(time,reduced=false){
    const age=this.activatedAt===null?SHIELD.duration+SHIELD.cooldown+SHIELD_ART.readySettle:Math.max(0,time-this.activatedAt);
    const frame=shieldFrame(age,time,reduced);
    return{...frame,enabled:this.enabled,active:this.enabled&&frame.state==='active',activatedAt:this.activatedAt};
  }
  activate(time){
    if(!this.enabled||this.snapshot(time).state!=='ready')return false;
    this.activatedAt=time;return true;
  }
}
// Render, interception and protection share this circle in unshaken screen space.
export function shieldCircle(view,ground,scale,growth=1){
  return{x:radarOriginX(scale)*view.sx+SHIELD.x*view.art*scale,y:ground*view.sy+SHIELD.y*view.art*scale,
    radius:SHIELD.radius*view.art*scale*(.82+.18*growth)};
}
export function shieldContains(point,circle){return Math.hypot(point.x-circle.x,point.y-circle.y)<=circle.radius+1e-7;}
// Sweep an inflated ellipse so a fast or large glyph cannot skip the shield.
export function shieldContact(a,b,circle){
  const rx=circle.radius+Math.max(a.rx??0,b.rx??0),ry=circle.radius+Math.max(a.ry??0,b.ry??0);
  const x=(a.x-circle.x)/rx,y=(a.y-circle.y)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry;
  const c=x*x+y*y-1,aa=dx*dx+dy*dy,bb=2*(x*dx+y*dy);
  let t=0;
  if(c>0){const discriminant=bb*bb-4*aa*c;if(aa<1e-16||discriminant<0)return null;t=(-bb-Math.sqrt(discriminant))/(2*aa);if(t<0||t>1)return null;}
  const center={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};let nx=center.x-circle.x,ny=center.y-circle.y;
  if(Math.hypot(nx,ny)<1e-9){nx=0;ny=-1;}const length=Math.hypot(nx,ny);
  return{t,x:circle.x+nx/length*circle.radius,y:circle.y+ny/length*circle.radius,normal:{x:nx/length,y:ny/length}};
}
