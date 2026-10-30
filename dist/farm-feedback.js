import {FARM} from './farm.js';
const clamp=n=>Math.max(0,Math.min(1,n));
export class FarmFeedback{
  constructor(){this.reset();}
  reset(){this.items=[];}
  add(event){
    const seed=Math.sin(event.id*12.9898+event.harvest*78.233)*43758.5453,u=seed-Math.floor(seed),v=Math.sin(seed*3.7)*.5+.5;
    this.items.push({value:event.points,time:event.sceneTime,x:-125+u*300,y:-100-v*60});
    this.items=this.items.slice(-27);
  }
  snapshot(time,reduced=false){
    this.items=this.items.filter(p=>time-p.time<1.8);
    return this.items.map(p=>{const age=time-p.time,opacity=.72*Math.min(clamp(age/.18),clamp((1.8-age)/.38));return{...p,opacity,y:p.y-(reduced?0:Math.min(1,age/1.8)*25)};});
  }
  draw(ctx,g,time,reduced=false,dark=false){
    ctx.save();ctx.translate(g.x,g.y);ctx.scale(g.scale,g.scale);ctx.fillStyle=FARM.colors[dark?0:1];ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(32,22/g.scale)}px "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif`;
    for(const p of this.snapshot(time,reduced)){ctx.globalAlpha=p.opacity;ctx.fillText(`+${p.value}`,p.x,p.y);}
    ctx.restore();
  }
}
