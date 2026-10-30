import {CUT} from './cut-settings.js';
import {FIRE_BLUE} from './fire.js';
import {bombChargeAt} from './bomb-physics.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function bombDebris(seed,count,speed,size,ground=false){
  let state=(seed*2654435761)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return Array.from({length:count},(_,i)=>{
    const angle=ground?-Math.PI*random():Math.PI*2*random(),v=speed*(.3+random()*.7);
    return{vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,size:size*(i<8?.8+random()*.6:.15+random()*.6),angle:random()*Math.PI,spin:(random()-.5)*16};
  });
}
export function bombDebrisAt(p,age,height,gravity){
  const y=p.vy*age+.5*gravity*age*age;if(age<0||y>=height&&age>0)return null;
  return{x:p.vx*age,y,angle:p.angle+p.spin*age};
}
export function makeBombBurst(event){
  const ground=event.type==='bombletImpact',count=ground?Math.round(CUT.bombDebrisCount*.28):CUT.bombDebrisCount;
  return{type:ground?'bombGround':'bombAir',x:event.x,y:event.y,time:event.sceneTime,seed:event.id,
    radius:ground?event.radius:CUT.bombAirRadius,flashDuration:CUT.bombBlastDuration*(ground?.7:1),gravity:CUT.bombDebrisGravity,
    pieces:bombDebris(event.id,count,CUT.bombDebrisSpeed*(ground?.7:1),CUT.bombDebrisSize*(ground?.7:1),ground),duration:12};
}
export function bombBurstDuration(b,view,ground){
  const height=Math.max(0,(ground*view.sy-b.y*view.sy)/view.art);
  return Math.max(b.flashDuration,...b.pieces.map(p=>(Math.sqrt(p.vy*p.vy+2*b.gravity*height)-p.vy)/b.gravity))+.02;
}
const chargeBlues=FIRE_BLUE.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
function chargeColor(contract,gray){
  // The same two blues as the explosion: neutral -> saturated blue -> bright blue.
  const stage=contract<.55?0:1,t=clamp(stage?(contract-.55)/.45:contract/.55,0,1),mix=t*t*(3-2*t);
  const from=stage?chargeBlues[0]:[gray,gray,gray],to=chargeBlues[stage];
  return `rgb(${from.map((v,i)=>Math.round(v+(to[i]-v)*mix)).join(' ')})`;
}
export function drawBombCharge(ctx,m,time,point,scale,dark,reduced){
  const q=bombChargeAt(m,time);if(!q)return;
  const gray=reduced?(dark?176:100):(dark?96:80),r=Math.max(.5,(reduced?m.arm.radius*.25:q.radius)*scale);
  ctx.save();ctx.fillStyle=reduced?`rgb(${gray} ${gray} ${gray})`:chargeColor(q.contract,gray);ctx.globalAlpha=reduced?.18:q.opacity;
  ctx.beginPath();ctx.arc(point.x,point.y,r,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function drawBombBurst(ctx,b,time,project,metrics,ground){
  const age=time-b.time;if(age<0||age>=b.duration)return;
  const p=project(b.x,b.y),isGround=b.type==='bombGround',s=metrics.art,radius=b.radius*s;
  ctx.save();ctx.translate(p.x,p.y);
  if(age<b.flashDuration){
    const u=age/b.flashDuration,grow=metrics.reduced?1:1-(1-clamp(age/.065,0,1))**4,fade=(1-u)**1.4;
    for(let layer=0;layer<2;layer++){
      const r=radius*grow*(layer?.56:1)*(metrics.reduced?.65:1);
      ctx.fillStyle=FIRE_BLUE[layer];ctx.globalAlpha=(layer?.86:.65)*fade;ctx.beginPath();
      const start=isGround?Math.PI:0,range=isGround?Math.PI:Math.PI*2;
      for(let i=0;i<=40;i++){
        const a=start+i/40*range,lobe=1+.07*Math.sin(a*7+b.seed)+.035*Math.sin(a*11-b.seed),x=Math.cos(a)*r*lobe,y=Math.sin(a)*r*lobe*(isGround?.85:1);
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      }
      ctx.closePath();ctx.fill();
    }
    const ring=radius*(.3+grow*1.1);ctx.strokeStyle=FIRE_BLUE[1];ctx.globalAlpha=.8*fade;ctx.lineWidth=(1-u)*5*s+.5;
    ctx.beginPath();if(isGround)ctx.ellipse(0,0,ring,ring*.14,0,Math.PI,Math.PI*2);else ctx.arc(0,0,ring,0,Math.PI*2);ctx.stroke();
  }
  const floor=project(b.x,ground),height=Math.max(0,(floor.y-p.y)/s),step=metrics.reduced?3:1;
  for(let i=0;i<b.pieces.length;i+=step){
    const piece=b.pieces[i],q=bombDebrisAt(piece,age,height,b.gravity);if(!q)continue;
    ctx.save();ctx.translate(q.x*s,q.y*s);ctx.rotate(q.angle);ctx.globalAlpha=.85;ctx.fillStyle=FIRE_BLUE[i%2];
    const z=piece.size*s;ctx.beginPath();ctx.moveTo(-z*.7,-z*.3);ctx.lineTo(z*.5,-z*.45);ctx.lineTo(z*.65,z*.25);ctx.lineTo(-z*.25,z*.5);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.restore();
}
