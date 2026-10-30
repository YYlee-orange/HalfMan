export const NUCLEAR_RULES=Object.freeze({chance:.003,bombThreshold:8,warning:45,iconWarning:10,iconPeriod:2,launchGap:.2,cooldown:30,gravity:480,initialSpeed:80,bombHeight:164,cloudLife:6,shake:82,shakeDuration:1.35});
export const nuclearBombScale=view=>Math.max(.65,Math.min(1.25,view.art));
export class NuclearStrike{
  constructor(enabled=false){this.enabled=enabled;this.phase='idle';this.warningAt=null;this.countdownAt=null;this.launchAt=null;this.cooldownUntil=-Infinity;this.handled=0;this.serial=0;this.explosions=0;this.bomb=null;this.processed=new Set();this.reason=null;}
  canTrigger(time){return this.enabled&&time+1e-9>=this.cooldownUntil&&!['warning','retracting','falling'].includes(this.phase);}
  request(time,force=false,reason='editor'){
    if(!this.enabled||!force&&!this.canTrigger(time))return false;
    this.phase='warning';this.warningAt=time;this.countdownAt=time+NUCLEAR_RULES.warning;this.launchAt=this.countdownAt+NUCLEAR_RULES.launchGap;this.cooldownUntil=time+NUCLEAR_RULES.cooldown;this.handled=0;this.bomb=null;this.reason=reason;this.serial++;return true;
  }
  chance(time,random){return this.canTrigger(time)&&random()<NUCLEAR_RULES.chance&&this.request(time,false,'chance');}
  noteBomb(id,time){
    if(this.processed.has(id))return false;this.processed.add(id);
    if(!this.canTrigger(time))return false;
    this.handled++;return this.handled>=NUCLEAR_RULES.bombThreshold&&this.request(time,false,'bombs');
  }
  step(time,view,ground){
    const events=[];
    if(this.phase==='warning'&&time+1e-9>=this.countdownAt)this.phase='retracting';
    if(this.phase==='retracting'&&time+1e-9>=this.launchAt){
      const half=NUCLEAR_RULES.bombHeight*nuclearBombScale(view)/2;
      this.bomb={x:720,y:-half*1.3/view.sy,fromY:-half*1.3/view.sy,born:this.launchAt,vy:NUCLEAR_RULES.initialSpeed};this.phase='falling';events.push({type:'nuclearLaunch',serial:this.serial});
    }
    if(this.phase==='falling'){
      const b=this.bomb,t=Math.max(0,time-b.born),half=NUCLEAR_RULES.bombHeight*nuclearBombScale(view)/2/view.sy;
      b.y=b.fromY+NUCLEAR_RULES.initialSpeed*t+.5*NUCLEAR_RULES.gravity*t*t;b.vy=NUCLEAR_RULES.initialSpeed+NUCLEAR_RULES.gravity*t;
      if(b.y+half>=ground){this.phase='idle';this.bomb=null;this.explosions++;events.push({type:'nuclearBlast',serial:this.serial,x:b.x,y:ground});}
    }
    return events;
  }
  cancel(){this.phase='idle';this.bomb=null;}
  snapshot(time){return{enabled:this.enabled,phase:this.phase,serial:this.serial,reason:this.reason,warningAt:this.warningAt,countdownAt:this.countdownAt,launchAt:this.launchAt,remaining:this.phase==='warning'?Math.max(0,this.countdownAt-time):0,cooldown:Math.max(0,this.cooldownUntil-time),handled:this.handled,explosions:this.explosions,bomb:this.bomb?{...this.bomb}:null};}
}
