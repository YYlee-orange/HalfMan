const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const BLACK_HAWK_BOUNDS=Object.freeze({left:.25,right:.75,top:.235,bottom:.45});
export const BLACK_HAWK_ENTRY_DURATION=3.4;
export const BLACK_HAWK_PATROL_START=BLACK_HAWK_ENTRY_DURATION+3.10;

export class BlackHawkPilot{
  constructor(random=Math.random){
    this.seed=Math.floor(random()*0x100000000)>>>0;
    const arrival={x:.34,y:.36,yaw:.14};
    const departure={mode:'forward',from:arrival,to:{x:.52,y:.335,yaw:arrival.yaw},start:BLACK_HAWK_PATROL_START,end:BLACK_HAWK_PATROL_START+2.10};
    const hover={mode:'entryHover',from:arrival,to:arrival,start:BLACK_HAWK_ENTRY_DURATION,end:BLACK_HAWK_PATROL_START,exit:departure};
    this.leg={mode:'entry',from:{x:-.29,y:.16,yaw:arrival.yaw},to:arrival,start:0,end:BLACK_HAWK_ENTRY_DURATION,exit:hover};
  }
  roll(){
    this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
    return this.seed/0x100000000;
  }
  plan(start,at,dodgeDirection=0){
    const bounds=BLACK_HAWK_BOUNDS,heading=Math.cos(at.yaw)>=0?1:-1;
    const forward=heading>0?bounds.right-at.x:at.x-bounds.left;
    const reverse=heading>0?at.x-bounds.left:bounds.right-at.x;
    const choices=dodgeDirection?[]:['turn','hover'];
    if(forward>.08&&(!dodgeDirection||dodgeDirection===heading))choices.push('forward','forward');
    if(reverse>.075&&(!dodgeDirection||dodgeDirection===-heading))choices.push('reverse');
    if(at.y-bounds.top>.045)choices.push('climb');
    if(bounds.bottom-at.y>.045)choices.push('descend');
    const available=dodgeDirection?choices:choices.filter(mode=>mode!==this.leg.mode);
    const mode=available[Math.floor(this.roll()*available.length)];
    const to={...at};
    let duration;
    if(mode==='forward'||mode==='reverse'){
      const direction=mode==='forward'?heading:-heading,room=mode==='forward'?forward:reverse;
      const distance=Math.min(room,.09+this.roll()*(mode==='forward'?.22:.10));
      to.x+=distance*direction;
      to.y=clamp(at.y+(this.roll()-.5)*.065,bounds.top,bounds.bottom);
      duration=1.10+distance*4.9+this.roll()*.38;
    }else if(mode==='climb'||mode==='descend'){
      const direction=mode==='climb'?-1:1;
      to.y=clamp(at.y+direction*(.065+this.roll()*.092),bounds.top,bounds.bottom);
      const drift=(this.roll()-.5)*.083;
      to.x=clamp(at.x+(dodgeDirection?Math.abs(drift)*dodgeDirection:drift),bounds.left,bounds.right);
      duration=1.37+this.roll()*.69;
    }else if(mode==='turn'){
      to.yaw=heading>0?Math.PI-.14:.14;
      duration=1.02+this.roll()*.42;
    }else{
      duration=.54+this.roll()*.69;
    }
    return {mode,from:at,to,start,end:start+duration};
  }
  advance(time){
    while(time>=this.leg.end){
      const {end,to,exit}=this.leg;
      this.leg=exit??this.plan(end,to);
    }
  }
  dodge(time,dx,rise){
    const entry=this.leg,{x,y,yaw}=this.sample(time);
    const {left,right,top,bottom}=BLACK_HAWK_BOUNDS;
    const end=time+.38,from={x,y,yaw};
    const to={x:clamp(x+dx,left,right),y:clamp(y-rise,top,bottom),yaw:this.sample(end,entry).yaw};
    const exit=this.plan(time+.11,to,Math.sign(dx));
    this.leg={mode:'dodge',from,to,start:time,end,entry,exit};
    return this.leg;
  }
  nuclearApproach(time,duration,stationary){
    const {x,y,yaw}=this.sample(time),from={x,y,yaw},to={x:.5,y:.32,yaw},end=time+duration;
    const entry=stationary?{mode:'hover',from,to:from,start:time,end}:this.leg;
    const exit={mode:'hover',from:to,to,start:time,end};
    return {mode:'nuclearApproach',from,to,start:time,end,entry,exit};
  }
  sample(time,leg=this.leg){
    const {mode,from,to,start,end}=leg,duration=end-start,u=clamp((time-start)/duration,0,1);
    const warp=mode==='dodge'?.48:1,denominator=warp+(1-warp)*u,phase=u/denominator;
    const progress=phase**3*(10+phase*(-15+6*phase));
    const speed=30*phase**2*(1-phase)**2*warp/(denominator**2*duration);
    if(leg.entry){
      // Carry the previous leg into the transition so position and velocity meet at both ends.
      const prior=this.sample(time,leg.entry),next=this.sample(time,leg.exit);
      return {
        mode,x:prior.x+(next.x-prior.x)*progress,y:prior.y+(next.y-prior.y)*progress,
        yaw:prior.yaw+(next.yaw-prior.yaw)*progress,
        vx:prior.vx+(next.vx-prior.vx)*progress+(next.x-prior.x)*speed,
        vy:prior.vy+(next.vy-prior.vy)*progress+(next.y-prior.y)*speed,
      };
    }
    return{
      mode,x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress,
      yaw:from.yaw+(to.yaw-from.yaw)*progress,
      vx:(to.x-from.x)*speed,vy:(to.y-from.y)*speed,
    };
  }
  pose(time,view,reduced=false,leg=this.leg){
    const state=this.sample(reduced&&leg.mode==='entry'?leg.end:time,leg);
    const {x,y,vx,vy,yaw,mode}=state;
    const forwardSpeed=vx*Math.cos(yaw);
    const idle=1-clamp((Math.abs(vx)+Math.abs(vy))*9,0,1);
    const scale=Math.min(1.46,view.width*.435/330,view.height*.244/124);
    const bob=reduced?0:Math.sin(time*3.2)*2.8*idle*scale;
    const pitch=clamp(forwardSpeed*1.7,-.28,.28)+(reduced?0:Math.sin(time*2.6)*.018*idle);
    const dodgeLean=leg.mode==='dodge'?Math.sin(Math.PI*clamp((time-leg.start)/(leg.end-leg.start),0,1))**2:0;
    const bank=.07+clamp(-vy*3.5,-.32,.36)+clamp(vx*.25,-.18,.18)*dodgeLean;
    return{
      x:x*view.width,y:y*view.height+bob,vx,vy,forwardSpeed,yaw,scale,mode,
      pitch:pitch*(reduced?.55:1),bank:bank*(reduced?.62:1),
      rotorPhase:reduced?.42:time*16.8,tailPhase:reduced?.75:time*32,
    };
  }
}

