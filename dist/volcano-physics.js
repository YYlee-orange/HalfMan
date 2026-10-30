import {volcanoFrame} from './volcano.js';
import {farmGeometry} from './farm.js';
import {FARM_BOUNDS} from './farm-rowing.js';
export const VOLCANO_RULES=Object.freeze({chance:.15,angleMin:-30,angleMax:15,gravityFallback:34});
const clamp=n=>Math.max(0,Math.min(1,n));
export function volcanoLaunch(view,time,reduced,lastEruption,body,gravity,random=Math.random){
  const frame=volcanoFrame('man-4',view,time,reduced,lastEruption),farm=farmGeometry(view,time,reduced),g=gravity>0&&Number.isFinite(gravity)?gravity:VOLCANO_RULES.gravityFallback;
  const farmTop=farm.y-FARM_BOUNDS.top*farm.scale*farm.sy,minimumApexY=farmTop-Math.max(70,view.height*.08),heightMin=Math.max(120*view.character,frame.mouth.y-minimumApexY);
  const heightMax=Math.max(heightMin*1.5,frame.mouth.y+Math.max(90,view.height*.18)+body.size*view.character*.6),cos=Math.cos(Math.max(Math.abs(VOLCANO_RULES.angleMin),Math.abs(VOLCANO_RULES.angleMax))*Math.PI/180),screenGravity=g*view.sy;
  const speedMin=Math.sqrt(2*screenGravity*heightMin)/cos,speedMax=Math.sqrt(2*screenGravity*heightMax)/cos,angle=(VOLCANO_RULES.angleMin+clamp(random())*(VOLCANO_RULES.angleMax-VOLCANO_RULES.angleMin))*Math.PI/180,speed=speedMin+(speedMax-speedMin)*clamp(random());
  return{source:'volcano',x:frame.mouth.x/view.sx,y:(frame.mouth.y-body.size*.5*(view.sy-view.character))/view.sy,vx:Math.sin(angle)*speed/view.sx,vy:-Math.cos(angle)*speed/view.sy,tilt:angle*.6,gravity:g,launchAngle:angle,launchSpeed:speed,speedRange:[speedMin,speedMax],fallStartedAt:null,minimumApexY,mouth:{...frame.mouth}};
}
