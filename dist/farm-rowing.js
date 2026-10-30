import {RADAR_SCALE,radarOriginX} from './radar.js';
import {PROGRESSION} from './progression.js';
export const ROWING=Object.freeze({stroke:3.2,strokesPerLeg:4,turn:1.2,oarLength:84,hinges:Object.freeze([-110,0,110])});
export const FARM_BOUNDS=Object.freeze({left:270,right:245,top:216,bottom:164});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>{const u=clamp(t,0,1);return u*u*(3-2*u);};
function strokeAt(p){
  // Viewed from the side: a working blade's normal lies in the screen plane,
  // so its face projects narrowly. Turn the face toward the viewer on recovery.
  if(p<.12){const u=smooth(p/.12);return{phase:'catch',angle:-.6,lift:1-u,bladeWidth:1-.78*u,thrust:0};}
  if(p<.56){const u=(p-.12)/.44;return{phase:'power',angle:-.6+1.2*smooth(u),lift:0,bladeWidth:.22,thrust:Math.sin(Math.PI*u)**2};}
  if(p<.68){const u=smooth((p-.56)/.12);return{phase:'release',angle:.6,lift:u,bladeWidth:.22+.78*u,thrust:0};}
  return{phase:'recover',angle:.6-1.2*smooth((p-.68)/.32),lift:1,bladeWidth:1,thrust:0};
}
// Integrate thrust minus drag once at fixed resolution. All frame rates sample the
// same displacement/velocity curve; returning oars cannot pull the boat backward.
const leg=ROWING.stroke*ROWING.strokesPerLeg,steps=Math.round(leg*120),dt=leg/steps,profile=[{distance:0,velocity:0}];
let velocity=0,distance=0,previous=0;
for(let i=1;i<=steps;i++){
  const t=i*dt,p=(t%ROWING.stroke)/ROWING.stroke,power=strokeAt(p).thrust;
  velocity+=(power*4.4-velocity*1.05)*dt;
  const v=velocity*smooth(t/.75)*smooth((leg-t)/1.05);distance+=(previous+v)*dt/2;profile.push({distance,velocity:v});previous=v;
}
for(const sample of profile){sample.distance/=distance;sample.velocity/=distance;}
export function rowingAt(time=0,reduced=false){
  if(reduced)return{progress:.5,velocity:0,direction:1,phase:'rest',angle:0,lift:.4,bladeWidth:1,thrust:0};
  const t=Number.isFinite(time)?Math.max(0,time):0,span=leg+ROWING.turn,index=Math.floor(t/span),local=t-index*span,direction=index%2?-1:1;
  if(local>=leg){const u=smooth((local-leg)/ROWING.turn);return{progress:direction===1?1:0,velocity:0,direction,phase:'turn',angle:-.6*direction*(1-2*u),lift:1,bladeWidth:1,thrust:0};}
  const x=local/dt,i=Math.min(steps-1,Math.floor(x)),f=x-i,a=profile[i],b=profile[i+1],progress=a.distance+(b.distance-a.distance)*f,pose=strokeAt((local%ROWING.stroke)/ROWING.stroke);
  return{...pose,angle:pose.angle*direction,direction,progress:direction===1?progress:1-progress,velocity:(a.velocity+(b.velocity-a.velocity)*f)*direction};
}
export function farmRoute(view){
  const b=FARM_BOUNDS,margin=18,clearance=Math.max(14,20*view.art),maxRadarScale=RADAR_SCALE*PROGRESSION.radarCap;
  // Dish and antenna fit within 104 local units to the left, including rotation.
  // Keep max-growth avoidance without reserving the former oversized 130-unit box.
  const radar={left:radarOriginX(maxRadarScale)*view.sx-104*view.art*maxRadarScale,top:808*view.sy-280*view.art*maxRadarScale};
  let scale=Math.min(1,Math.max(.54,view.art*.95),(view.width-76)/520,(view.height-36)/((b.top+b.bottom)*1.02));
  const minY=()=>b.top*scale*1.02+14,maxY=()=>808*view.sy-b.bottom*scale*1.02-18;
  let y=clamp(view.height*.57,minY(),maxY()),min=margin+b.left*scale*1.02,max=view.width-margin-b.right*scale*1.02;
  if(y+b.bottom*scale*1.02+4*scale>radar.top-clearance){
    const safeMax=radar.left-clearance-b.right*scale*1.02;
    if(safeMax-min>=24)max=Math.min(max,safeMax);
    else if(radar.top-clearance-24>115){
      // Compact screens place the entire boat above the radar instead of
      // shrinking it into an unreadable sliver alongside the building.
      scale=Math.min(scale,(radar.top-clearance-24)/((b.top+b.bottom)*1.02));
      scale=Math.max(.1,scale);y=Math.min(y,radar.top-clearance-b.bottom*scale*1.02-4*scale);
      min=margin+b.left*scale*1.02;max=view.width-margin-b.right*scale*1.02;
    }else{
      scale=Math.min(scale,(radar.left-clearance-2*margin-24)/((b.left+b.right)*1.02));scale=Math.max(.1,scale);
      y=clamp(view.height*.57,minY(),maxY());min=margin+b.left*scale*1.02;max=radar.left-clearance-b.right*scale*1.02;
    }
  }
  return{min,max,y,scale,radar,clearance};
}