const MOUNTS=[[69,19,9],[1,23,-4],[-110,1,-9]];
const HULL_HIT_VOLUMES=[
  [[-13,-4,0],[63,25,25]],
  [[70,-3,0],[43,20,21]],
  [[-117,-8,0],[52,10,8]],
  [[-165,-33,0],[11,19,5]],
];

// The local x axis points through the nose, y points down and z points toward the player.
export function blackHawkProjector(frame){
  const cy=Math.cos(frame.yaw),sy=Math.sin(frame.yaw),cp=Math.cos(frame.pitch),sp=Math.sin(frame.pitch);
  const cb=Math.cos(frame.bank),sb=Math.sin(frame.bank);
  return ([x,y,z])=>{
    const along=x*cp-y*sp,vertical=x*sp+y*cp;
    const across=along*cy-z*sy,depth=along*sy+z*cy;
    const down=vertical*cb+depth*sb,near=depth*cb-vertical*sb;
    const scale=frame.scale*700/(700-near);
    return {x:frame.x+across*scale,y:frame.y+down*scale,depth:near,scale};
  };
}
export function blackHawkMounts(frame){
  const project=blackHawkProjector(frame);
  return MOUNTS.map(([x,y,z],index)=>{
    const anchor=project([x,y+13,z]);
    return{...anchor,index,root:project([x,y,z]),radius:Math.max(21,25*anchor.scale)};
  });
}
export function blackHawkTargets(frame){
  const project=blackHawkProjector(frame);
  return HULL_HIT_VOLUMES.map(([center,radii])=>{
    const p=project(center);
    const axes=radii.map((radius,axis)=>{
      const point=project(center.map((value,index)=>index===axis?value+radius:value));
      return{x:point.x-p.x,y:point.y-p.y};
    });
    return{x:p.x,y:p.y,rx:Math.hypot(...axes.map(a=>a.x)),ry:Math.hypot(...axes.map(a=>a.y))};
  });
}
