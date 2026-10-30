export {SHIELD_ART,shieldFrame as previewFrame,drawToggleIcon,SHIELD_CELLS,shieldPoint,shieldLight,shieldCellVisibility,drawShield} from '../shield-art.js';
export function previewLayout(width,height){
  const unit=width<620?Math.max(.5,Math.min(width/620,height/440)):Math.max(.42,Math.min(width/1120,height/590)),ground=height*.91;
  const radarX=width*(width<620?.61:.64),radarScale=1.28*unit;
  const radar={x:radarX,y:ground-5*unit,scale:radarScale},radius=118*radarScale;
  return{width,height,ground,unit,radar,dome:{x:radarX-2*radarScale,y:radar.y-175*radarScale,radius},control:{x:Math.max(24,radarX-radius-152*unit),y:Math.min(ground-105*unit,height-(width<620?126:146))}};
}
// Preview-only copy of the current approved two-color radar silhouette.
export function drawPreviewRadar(ctx,layout,time=0,reduced=false){
  const {x,y,scale}=layout.radar,scan=reduced?0:Math.sin(time*.9)*.028,antenna=reduced?0:Math.sin(time*2.2)*.008;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.fillStyle='#da3e3e';ctx.beginPath();ctx.moveTo(-12,-161);ctx.lineTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(48,0);ctx.lineTo(-9,0);ctx.lineTo(2,-10);ctx.closePath();ctx.fill();
  ctx.fillStyle='#982b35';ctx.beginPath();ctx.moveTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(20,-9);ctx.lineTo(-4,-161);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(-10,-165);ctx.rotate(-.45+scan);
  ctx.fillStyle='#982b35';ctx.beginPath();ctx.moveTo(-91,0);ctx.bezierCurveTo(-85,62,83,61,91,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#da3e3e';ctx.beginPath();ctx.ellipse(0,0,91,27,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#982b35';ctx.beginPath();ctx.ellipse(0,-2,78,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#da3e3e';ctx.beginPath();ctx.moveTo(-58,13);ctx.bezierCurveTo(-29,-3,18,-5,49,13);ctx.bezierCurveTo(18,28,-29,28,-58,13);ctx.fill();
  ctx.save();ctx.rotate(antenna);
  ctx.fillStyle='#da3e3e';ctx.beginPath();ctx.moveTo(-8,9);ctx.lineTo(-16,-67);ctx.lineTo(-6,-69);ctx.lineTo(5,7);ctx.closePath();ctx.fill();
  ctx.fillStyle='#982b35';ctx.beginPath();ctx.moveTo(-6,-69);ctx.lineTo(5,7);ctx.lineTo(0,9);ctx.lineTo(-11,-67);ctx.fill();
  ctx.fillStyle='#da3e3e';ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.clip();ctx.fillStyle='#982b35';ctx.beginPath();ctx.ellipse(-3,-75,9,17,-.2,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.restore();ctx.restore();ctx.restore();
}
