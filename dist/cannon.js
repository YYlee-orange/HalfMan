export const CANNON=Object.freeze({level:'man-2',x:500,capacity:6,scale:1.2,barrel:132,fireRates:Object.freeze([1.5,2.05,2.6,3.15,3.7,4.25,4.8]),speed:1500,spread:.035,heatPerShot:.12,coolRate:.85,overheatCoolRate:.5,bulletLife:2.4});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const cannonFireRate=crew=>CANNON.fireRates[clamp(Math.floor(crew),0,CANNON.capacity)];
export const cannonHeatLimit=crew=>crew===0?.5:1;
export const cannonBulletRadius=view=>5*Math.max(.7,view.art);
export function cannonGeometry(view,ground){
  const scale=view.art*CANNON.scale;
  return{x:CANNON.x*view.sx,y:ground*view.sy,scale,pivot:{x:CANNON.x*view.sx,y:ground*view.sy-79*scale}};
}
export class Cannon{
  constructor(enabled=false){this.enabled=enabled;this.aiming=false;this.trigger=false;this.heat=0;this.overheated=false;this.untilShot=0;this.angle=-Math.PI*.65;this.aim={x:650,y:250};this.shots=0;this.lastShot=-10;this.entered=-10;this.modeAt=-10;this.bullets=[];this.kicks=[];}
  setAim(x,y,view,ground){
    const g=cannonGeometry(view,ground),px=clamp(x,8,view.width-8),py=clamp(y,8,g.pivot.y-20*g.scale);
    this.aim={x:px/view.sx,y:py/view.sy};this.angle=Math.atan2(py-g.pivot.y,px-g.pivot.x);
  }
  toggle(time){if(!this.enabled)return false;this.aiming=!this.aiming;this.modeAt=time;this.trigger=false;this.untilShot=0;return true;}
  step(dt,time,crew,view,ground,random,emit){
    const heatMax=cannonHeatLimit(crew);this.heat=Math.min(this.heat,heatMax);if(this.heat>=heatMax-1e-9)this.overheated=true;
    const attacking=this.aiming&&this.trigger&&!this.overheated;
    if(!attacking){this.heat=Math.max(0,this.heat-dt*(this.overheated?CANNON.overheatCoolRate:CANNON.coolRate));if(this.overheated&&this.heat<=1e-8){this.heat=0;this.overheated=false;}}
    this.untilShot-=dt;
    if(attacking&&this.untilShot<=1e-8){
      const g=cannonGeometry(view,ground),a=this.angle+(random()-.5)*2*CANNON.spread;
      const bullet={id:++this.shots,x:(g.pivot.x+Math.cos(this.angle)*(CANNON.barrel+5)*g.scale)/view.sx,y:(g.pivot.y+Math.sin(this.angle)*(CANNON.barrel+5)*g.scale)/view.sy,
        vx:Math.cos(a)*CANNON.speed*view.art/view.sx,vy:Math.sin(a)*CANNON.speed*view.art/view.sy,born:time,age:0};
      this.bullets.push(bullet);this.lastShot=time;this.kicks.push({time,angle:this.angle});this.heat=Math.min(heatMax,this.heat+CANNON.heatPerShot);
      if(this.heat>=heatMax-1e-9){this.heat=heatMax;this.overheated=true;}this.untilShot=1/cannonFireRate(crew);emit('cannonShot',{angle:this.angle,bullet:{...bullet}});
    }
    if(!attacking)this.untilShot=Math.max(0,this.untilShot);
    this.kicks=this.kicks.filter(k=>time-k.time<.6);
  }
  snapshot(time,crew=0,reserved=0){const heatMax=cannonHeatLimit(crew);return{enabled:this.enabled,aiming:this.aiming,trigger:this.trigger,crew,reserved,capacity:CANNON.capacity,heat:this.heat,heatMax,heatProgress:clamp(this.heat/heatMax,0,1),overheated:this.overheated,angle:this.angle,aim:{...this.aim},shots:this.shots,modeAge:time-this.modeAt,shotAge:time-this.lastShot,entryAge:time-this.entered,rate:cannonFireRate(crew),bullets:this.bullets.map(b=>({...b}))};}
}
export function cannonRecoil(cannon,time,reduced=false){
  if(reduced)return{x:0,y:0};let x=0,y=0;
  for(const k of cannon.kicks){const t=time-k.time;if(t<0||t>.6)continue;const strength=5*Math.exp(-9*t)*Math.sin(t*24);x-=Math.cos(k.angle)*strength;y-=Math.sin(k.angle)*strength;}
  return{x:clamp(x,-8,8),y:clamp(y,-8,8)};
}
export function shotIntersects(a,b,target,radius=2){
  const rx=(target.rx??0)+radius,ry=(target.ry??0)+radius,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,x=(a.x-target.x)/rx,y=(a.y-target.y)/ry;
  const aa=dx*dx+dy*dy,t=aa?clamp(-(x*dx+y*dy)/aa,0,1):0;
  return(x+dx*t)**2+(y+dy*t)**2<=1;
}
