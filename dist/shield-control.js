import {SHIELD_ART,drawToggleIcon} from './shield-art.js';
const names={ready:'护盾就绪',active:'护盾开启中',cooldown:'护盾冷却中'};
export class ShieldControl{
  constructor(root,onActivate){
    this.root=root;this.button=root.querySelector('.energy-toggle');this.thumb=root.querySelector('.toggle-thumb');
    this.icon=root.querySelector('canvas');this.context=this.icon.getContext('2d');this.icon.width=this.icon.height=60;this.context.setTransform(2,0,0,2,0,0);
    this.lastThumb=0;this.state=null;this.frame=null;this.available=false;this.reduced=false;
    this.button.addEventListener('click',()=>{if(this.available&&this.frame?.state==='ready')onActivate();});
  }
  render(frame,{available=true,inspect=false}={}){
    this.frame=frame;this.available=available;this.root.dataset.state=frame.state;this.root.dataset.inspect=String(inspect);
    this.button.disabled=!available;this.button.setAttribute('aria-disabled',String(!available||frame.state!=='ready'));this.button.setAttribute('aria-pressed',String(frame.state==='active'));
    this.button.style.setProperty('--toggle-color',frame.toggleColor);
    this.button.setAttribute('aria-label',frame.state==='ready'?'护盾就绪':frame.state==='cooldown'?`护盾冷却中，已恢复 ${Math.round(frame.recharge*100)}%`:names.active);
    this.icon.className=`state-symbol symbol-${frame.state}`;drawToggleIcon(this.context,frame);
    const target=frame.state==='active'?74:0;
    this.button.style.setProperty('--thumb-x',`${target}px`);
    if(this.reduced!==frame.reduced){this.thumb.getAnimations().forEach(a=>a.cancel());this.reduced=frame.reduced;}
    if(this.state!==frame.state){
      this.thumb.getAnimations().forEach(a=>a.cancel());
      if(!frame.reduced&&target!==this.lastThumb)this.thumb.animate([
        {transform:`translateX(${this.lastThumb}px) scale(1,1)`,offset:0},
        {transform:`translateX(${this.lastThumb+(target-this.lastThumb)*.52}px) scale(1.14,.88)`,offset:.38},
        {transform:`translateX(${target+(target>this.lastThumb?4:-4)}px) scale(.94,1.06)`,offset:.78},
        {transform:`translateX(${target}px) scale(1,1)`,offset:1},
      ],{duration:SHIELD_ART.thumb*1000,easing:'cubic-bezier(.4,0,.25,1)'});
      this.lastThumb=target;this.state=frame.state;
    }
  }
}
