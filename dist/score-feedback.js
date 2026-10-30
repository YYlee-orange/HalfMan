const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mod=x=>((x%10)+10)%10;
const ease=x=>1-(1-clamp(x,0,1))**3;
const lerp=(a,b,t)=>a+(b-a)*t;
export const SCORE_DEFAULTS=Object.freeze({scoreGainScale:1.32,scoreHeavyScale:1.48,scoreRotation:3,scoreRoll:.18,scoreSourceLife:.9,scoreMerge:.25,scoreCooldown:.2});
export const signedScore=value=>`${value<0?'−':'+'}${Math.abs(value)}`;
const countLabel=s=>s.unit?`${s.label} ${s.count}${s.unit}`:`${s.label}${s.count>1?` ×${s.count}`:''}`;
function keyframe(age,frames){
  if(age<=frames[0][0])return frames[0][1];
  for(let i=1;i<frames.length;i++)if(age<frames[i][0]){const [a,x]=frames[i-1],[b,y]=frames[i];return lerp(x,y,ease((age-a)/(b-a)));}
  return frames.at(-1)[1];
}
export class ScoreFeedback{
  constructor(settings=SCORE_DEFAULTS){this.settings=settings;this.reset();}
  reset(value=0){this.time=0;this.target=value;this.roll=null;this.pulse=null;this.groups=[];this.sequence=0;this.lastPunch=-Infinity;}
  digits(){
    if(!this.roll)return String(this.target).split('').reverse().map((n,index)=>({index,position:Number(n),opacity:1}));
    const t=clamp((this.time-this.roll.time)/this.roll.duration,0,1),u=ease(t);
    return this.roll.digits.map(d=>({...d,position:lerp(d.from,d.to,u),opacity:lerp(d.alpha,d.visible?1:0,u)})).filter(d=>t<1||d.visible);
  }
  retarget(value){
    if(value===this.target)return;
    const direction=Math.sign(value-this.target),old=this.digits(),next=String(value).split('').reverse();
    this.roll={time:this.time,duration:Math.min(.22,Math.max(.05,this.settings.scoreRoll)),digits:Array.from({length:Math.max(old.length,next.length)},(_,i)=>{
      const from=old[i]?.position??0,wanted=Number(next[i]??0),diff=direction>0?mod(wanted-mod(from)):-mod(mod(from)-wanted);
      return{index:i,from,to:from+diff,alpha:old[i]?.opacity??0,visible:i<next.length};
    })};this.target=value;
  }
  receive(change){
    if(!change||!Number.isFinite(change.after)||change.after<0)return;
    this.retarget(change.after);
    const source=change.source??{key:'other',label:'分数变化',count:1},direction=change.delta>0?1:change.delta<0?-1:source.tone==='gain'?1:-1;
    const heavy=source.emphasis==='heavy',level=heavy?3:direction>0?2:1;
    if(change.delta!==0){
      if(this.time-this.lastPunch>=this.settings.scoreCooldown||level>(this.pulse?.level??0)){
        this.pulse={time:this.time,level,direction,boost:0};this.lastPunch=this.time;
      }else if(this.pulse)this.pulse.boost=clamp(this.pulse.boost+.035,0,.12);
    }
    let row=this.groups.find(r=>r.direction===direction);
    if(!row||this.time-row.lastAt>this.settings.scoreMerge){
      row={id:++this.sequence,direction,created:this.time,lastAt:this.time,punchAt:this.time,delta:0,after:change.after,heavy:false,sources:new Map(),components:new Map(),clipped:false};
      this.groups=this.groups.filter(r=>r.direction!==direction);this.groups.push(row);
    }
    if(this.time-row.punchAt>=this.settings.scoreCooldown)row.punchAt=this.time;
    row.lastAt=this.time;row.delta+=change.delta;row.after=change.after;row.heavy||=heavy;row.clipped||=!!change.clipped;
    const key=source.key??source.label,entry=row.sources.get(key);
    if(entry)entry.count+=(source.count??1);else row.sources.set(key,{...source,count:source.count??1});
    for(const p of source.components??[]){const current=row.components.get(p.key??p.label);if(current){current.value+=p.value;current.count=(current.count??0)+(p.count??0);}else row.components.set(p.key??p.label,{...p});}
  }
  step(dt){this.time+=Math.max(0,dt);this.groups=this.groups.filter(r=>this.time-r.lastAt<(r.heavy?Math.max(1.4,this.settings.scoreSourceLife):this.settings.scoreSourceLife));}
  settle(value=this.target){this.target=value;this.roll=null;this.pulse=null;this.groups=[];}
  snapshot(reduced=false){
    const p=this.pulse,age=p?this.time-p.time:Infinity,heavy=p?.level===3,gain=p?.direction>0;
    const peak=clamp((heavy?this.settings.scoreHeavyScale:gain?this.settings.scoreGainScale:1.14)+(p?.boost??0),1,Math.max(this.settings.scoreGainScale,this.settings.scoreHeavyScale));
    const scale=reduced?1:keyframe(age,heavy?[[0,1],[.05,.84],[.11,peak],[.23,.94],[.38,1]]:[[0,1],[.055,peak],[.15,.95],[.30,1]]);
    const rotation=reduced?0:keyframe(age,[[0,0],[heavy?.11:.055,(heavy?1.33:gain?-1:.67)*this.settings.scoreRotation],[.17,(gain?.33:-.25)*this.settings.scoreRotation],[heavy?.38:.30,0]]);
    const y=reduced?0:keyframe(age,[[0,0],[heavy?.11:.055,heavy?9:gain?-5:5],[heavy?.23:.15,gain?1:2],[heavy?.38:.30,0]]);
    const flash=p?keyframe(age,[[0,0],[.06,1],[heavy?.45:.30,0]]):0;
    return{target:this.target,digits:reduced?String(this.target).split('').reverse().map((n,index)=>({index,position:Number(n),opacity:1})):this.digits(),scale,rotation,y,flash,tone:heavy?'heavy':gain?'gain':'loss',groups:this.groups.map(row=>{
      const life=row.heavy?Math.max(1.4,this.settings.scoreSourceLife):this.settings.scoreSourceLife,age=this.time-row.created,lastAge=this.time-row.lastAt,entry=ease(age/.16),punch=this.time-row.punchAt;
      const details=[...row.components.values()];
      return{id:row.id,direction:row.direction,tone:row.heavy?'heavy':row.direction>0?'gain':'loss',label:[...row.sources.values()].map(countLabel).join(' · '),
        amount:row.delta===0?row.after===0?'0 分':'±0':signedScore(row.delta),
        detail:row.clipped?(row.after===0?'当前 0 分':'本次实际计入'):details.length>1?details.map(s=>`${s.unit?countLabel(s):s.label} ${signedScore(s.value)}`).join(' · '):'',
        opacity:Math.min(entry,clamp((life-lastAge)/.15,0,1)),y:reduced?0:(1-entry)*18*row.direction-Math.max(0,(lastAge-life+.15)/.15)*8*row.direction,
        scale:reduced?1:keyframe(punch,[[0,.72],[.065,row.heavy?1.55:1.4],[.16,.95],[.26,1]]),rotation:reduced?0:keyframe(punch,[[0,row.direction>0?-5:4],[.09,row.direction>0?-2:2],[.26,0]])};
    }).sort((a,b)=>b.id-a.id)};
  }
}
export function scorePanelLayout(width,height){
  const compact=width<=700||height<=520,w=Math.min(compact?224:300,width-32),h=compact?166:208;
  const top=height<=520?86:Math.max(120,height*.14),margin=width<=700?18:32;
  return{top:Math.min(top,Math.max(80,height-h-12)),right:margin,width:w,compact};
}
