import {FARM} from './farm.js';
import {ROWING} from './farm-rowing.js';
const [light,shade]=FARM.colors;
function plant(ctx,c){
  const s=c.height/64,color=c.layer==='front'?light:shade;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.scale(s,s);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineCap='round';ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-2,-20,3,-40,0,-57);ctx.stroke();
  for(const [side,y]of [[-1,-16],[1,-31],[-1,-44]]){
    ctx.beginPath();ctx.moveTo(0,y+7);ctx.bezierCurveTo(side*17,y+8,side*24,y-2,side*21,y-12);ctx.bezierCurveTo(side*8,y-10,side*1,y-1,0,y+7);ctx.fill();
  }
  ctx.beginPath();ctx.moveTo(0,-52);ctx.quadraticCurveTo(-10,-59,0,-64);ctx.quadraticCurveTo(8,-57,0,-52);ctx.fill();ctx.restore();
}
function mill(ctx,angle){
  ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-213,-116);ctx.bezierCurveTo(-213,-150,-194,-FARM.millHeight,-170,-FARM.millHeight);ctx.bezierCurveTo(-146,-FARM.millHeight,-127,-150,-127,-116);ctx.lineTo(-127,-2);ctx.bezierCurveTo(-127,12,-213,12,-213,-2);ctx.closePath();ctx.fill();
  ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-170,-FARM.millHeight);ctx.bezierCurveTo(-140,-172,-127,-143,-127,-116);ctx.lineTo(-127,-2);ctx.bezierCurveTo(-127,6,-143,11,-156,10);ctx.lineTo(-156,-116);ctx.bezierCurveTo(-156,-148,-161,-165,-170,-FARM.millHeight);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.roundRect(-190,-40,24,42,[12,12,0,0]);ctx.fill();
  ctx.save();ctx.translate(-170,-120);ctx.rotate(angle);
  for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(i*Math.PI/2);ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(5,-8);ctx.lineTo(14,-86);ctx.lineTo(42,-79);ctx.lineTo(32,-6);ctx.closePath();ctx.fill();
    ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(32,-6);ctx.lineTo(42,-79);ctx.lineTo(34,-81);ctx.lineTo(24,-8);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=light;ctx.beginPath();ctx.arc(-1,-1,3,0,Math.PI*2);ctx.fill();ctx.restore();
}
function hull(ctx,row){
  ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-232,20);ctx.bezierCurveTo(-210,88,-135,116,0,119);ctx.bezierCurveTo(143,118,213,85,232,20);ctx.closePath();ctx.fill();
  ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-222,33);ctx.bezierCurveTo(-183,91,-93,110,40,111);ctx.bezierCurveTo(-91,125,-194,98,-222,33);ctx.fill();
  for(const x of ROWING.hinges){
    ctx.save();ctx.translate(x,43);ctx.rotate(row.angle);ctx.scale(1,1-row.lift*.2);ctx.strokeStyle=light;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,ROWING.oarLength+2);ctx.stroke();
    ctx.translate(0,ROWING.oarLength);ctx.scale(row.bladeWidth,1);ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(-11,-2);ctx.lineTo(11,-2);ctx.lineTo(14,24);ctx.quadraticCurveTo(0,31,-14,24);ctx.closePath();ctx.fill();
    ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(7,-2);ctx.lineTo(11,-2);ctx.lineTo(14,24);ctx.quadraticCurveTo(9,28,5,27);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle=light;ctx.beginPath();ctx.arc(x,43,5,0,Math.PI*2);ctx.fill();
  }
}
export function drawFarm(ctx,frame,layer){
  const g=frame.geometry;ctx.save();ctx.translate(g.x,g.y);ctx.scale(g.scale*g.sx,g.scale*g.sy);
  if(layer==='back'){
    hull(ctx,g.row);
    ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-235,-1);ctx.bezierCurveTo(-249,2,-239,33,-219,37);ctx.bezierCurveTo(-105,51,133,49,218,32);ctx.quadraticCurveTo(243,27,238,-1);ctx.closePath();ctx.fill();
    ctx.fillStyle=light;ctx.beginPath();ctx.ellipse(0,-2,239,24,0,0,Math.PI*2);ctx.fill();
    // Far roots sit on the light rear bed; near roots stand on the dark front bed.
    ctx.save();ctx.beginPath();ctx.ellipse(0,-2,239,24,0,0,Math.PI*2);ctx.clip();ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-240,2);ctx.quadraticCurveTo(0,-9,240,2);ctx.lineTo(240,28);ctx.lineTo(-240,28);ctx.closePath();ctx.fill();ctx.restore();
    mill(ctx,frame.rotor);
  }
  for(const c of frame.crops)if(c.layer===layer)plant(ctx,c);
  ctx.restore();
}
