import {BLACK_HAWK_BOUNDS,BLACK_HAWK_PATROL_START,BlackHawkPilot,blackHawkMounts,blackHawkTargets} from './black-hawk-flight.js';
import {BLACK_HAWK_ELBOW_SKILL,ELBOW_DURATION} from './black-hawk-elbow.js';
import {shotIntersects} from './cannon.js';
import {laserContact} from './laser.js';
import {halfHeight} from './variants.js';

export const BLACK_HAWK_CAPACITY=8;
export const BLACK_HAWK_STAGE_HEALTH=490;
export const BLACK_HAWK_MAX_HEALTH=3*BLACK_HAWK_STAGE_HEALTH;
export const BLACK_HAWK_BOMB_SKILL=Object.freeze({
  windup:2,wobble:1,count:8,interval:.48,firstDelay:11,cooldown:8,speed:150,drift:47,spacing:140,
});
const DAMAGE={cut:10,cannon:48,laser:24};
const DODGE_DURATION=.76;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=t=>t*t*(3-2*t);

export class BlackHawkCombat{
  constructor(random=Math.random){
    this.pilot=new BlackHawkPilot(random);
    this.hooks=Array.from({length:3},()=>({links:[],detached:false,vx:0}));
    this.dodge=null;
    this.nuclearFlight=null;
    this.skill=null;
    this.nextSkillAt=BLACK_HAWK_PATROL_START+BLACK_HAWK_BOMB_SKILL.firstDelay;
    this.nextSkillKind='bomb';
    this.queuedSkill=null;
    this.lastBeamId=null;
    this.staggeredAt=null;
    this.flightDelay=0;
    this.health=BLACK_HAWK_MAX_HEALTH;
    this.healthLoss=null;
    this.hits=[];
    this.focusAt=null;
    this.cutInside=false;
    this.cutStroke=null;
    this.lastCutAt=-Infinity;
    this.lastLaserAt=-Infinity;
    this.finisher=null;
    this.destroyed=false;
  }
  pose(time,view,reduced){
    const flightTime=this.staggeredAt??time;
    const approach=this.nuclearFlight;
    const frame=approach?this.pilot.pose(approach.leg.start+time-approach.start,view,reduced,approach.leg)
      :this.pilot.pose(flightTime-this.flightDelay,view,reduced);
    const staggered=this.staggeredAt!==null,staggerAge=staggered?Math.max(0,time-this.staggeredAt):0;
    if(staggered&&!reduced){
      frame.rotorPhase=time*16.8;frame.tailPhase=time*32;
      const wake=Math.min(1,staggerAge*8);
      frame.x+=Math.sin(staggerAge*26)*3.4*frame.scale*wake;
      frame.y+=Math.sin(staggerAge*21)*2.4*frame.scale*wake;
      frame.bank+=Math.sin(staggerAge*17)*.061*wake;
      frame.yaw+=Math.sin(staggerAge*13)*.041*wake;
      frame.pitch+=Math.sin(staggerAge*19)*.044*wake;
      for(const hit of this.hits){
        const elapsed=time-hit.time;
        if(elapsed<0||elapsed>.62)continue;
        const recoil=Math.sin(elapsed*17)*Math.exp(-7*elapsed);
        frame.bank+=hit.dy*recoil*.47;
        frame.yaw+=hit.dx*recoil*.36;
        frame.pitch+=hit.dx*recoil*.20;
      }
    }
    const skill=!staggered&&!approach?this.skill:null,skillAge=skill?Math.max(0,time-skill.start):null;
    const wobble=skill?.kind==='elbow'?BLACK_HAWK_ELBOW_SKILL.windup:BLACK_HAWK_BOMB_SKILL.wobble;
    if(!reduced&&skillAge!==null&&skillAge<wobble){
      const t=skillAge/wobble,beat=t*Math.PI*2,amplitude=Math.sin(Math.PI*t)**2;
      frame.yaw+=Math.sin(beat*2.1)*.26*amplitude;
      frame.pitch+=Math.sin(beat*2.55+.6)*.15*amplitude;
      frame.bank+=Math.sin(beat*1.7-.4)*.16*amplitude;
      frame.y+=Math.sin(beat*2.25)*6.5*frame.scale*amplitude;
    }
    return {...frame,time,reduced,staggerAge,skillAge,skillKind:skill?.kind??null,health:this.health,trailHealth:this.trailingHealth(time),destroyed:this.destroyed,
      detached:this.hooks.map(h=>h.detached),staggered,dodging:frame.mode==='dodge'&&!staggered};
  }
  requestSkill(kind,time){
    if(this.skill||this.queuedSkill||this.staggeredAt!==null||this.nuclearFlight||this.destroyed)return false;
    this.queuedSkill=kind;
    this.nextSkillAt=time;
    return true;
  }
  stepSkill(time,available,falling,spawn){
    const {windup,count,interval,cooldown}=BLACK_HAWK_BOMB_SKILL;
    if(this.staggeredAt!==null||this.nuclearFlight||this.destroyed){
      this.skill=null;
      this.queuedSkill=null;
      this.nextSkillAt=null;
      return;
    }
    const bombDuration=windup+(count-1)*interval;
    if(!this.skill){
      if(this.nextSkillAt===null){
        if(falling)return;
        this.nextSkillAt=time+cooldown;
      }
      const kind=this.queuedSkill??this.nextSkillKind,duration=kind==='elbow'?ELBOW_DURATION:bombDuration;
      if(time+1e-9<this.nextSkillAt||['entry','dodge'].includes(this.pilot.leg.mode)||available<duration)return;
      this.skill={kind,start:time,spawned:0,direction:kind==='bomb'&&this.pilot.roll()<.5?-1:1};
      this.queuedSkill=null;
    }
    const skill=this.skill;
    if(skill.kind==='bomb'){
      while(skill.spawned<count&&time+1e-9>=skill.start+windup+skill.spawned*interval)spawn(skill.spawned++,skill.direction);
      if(skill.spawned<count)return;
    }else if(time+1e-9<skill.start+ELBOW_DURATION)return;
    this.nextSkillKind=skill.kind==='bomb'?'elbow':'bomb';
    this.skill=null;
    this.nextSkillAt=null;
  }
  beginNuclearApproach(time,duration){
    if(this.nuclearFlight||this.destroyed)return;
    const flightTime=(this.staggeredAt??time)-this.flightDelay;
    const leg=this.pilot.nuclearApproach(flightTime,duration,this.staggeredAt!==null);
    this.nuclearFlight={start:time,leg};
  }
  endNuclearApproach(time){
    if(!this.nuclearFlight)return;
    const {start,leg}=this.nuclearFlight,at=leg.start+time-start;
    const {x,y,yaw}=this.pilot.sample(at,leg),from={x,y,yaw};
    this.pilot.leg={mode:'hover',from,to:from,start:at,end:at+.35};
    this.flightDelay=(this.staggeredAt??time)-at;
    this.nuclearFlight=null;
  }
  ghosts(time,view,reduced){
    const age=time-(this.dodge?.time??-Infinity);
    if(reduced||this.staggeredAt!==null||age<=0||age>=.39)return [];
    const fade=smooth(clamp(age/.065,0,1))*(1-smooth(clamp((age-.12)/.27,0,1)));
    return [.11,.056].map((delay,i)=>({
      frame:this.pilot.pose(Math.max(this.dodge.time,time-delay)-this.flightDelay,view,false,this.dodge.leg),
      opacity:(i?.24:.13)*fade,
    }));
  }
  dodgeShot(from,to,padding,time,view,previous,current,beamId=null){
    if(current.mode==='entry'||current.mode==='entryHover'||this.nuclearFlight||this.staggeredAt!==null||time-(this.dodge?.time??-Infinity)<DODGE_DURATION||
      (beamId!==null&&beamId===this.lastBeamId))return false;
    const targets=blackHawkTargets(current),oldTargets=previous?blackHawkTargets(previous):targets;
    const hit=targets.some((target,i)=>{
      const before=oldTargets[i];
      return shotIntersects(
        {x:from.x-before.x,y:from.y-before.y},
        {x:to.x-target.x,y:to.y-target.y},
        {x:0,y:0,rx:Math.max(before.rx,target.rx),ry:Math.max(before.ry,target.ry)},padding,
      );
    });
    if(!hit)return false;
    const x=current.x/view.width,amount=Math.min(.19,(112*current.scale+31)/view.width);
    const vx=to.x-from.x;
    let direction=Math.abs(vx)>3?Math.sign(vx):x<.5?1:-1;
    const {left,right,top}=BLACK_HAWK_BOUNDS;
    if(x+direction*amount<left||x+direction*amount>right)direction=-direction;
    const dx=clamp(x+direction*amount,left,right)-x;
    const rise=clamp((26*current.scale+8)/view.height,0,Math.max(0,current.y/view.height-top));
    this.dodge={time,leg:this.pilot.dodge(time-this.flightDelay,dx,rise)};
    if(beamId!==null)this.lastBeamId=beamId;
    return true;
  }
  hitContact(from,to,padding,frame,previous=frame){
    const targets=blackHawkTargets(frame),old=previous===frame?targets:blackHawkTargets(previous);
    let nearest=null;
    for(const [i,target] of targets.entries()){
      const before=old[i];
      const a={x:from.x-before.x,y:from.y-before.y},b={x:to.x-target.x,y:to.y-target.y};
      const area={x:0,y:0,rx:Math.max(before.rx,target.rx),ry:Math.max(before.ry,target.ry)};
      const hit=laserContact(a,b,area,padding);
      if(hit&&(!nearest||hit.t<nearest.t))nearest=hit;
    }
    if(!nearest)return null;
    return {x:from.x+(to.x-from.x)*nearest.t,y:from.y+(to.y-from.y)*nearest.t};
  }
  knifeContact(from,to,padding,frame,strokeId,time){
    const point=this.hitContact(from,to,padding,frame);
    const continuing=this.cutInside&&this.cutStroke===strokeId;
    this.cutInside=blackHawkTargets(frame).some(target=>shotIntersects(to,to,target,padding));
    this.cutStroke=strokeId;
    return !continuing&&time-this.lastCutAt>=.075?point:null;
  }
  trailingHealth(time){
    const loss=this.healthLoss;
    if(!loss)return this.health;
    const t=clamp((time-loss.time-.10)/.42,0,1);
    return this.health+(loss.from-this.health)*(1-smooth(t));
  }
  takeHit(source,time,dx,dy){
    if(this.staggeredAt===null||this.finisher||this.destroyed)return null;
    if(source==='laser'&&time-this.lastLaserAt<.23)return null;
    if(source==='laser')this.lastLaserAt=time;
    if(source==='cut')this.lastCutAt=time;
    const first=this.focusAt===null;
    if(first)this.focusAt=time;
    const size=Math.hypot(dx,dy)||1;
    const hit={source,time,dx:dx/size,dy:dy/size};
    this.hits=this.hits.filter(h=>time-h.time<.62);
    this.hits.push(hit);
    this.healthLoss={time,from:this.trailingHealth(time)};
    const stage=this.hooks.filter(h=>h.detached).length,threshold=BLACK_HAWK_MAX_HEALTH-stage*BLACK_HAWK_STAGE_HEALTH;
    const before=this.health;
    this.health=Math.max(threshold,before-DAMAGE[source]);
    if(this.health===threshold){
      const final=this.health===0;
      this.finisher={time,final,stage,until:time+(final?.24:.70)};
    }
    return {...hit,first,damage:before-this.health,clear:this.finisher};
  }
  advance(time){
    if(this.staggeredAt===null){this.pilot.advance(time-this.flightDelay);return false;}
    if(!this.finisher||this.destroyed||time+1e-9<this.finisher.until)return false;
    if(this.finisher.final){this.destroyed=true;return true;}
    const stopped=time-this.staggeredAt;
    this.flightDelay+=stopped;
    if(this.dodge)this.dodge.time+=stopped;
    this.staggeredAt=null;this.finisher=null;this.focusAt=null;
    this.hits=[];this.cutInside=false;this.cutStroke=null;
    return false;
  }
  camera(time,view,reduced){
    if(reduced)return {zoom:1,dx:0,dy:0};
    let dx=0,dy=0;
    const scale=Math.max(.54,Math.min(view.width/1440,view.height/810));
    for(const hit of this.hits){
      const age=time-hit.time;
      if(age<0||age>.62)continue;
      const wave=Math.sin(22*age)*Math.exp(-8.3*age);
      const strength=hit.source==='cut'?38:hit.source==='cannon'?-25:-16;
      dx+=hit.dx*wave*strength*scale;dy+=hit.dy*wave*strength*scale;
    }
    const pullIn=this.focusAt===null?0:smooth(clamp((time-this.focusAt)/.23,0,1));
    const pullOut=this.finisher?smooth(clamp((time-this.finisher.time)/.46,0,1)):0;
    return {zoom:1+.24*pullIn*(1-pullOut),dx:clamp(dx,-44,44),dy:clamp(dy,-44,44)};
  }
  step(before,frame,view,dt,reduced){
    const previous=blackHawkMounts(before),mounts=blackHawkMounts(frame);
    for(const [index,mount] of mounts.entries()){
      const hook=this.hooks[index];
      hook.links=hook.links.filter(p=>p.state==='hawkMounted');
      let jointX=mount.x,jointY=mount.y;
      const parentVx=dt?(mount.x-previous[index].x)/dt:0;
      let acceleration=dt?(parentVx-hook.vx)/dt:0, parentAngle=0;
      hook.vx=parentVx;
      for(const p of hook.links){
        const link=p.hawkLink;
        if(reduced){link.angle=0;link.omega=0;}
        else if(dt){
          const target=clamp(parentAngle*.64-acceleration/(980*view.art),-.92,.92);
          link.omega+=(23*(target-link.angle)-4.7*link.omega)*dt;
          link.angle=clamp(link.angle+link.omega*dt,-1.08,1.08);
        }
        const height=2*halfHeight(p)*view.character;
        const length=Math.min(height*.94,view.height*.049);
        link.scale=length/(height*.94);
        const sx=Math.sin(link.angle)*length,sy=Math.cos(link.angle)*length;
        link.age+=dt;
        const connect=smooth(clamp(link.age/link.connectTime,0,1));
        const centerX=link.fromX*view.width*(1-connect)+(jointX+sx/2)*connect;
        const centerY=link.fromY*view.height*(1-connect)+(jointY+sy/2)*connect;
        if(dt){
          const previousVx=link.vx;
          link.vx=(centerX-p.x*view.sx)/dt;
          link.vy=(centerY-p.y*view.sy)/dt;
          acceleration=(link.vx-previousVx)/dt;
        }
        p.x=centerX/view.sx;p.y=centerY/view.sy;
        jointX+=sx;jointY+=sy;parentAngle=link.angle;
      }
    }
    return {previous,mounts,entering:frame.mode==='entry'};
  }
  catchPerson(p,from,to,sweep,view,time){
    if(!sweep||sweep.entering||this.staggeredAt!==null)return null;
    let closest=null,arrival=Infinity,distance=Infinity;
    for(const mount of sweep.mounts){
      const hook=this.hooks[mount.index];
      if(hook.detached||hook.links.length>=BLACK_HAWK_CAPACITY)continue;
      const previous=sweep.previous[mount.index];
      const a={x:from.x-previous.x,y:from.y-previous.y},b={x:to.x-mount.x,y:to.y-mount.y};
      const radius=Math.max(previous.radius,mount.radius);
      const area={x:0,y:0,rx:radius,ry:radius},padding=Math.min(8,to.ry*.26);
      if(!shotIntersects(a,b,area,padding))continue;
      const entry=laserContact(a,b,area,padding)?.t??0;
      const nextDistance=Math.hypot(a.x+(b.x-a.x)*entry,a.y+(b.y-a.y)*entry);
      if(entry<arrival||(entry===arrival&&nextDistance<distance)){
        arrival=entry;distance=nextDistance;closest=mount;
      }
    }
    if(!closest)return null;
    const hook=this.hooks[closest.index];
    p.hawkLink={
      age:0,connectTime:.14+.022*hook.links.length,fromX:to.x/view.width,fromY:to.y/view.height,
      angle:clamp((to.x-closest.x)/(closest.radius*2),-.52,.52),omega:0,
      vx:0,vy:0,scale:Math.min(1,view.height*.049/(2*halfHeight(p)*view.character*.94)),
    };
    p.x=to.x/view.sx;p.y=to.y/view.sy;
    p.state='hawkMounted';p.landed=false;p.onRadar=false;p.onFood=false;p.cutMotion=false;p.birthSize=p.size;
    delete p.jump;delete p.cannonDraft;delete p.pendingImpulse;delete p.birthX;delete p.birthY;delete p.elbowLaunchAt;
    hook.links.push(p);
    if(hook.links.length<BLACK_HAWK_CAPACITY)return {index:closest.index,detached:false};

    hook.detached=true;
    this.staggeredAt=time;
    for(const member of hook.links){
      const link=member.hawkLink;
      member.y-=halfHeight(member)*(view.sy-view.character)/view.sy;
      member.vx=clamp(link.vx/view.sx,-210,210);
      member.vy=clamp(link.vy/view.sy,-60,165);
      member.state='fall';member.noTrail=true;
      delete member.hawkLink;
    }
    hook.links=[];
    return {index:closest.index,detached:true,point:closest};
  }
}
