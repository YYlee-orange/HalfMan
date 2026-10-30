import {drawBackground} from './background.js';
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>n*n*(3-2*n);
export const SCENE_TRANSITION=Object.freeze({close:.28,hold:.24,cutPause:.10,open:.28,reducedClose:.07,reducedHold:.02,reducedOpen:.07});
const skins=[{paper:'#f7f8f5',ink:'#292d2b'},{paper:'#191e1c',ink:'#e5eae4'}];

// A reusable cover/swap/reveal clock. It knows nothing about routes or GameModel.
export class SceneTransition{
  constructor(){this.active=false;this.time=0;this.paused=false;this.covered=false;this.reduced=false;this.fromDark=false;this.onCovered=null;this.onComplete=null;}
  begin({dark=false,reduced=false,onCovered=()=>{},onComplete=()=>{}}={}){
    if(this.active)return false;
    Object.assign(this,{active:true,time:0,paused:false,covered:false,reduced,fromDark:dark,onCovered,onComplete});return true;
  }
  get timings(){return this.reduced?{close:SCENE_TRANSITION.reducedClose,hold:SCENE_TRANSITION.reducedHold,cutPause:0,open:SCENE_TRANSITION.reducedOpen}:SCENE_TRANSITION;}
  get duration(){const t=this.timings;return t.close+t.hold+t.cutPause+t.open;}
  step(dt){
    if(!this.active||this.paused||!Number.isFinite(dt)||dt<=0)return;
    const end=Math.min(this.duration,this.time+dt);
    if(!this.covered&&end+1e-9>=this.timings.close){
      this.time=this.timings.close;this.covered=true;const callback=this.onCovered;this.onCovered=null;callback?.();
    }
    this.time=end;
    if(this.time+1e-9>=this.duration){this.time=this.duration;this.active=false;const callback=this.onComplete;this.onComplete=null;callback?.();}
  }
  snapshot(){
    const {close,hold,cutPause,open}=this.timings,t=this.time,revealAt=close+hold+cutPause;
    const phase=!this.active?'idle':t<close?'closing':t<close+hold?'covered':t<revealAt?'cut-pause':'opening';
    const coverage=!this.active?0:t<close?smooth(clamp(t/close)):t<revealAt?1:1-smooth(clamp((t-revealAt)/open));
    // The cut reaches the bottom before the additional closed-door pause begins.
    const cutProgress=!this.active||t<close?0:this.reduced?1:clamp((t-close)/hold);
    return{active:this.active,time:t,duration:this.duration,phase,coverage,cutProgress,covered:this.covered,paused:this.paused,reduced:this.reduced,fromDark:this.fromDark,layerDark:!this.fromDark};
  }
}

export function transitionSeam(width,height){
  const cx=width/2,size=Math.min(190,width*.42,height*.30);
  return{cx,size,amplitude:0,segments:[['L',cx,height]]};
}
function clipPanel(ctx,side,width,height,seam,overlap){
  const edge=side<0?-2:width+2,offset=side<0?overlap:-overlap;
  ctx.beginPath();ctx.moveTo(edge,-2);ctx.lineTo(seam.cx+offset,-2);ctx.lineTo(seam.cx+offset,0);
  ctx.lineTo(seam.cx+offset,height);
  ctx.lineTo(seam.cx+offset,height+2);ctx.lineTo(edge,height+2);ctx.closePath();ctx.clip();
}
export class SceneTransitionRenderer{
  constructor(makeCanvas=()=>document.createElement('canvas')){this.panel=makeCanvas();this.width=0;this.height=0;this.ratio=0;}
  resize(width,height,dpr){
    const ratio=Math.min(dpr,2,2560/Math.max(width,height));
    if(width===this.width&&height===this.height&&ratio===this.ratio)return;
    this.width=width;this.height=height;this.ratio=ratio;this.panel.width=Math.ceil(width*ratio);this.panel.height=Math.ceil(height*ratio);
  }
  draw(ctx,frame,{width,height,dpr=1,sky,glyph,path}){
    ctx.clearRect(0,0,width,height);if(!frame.active||frame.coverage<=0)return;
    this.resize(width,height,dpr);
    const p=this.panel.getContext('2d'),skin=skins[Number(frame.layerDark)],seam=transitionSeam(width,height);
    p.setTransform(this.ratio,0,0,this.ratio,0,0);p.globalAlpha=1;p.globalCompositeOperation='source-over';p.fillStyle=skin.paper;p.fillRect(0,0,width,height);
    drawBackground(p,sky,{width,height,dark:frame.layerDark,reduced:frame.reduced,emphasis:1.85});
    if(glyph&&path){p.save();p.translate(width/2,height/2);p.scale(seam.size/glyph.height,seam.size/glyph.height);p.translate(-glyph.width/2,-glyph.height/2);p.fillStyle=skin.ink;p.fill(path);p.restore();}
    if(frame.cutProgress>0){
      const unit=Math.max(.7,Math.min(width/1440,height/810)),head=height*frame.cutProgress;
      p.save();p.strokeStyle=skin.ink;p.lineWidth=6*unit;p.lineCap='butt';p.setLineDash([18*unit,12*unit]);
      p.beginPath();p.moveTo(width/2,0);p.lineTo(width/2,head);p.stroke();
      // A solid moving tip makes the contact with the screen bottom unambiguous,
      // even when the repeating dash pattern would otherwise end inside a gap.
      p.setLineDash([]);p.beginPath();p.moveTo(width/2,Math.max(0,head-9*unit));p.lineTo(width/2,head);p.stroke();p.restore();
    }
    if(frame.reduced){ctx.save();ctx.globalAlpha=frame.coverage;ctx.drawImage(this.panel,0,0,width,height);ctx.restore();return;}
    const distance=(width/2+seam.amplitude+8)*(1-frame.coverage);
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*distance,0);
      // Identical content under the subpixel overlap prevents a hairline at closure.
      clipPanel(ctx,side,width,height,seam,.75/this.ratio);ctx.drawImage(this.panel,0,0,width,height);ctx.restore();
    }
  }
}
