import {VOLCANO} from './volcano.js';
export class VolcanoSplash{
  constructor(){this.clear();}
  clear(){this.bursts=[];}
  add(event){
    const noise=i=>{const n=Math.sin(event.id*17.13+i*93.31)*43758.5453;return n-Math.floor(n);};
    this.bursts.push({x:event.x,y:event.y,time:event.sceneTime,pieces:Array.from({length:18},(_,i)=>({vx:(noise(i)-.5)*180,vy:-90-noise(i+30)*130,r:2+noise(i+60)*4,life:.75+noise(i+90)*.5,spin:noise(i+120)*6}))});
    this.bursts=this.bursts.slice(-9);
  }
  snapshot(time){
    this.bursts=this.bursts.filter(b=>time-b.time<1.25);return this.bursts.flatMap(b=>b.pieces.map(p=>{const age=time-b.time;if(age<0||age>=p.life)return null;return{x:b.x,y:b.y,dx:p.vx*age,dy:p.vy*age+210*age*age,r:p.r*Math.min(1,(p.life-age)/.2),angle:p.spin+age*3};}).filter(Boolean));
  }
  draw(ctx,time,project,metrics){
    ctx.save();ctx.globalAlpha=1;
    for(const p of this.snapshot(time)){const origin=project(p.x,p.y),s=metrics.art;ctx.save();ctx.translate(origin.x+p.dx*s,origin.y+p.dy*s);ctx.rotate(p.angle);ctx.fillStyle=VOLCANO.colors.lava;ctx.beginPath();ctx.ellipse(0,0,p.r*s,p.r*.7*s,0,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.restore();
  }
}
