export class CannonCoolingHUD{
  constructor(root){this.root=root;this.label=root.querySelector('.cannon-cooling-label');this.shown=false;this.serial=0;this.reduced=false;}
  update(show,reduced=false,immediate=false){
    const motionChanged=this.reduced!==reduced;this.reduced=reduced;
    if(show===this.shown&&!motionChanged&&(!immediate||this.root.hidden===!show))return;this.shown=show;const serial=++this.serial;
    const style=getComputedStyle(this.root),start={opacity:this.root.hidden?'0':style.opacity,transform:this.root.hidden?'scale(.25)':style.transform};
    for(const node of [this.root,this.label])node.getAnimations().forEach(a=>a.cancel());
    if(reduced||immediate){this.root.hidden=!show;this.root.style.opacity=show?'1':'0';this.root.style.transform=show?'scale(1)':'scale(.25)';this.label.style.opacity=show?'1':'0';this.label.style.transform='none';return;}
    this.root.hidden=false;
    const frames=show?[start,{opacity:1,transform:'scale(1.16)',offset:.55},{opacity:1,transform:'scale(.95)',offset:.8},{opacity:1,transform:'scale(1)'}]:[start,{opacity:.9,transform:'scale(1.06)',offset:.2},{opacity:0,transform:'scale(.25)'}];
    const motion=this.root.animate(frames,{duration:show?440:270,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'});
    this.label.animate(show?[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(-2px)',offset:.75},{opacity:1,transform:'translateY(0)'}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],{duration:show?320:170,delay:show?70:0,fill:'forwards',easing:'cubic-bezier(.2,0,.2,1)'});
    motion.finished.then(()=>{if(serial===this.serial&&!this.shown)this.root.hidden=true;}).catch(()=>{});
  }
}
