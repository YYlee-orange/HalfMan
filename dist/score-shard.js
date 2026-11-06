import {gemColorAt} from './score-gem.js';
export const SHARD_OUTLINES=Object.freeze([
  [[-.62,.28],[.64,-.47],[.18,.42]],
  [[-.59,-.23],[.61,-.42],[.26,.44],[-.34,.31]],
  [[-.63,.15],[.34,-.56],[.57,.2],[.03,.43]],
  [[-.55,-.35],[.67,-.08],[.12,.49],[-.32,.16]],
  [[-.64,.34],[.5,-.51],[.3,.06],[.54,.3],[-.08,.4]],
  [[-.53,-.27],[.59,-.48],[.32,.41],[-.15,.18]],
].map(poly=>Object.freeze(poly.map(v=>Object.freeze(v)))));
export const shardOutline=f=>SHARD_OUTLINES[(f.shape??f.id??0)%SHARD_OUTLINES.length];
export function shardExtent(f){
  const c=Math.cos(f.angle??0),s=Math.sin(f.angle??0),poly=shardOutline(f);
  return{rx:Math.max(...poly.map(([x,y])=>Math.abs(x*c-y*s))),ry:Math.max(...poly.map(([x,y])=>Math.abs(x*s+y*c)))};
}
export function shardColor(f,time){return gemColorAt(f.facetIndex??0,time,f.gemSeed??f.id,-17);}
export function drawScoreShard(ctx,f,size,time){
  const poly=shardOutline(f),seed=f.gemSeed??f.id,index=f.facetIndex??0;
  const g=ctx.createLinearGradient(-size*.5,-size*.3,size*.5,size*.4);g.addColorStop(0,shardColor(f,time));g.addColorStop(1,gemColorAt(index+2,time,seed,12));
  ctx.fillStyle=g;ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));ctx.closePath();ctx.fill();
  ctx.save();ctx.clip();ctx.fillStyle=gemColorAt(index+4,time,seed,21);ctx.beginPath();ctx.moveTo(poly[0][0]*size,poly[0][1]*size);ctx.lineTo(size*.05,-size*.04);ctx.lineTo(poly[1][0]*size,poly[1][1]*size);ctx.lineTo(size*.15,size*.38);ctx.closePath();ctx.fill();ctx.restore();
}
