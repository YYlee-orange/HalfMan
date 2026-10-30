import {idleScan} from './facilities.js';
import {airHitBurst} from '../fx-physics.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CLIP_SECONDS=8.8;
export const SCENES=['cut','impact','collision'];
export function metricsFor(width,height){
  const sx=width/1440,sy=height/810;
  return{width,height,sx,sy,art:Math.max(.34,Math.min(sx,sy)),character:Math.max(.70,Math.min(sx,sy))};
}
export function segmentDistance(p,a,b){
  const x=b.x-a.x,y=b.y-a.y,d=x*x+y*y,t=d?clamp(((p.x-a.x)*x+(p.y-a.y)*y)/d,0,1):0;
  return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t);
}
export class PreviewModel{
  constructor({width=1440,height=810,ratio=1,fontId='youyuan',size=82,tone=0}={}){
    this.metrics=metricsFor(width,height);this.fontId=fontId;this.ratio=ratio;this.size=size;this.tone=tone;
    this.mode='full';this.manual=false;this.reset();
  }
  get duration(){return this.mode==='full'?CLIP_SECONDS*3:CLIP_SECONDS;}
  get localTime(){return this.time-this.clipIndex*CLIP_SECONDS;}
  get scene(){return this.mode==='full'?SCENES[this.clipIndex]:this.mode;}
  reset(){this.time=0;this.events=[];this.clipIndex=0;this.nextId=1;this.startClip();}
  setMode(mode){this.mode=mode;this.reset();}
  startClip(){
    this.meteors=[];this.people=[];this.trails=[];this.bursts=[];this.launched=false;this.didCut=false;this.deaths=0;this.launchTime=-10;this.cutTime=null;this.lastImpact=-10;
    this.workers=[{id:-1,part:1,anchor:{type:'antenna',x:-12,y:-90}},
      {id:-2,part:0,anchor:{type:'dish',x:-44,y:9}},{id:-3,part:1,anchor:{type:'tower',x:9,y:-90}}].map(p=>({...p,alive:true,size:48}));
    this.updateWorkers();
  }
  emit(type,data={}){this.events.push({type,time:this.time,...data});}
  antennaPoint(anchor,time=this.time){
    const m=this.metrics,a=anchor;
    let x=a.x,y=a.y;
    const releaseAge=time-this.launchTime,release=releaseAge>=0&&releaseAge<.5?Math.sin(releaseAge*20)*Math.exp(-releaseAge*7):0;
    if(a.type!=='tower'){
      if(a.type==='antenna'){
        const r=-release*.028+Math.sin(time*2.2)*.008;[x,y]=[x*Math.cos(r)-y*Math.sin(r),x*Math.sin(r)+y*Math.cos(r)];
      }
      const r=-.45-release*.025+idleScan(time);[x,y]=[-10+x*Math.cos(r)-y*Math.sin(r),-165+x*Math.sin(r)+y*Math.cos(r)];
    }
    return{x:1240+x*m.art*1.8/m.sx,y:780+y*m.art*1.8/m.sy};
  }
  updateWorkers(){
    for(const w of this.workers){const p=this.antennaPoint(w.anchor);w.x=p.x;w.y=p.y-w.size*this.ratio/4*this.metrics.character/this.metrics.sy;}
  }
  extents(body){
    const m=this.metrics;
    return body.kind==='meteor'?{rx:body.size*.62*m.character/m.sx,ry:body.size*.62*m.character/m.sy}:
      {rx:body.size*.50*m.character/m.sx,ry:body.size*this.ratio/4*m.character/m.sy};
  }
  launch(){
    this.launched=true;this.launchTime=this.time;
    const m={id:this.nextId++,kind:'meteor',size:this.size,fontId:this.fontId,tone:this.tone,tilt:.22,vy:64,vx:78,gravity:100,born:this.time};
    const r=this.extents(m);m.y=-r.ry-28/this.metrics.sy;m.x=350;
    if(this.scene==='collision'){
      const w=this.workers[0],t=1.85;m.vx=84;m.x=w.x-m.vx*t;m.vy=(w.y-m.y-.5*m.gravity*t*t)/t;
    }
    this.meteors.push(m);this.trails.push({id:m.id,kind:'meteor',size:m.size,ratio:this.ratio,born:this.time,points:[{x:m.x,y:m.y,time:this.time}],ended:null,reason:null});
    this.emit('spawn',{x:m.x,y:m.y,lowestScreenPixel:(m.y+r.ry)*this.metrics.sy});
  }
  remember(body){
    const trail=this.trails.find(t=>t.id===body.id);if(!trail)return;
    const last=trail.points.at(-1);
    if(this.time-last.time>=.014||Math.hypot(last.x-body.x,last.y-body.y)>3)trail.points.push({x:body.x,y:body.y,time:this.time});
    while(trail.points.length>2&&this.time-trail.points[0].time>.64)trail.points.shift();
  }
  endTrail(id,reason){const t=this.trails.find(t=>t.id===id);if(t){t.ended=this.time;t.reason=reason;}}
  cut(){
    const m=this.meteors[0];if(!m)return false;
    this.didCut=true;this.cutTime=this.time;this.endTrail(m.id,'split');this.meteors=[];
    for(let part=0;part<2;part++){
      const offset=(part?1:-1)*m.size*this.ratio/4*this.metrics.character/this.metrics.sx;
      const p={id:this.nextId++,kind:'man',part,fontId:m.fontId,tone:m.tone,born:this.time,x:m.x+offset,y:m.y,
        birthX:m.x,birthY:m.y,birthSize:m.size,birthTilt:m.tilt,size:m.size/82*64,vx:(part?1:-1)*215+m.vx*.2,vy:-44+Math.min(35,m.vy*.2),gravity:235,landed:false};
      this.people.push(p);this.trails.push({id:p.id,kind:'man',size:p.size,birthSize:p.birthSize,ratio:this.ratio,born:this.time,points:[{x:m.x,y:m.y,time:this.time},{x:p.x,y:p.y,time:this.time}],ended:null,reason:'branch'});
    }
    this.emit('cut',{x:m.x,y:m.y});return true;
  }
  burst(type,x,y,seed){this.bursts.push(type==='victim'?airHitBurst(x,y,seed,this.time,this.metrics,780):{type,x,y,seed,time:this.time,duration:1.4});}
  moveBody(body,dt){
    const old={x:body.x,y:body.y};
    body.y+=body.vy*dt+.5*body.gravity*dt*dt;body.vy+=body.gravity*dt;body.x+=body.vx*dt;
    if(body.kind==='man'){body.vx*=Math.exp(-1.35*dt);body.x=clamp(body.x,90,1330);}
    this.remember(body);
    if(body.kind==='meteor'){
      const mr=this.extents(body);
      for(const w of this.workers){
        if(!w.alive)continue;const wr=this.extents(w),rx=mr.rx+wr.rx,ry=mr.ry+wr.ry;
        const p={x:w.x/rx,y:w.y/ry},a={x:old.x/rx,y:old.y/ry},b={x:body.x/rx,y:body.y/ry};
        if(segmentDistance(p,a,b)<=1){w.alive=false;this.deaths++;this.burst('victim',w.x,w.y,w.id);this.emit('airHit',{id:w.id,x:w.x,y:w.y});}
      }
    }
    const r=this.extents(body);
    if(body.y+r.ry>=780){
      body.y=780-r.ry;this.remember(body);this.endTrail(body.id,'landing');this.burst(body.kind,body.x,780,body.id);
      if(body.kind==='meteor'){body.dead=true;this.lastImpact=this.time;this.emit('meteorLand',{x:body.x});}
      else {body.landed=true;body.landedAt=this.time;body.vy=0;this.emit('manLand',{id:body.id,x:body.x});}
    }
  }
  advance(dt){
    this.time+=dt;
    if(this.mode==='full'){
      const index=Math.min(2,Math.floor(this.time/CLIP_SECONDS));if(index!==this.clipIndex){this.clipIndex=index;this.startClip();}
    }
    this.updateWorkers();
    if(this.scene!=='idle'&&!this.launched&&this.localTime>=1)this.launch();
    const visibleMeteor=this.meteors[0];
    if(this.scene==='cut'&&!this.manual&&!this.didCut&&this.localTime>=2.65&&visibleMeteor&&
      (visibleMeteor.y-this.extents(visibleMeteor).ry)*this.metrics.sy>50)this.cut();
    for(const m of this.meteors)this.moveBody(m,dt);
    this.meteors=this.meteors.filter(m=>!m.dead);
    for(const p of this.people)if(!p.landed)this.moveBody(p,dt);
    this.trails=this.trails.filter(t=>t.ended===null||this.time-t.ended<(t.reason==='split'?.42:.30));
    this.bursts=this.bursts.filter(b=>this.time-b.time<b.duration);
  }
  step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    if(this.time+dt>this.duration){const left=(this.time+dt)%this.duration;this.reset();this.step(left);return;}
    const n=Math.ceil(dt*120);for(let i=0;i<n;i++)this.advance(dt/n);
  }
  seek(time){const mode=this.mode,target=clamp(time,0,this.duration-.001);this.reset();this.mode=mode;this.step(target);}
  phase(){
    if(this.scene==='idle')return'建筑待机';
    if(!this.launched)return'蓄力 · 准备发射';
    if(this.time-this.launchTime<.8)return'天线发射电波 · 屏幕外生成';
    if(this.meteors[0]?.y<0)return'陨石从屏幕外进入';
    if(this.people.some(p=>p.landed))return'小爆炸承接落地 · 余焰消散';
    if(this.didCut)return'原拖尾保留 · 两条新拖尾分裂';
    if(this.lastImpact>0)return'大爆炸承接撞地 · 拖尾收势';
    if(this.deaths)return'陨石沿途撞击小人 · 继续坠落';
    return'半透明火焰拖尾 · 重力加速';
  }
  snapshot(){return{time:this.time,scene:this.scene,phase:this.phase(),fontId:this.fontId,meteors:this.meteors.map(m=>({...m})),people:this.people.map(p=>({...p})),trails:this.trails.map(t=>({id:t.id,kind:t.kind,ended:t.ended,reason:t.reason})),deaths:this.deaths,events:this.events.slice()};}
}
