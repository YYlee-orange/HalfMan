import {scoreChargeAt} from './score-meteor.js';
export function drawScoreCharge(ctx,m,p,size,time,reduced=false){
  const charge=scoreChargeAt(m,time);if(charge.progress<=0)return charge;
  const {progress,contract}=charge,radius=reduced?size*.62:Math.max(size*.055,size*1.08*charge.radius);
  ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=reduced?.18:charge.opacity;ctx.fillStyle=contract>.75?'#d8efff':contract>.25?'#8d9ee5':'#6874a8';ctx.shadowColor='#91c8ff';ctx.shadowBlur=reduced?0:size*.2*contract;
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  if(!reduced)for(let i=0;i<3;i++){
    const a=time*(2+i*.3)+i*2.1,r=radius+(1-contract)*size*(.1+i*.06);ctx.strokeStyle=i%2?'#d3eaff':'#829be2';ctx.lineWidth=(2+contract*3)*Math.max(.6,size/134);ctx.globalAlpha=(.28+contract*.5)*progress;
    ctx.beginPath();ctx.arc(0,0,r,a,a+.9+progress*.7);ctx.stroke();
  }
  ctx.restore();return charge;
}
export function drawScoreChargeCore(ctx,p,size,charge,reduced=false){
  if(charge.contract<=0)return;
  ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=charge.contract*.9;ctx.fillStyle='#eef9ff';ctx.shadowColor='#bfdcff';ctx.shadowBlur=reduced?0:size*.32*charge.contract;
  ctx.beginPath();ctx.arc(0,0,size*(.035+charge.contract*.08),0,Math.PI*2);ctx.fill();ctx.restore();
}
