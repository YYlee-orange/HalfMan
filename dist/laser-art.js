import {LASER} from './laser.js';
const clamp=n=>Math.max(0,Math.min(1,n)),fract=n=>n-Math.floor(n);
const energy='#45c7ef',core='#efffff',light='#648fb6',side='#34536e';
export function drawLaserBarrel(ctx,frame,time,reduced=false){
  ctx.fillStyle=side;ctx.beginPath();ctx.roundRect(-14,-26,62,52,14);ctx.fill();
  // Thick annular collars share a continuous core and nearly meet in projection.
  ctx.fillStyle=light;ctx.fillRect(17,-19,79,38);
  ctx.fillStyle=side;ctx.fillRect(17,6,79,13);
  for(let x=27;x<=79;x+=13){
    ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(x,-25);ctx.lineTo(x+8,-25);
    ctx.bezierCurveTo(x+15,-25,x+15,25,x+8,25);ctx.lineTo(x,25);ctx.bezierCurveTo(x-7,25,x-7,-25,x,-25);ctx.closePath();ctx.fill();
    ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(x+8,0,5.5,25,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.ellipse(x+8,0,3.8,19,0,0,Math.PI*2);ctx.clip();
    ctx.fillStyle=light;ctx.fillRect(x+4,-19,8,38);ctx.fillStyle=side;ctx.fillRect(x+4,6,8,13);ctx.restore();
  }
  ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(94,0,10,28,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=light;ctx.beginPath();ctx.ellipse(98,0,6,23,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.ellipse(99,0,3,14,0,0,Math.PI*2);ctx.fill();
  const p=frame.charge??0,beam=!!frame.beam;if(p<=0&&!beam)return;
  ctx.save();ctx.translate(99,0);ctx.fillStyle=energy;
  if(!reduced)for(let i=0;i<10;i++){const u=fract(time*(.6+i*.027)+i*.371),a=i*2.399+time*.2,r=(1-u)*(24+30*p)+6;ctx.globalAlpha=(.2+.65*u)*p;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,1.2+u*1.8,0,Math.PI*2);ctx.fill();}
  ctx.shadowColor=energy;ctx.shadowBlur=beam?18:12*p;ctx.globalAlpha=beam?.9:.2+p*.65;
  ctx.beginPath();ctx.ellipse(0,0,beam?9:3+6*p,beam?17:4+10*p,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle=core;ctx.globalAlpha=beam?1:p*.9;ctx.beginPath();ctx.ellipse(0,0,beam?4:2+p*3,beam?9:2+p*5,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function drawLaserBeams(ctx,frame,time,project,view,reduced=false){
  const unit=Math.max(.55,view.art),beams=[...(frame.traces??[]),...(frame.beam?[frame.beam]:[])];ctx.save();ctx.lineCap='round';
  for(const beam of beams){
    const age=time-beam.born,fade=beam.ended==null?1:clamp(1-(time-beam.ended)/LASER.fade);
    const grow=reduced?1:clamp(age/.045),a=project(beam.from.x,beam.from.y),b=project(beam.to.x,beam.to.y),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,nx=-uy,ny=ux;
    const width=LASER.width*unit*grow*(reduced?1:1+.055*Math.sin(time*46+beam.id));
    for(const [scale,alpha,color]of [[2.7,.07,energy],[1.65,.16,energy],[1,.64,energy],[.24,.98,core]]){ctx.globalAlpha=fade*alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.5,width*scale);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    if(!reduced&&beam.ended==null)for(let i=0;i<24;i++){
      const u=fract(age*(.65+fract(i*.381)*.8)+i*.618),offset=Math.sin(i*2.71+time*3)*width*.38;
      const x=a.x+dx*u+nx*offset,y=a.y+dy*u+ny*offset,tail=(4+fract(i*.77)*11)*unit;
      ctx.strokeStyle=i%3?core:energy;ctx.globalAlpha=fade*(.25+.65*fract(i*.43));ctx.lineWidth=(1+fract(i*.59)*1.5)*unit;ctx.beginPath();ctx.moveTo(x-tail*ux,y-tail*uy);ctx.lineTo(x,y);ctx.stroke();
    }
  }
  for(const hit of frame.contacts??[]){
    const age=time-hit.time;if(age<0||age>.38)continue;const p=project(hit.x,hit.y),fade=(1-age/.38)**1.6;
    ctx.globalAlpha=fade*.7;ctx.fillStyle=energy;ctx.beginPath();ctx.ellipse(p.x,p.y,(13+age*25)*unit,(18+age*32)*unit,hit.beamAngle,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=core;ctx.globalAlpha=fade;ctx.beginPath();ctx.arc(p.x,p.y,(4+5*(1-age/.38))*unit,0,Math.PI*2);ctx.fill();
    if(!reduced)for(let i=0;i<14;i++){
      const seed=fract(Math.sin(hit.id*17+i*43)*43758.54),a=hit.angle+(seed-.5)*2.9,d=age*(85+seed*245)*unit;
      const x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d+age*age*90*unit;ctx.strokeStyle=i%3?energy:core;ctx.lineWidth=(1+seed*2)*unit;ctx.globalAlpha=fade;
      ctx.beginPath();ctx.moveTo(x-Math.cos(a)*(3+seed*8)*unit,y-Math.sin(a)*(3+seed*8)*unit);ctx.lineTo(x,y);ctx.stroke();
    }
  }
  ctx.restore();
}
