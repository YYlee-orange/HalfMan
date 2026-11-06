import {ScoreFeedback} from './score-feedback.js';
import {CUT} from './cut-settings.js';
import {scoreCutColor} from './score-award-style.js';
export class ScoreCombo{
  constructor(id){this.id=id;this.feedback=new ScoreFeedback(CUT);this.changedAt=0;}
  update(value,time){this.feedback.time=time;this.feedback.retarget(value);this.changedAt=time;}
  snapshot(time,reduced=false){
    this.feedback.time=time;const age=Math.max(0,time-this.changedAt),pulse=reduced?0:Math.exp(-age*11)*Math.sin(age*26);
    const value=this.feedback.target,color=scoreCutColor(this.id,value,reduced?0:this.changedAt);
    return{value,color,digits:reduced?String(value).split('').reverse().map((n,index)=>({index,position:Number(n),opacity:1})):this.feedback.digits(),sx:1+pulse*.7,sy:1-pulse*.35,rotation:-.10+Math.sin(this.id*2.3)*.045+(reduced?0:pulse*.08)};
  }
  draw(ctx,point,size,time,view,reduced=false){
    const s=this.snapshot(time,reduced),font=Math.max(36,size*.31),cell=font*.66,n=s.digits.length,w=cell*n;
    const x=Math.max(w*.5+10,Math.min(view.width-w*.5-12,point.x+size*.64+w*.5)),y=Math.max(font+22,Math.min(view.height-font,point.y-size*.03));
    ctx.save();ctx.translate(x,y);ctx.rotate(s.rotation);ctx.scale(s.sx,s.sy);ctx.fillStyle=s.color;ctx.shadowColor='#30464770';ctx.shadowBlur=3;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(16,font*.34)}px "Microsoft YaHei", sans-serif`;ctx.fillText('连击',0,-font*.85);
    ctx.font=`${font}px "Man Numbers", monospace`;
    for(const digit of s.digits){
      const px=(n-1-digit.index)*cell-w/2,base=Math.floor(digit.position),fraction=digit.position-base;
      ctx.save();ctx.globalAlpha=digit.opacity;ctx.beginPath();ctx.rect(px,-font*.6,cell,font*1.2);ctx.clip();
      for(let j=0;j<3;j++)ctx.fillText(String(((base+j-1)%10+10)%10),px+cell/2,(j-1-fraction)*font*1.2);ctx.restore();
    }
    ctx.restore();
  }
}
