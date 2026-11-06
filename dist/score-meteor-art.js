import {scoreFragmentView} from './score-meteor.js';
import {drawScoreGem} from './score-gem.js';
import {drawScoreShard} from './score-shard.js';
import {scoreAwardColor} from './score-award-style.js';
import {drawScoreCharge,drawScoreChargeCore} from './score-charge-art.js';
import {ScoreCombo} from './score-combo.js';
import {cutLineAt,cutSparksAt,cutScoreOffset,cutNumberOpacity} from './score-cut-feedback.js';
import {makeBombBurst,drawBombBurst,bombDebris} from './bomb-fx.js';
import {impactShakeAt} from './effects.js';
import {CUT} from './cut-settings.js';
import {SCORE_METEOR} from './score-meteor-rules.js';
const clamp=n=>Math.max(0,Math.min(1,n)),spark='#e3f5ff';
const landingNumberLife=.85;
function drawYellowStar(ctx,x,y,r,rotation,opacity){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.fillStyle='#ffd052';ctx.globalAlpha=opacity;
  ctx.beginPath();ctx.moveTo(0,-r*1.7);ctx.quadraticCurveTo(r*.18,-r*.18,r*1.1,0);ctx.quadraticCurveTo(r*.18,r*.18,0,r*1.7);ctx.quadraticCurveTo(-r*.18,r*.18,-r*1.1,0);ctx.quadraticCurveTo(-r*.18,-r*.18,0,-r*1.7);ctx.fill();
  ctx.fillStyle='#fff2b9';ctx.beginPath();ctx.moveTo(0,-r*.55);ctx.lineTo(r*.3,0);ctx.lineTo(0,r*.55);ctx.lineTo(-r*.3,0);ctx.closePath();ctx.fill();ctx.restore();
}
export function drawScoreMeteor(ctx,m,p,size,time,reduced=false){
  const charge=drawScoreCharge(ctx,m,p,size,time,reduced);
  const f=m.frenzy,age=f?time-f.lastCutAt:Infinity,kick=reduced||!f||age<0||age>.6?0:Math.exp(-age*15)*Math.sin(age*48),d=f?.direction??{x:0,y:0};
  const tilt=(m.tilt??0)+(f&&!reduced?(f.rotation??0)+kick*(d.x*.12-d.y*.08):0),compress=reduced?1:1-charge.contract*.24,tremor=reduced?0:Math.sin(time*90)*charge.contract*2.5;
  ctx.save();ctx.translate(p.x+tremor,p.y);ctx.rotate(tilt);ctx.scale((1-kick*.20)*compress,(1+kick*.17)*compress);drawScoreGem(ctx,size,reduced?0:time,m.id);ctx.restore();
  drawScoreChargeCore(ctx,p,size,charge,reduced);
}
export function drawScoreFragment(ctx,f,view,project){
  const q=scoreFragmentView(f,view),p=project(q.x/view.sx,q.y/view.sy),size=f.size*view.character*(view.zoom??1);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(f.angle);drawScoreShard(ctx,f,size,view.time??0);ctx.restore();
}
export class ScoreMeteorEffects{
  constructor(){this.clear();}
  clear(){this.cuts=[];this.bursts=[];this.numbers=[];this.combos=new Map();}
  event(e){
    if(e.type==='scoreMeteorCut'){
      this.cuts.push({...e});let combo=this.combos.get(e.id);if(!combo){combo=new ScoreCombo(e.id);this.combos.set(e.id,combo);}combo.update(e.cuts,e.time);
    }
    if(e.type==='scoreMeteorBurst'){
      const blast=makeBombBurst(e);
      blast.time=e.time;
      blast.shake=CUT.frenzyBlastShake;
      blast.shakeDuration=SCORE_METEOR.blastShakeDuration;
      blast.stars=bombDebris(e.id,32,1,11).map((star,index,stars)=>{
        const direction=e.id*.37+2*Math.PI*(index+.15+.7*star.angle/Math.PI)/stars.length;
        const reach=.28+.72*Math.hypot(star.vx,star.vy);
        return{x:Math.cos(direction)*reach,y:Math.sin(direction)*reach,size:star.size,angle:star.angle,spin:star.spin,life:.86+(index%8)*.04};
      });
      blast.duration=Math.max(blast.shakeDuration,blast.flashDuration,...blast.stars.map(star=>star.life));
      blast.pieces=[];
      this.bursts.push(blast);this.combos.delete(e.id);
    }
    if(e.type==='scoreFragmentLand')this.numbers.push({...e});
    this.cuts=this.cuts.slice(-18);this.bursts=this.bursts.slice(-8);this.numbers=this.numbers.slice(-45);
  }
  drawCombo(ctx,m,p,size,time,view,reduced){
    if(m.frenzy?.chargeStartedAt==null)this.combos.get(m.id)?.draw(ctx,p,size,time,view,reduced);
  }
  shakeAt(time,reduced=false){
    let best={dx:0,dy:0,envelope:0};if(reduced)return best;
    for(const burst of this.bursts){const q=impactShakeAt(time-burst.time,burst.shake,burst.shakeDuration);if(q.envelope>best.envelope)best=q;}return best;
  }
  draw(ctx,time,project,view,reduced=false,dark=false){
    this.cuts=this.cuts.filter(e=>time-e.time<.68);this.bursts=this.bursts.filter(e=>time-e.time<e.duration);this.numbers=this.numbers.filter(e=>time-e.time<landingNumberLife);
    const unit=view.art,zoom=view.zoom??1;
    for(const e of this.bursts){
      drawBombBurst(ctx,e,time,project,{...view,art:unit*zoom,reduced},view.ground??808);
      const age=time-e.time;
      if(reduced||age<0)continue;
      const p=project(e.x,e.y),reach=Math.min(440*unit,Math.min(view.width,view.height)*.46);
      const distance=reach*(1-(1-clamp(age/.95))**2);
      for(const star of e.stars){
        if(age>=star.life)continue;
        const fade=1-clamp((age-.22)/(star.life-.22));
        const radius=Math.max(2.4,star.size*unit)*(.7+.3*fade);
        drawYellowStar(ctx,p.x+star.x*distance,p.y+star.y*distance,radius,star.angle+star.spin*age,clamp(age/.025)*fade);
      }
    }
    ctx.save();ctx.lineCap='round';
    for(const e of this.cuts){
      const age=time-e.time;if(age<0)continue;
      const p=project(e.x,e.y),size=e.meteor.size*(e.meteor.bodyScale??1)*view.character*zoom,line=cutLineAt(e,size),fade=1-clamp(age/.12);
      if(age<.12){ctx.strokeStyle=spark;ctx.globalAlpha=fade;ctx.lineWidth=(reduced?2:5)*unit*zoom;ctx.beginPath();ctx.moveTo(p.x+line.x-line.dx*line.half,p.y+line.y-line.dy*line.half);ctx.lineTo(p.x+line.x+line.dx*line.half,p.y+line.y+line.dy*line.half);ctx.stroke();}
      if(!reduced)for(const dot of cutSparksAt(e,age,size,unit*zoom)){
        drawYellowStar(ctx,p.x+dot.x,p.y+dot.y,dot.radius,dot.rotation,dot.opacity);
      }
      const offset=cutScoreOffset(e),font=Math.max(25,35*unit),margin=font*offset.scale*1.45,x=Math.max(margin,Math.min(view.width-margin,p.x+offset.x*size)),y=Math.max(margin,Math.min(view.height-margin,p.y+offset.y*size-(reduced?0:age*48*unit)));
      ctx.save();ctx.translate(x,y);ctx.rotate(reduced?0:offset.rotation);const scale=offset.scale*(reduced?1:1+Math.sin(clamp(age/.17)*Math.PI)*.42);ctx.scale(scale,scale);ctx.globalAlpha=cutNumberOpacity(age);ctx.fillStyle=scoreAwardColor(e,reduced);ctx.shadowColor=dark?'#101620aa':'#30464770';ctx.shadowBlur=4*unit;ctx.textAlign='center';ctx.font=`900 ${font}px "Man Numbers", monospace`;ctx.fillText(`+${e.points}`,0,0);ctx.restore();
    }
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=dark?'#101620aa':'#30464770';ctx.shadowBlur=3*unit;
    for(const e of this.numbers){const age=time-e.time,p=project(e.x,e.y),scale=.82+(e.fragment.size/30)*.36;ctx.font=`900 ${Math.max(22,32*unit)*scale}px "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif`;ctx.fillStyle=scoreAwardColor(e,reduced);ctx.globalAlpha=.72*Math.min(clamp(age/.055),clamp((landingNumberLife-age)/.19));ctx.fillText(`+${e.points}`,p.x+Math.sin(e.id*2.4)*12*unit,p.y-(30+(reduced?0:age/landingNumberLife*18))*unit);}
    ctx.restore();
  }
}
