import {gemColorAt} from './score-gem.js';
import {shardColor} from './score-shard.js';
export const scoreCutColor=(id,cuts,time)=>gemColorAt(cuts%7,time,id,-17);
export function scoreAwardColor(event,reduced=false){
  const time=reduced?0:event.time;
  return event.type==='scoreFragmentLand'?shardColor(event.fragment,time):scoreCutColor(event.id,event.cuts,time);
}
