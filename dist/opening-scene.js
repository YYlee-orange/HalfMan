import {drawBackground} from './background.js';
const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
export const OPENING=Object.freeze({duration:2.3,reducedDuration:.18,
  food:{start:0,charge:.13,exit:.28},radar:{start:.12,charge:.13,exit:.30},shelter:{start:.24,charge:.13,exit:.31},
  uiStart:.40,uiDuration:.32,glyphStart:.80,glyphDuration:.40,cutStart:1.20,cutDuration:.32,
  invertStart:1.36,invertDuration:.46,doorStart:1.76,doorDuration:.54});
const progress=(time,start,duration)=>clamp((time-start)/duration);
export function buildingExit(kind,time,width,height,art){
  const t=OPENING[kind],age=time-t.start;
  if(age<=0)return{visible:true,dx:0,dy:0,sx:1,sy:1};
  if(age>=t.charge+t.exit)return{visible:false,dx:0,dy:0,sx:1,sy:1};
  const vertical=kind==='food',direction=kind==='shelter'?-1:1;
  let x=0,y=0,sx=1,sy=1;
  if(age<t.charge){
    const u=smooth(age/t.charge),squash=mix(1,.55,u),spread=mix(1,1.65,u);
    sx=vertical?spread:squash;sy=vertical?squash:spread;
    if(vertical)y=-22*art*u;else x=-direction*24*art*u;
  }else{
    const u=clamp((age-t.charge)/t.exit),release=1-(1-u)**2;
    const recovery=u<.35?smooth(u/.35):smooth((u-.35)/.65);
    const axis=u<.35?mix(.55,1.28,recovery):mix(1.28,1,recovery),other=u<.35?mix(1.65,.78,recovery):mix(.78,1,recovery);
    sx=vertical?other:axis;sy=vertical?axis:other;
    if(vertical)y=mix(-22*art,height*.35+220*art,release);
    else x=direction*mix(-24*art,width*(kind==='radar'?.48:.36)+350*art,release);
  }
  return{visible:true,dx:x,dy:y,sx,sy};
}
export class OpeningScene{
  constructor(){this.reset();}
  reset(){this.mode='title';this.time=0;this.idleTime=0;this.fromDark=false;this.reduced=false;this.paused=false;}
  get duration(){return this.reduced?OPENING.reducedDuration:OPENING.duration;}
  begin(dark=false,reduced=false){if(this.mode!=='title')return false;this.mode='transition';this.time=0;this.fromDark=dark;this.reduced=reduced;this.paused=false;return true;}
  enterGame(){this.mode='game';this.time=this.duration;this.paused=false;}
  step(dt){
    if(this.mode==='game'||this.paused||!Number.isFinite(dt)||dt<=0)return false;
    this.idleTime+=dt;if(this.mode==='title')return false;
    this.time=Math.min(this.duration,this.time+dt);return this.time>=this.duration-1e-9;
  }
  snapshot(width,height,art=1){
    const active=this.mode==='transition',t=active?this.time:-1;
    const ui=active?this.reduced?clamp(t/this.duration):smooth(progress(t,OPENING.uiStart,OPENING.uiDuration)):0;
    const doors=active&&!this.reduced?1-(1-progress(t,OPENING.doorStart,OPENING.doorDuration))**3:0;
    return{mode:this.mode,time:this.time,duration:this.duration,fromDark:this.fromDark,toDark:!this.fromDark,reduced:this.reduced,paused:this.paused,
      buildings:Object.fromEntries(['food','radar','shelter'].map(k=>[k,buildingExit(k,this.reduced?-1:t,width,height,art)])),
      uiProgress:ui,uiGone:ui>=1,glyphVisible:active&&!this.reduced&&t>=OPENING.glyphStart,
      glyphProgress:active?1-(1-progress(t,OPENING.glyphStart,OPENING.glyphDuration))**3:0,
      cutProgress:active?progress(t,OPENING.cutStart,OPENING.cutDuration):0,
      invertProgress:active?smooth(progress(t,OPENING.invertStart,OPENING.invertDuration)):0,
      doorProgress:doors,revealing:active&&(this.reduced||t>=OPENING.doorStart),
      backgroundOnly:active&&!this.reduced&&t>=OPENING.uiStart+OPENING.uiDuration&&t<OPENING.glyphStart};
  }
}
const skins=[{paper:'#f7f8f5',ink:'#292d2b'},{paper:'#191e1c',ink:'#e5eae4'}];
export function inversionEdges(amount,y,width,height){
  const p=clamp(amount),feather=Math.min(210,width*.28),amplitude=Math.min(90,width*.075,height*.14),z=y/Math.max(1,height);
  const reach=p*(width/2+feather+amplitude),envelope=Math.sin(Math.PI*p);
  const edge=side=>{
    const phase=side<0?.35:2.1;
    const wave=.60*Math.sin(z*6.1+phase+p*1.1)+.28*Math.sin(z*12.9-phase*.7-p*.6)+.12*Math.sin(z*21.7+phase*1.3);
    return width/2+side*(reach+amplitude*envelope*wave);
  };
  return{left:edge(-1),right:edge(1),feather};
}
export function inversionAlpha(x,edges,width){
  const distance=x<width/2?x-edges.left:edges.right-x;
  return smooth(clamp(distance/Math.max(1,edges.feather)));
}
export class OpeningRenderer{
  constructor(makeCanvas=()=>document.createElement('canvas')){this.panel=makeCanvas();this.inverse=makeCanvas();this.mask=makeCanvas();this.maskImage=null;this.maskAmount=-1;this.maskWidth=0;this.maskHeight=0;this.width=0;this.height=0;this.ratio=0;}
  resize(width,height,dpr){
    const ratio=Math.min(dpr,2,2560/Math.max(width,height));if(width===this.width&&height===this.height&&ratio===this.ratio)return;
    this.width=width;this.height=height;this.ratio=ratio;
    for(const c of [this.panel,this.inverse]){c.width=Math.ceil(width*ratio);c.height=Math.ceil(height*ratio);}
  }
  updateMask(width,height,amount){
    const w=Math.max(2,Math.min(256,Math.ceil(width/4))),h=Math.max(2,Math.min(256,Math.ceil(height/4))),ctx=this.mask.getContext('2d');
    if(this.mask.width!==w||this.mask.height!==h||!this.maskImage){this.mask.width=w;this.mask.height=h;this.maskImage=ctx.createImageData(w,h);this.maskAmount=-1;}
    if(this.maskAmount===amount&&this.maskWidth===width&&this.maskHeight===height)return;
    const data=this.maskImage.data;
    // A small procedural alpha field, interpolated at display size, avoids straight
    // clipping edges and the cost of blurring full-resolution scene layers.
    for(let row=0;row<h;row++){
      const edges=inversionEdges(amount,(row+.5)/h*height,width,height);
      for(let column=0;column<w;column++){
        const i=(row*w+column)*4;data[i]=data[i+1]=data[i+2]=255;
        data[i+3]=Math.round(inversionAlpha((column+.5)/w*width,edges,width)*255);
      }
    }
    ctx.putImageData(this.maskImage,0,0);this.maskAmount=amount;this.maskWidth=width;this.maskHeight=height;
  }
  paint(ctx,frame,{width,height,sky,glyph,path,reduced},dark){
    const skin=skins[Number(dark)],size=Math.min(190,width*.42,height*.30);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=skin.paper;ctx.fillRect(0,0,width,height);
    const emphasis=frame.mode==='transition'&&!reduced?1+.85*smooth(progress(frame.time,OPENING.glyphStart-.12,.24)):1;
    drawBackground(ctx,sky,{width,height,dark,reduced,emphasis});
    if(frame.glyphVisible&&glyph&&path){
      const y=mix(-size,height/2,frame.glyphProgress);ctx.save();ctx.translate(width/2,y);ctx.scale(size/glyph.height,size/glyph.height);
      ctx.translate(-glyph.width/2,-glyph.height/2);ctx.fillStyle=skin.ink;ctx.fill(path);ctx.restore();
    }
    if(frame.cutProgress>0){
      const unit=Math.max(.7,Math.min(width/1440,height/810));ctx.save();ctx.strokeStyle=skin.ink;ctx.lineWidth=Math.max(3.5,5*unit);
      ctx.setLineDash([14*unit,11*unit]);ctx.lineDashOffset=-frame.cutProgress*14*unit;
      ctx.beginPath();ctx.moveTo(width/2,0);ctx.lineTo(width/2,height*frame.cutProgress);ctx.stroke();ctx.restore();
    }
  }
  draw(ctx,frame,options){
    const {width,height,dpr=1,dark,drawBuilding}=options;ctx.clearRect(0,0,width,height);
    if(frame.mode==='game')return;
    const original=frame.mode==='title'?dark:frame.fromDark;
    if(!frame.glyphVisible){
      ctx.save();if(frame.reduced&&frame.mode==='transition')ctx.globalAlpha=1-frame.uiProgress;
      // Paint a single isolated title scene. The game renderer never supplies its entities here.
      if(frame.reduced&&frame.mode==='transition'){
        this.resize(width,height,dpr);const p=this.panel.getContext('2d');p.setTransform(this.ratio,0,0,this.ratio,0,0);this.paint(p,frame,options,original);
        for(const kind of ['shelter','food','radar'])drawBuilding(kind,p,frame.buildings[kind]);ctx.drawImage(this.panel,0,0,width,height);
      }else{this.paint(ctx,frame,options,original);for(const kind of ['shelter','food','radar'])if(frame.buildings[kind].visible)drawBuilding(kind,ctx,frame.buildings[kind]);}
      ctx.restore();return;
    }
    this.resize(width,height,dpr);
    const p=this.panel.getContext('2d'),q=this.inverse.getContext('2d');
    p.setTransform(this.ratio,0,0,this.ratio,0,0);this.paint(p,frame,options,original);
    if(frame.invertProgress>0){
      q.setTransform(this.ratio,0,0,this.ratio,0,0);this.paint(q,frame,options,!original);
      this.updateMask(width,height,frame.invertProgress);
      q.save();q.globalCompositeOperation='destination-in';q.imageSmoothingEnabled=true;q.imageSmoothingQuality='high';q.drawImage(this.mask,0,0,width,height);q.restore();
      p.drawImage(this.inverse,0,0,width,height);
    }
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*(width/2+24)*frame.doorProgress,0);ctx.beginPath();ctx.rect(side<0?0:width/2,0,width/2,height);ctx.clip();ctx.drawImage(this.panel,0,0,width,height);ctx.restore();
    }
  }
}
