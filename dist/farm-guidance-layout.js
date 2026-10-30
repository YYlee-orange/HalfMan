import {farmRoute,FARM_BOUNDS} from './farm-rowing.js';
import {viewMetrics} from './body-geometry.js';
// Reserve the entire moving farm envelope, including the rotating mill and oars.
// A fixed region avoids text chasing the ship during writing or erasing.
export function farmGuidanceArea(view){
  const route=farmRoute(viewMetrics(view.width,view.height)),s=route.scale;
  const farm={top:route.y-FARM_BOUNDS.top*s*1.02-5*s,right:route.max+FARM_BOUNDS.right*s*1.02};
  const y=view.height<520?12:86,above={x:22,y,width:view.width-44,height:farm.top-16-y};
  if(above.height>=65)return{...above,farm,placement:'above'};
  const x=farm.right+16;return{x,y:12,width:Math.max(30,view.width-x-16),height:view.height-24,farm,placement:'right'};
}
