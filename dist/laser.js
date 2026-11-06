import {CANNON,Cannon,cannonGeometry,cannonHeatLimit} from './cannon.js';

export const LASER=Object.freeze({barrel:94,width:18,fade:.14,heatPerSecond:.24,chargeTimes:Object.freeze([2.4,2.05,1.75,1.48,1.24,1.04,.86])});
export const laserChargeTime=crew=>LASER.chargeTimes[Math.max(0,Math.min(6,Math.floor(crew)))];
export function laserRay(cannon,view,ground){
  const g=cannonGeometry(view,ground),dx=Math.cos(cannon.angle),dy=Math.sin(cannon.angle);
  const x=g.pivot.x+dx*(LASER.barrel+5)*g.scale,y=g.pivot.y+dy*(LASER.barrel+5)*g.scale;
  const distances=[Math.hypot(view.width,view.height)*2];
  if(Math.abs(dx)>1e-8)distances.push(((dx>0?view.width+32:-32)-x)/dx);
  if(Math.abs(dy)>1e-8)distances.push(((dy>0?view.height+32:-32)-y)/dy);
  const reach=Math.min(...distances.filter(d=>d>0));
  return{from:{x:x/view.sx,y:y/view.sy},to:{x:(x+dx*reach)/view.sx,y:(y+dy*reach)/view.sy},angle:cannon.angle};
}
// First intersection with the target's expanded ellipse, in screen coordinates.
export function laserContact(from,to,target,padding=0){
  const rx=Math.max(1,(target.rx??0)+padding),ry=Math.max(1,(target.ry??0)+padding),ox=(from.x-target.x)/rx,oy=(from.y-target.y)/ry,dx=(to.x-from.x)/rx,dy=(to.y-from.y)/ry;
  const a=dx*dx+dy*dy,b=2*(ox*dx+oy*dy),c=ox*ox+oy*oy-1,disc=b*b-4*a*c;
  if(a<1e-12||disc<0)return null;
  const t=c<=0?0:(-b-Math.sqrt(disc))/(2*a);if(t<0||t>1)return null;
  const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
  const nx=(x-target.x)/(rx*rx),ny=(y-target.y)/(ry*ry),n=Math.hypot(nx,ny)||1;
  return{x,y,t,nx:nx/n,ny:ny/n};
}
export class LaserCannon extends Cannon{
  constructor(enabled=false){super(enabled);this.weapon='laser';this.charge=0;this.beam=null;this.traces=[];this.contacts=[];}
  cancelFire(time,immediate=false){
    this.charge=0;
    if(this.beam&&!immediate)this.traces.push({...this.beam,ended:time});
    this.beam=null;if(immediate){this.traces=[];this.contacts=[];}
  }
  toggle(time){const changed=super.toggle(time);if(changed)this.cancelFire(time);return changed;}
  step(dt,time,crew,view,ground,random,emit){
    const heatMax=cannonHeatLimit(crew);this.heat=Math.min(this.heat,heatMax);if(this.heat>=heatMax-1e-9)this.overheated=true;
    if(!this.aiming||!this.trigger||this.overheated)this.cancelFire(time);
    const attacking=this.aiming&&this.trigger&&!this.overheated;
    let firingDt=this.beam?dt:0;
    if(attacking&&!this.beam){
      const chargeTime=laserChargeTime(crew),needed=(1-this.charge)*chargeTime;
      if(dt+1e-9>=needed){
        const born=time-dt+Math.min(dt,needed);this.charge=0;this.beam={id:++this.shots,born,...laserRay(this,view,ground)};this.lastShot=born;this.kicks.push({time:born,angle:this.angle});
        firingDt=Math.max(0,dt-needed);emit('laserShot',{angle:this.angle,beam:{...this.beam}});
      }else this.charge=Math.min(1,this.charge+dt/chargeTime);
    }
    if(this.beam){
      Object.assign(this.beam,laserRay(this,view,ground));
      const remaining=heatMax-this.heat;this.heat=Math.min(heatMax,this.heat+firingDt*LASER.heatPerSecond);
      if(this.heat>=heatMax-1e-9){
        const ended=time-firingDt+Math.min(firingDt,remaining/LASER.heatPerSecond);this.heat=heatMax;this.overheated=true;this.cancelFire(ended);
      }
    }else if(!attacking){
      this.charge=0;this.heat=Math.max(0,this.heat-dt*(this.overheated?CANNON.overheatCoolRate:CANNON.coolRate));
      if(this.overheated&&this.heat<=1e-8){this.heat=0;this.overheated=false;}
    }
    this.traces=this.traces.filter(b=>time-b.ended<LASER.fade).slice(-2);
    this.contacts=this.contacts.filter(p=>time-p.time<.38).slice(-48);this.kicks=this.kicks.filter(k=>time-k.time<.6);
  }
  snapshot(time,crew=0,reserved=0){return{...super.snapshot(time,crew,reserved),weapon:'laser',charge:this.charge,chargeTime:laserChargeTime(crew),heatRate:LASER.heatPerSecond,rate:null,beam:this.beam?{...this.beam}:null,traces:this.traces.map(b=>({...b})),contacts:this.contacts.map(p=>({...p}))};}
}
