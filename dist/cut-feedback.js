import {CUT} from './cut-settings.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function inverseGlyphColor(color){return parseInt(color.slice(1,3),16)>127?'#000000':'#ffffff';}
export function cutParticles(event){
  let state=(event.id*2654435761)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const {dir,normal,strength,particleCount}=event.kinematics;
  return Array.from({length:particleCount},(_,i)=>{
    const sign=i%4<2?1:-1,along=i%2===0?1.8+random()*2:.25+random()*.4,across=i%2===0?sign*(.15+random()*.45):sign*(1.5+random()*1.7);
    const gain=(.75+strength*.55)*CUT.particleSpeed;
    return{vx:(dir.x*along+normal.x*across)*gain,vy:(dir.y*along+normal.y*across)*gain,
      life:CUT.particleLife*(.7+random()*.3),length:(.025+random()*.035)*CUT.particleSize,angle:random()*Math.PI,shape:i%3};
  });
}
export class CutFeedback{
  constructor(){this.clear();}
  clear(){this.cues=[];}
  add(event){this.cues.push({...event,particles:cutParticles(event),flashFrames:0});if(this.cues.length>12)this.cues.shift();}
  draw(ctx,time,{meteorPoint,glyphs,paths,metrics,glyphColor,ink,reduced}){
    this.cues=this.cues.filter(e=>time-e.releaseAt<Math.max(.18,CUT.flashFrames*.05,...e.particles.map(p=>p.life))+.02);
    for(const e of this.cues){
      const p=meteorPoint(e.meteor),size=e.meteor.size*metrics.character,g=glyphs.get(e.meteor.fontId),age=time-e.releaseAt;
      if(e.flashFrames<CUT.flashFrames&&time-e.time<=Math.max(.1,CUT.hitStop,CUT.flashFrames*.05)&&g&&CUT.flashWidth>0){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(e.meteor.tilt);ctx.scale(size/g.height,size/g.height);ctx.translate(-g.width/2,-g.height/2);
        ctx.clip(paths.get(g.id));ctx.beginPath();
        const a=Math.atan2(e.kinematics.dir.y,e.kinematics.dir.x)-e.meteor.tilt,dx=Math.cos(a)*g.height,dy=Math.sin(a)*g.height;
        ctx.moveTo(g.width/2-dx,g.height/2-dy);ctx.lineTo(g.width/2+dx,g.height/2+dy);
        ctx.strokeStyle=inverseGlyphColor(glyphColor(e.meteor.tone));ctx.lineWidth=Math.max(.5,CUT.flashWidth*metrics.art)*g.height/size;ctx.stroke();ctx.restore();e.flashFrames++;
      }
      if(age<0)continue;
      ctx.save();ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineCap='round';
      const particles=reduced?e.particles.slice(0,4):e.particles;
      for(const particle of particles){
        if(age>=particle.life)continue;
        const vx=particle.vx*size,vy=particle.vy*size,x=p.x+vx*age,y=p.y+vy*age;
        ctx.globalAlpha=clamp(1-age/particle.life,0,1)**.65;
        const length=particle.length*size*(.8+e.kinematics.strength*.5);
        if(particle.shape){
          const speed=Math.hypot(vx,vy)||1;ctx.lineWidth=Math.max(.5,metrics.art*1.15*CUT.particleSize);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-vx/speed*length,y-vy/speed*length);ctx.stroke();
        }else{
          ctx.save();ctx.translate(x,y);ctx.rotate(particle.angle+age*5);const s=Math.max(.5,metrics.art*1.8*CUT.particleSize);ctx.fillRect(-s/2,-s/2,s,s);ctx.restore();
        }
      }
      ctx.restore();
    }
  }
  snapshot(){return this.cues.map(e=>({id:e.id,time:e.time,releaseAt:e.releaseAt,strength:e.kinematics.strength,particleCount:e.particles.length,dir:{...e.kinematics.dir},flashFrames:e.flashFrames}));}
}
