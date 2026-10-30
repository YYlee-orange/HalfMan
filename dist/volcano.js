import {levelFeatures} from './level-rules.js';
import {FOOD_X} from './facilities.js';
import {RADAR_X} from './radar.js';
import {farmGeometry} from './farm.js';
import {FARM_BOUNDS} from './farm-rowing.js';
// DESIGN_VARIANCE 5 / MOTION_INTENSITY 2 / VISUAL_DENSITY 2.
// Three flat colors: two neutral structural planes plus one muted magma accent.
export const VOLCANO=Object.freeze({width:800,height:320,colors:Object.freeze({body:'#666a67',shade:'#303532',lava:'#a7655f'}),asset:'/assets/volcano.svg'});
export const VOLCANO_SHAPES=Object.freeze([
  {id:'body',color:'body',d:'M-400 0C-322-14-286-81-220-126C-164-166-143-220-99-281Q-75-292-18-285Q40-293 85-281C135-226 164-172 225-124C286-77 320-18 400 0Z'},
  {id:'side',color:'shade',d:'M-18-285Q40-293 85-281C135-226 164-172 225-124C286-77 320-18 400 0H30C66-44 63-93 26-132C4-177 28-228-18-285Z'},
  {id:'crater',color:'shade',d:'M-97-282C-97-307 83-307 83-282C83-257-97-257-97-282Z'},
  {id:'magma-pool',color:'lava',d:'M-76-283C-64-297 62-297 68-283C50-271-60-268-76-283Z'},
  // The channel stays on the light face, apart from the plane seam. Matched
  // y-control points widen its two banks continuously from crater to ground.
  {id:'magma-run',color:'lava',d:'M-62-278C-64-250-102-236-100-210C-97-186-100-166-119-140C-136-116-165-96-169-70C-173-44-187-20-200 0H-80C-83-20-83-44-91-70C-99-96-80-116-71-140C-60-166-63-186-70-210C-78-236-46-250-48-278Z'},
].map(Object.freeze));
export function volcanoGeometry(view){
  const scale=Math.max(.08,Math.min(1100/VOLCANO.width,view.width*.65/VOLCANO.width)),y=808*view.sy,farm=farmGeometry(view,0,true);
  const farmBottom=farm.y+FARM_BOUNDS.bottom*farm.scale,oldHeight=Math.min(720,view.width*.43,view.height*.5*VOLCANO.width/VOLCANO.height)/VOLCANO.width*VOLCANO.height;
  // The broad base may extend beyond the viewport. Keep height independent of
  // width so widening the mountain does not also raise the eruption mouth.
  const height=Math.max(oldHeight*1.35,(y-farmBottom+Math.max(28,view.height*.06))*VOLCANO.height/298)*.92;
  return{x:(FOOD_X+(RADAR_X-FOOD_X)*.62)*view.sx,y,scale,width:VOLCANO.width*scale,height,stretch:height/(VOLCANO.height*scale)};
}
export function magmaChannel(time=0,reduced=false){
  const base=VOLCANO_SHAPES.find(s=>s.id==='magma-run').d;if(reduced||time===0)return base;
  // Both banks share a downward travelling displacement. The mouth and foot
  // stay pinned, and the original narrow-to-wide channel keeps its width.
  const point=(x,y)=>{const t=(y+278)/278,wave=9*Math.sin(Math.PI*t)*(Math.sin(time*1.1-t*6)-Math.sin(-t*6));return `${(x+wave).toFixed(3)} ${y}`;};
  const curve=(...p)=>'C'+[0,2,4].map(i=>point(p[i],p[i+1])).join(' ');
  return 'M'+point(-62,-278)+curve(-64,-250,-102,-236,-100,-210)+curve(-97,-186,-100,-166,-119,-140)+curve(-136,-116,-165,-96,-169,-70)+curve(-173,-44,-187,-20,-200,0)+'L'+point(-80,0)+curve(-83,-20,-83,-44,-91,-70)+curve(-99,-96,-80,-116,-71,-140)+curve(-60,-166,-63,-186,-70,-210)+curve(-78,-236,-46,-250,-48,-278)+'Z';
}
export function volcanoFrame(level,view,time=0,reduced=false,lastEruption=-10){
  const age=time-lastEruption,idle=reduced?0:Math.sin(time*1.05)*.025,jelly=reduced||age<0||age>.85?0:.55*Math.exp(-5.5*age)*Math.sin(20*age),base=volcanoGeometry(view);
  const geometry={...base,sx:1-idle*.45+jelly,sy:base.stretch*(1+idle-jelly*.8)};
  return{enabled:levelFeatures(level).volcano,geometry,time,drift:0,pulse:1,jelly,magma:magmaChannel(time,reduced),mouth:{x:geometry.x-8*geometry.scale*geometry.sx,y:geometry.y-282*geometry.scale*geometry.sy}};
}
export class VolcanoRenderer{
  constructor(makePath=d=>new Path2D(d)){this.makePath=makePath;this.paths=VOLCANO_SHAPES.map(s=>({...s,path:makePath(s.d)}));this.magma=null;}
  draw(ctx,frame,dark=false){
    if(!frame.enabled)return;const g=frame.geometry;ctx.save();ctx.translate(g.x,g.y);ctx.scale(g.scale*g.sx,g.scale*g.sy);ctx.globalAlpha=1;
    if(this.magma?.d!==frame.magma)this.magma={d:frame.magma,path:this.makePath(frame.magma)};
    for(const s of this.paths){ctx.fillStyle=VOLCANO.colors[s.color];ctx.fill(s.id==='magma-run'?this.magma.path:s.path);}
    ctx.restore();
  }
}
export function volcanoSvg(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="-400 -320 800 320" role="img" aria-label="灰黑色火山与低饱和红色岩浆"><title>火山</title>${VOLCANO_SHAPES.map(s=>`<path id="${s.id}" fill="${VOLCANO.colors[s.color]}" d="${s.d}"/>`).join('')}</svg>\n`;
}
