import {CUT} from './cut-settings.js';
import {BOMB_GLYPH} from './bomb-metrics.js';
import {meteorView} from './body-geometry.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function bombChargeAt(m,time){
  if(!m.arm)return null;
  const a=m.arm,age=Math.max(0,time-a.time),expand=clamp(age/a.expand,0,1),contract=clamp((age-a.expand)/a.contract,0,1);
  return{age,expand,contract,radius:a.radius*(1-(1-expand)**3)*(1-contract)**2,brightness:contract,opacity:a.opacity+(.9-a.opacity)*contract};
}
export function bombletView(c,v,hitScale=1){
  const a=c.angle||0,w=c.width*v.character,h=c.height*v.character;
  return{x:c.x*v.sx,y:c.y*v.sy,rx:(Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*h)*.5*hitScale,ry:(Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*h)*.5*hitScale};
}
export function makeBomblets(m,v,nextId,random,ground){
  const center=meteorView(m,v),cos=Math.cos(m.tilt),sin=Math.sin(m.tilt),s=m.size/BOMB_GLYPH.height;
  return BOMB_GLYPH.parts.map((part,i)=>{
    const dx=(part.pivot[0]-BOMB_GLYPH.width/2)*s*v.character,dy=(part.pivot[1]-BOMB_GLYPH.height/2)*s*v.character;
    const angle=Math.PI/2+(i/5-.5)*CUT.bombChildSpread*Math.PI/180,speed=CUT.bombChildSpeed*(1+(random()*2-1)*CUT.bombChildVariation);
    const c={id:nextId(),part:i,sourceSize:m.size,size:part.height*s,width:part.width*s,height:part.height*s,
      x:(center.x+dx*cos-dy*sin)/v.sx,y:(center.y+dx*sin+dy*cos)/v.sy,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle:m.tilt,spin:(i%2?1:-1)*CUT.bombChildSpin*Math.PI/180,born:0};
    // Aim the fan back into the playfield when a parent bursts near an edge.
    const distance=Math.max(1,ground-c.y),g=CUT.bombChildGravity,t=2*distance/(Math.sqrt(c.vy*c.vy+2*g*distance)+c.vy);
    const k=CUT.bombChildDrag>1e-8?-Math.expm1(-CUT.bombChildDrag*t)/CUT.bombChildDrag:t;
    c.vx=(clamp(c.x+c.vx*k,24,1416)-c.x)/Math.max(.001,k);
    return c;
  });
}
export function advanceBomblet(c,dt,reduced=false){
  const drag=CUT.bombChildDrag,k=drag>1e-8?-Math.expm1(-drag*dt)/drag:dt;
  c.x+=c.vx*k;c.vx*=Math.exp(-drag*dt);
  c.y+=c.vy*dt+.5*CUT.bombChildGravity*dt*dt;c.vy+=CUT.bombChildGravity*dt;if(!reduced)c.angle+=c.spin*dt;
}
