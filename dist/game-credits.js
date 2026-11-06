const FINAL_HOLD=8;
const TRACK_DURATION=227.254;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function creditsOffset(elapsed,duration,distance,viewport){
  const end=Math.max(0,duration-FINAL_HOLD);
  if(elapsed>=end)return distance;
  const time=clamp(elapsed,0,end),settle=Math.min(5,end/3),remaining=end-time;
  // Start with enough travel to bring the title into view, then ease into the final stop.
  const lead=Math.min(distance*.18,viewport*.36);
  const opening=1-(1-clamp(time/Math.min(15,end/3),0,1))**3;
  const crawl=remaining<settle?1-remaining**2/(2*settle*(end-settle/2)):time/(end-settle/2);
  return lead*opening+(distance-lead)*crawl;
}

export class GameCredits{
  constructor(root,audio,onComplete){
    this.root=root;this.audio=audio;this.onComplete=onComplete;
    this.track=root.querySelector('.credits-track');
    this.mark=root.querySelector('.credits-mark svg');
    this.finalLine=root.querySelector('#credits-final-line');
    this.skip=root.querySelector('#credits-skip');
    this.retry=root.querySelector('#credits-play');
    this.notice=root.querySelector('#credits-audio-notice');
    this.request=0;
    this.skip.addEventListener('click',()=>this.finish(true));
    this.retry.addEventListener('click',()=>this.play());
    audio.addEventListener('error',()=>{if(this.active&&!this.finished)this.useSilentClock();});
    audio.addEventListener('ended',()=>this.finish());
    const observer=new ResizeObserver(()=>{if(this.active)this.measure();});
    observer.observe(root);observer.observe(this.track);
  }
  get duration(){return Number.isFinite(this.audio.duration)&&this.audio.duration>FINAL_HOLD?this.audio.duration:TRACK_DURATION;}
  show(glyph,dark){
    this.active=true;this.finished=false;this.silent=false;this.elapsed=0;this.offset=null;
    this.skip.disabled=false;
    this.root.dataset.dark=String(dark);this.root.hidden=false;
    this.mark.setAttribute('viewBox',`0 0 ${glyph.width} ${glyph.height}`);
    this.mark.querySelector('path').setAttribute('d',glyph.path);
    this.measure();
  }
  measure(){
    const track=this.track.getBoundingClientRect(),last=this.finalLine.getBoundingClientRect();
    this.viewport=this.root.clientHeight;
    this.distance=Math.max(0,last.top-track.top+last.height/2-this.viewport/2);
    this.render();
  }
  play(){
    if(!this.active||this.finished)return;
    this.retry.hidden=true;this.wantsPlayback=true;
    if(this.silent||this.paused)return;
    if(this.audio.error){this.useSilentClock();return;}
    const request=++this.request;
    this.audio.play().catch(error=>{
      if(this.request!==request||this.finished||this.silent)return;
      if(error.name==='NotAllowedError'){this.wantsPlayback=false;this.retry.hidden=false;}
      else this.useSilentClock();
    });
  }
  useSilentClock(){
    this.silent=true;this.audio.pause();this.retry.hidden=true;this.notice.hidden=false;
  }
  setPaused(paused){
    this.paused=paused;
    if(!this.active||this.finished)return;
    if(paused){this.request++;this.audio.pause();}
    else if(this.wantsPlayback)this.play();
  }
  render(){
    const offset=creditsOffset(this.elapsed,this.duration,this.distance,this.viewport);
    if(offset===this.offset)return;
    this.offset=offset;this.track.style.transform=`translateY(${-offset}px)`;
  }
  step(dt){
    if(!this.active||this.paused||this.finished)return;
    this.elapsed=this.silent?Math.min(this.duration,this.elapsed+dt):this.audio.currentTime;
    this.render();
    if(this.silent&&this.elapsed>=this.duration)this.finish();
  }
  finish(skipped=false){
    if(!this.active||this.finished)return;
    this.finished=true;this.request++;this.wantsPlayback=false;
    this.audio.pause();this.skip.disabled=true;this.retry.hidden=true;
    if(!skipped){this.elapsed=this.duration;this.render();}
    this.onComplete();
  }
  reset(){
    this.request++;this.active=false;this.wantsPlayback=false;this.finished=false;this.elapsed=0;
    this.audio.pause();this.audio.currentTime=0;
    this.root.hidden=true;this.retry.hidden=true;this.notice.hidden=true;
  }
  snapshot(){return {active:!!this.active,elapsed:this.elapsed??0,duration:this.duration,offset:this.offset??0,distance:this.distance??0,playing:this.active&&!this.audio.paused,finished:!!this.finished};}
}
