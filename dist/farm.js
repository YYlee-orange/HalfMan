// DESIGN_VARIANCE 5 / MOTION_INTENSITY 4 / VISUAL_DENSITY 2.
import {farmRoute,rowingAt} from './farm-rowing.js';
export const FARM=Object.freeze({level:'man-3',millHeight:176,rotorSpeed:.16,colors:Object.freeze(['#82b7ad','#325e63'])});
export const FARM_CROPS=Object.freeze([
  ...[-65,0,66,132,198].map((x,i)=>Object.freeze({id:`back-${i}`,layer:'back',x,y:-15+(i%3)*2,height:[56,62,58,64,60][i],phase:i*1.31})),
  ...[-30,42,114,186].map((x,i)=>Object.freeze({id:`front-${i}`,layer:'front',x,y:6+(i%2)*3,height:FARM.millHeight*.5,phase:1+i*1.57})),
]);
export function farmGeometry(view,time=0,reduced=false){
  const route=farmRoute(view),row=rowingAt(time,reduced),scale=route.scale,breathe=reduced?0:Math.sin(time*1.12)*.014;
  return{x:route.min+(route.max-route.min)*row.progress,y:route.y+(reduced?0:(Math.sin(time*.82)*3+row.thrust*1.6)*scale),scale,sx:1+breathe,sy:1-breathe*.65,width:view.width,height:view.height,row,route};
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function touches(a,b,c,rx,ry){
  const x=(a.x-c.x)/rx,y=(a.y-c.y)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,d=dx*dx+dy*dy,t=d?clamp(-(x*dx+y*dy)/d,0,1):0;
  return(x+dx*t)**2+(y+dy*t)**2<=1;
}
export class FarmMotion{
  constructor(){this.reset();}
  reset(){this.previous=new Map();this.contacts=new Set();this.impulses=new Map();this.time=null;this.viewport='';this.geometry=null;}
  sync(people,time,g,reduced=false){
    const viewport=`${g.width}:${g.height}`,dt=this.time===null?0:time-this.time,next=new Map(people.map(p=>[p.id,p]));
    if(dt<=0||viewport!==this.viewport||reduced){this.previous=next;this.time=time;if(viewport!==this.viewport||reduced)this.contacts.clear();this.viewport=viewport;this.geometry=g;return;}
    const contacts=new Set(),local=(p,pose)=>({x:(p.x-pose.x)/(pose.scale*pose.sx),y:(p.y-pose.y)/(pose.scale*pose.sy)});
    for(const p of people){
      const previous=this.previous.get(p.id);if(!previous)continue;
      const a=local(previous,this.geometry),b=local(p,g),speed=(b.x-a.x)/dt;if(Math.abs(speed)<8)continue;
      for(const c of FARM_CROPS){
        const key=`${p.id}:${c.id}`,center={x:c.x,y:c.y-c.height*.5},rx=c.height*.34+(p.rx??12)/g.scale,ry=c.height*.5+(p.ry??10)/g.scale;
        if(touches(a,b,center,rx,ry)){
          contacts.add(key);
          if(!this.contacts.has(key))this.impulses.set(c.id,{time,force:Math.sign(speed)*.34*clamp(Math.abs(speed)/100,.35,1)});
        }
      }
    }
    for(const [id,hit]of this.impulses)if(time-hit.time>1.5)this.impulses.delete(id);
    this.previous=next;this.contacts=contacts;this.time=time;this.viewport=viewport;this.geometry=g;
  }
  snapshot(time,g,reduced=false){
    return{geometry:g,rotor:reduced?0:time*FARM.rotorSpeed,crops:FARM_CROPS.map(c=>{
      const hit=this.impulses.get(c.id),age=hit?time-hit.time:2,reaction=reduced||age<0||age>1.5?0:hit.force*Math.exp(-4.6*age)*Math.sin(11*age);
      return{...c,reaction,angle:(reduced?0:Math.sin(time*1.5+c.phase)*.025)+reaction};
    })};
  }
}
