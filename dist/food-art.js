const clamp=value=>Math.max(0,Math.min(1,value));
const LEFT_CHIP=[[-90,-91],[-31,-91],[-34,-76],[-44,-68],[-48,-57],[-63,-62],[-70,-52],[-90,-53]];
const RIGHT_CHIP=[[43,-91],[98,-91],[98,-24],[66,-24],[56,-34],[47,-31],[51,-45],[35,-54],[41,-65],[32,-74]];
const WALL_SPLIT=[
  [6,-96],[31,-96],[27,-75],[43,-63],[33,-52],[43,-40],[27,-27],[34,-18],[21,-8],[21,10],
  [-2,10],[1,-10],[15,-21],[7,-29],[21,-43],[13,-54],[22,-64],[7,-74],
];
const CUTOUTS=[
  [LEFT_CHIP],
  [LEFT_CHIP,RIGHT_CHIP],
  [LEFT_CHIP,WALL_SPLIT,[[54,-91],[98,-91],[98,-23],[65,-27],[69,-42],[54,-51],[60,-63],[48,-73]]],
];
const CRACKS=[
  [[-51,-60],[-40,-47],[-49,-39],[-41,-28],[-56,-40],[-47,-48],[-58,-60]],
  [[49,-38],[57,-28],[44,-19],[51,-7],[35,-19],[46,-29],[42,-41]],
  [[-68,-24],[-49,-20],[-43,-12],[-23,-8],[-41,-6],[-53,-15],[-67,-16]],
];
const CROSSES=[[-48,-63,0,8],[-13,-75,.08,11],[27,-64,.13,8],[48,-73,.04,6],[-31,-78,.19,6],[11,-73,.23,9],[35,-67,.27,5]];
const REPAIR_COLOR='#98e363',GRAVITY=540;
export const foodBreakDelay=reduced=>reduced?.44:.86;

function polygon(ctx,points){
  ctx.moveTo(...points[0]);
  for(const point of points.slice(1))ctx.lineTo(...point);
  ctx.closePath();
}

export function clipFoodDamage(ctx,stage){
  ctx.beginPath();ctx.rect(-110,-110,220,124);
  for(const cutout of CUTOUTS[stage-1])polygon(ctx,cutout);
  ctx.clip('evenodd');
}

export function drawFoodCracks(ctx,stage,color){
  ctx.fillStyle=color;ctx.beginPath();
  for(const crack of CRACKS.slice(0,stage))polygon(ctx,crack);
  ctx.fill();
}

function makeShards(seed,broken){
  const noise=i=>{const n=Math.sin(seed*12.31+i*78.21)*43758.5453;return n-Math.floor(n);};
  return Array.from({length:broken?22:13},(_,i)=>{
    const direction=noise(i)*2-1;
    return {
      x:direction*(broken?62:10),y:broken?-15-noise(i+25)*51:0,
      vx:direction*(65+noise(i+50)*(broken?180:115)),vy:-75-noise(i+75)*(broken?205:160),
      size:broken?6+noise(i+100)*15:2+noise(i+100)*6,angle:noise(i+125)*Math.PI*2,
      spin:direction*9,life:(broken?.54:.32)+noise(i+150)*.29,dark:i%3===0,
    };
  });
}

export class FoodEffects{
  constructor(){this.clear();}
  clear(){this.bursts=[];this.serial=0;}
  event(event){
    if(event.type==='foodRepair')this.bursts.push({...event,life:.82});
    else if(event.type==='foodHit'||event.type==='foodDestroyed'){
      const broken=event.type==='foodDestroyed';
      this.bursts.push({...event,life:broken?.83:.61,shards:makeShards(++this.serial,broken)});
    }
  }
  draw(ctx,time,project,scale,ground,palette,reduced){
    const elapsed=event=>(time-event.sceneTime)*(reduced?2:1);
    this.bursts=this.bursts.filter(event=>elapsed(event)<event.life);
    const floor=project(0,ground).y;
    for(const event of this.bursts){
      const origin=project(event.x,event.y),age=elapsed(event);
      if(age<0)continue;
      ctx.save();
      if(event.type==='foodRepair'){
        ctx.fillStyle=REPAIR_COLOR;
        for(const [x,y,delay,size] of CROSSES){
          const t=(age-delay)/.52;
          if(t<=0||t>=1)continue;
          const s=Math.max(1,size*Math.min(1,t*4)*scale),arm=Math.max(1,s*.38);
          const dx=origin.x+(x+x*t*.16)*scale,dy=origin.y+(y-t*(reduced?14:68))*scale;
          ctx.globalAlpha=clamp(t*8)*clamp((1-t)*2.4);
          ctx.beginPath();ctx.rect(dx-s,dy-arm,s*2,arm*2);ctx.rect(dx-arm,dy-s,arm*2,s*2);ctx.fill();
        }
      }else{
        for(const [i,piece] of event.shards.entries()){
          if(age>=piece.life||reduced&&i%2)continue;
          const drop=Math.max(0,(floor-origin.y)/scale-piece.y);
          const landing=(-piece.vy+Math.sqrt(piece.vy**2+2*GRAVITY*drop))/GRAVITY;
          const flight=Math.min(age,landing),slide=flight+Math.max(0,age-landing)*.22;
          const x=origin.x+(piece.x+piece.vx*slide)*scale;
          const y=origin.y+(piece.y+piece.vy*flight+GRAVITY*flight**2*.5)*scale;
          const s=piece.size*scale;
          ctx.save();ctx.translate(x,y);ctx.rotate(piece.angle+piece.spin*flight);
          ctx.globalAlpha=clamp((piece.life-age)/.22);ctx.fillStyle=piece.dark?palette.greenSide:palette.green;
          ctx.beginPath();polygon(ctx,[[-s,-s*.26],[s*.32,-s*.72],[s,s*.22],[-s*.32,s*.65]]);ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }
}
