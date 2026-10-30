const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
function seededRandom(seed){
  let state=seed>>>0;
  return()=>{state+=0x6d2b79f5;let n=state;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return((n^n>>>14)>>>0)/4294967296;};
}
export const starCount=(width,height)=>clamp(Math.round(width*height/10000),30,140);
export function starOpacity(star,time,reduced=false){
  return star.alpha*(reduced?.75:.18+.97*(.5+.5*Math.sin(time*star.frequency+star.phase)));
}
export function shootingPoint(star,progress){
  const u=clamp(progress,0,1),v=1-u;
  return{x:v*v*star.from.x+2*v*u*star.control.x+u*u*star.to.x,y:v*v*star.from.y+2*v*u*star.control.y+u*u*star.to.y};
}
export function shootingOpacity(progress){
  if(progress<=0||progress>=1)return 0;
  const fadeIn=clamp(progress/.12,0,1),fadeOut=clamp((1-progress)/.34,0,1);
  return fadeIn*fadeOut*(2-fadeOut);
}
// Own clock and PRNG: decoration cannot consume gameplay randomness or game events.
export class BackgroundSky{
  constructor(seed=Date.now()){
    this.random=seededRandom(seed);this.time=0;this.total=0;this.shooting=[];
    const r=this.random;
    this.stars=Array.from({length:140},()=>{
      const gray=120+Math.floor(r()*51),darkGray=gray-50;
      return{x:.018+r()*.964,y:.025+r()*.825,radius:2.2+r()*1.8,alpha:.10+r()*.16,
        frequency:.7+r()*.6,phase:r()*Math.PI*2,cross:r()<.36,
        light:`rgb(${gray},${gray},${gray})`,dark:`rgb(${darkGray},${darkGray},${darkGray})`};
    });
    this.nextAt=1+r()*1.4;
  }
  makeShooting(born){
    const r=this.random,direction=r()<.5?-1:1,x=direction>0?.06+r()*.48:.46+r()*.48,y=.07+r()*.28;
    const dx=direction*(.18+r()*.24),dy=.10+r()*.18;
    return{id:++this.total,born,duration:1.3+r(),tail:.24+r()*.18,radius:.8+r()*.55,
      from:{x,y},control:{x:x+dx*.48,y:y-.04-r()*.07},to:{x:x+dx,y:y+dy}};
  }
  step(dt,reduced=false){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.time+=dt;
    while(this.nextAt<=this.time){
      const star=this.makeShooting(this.nextAt);
      if(!reduced&&star.born+star.duration>this.time)this.shooting.push(star);
      this.nextAt+=1.8+this.random()*2.2;
    }
    this.shooting=reduced?[]:this.shooting.filter(s=>this.time<s.born+s.duration);
  }
  snapshot(width,height,reduced=false){
    return{time:this.time,stars:starCount(width,height),total:this.total,
      shooting:reduced?[]:this.shooting.map(s=>({...s,progress:(this.time-s.born)/s.duration}))};
  }
}
export function drawBackground(ctx,sky,{width,height,dark=false,reduced=false,emphasis=1,drift=null}){
  ctx.save();
  for(let i=0;i<starCount(width,height);i++){
    const s=sky.stars[i],x=drift?((s.x*width+drift.x)%width+width)%width:s.x*width,y=drift?((s.y*height+drift.y)%height+height)%height:s.y*height;
    ctx.globalAlpha=clamp(starOpacity(s,sky.time,reduced)*emphasis,0,1);ctx.fillStyle=dark?s.dark:s.light;
    ctx.beginPath();
    if(s.cross){const a=s.radius*1.9,b=s.radius*.42;ctx.moveTo(x,y-a);ctx.lineTo(x+b,y-b);ctx.lineTo(x+a,y);ctx.lineTo(x+b,y+b);ctx.lineTo(x,y+a);ctx.lineTo(x-b,y+b);ctx.lineTo(x-a,y);ctx.lineTo(x-b,y-b);ctx.closePath();}
    else ctx.arc(x,y,s.radius,0,Math.PI*2);
    ctx.fill();
  }
  if(!reduced)for(const s of sky.shooting){
    const u=(sky.time-s.born)/s.duration,fade=shootingOpacity(u);
    if(!fade)continue;
    const start=Math.max(0,u-s.tail/s.duration),color=dark?'rgb(112,112,112)':'rgb(106,106,106)';
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';
    let previous=shootingPoint(s,start);
    for(let i=1;i<=18;i++){
      const t=i/18,p=shootingPoint(s,mix(start,u,t));
      ctx.globalAlpha=clamp(.24*fade*t*t*emphasis,0,1);ctx.lineWidth=.15+s.radius*.8*t;
      ctx.beginPath();ctx.moveTo(previous.x*width,previous.y*height);ctx.lineTo(p.x*width,p.y*height);ctx.stroke();previous=p;
    }
    ctx.globalAlpha=clamp(.32*fade*emphasis,0,1);ctx.beginPath();ctx.arc(previous.x*width,previous.y*height,s.radius,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
