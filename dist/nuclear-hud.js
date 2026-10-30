import {ScoreFeedback} from './score-feedback.js';
const encoded=seconds=>Math.floor(seconds/60)*100+seconds%60;
export class NuclearHUD{
  constructor(root,settings){this.root=root;this.settings=settings;this.feedback=new ScoreFeedback(settings);this.motion=root.querySelector('.nuclear-clock-motion');this.accessible=root.querySelector('.nuclear-clock-value');this.cells=[...root.querySelectorAll('.nuclear-clock-digit')].map(cell=>({cell,track:cell.firstElementChild,chars:[...cell.firstElementChild.children]}));this.reset();}
  reset(){this.serial=-1;this.seconds=null;this.time=null;this.feedback.reset(0);this.root.hidden=true;this.root.dataset.active='false';}
  render(state,time,reduced=false,available=true){
    if(!available||!state.enabled){this.reset();return;}
    this.root.hidden=false;const active=state.phase==='warning',presenting=active||state.phase==='retracting';this.root.dataset.active=String(active);this.root.setAttribute('aria-hidden',String(!active));
    if(this.time!==null)this.feedback.step(Math.max(0,time-this.time));this.time=time;
    const seconds=Math.ceil(state.remaining-1e-8);
    if(presenting&&(state.serial!==this.serial||seconds!==this.seconds)){
      if(state.serial!==this.serial)this.feedback.reset(encoded(seconds+1));
      const before=this.feedback.target,after=encoded(seconds);this.feedback.receive({before,after,delta:after-before,source:{key:'nuclear-timer',label:'核弹来袭',tone:'loss',emphasis:seconds<=5?'heavy':'light'}});this.seconds=seconds;this.serial=state.serial;
    }
    const frame=this.feedback.snapshot(reduced);this.motion.style.transform=`translateY(${frame.y}px) rotate(${frame.rotation}deg) scale(${frame.scale})`;this.root.dataset.urgent=String(seconds<=5);
    this.accessible.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    for(let i=0;i<3;i++){const d=frame.digits[2-i]??{position:0},base=Math.floor(d.position),fraction=d.position-base,{track,chars}=this.cells[i];for(let j=0;j<3;j++)chars[j].textContent=String(((base+j-1)%10+10)%10);track.style.transform=`translateY(${-1-fraction}em)`;}
  }
}
