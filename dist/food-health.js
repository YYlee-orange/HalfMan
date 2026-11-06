import {FOOD_X,foodIdle} from './facilities.js';
import {laserContact} from './laser.js';

export const FOOD_HEALTH=Object.freeze({
  max:100,damage:Object.freeze({man:10,bomb:10,child:5,nuclear:40}),
  repairRate:.5,maxRepairRate:1.5,repairPulse:5,
});
export const foodDamageStage=health=>health>75?0:health>50?1:health>25?2:3;

// Sweep in the same screen space as the bowl artwork and meteor silhouettes.
export function foodContact(a,b,view,ground,time,reduced){
  const breathe=foodIdle(time,!reduced);
  const x=FOOD_X*view.sx,y=ground*view.sy-40*view.art*(1-breathe);
  const rx=77*view.art*(1+breathe),ry=40*view.art*(1-breathe);
  const expandedX=rx+Math.max(a.rx,b.rx),expandedY=ry+Math.max(a.ry,b.ry);
  const hit=laserContact(a,b,{x,y,rx:expandedX,ry:expandedY});
  if(!hit)return null;
  const dx=(hit.x-x)/expandedX,dy=(hit.y-y)/expandedY,length=Math.hypot(dx,dy);
  return {surface:'food',t:hit.t,x:x+(length?dx/length:0)*rx,y:y+(length?dy/length:-1)*ry,
    normal:length?{x:hit.nx,y:hit.ny}:{x:0,y:-1}};
}
