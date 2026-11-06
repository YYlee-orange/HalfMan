import {NUCLEAR_RULES,nuclearBombScale} from './nuclear.js';
import {drawRadiation} from './radiation.js';
import {CUT} from './cut-settings.js';
import {drawBlastLetters} from './effects.js';
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>1-(1-clamp(n))**3;
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const TAU=Math.PI*2;
export const NUCLEAR_COLORS=Object.freeze({
  body:'#858967',side:'#4b5142',icon:'#ffe344',
});
function bombHull(ctx){
  ctx.beginPath();ctx.moveTo(-15,-82);ctx.lineTo(15,-82);ctx.lineTo(22,-42);
  ctx.bezierCurveTo(49,-23,47,38,25,64);ctx.quadraticCurveTo(12,78,0,82);
  ctx.quadraticCurveTo(-12,78,-25,64);ctx.bezierCurveTo(-47,38,-49,-23,-22,-42);ctx.closePath();
}
export function drawNuclearBomb(ctx,state,view,project,zoom=1){
  if(!state.bomb)return;const p=project(state.bomb.x,state.bomb.y),s=nuclearBombScale(view)*zoom,c=NUCLEAR_COLORS;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
  ctx.fillStyle=c.side;ctx.beginPath();ctx.moveTo(-16,-36);ctx.lineTo(-47,-73);ctx.lineTo(-45,-29);ctx.lineTo(-24,-13);ctx.lineTo(24,-13);ctx.lineTo(45,-29);ctx.lineTo(47,-73);ctx.lineTo(16,-36);ctx.closePath();ctx.fill();
  ctx.fillStyle=c.body;ctx.beginPath();ctx.moveTo(-43,-65);ctx.lineTo(-27,-39);ctx.lineTo(-40,-34);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(43,-65);ctx.lineTo(40,-34);ctx.lineTo(27,-39);ctx.closePath();ctx.fill();
  bombHull(ctx);ctx.fill();ctx.save();ctx.clip();
  ctx.fillStyle=c.side;ctx.beginPath();ctx.moveTo(7,-82);ctx.lineTo(48,-82);ctx.lineTo(48,83);ctx.lineTo(0,83);
  ctx.bezierCurveTo(22,64,37,16,23,-24);ctx.bezierCurveTo(20,-33,12,-50,7,-82);ctx.closePath();ctx.fill();
  // Curved panel seams wrap around the hull instead of crossing it as flat stripes.
  ctx.strokeStyle=c.side;ctx.lineCap='round';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-23,-43);ctx.quadraticCurveTo(0,-32,24,-44);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-38,45);ctx.quadraticCurveTo(-11,62,31,48);ctx.stroke();
  ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-31,-29);ctx.bezierCurveTo(-41,-10,-40,13,-35,29);ctx.stroke();
  ctx.strokeStyle=c.body;ctx.beginPath();ctx.moveTo(30,-21);ctx.quadraticCurveTo(42,4,34,31);ctx.stroke();
  ctx.fillStyle=c.side;
  for(const [x,y] of [[-18,-60],[-7,-73],[-26,-32],[-29,35],[-20,48],[8,51]]){
    ctx.beginPath();ctx.ellipse(x,y,1.8,2.3,0,0,TAU);ctx.fill();
  }
  ctx.restore();
  drawRadiation(ctx,-5,8,22,c.side);ctx.restore();
}
export function drawNuclearIcon(ctx,state,time,view,reduced=false){
  const frame=nuclearIconFrame(state,view,reduced);if(!frame)return;
  ctx.save();ctx.globalAlpha=frame.alpha;drawRadiation(ctx,view.width/2,view.height/2,frame.size/2,NUCLEAR_COLORS.icon);ctx.restore();
}
export function nuclearIconFrame(state,view,reduced=false){
  if(state.phase!=='warning'||state.remaining>NUCLEAR_RULES.iconWarning||state.remaining<=0)return null;
  const elapsed=NUCLEAR_RULES.iconWarning-state.remaining;
  const baseSize=Math.max(130,Math.min(300,view.width*.4,view.height*.46));
  const size=Math.min(baseSize*1.3,view.width*.78,view.height*.78);
  const wave=Math.sin(Math.PI*elapsed/NUCLEAR_RULES.iconPeriod),alpha=reduced?.65:Math.abs(wave)<1e-10?0:.78*wave*wave;
  return{size,alpha};
}
// Silhouettes reference the layered Doom-shroom effect, redrawn as flat color planes.
// https://github.com/FregD156/PvZ_Assets/tree/HEAD/particles
const SHADOW='#49246b',PURPLE='#79419d',GOLD='#ffd74e';
const PUFF_COLORS={
  shadow:{base:SHADOW,face:PURPLE},
  crown:{base:SHADOW,face:PURPLE,highlight:GOLD},
  rim:{base:PURPLE,face:GOLD},
};
export function nuclearCloudFrame(b,time,view,project,reduced=false){
  const age=time-b.sceneTime,p=project(b.x,b.y),life=clamp(age/NUCLEAR_RULES.cloudLife);
  const burst=ease(age/.44),lift=ease((age-.06)/(reduced?.95:1.9));
  const maxWidth=Math.min(view.width*.92,view.height*.96,1030);
  const maxHeight=Math.min(view.height*.82,maxWidth*1.09);
  const w=maxWidth*(.31+.56*burst+.07*lift+.06*life);
  const h=maxHeight*(.13+.08*burst+.34*lift+.19*life);
  const overscan=Math.min(20,Math.max(10,view.art*12));
  return{age,x:p.x,wordX:b.x*view.sx,y:view.height+overscan,w,h,lift,roll:reduced?0:1.1*lift+2.4*life,
    footHeight:Math.max(28,w*.115),squash:.53+.42*lift+.05*life,
    alpha:smooth((NUCLEAR_RULES.cloudLife-age)/1.15)};
}
// Small lower curls sit behind the dark crown, with the tall and front rolls overlapping.
const RIM_PUFFS=[
  [-.285,.145,.158,-.7],[-.187,.20,.171,.7],[-.091,.235,.168,-1.6],
  [.012,.245,.156,.47],[.112,.217,.166,1.3],[.222,.183,.170,-.9],[.303,.131,.145,2.6],
];
const CROWN_PUFFS=[
  [-.32,-.06,.29,-1.09,.92],[-.28,-.11,.29,-.36,.90],
  [.30,-.038,.31,2.5,-.99],[.33,.043,.30,1.50,-1.04],
  [-.19,-.15,.343,.57,1.15],[-.14,-.12,.367,.97,1.18],
  [.17,-.12,.337,-1.99,-1.21],[.134,-.164,.35,2.47,-1.16],
  [-.05,-.195,.367,-.36,1.30],[-.020,-.208,.391,.33,1.01,'crown'],
  [-.344,.059,.288,.13,.96],[.358,.083,.281,2.03,-1.10],
  [-.036,.093,.366,-.31,-1.20,'crown'],
];
function paintPuff(ctx,f,x,y,size,angle,colors){
  const width=size*f.w,height=width*157/147*f.squash;
  ctx.save();ctx.translate(x*f.w,y*f.w*f.squash-f.h);ctx.rotate(angle);
  ctx.scale(width/147,height/157);ctx.translate(-73.5,-78.5);

  ctx.fillStyle=colors.base;ctx.beginPath();ctx.moveTo(14,57);
  ctx.bezierCurveTo(13,34,24,13,43,9);
  ctx.bezierCurveTo(61,1,79,8,91,18);
  ctx.bezierCurveTo(108,12,118,26,121,41);
  ctx.bezierCurveTo(138,43,144,57,138,75);
  ctx.bezierCurveTo(134,88,124,95,115,98);
  ctx.bezierCurveTo(128,106,126,121,116,129);
  ctx.bezierCurveTo(109,135,100,136,92,134);
  ctx.bezierCurveTo(88,149,78,154,65,152);
  ctx.bezierCurveTo(54,151,46,143,44,134);
  ctx.bezierCurveTo(30,135,17,127,15,119);
  ctx.bezierCurveTo(6,116,5,105,10,96);
  ctx.quadraticCurveTo(13,89,17,84);
  ctx.bezierCurveTo(13,75,12,65,14,57);ctx.closePath();ctx.fill();

  // The broad face folds inward, leaving one recessed curl in the dark plane.
  ctx.fillStyle=colors.face;ctx.beginPath();ctx.moveTo(14,57);
  ctx.bezierCurveTo(13,34,24,13,43,9);
  ctx.bezierCurveTo(61,1,79,8,91,18);
  ctx.bezierCurveTo(108,12,118,26,121,41);
  ctx.bezierCurveTo(138,43,144,57,138,75);
  ctx.bezierCurveTo(128,85,115,85,105,95);
  ctx.bezierCurveTo(99,102,100,111,98,119);
  ctx.bezierCurveTo(92,113,96,93,91,77);
  ctx.bezierCurveTo(88,62,73,56,61,63);
  ctx.bezierCurveTo(50,70,55,83,65,85);
  ctx.quadraticCurveTo(71,85,75,79);
  ctx.bezierCurveTo(68,81,62,75,67,71);
  ctx.bezierCurveTo(77,64,86,75,86,91);
  ctx.bezierCurveTo(86,103,80,115,73,119);
  ctx.bezierCurveTo(54,119,31,100,22,81);
  ctx.bezierCurveTo(16,72,13,63,14,57);ctx.closePath();ctx.fill();

  if(colors.highlight){
    ctx.fillStyle=colors.highlight;ctx.beginPath();ctx.moveTo(23,50);
    ctx.bezierCurveTo(27,33,41,18,59,16);
    ctx.bezierCurveTo(73,14,85,21,94,27);
    ctx.bezierCurveTo(77,25,72,31,60,33);
    ctx.bezierCurveTo(43,34,32,42,23,50);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function paintStem(ctx,f){
  const top=-f.h-.13*f.w*f.squash;
  ctx.save();ctx.translate(0,top);ctx.scale(.446*f.w,-top+f.footHeight*.16);
  ctx.fillStyle=SHADOW;ctx.beginPath();ctx.moveTo(-.445,0);ctx.lineTo(.45,0);
  ctx.bezierCurveTo(.34,.23,.355,.62,.445,.81);
  ctx.bezierCurveTo(.483,.884,.50,.95,.50,1);
  ctx.lineTo(-.50,1);
  ctx.bezierCurveTo(-.50,.92,-.444,.86,-.410,.77);
  ctx.bezierCurveTo(-.348,.60,-.349,.27,-.445,0);
  ctx.closePath();ctx.fill();

  ctx.fillStyle=PURPLE;ctx.beginPath();ctx.moveTo(-.445,0);ctx.lineTo(.248,0);
  ctx.bezierCurveTo(.185,.25,.20,.64,.277,.83);
  ctx.bezierCurveTo(.31,.908,.322,.958,.32,1);
  ctx.lineTo(-.50,1);
  ctx.bezierCurveTo(-.50,.92,-.444,.86,-.410,.77);
  ctx.bezierCurveTo(-.348,.60,-.349,.27,-.445,0);
  ctx.closePath();ctx.fill();

  ctx.fillStyle=GOLD;ctx.beginPath();ctx.moveTo(-.318,0);ctx.lineTo(-.085,0);
  ctx.bezierCurveTo(-.047,.23,-.132,.53,-.126,.73);
  ctx.bezierCurveTo(-.125,.842,-.162,.939,-.213,.98);
  ctx.quadraticCurveTo(-.24,1,-.32,1);
  ctx.bezierCurveTo(-.305,.91,-.271,.82,-.267,.73);
  ctx.bezierCurveTo(-.256,.56,-.205,.25,-.318,0);
  ctx.closePath();ctx.fill();ctx.restore();
}
function paintCrownCore(ctx,f){
  ctx.save();ctx.translate(0,-f.h);ctx.scale(f.w,f.w*f.squash);
  ctx.fillStyle=SHADOW;ctx.beginPath();ctx.moveTo(-.36,.01);
  ctx.bezierCurveTo(-.39,-.14,-.24,-.27,-.13,-.255);
  ctx.bezierCurveTo(-.08,-.34,.07,-.34,.125,-.26);
  ctx.bezierCurveTo(.24,-.275,.37,-.15,.372,-.02);
  ctx.bezierCurveTo(.40,.11,.29,.19,.172,.203);
  ctx.bezierCurveTo(.08,.256,-.09,.251,-.177,.21);
  ctx.bezierCurveTo(-.29,.207,-.39,.107,-.36,.01);
  ctx.closePath();ctx.fill();ctx.restore();
}
function paintGround(ctx,f){
  const width=f.w*(.54+.12*f.lift);
  ctx.save();ctx.scale(width,f.footHeight);
  ctx.fillStyle=SHADOW;ctx.beginPath();ctx.moveTo(-.57,0);
  ctx.bezierCurveTo(-.55,-.34,-.48,-.51,-.39,-.47);
  ctx.bezierCurveTo(-.33,-.72,-.23,-.83,-.151,-.66);
  ctx.bezierCurveTo(-.093,-.985,.037,-1.13,.12,-.89);
  ctx.bezierCurveTo(.189,-.94,.286,-.795,.31,-.646);
  ctx.bezierCurveTo(.405,-.75,.482,-.51,.491,-.35);
  ctx.quadraticCurveTo(.56,-.32,.57,0);
  ctx.closePath();ctx.fill();ctx.clip();

  ctx.fillStyle=PURPLE;ctx.beginPath();ctx.moveTo(-.57,0);
  ctx.bezierCurveTo(-.54,-.41,-.45,-.66,-.37,-.52);
  ctx.bezierCurveTo(-.32,-.79,-.235,-.87,-.151,-.66);
  ctx.bezierCurveTo(-.09,-.94,.028,-1.15,.12,-.89);
  ctx.bezierCurveTo(.16,-.9,.218,-.84,.239,-.71);
  ctx.bezierCurveTo(.167,-.72,.113,-.57,.016,-.55);
  ctx.bezierCurveTo(-.078,-.51,-.104,-.38,-.192,-.36);
  ctx.bezierCurveTo(-.26,-.28,-.405,-.36,-.57,0);
  ctx.closePath();ctx.fill();

  ctx.fillStyle=GOLD;ctx.beginPath();ctx.moveTo(-.357,-.53);
  ctx.bezierCurveTo(-.297,-.788,-.229,-.798,-.155,-.675);
  ctx.bezierCurveTo(-.084,-.978,.035,-1.078,.115,-.88);
  ctx.bezierCurveTo(.051,-.886,.037,-.732,-.031,-.697);
  ctx.bezierCurveTo(-.113,-.688,-.115,-.543,-.194,-.56);
  ctx.bezierCurveTo(-.25,-.578,-.31,-.567,-.357,-.53);
  ctx.closePath();ctx.fill();ctx.restore();
}
function paintCrown(ctx,f){
  paintCrownCore(ctx,f);
  for(const [x,y,size,angle] of RIM_PUFFS){
    paintPuff(ctx,f,x,y,size,angle+.66*f.roll,PUFF_COLORS.rim);
  }
  for(const [x,y,size,angle,spin,layer='shadow'] of CROWN_PUFFS){
    const turn=spin*f.roll;
    paintPuff(ctx,f,x*(.87+.13*f.lift),y+.025*Math.sin(turn),size,angle+turn,PUFF_COLORS[layer]);
  }
}
function paintCloud(ctx,f){
  ctx.save();ctx.translate(f.x,f.y);ctx.globalAlpha=1;
  paintStem(ctx,f);
  paintCrown(ctx,f);
  paintGround(ctx,f);
  ctx.restore();
}
const DOOM_WORD=[
  ['D',-95,8,-.22,.93,45],['O',-58,0,-.13,1.02,42],['O',-18,-5,-.025,1.07,42],
  ['M',26,1,.105,.97,52],['!',64,6,.16,1.01,24],['!',87,9,.23,.93,24],
];
function paintBlastWord(ctx,f,reduced,word=DOOM_WORD,span=222){
  const growth=reduced?1:.58+.42*ease(f.age/.14);
  const rebound=reduced?0:.10*Math.sin(28*f.age)*Math.exp(-8*f.age);
  const shake=reduced?0:.18+.82*Math.exp(-1.6*f.age);
  const width=f.w*.68;
  const drift=Math.min(2.2,width*.005)*shake;
  const dx=drift*Math.sin(44*f.age),dy=.65*drift*Math.sin(53*f.age);
  const scale=width*(growth+rebound)/span;
  const y=f.wordY??(f.y-f.h*.44-f.footHeight*.52);

  ctx.save();
  ctx.translate(f.wordX+dx,y+dy);
  ctx.rotate(.008*shake*Math.sin(36*f.age));
  ctx.scale(scale,scale);drawBlastLetters(ctx,word);
  ctx.restore();
}
function paintCloudComposite(ctx,layer,view,alpha,paint){
  const ratio=Math.min(2,Math.max(1,(ctx.canvas?.width??view.width)/view.width));
  const width=Math.round(view.width*ratio),height=Math.round(view.height*ratio);
  if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;}
  const cloud=layer.getContext('2d');cloud.setTransform(ratio,0,0,ratio,0,0);cloud.clearRect(0,0,view.width,view.height);
  paint(cloud);
  // Fade the lettering and all cloud layers together in one composite.
  ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(layer,0,0,width,height,0,0,view.width,view.height);ctx.restore();
}

export const CRASH_CLOUD_LIFE=3.10;
const MAMBA_WORD=[
  ['M',-207,10,-.17,1,55],['a',-153,4,-.13,.94,52],['n',-105,0,-.09,1,51],
  ['b',-56,-3,-.05,1.04,53],['a',-6,-2,.01,.98,49],
  ['O',62,-5,.06,1.04,57],['u',116,0,.09,.98,51],['t',158,4,.13,1,39],['！',196,9,.16,1,43],
];
export function drawCrashCloud(ctx,layer,age,view,point,reduced=false){
  if(age<0||age>=CRASH_CLOUD_LIFE)return;
  const burst=ease(age/.40),spread=ease(age/2.1),rise=ease(age/1.65),life=age/CRASH_CLOUD_LIFE;
  const w=Math.min(view.width*1.02,view.height*1.40,1120)*(.20+.62*burst+.18*spread);
  const h=w*(.075+.055*burst+.060*rise);
  const alpha=ease(age/.09)*smooth((CRASH_CLOUD_LIFE-age)/.94);
  const f={age,x:point.x,y:point.y+2,w,h,lift:burst,squash:.70+.14*rise,
    wordX:Math.min(view.width-w*.37,Math.max(w*.37,point.x)),wordY:point.y-w*(.14+.04*rise),
    roll:reduced?0:.30*burst+2.25*life};
  paintCloudComposite(ctx,layer,view,alpha,cloud=>{
    cloud.save();cloud.translate(f.x,f.y);cloud.beginPath();cloud.rect(-view.width,-view.height,view.width*2,view.height);cloud.clip();
    paintCrown(cloud,f);cloud.restore();
    if(age>=.14)paintBlastWord(cloud,{...f,age:age-.14},reduced,MAMBA_WORD,474);
  });
}
export class NuclearEffects{
  constructor(makeCanvas=()=>document.createElement('canvas')){this.makeCanvas=makeCanvas;this.layer=null;this.clear();}
  clear(){this.blasts=[];}
  add(event){this.blasts.push({...event});if(this.blasts.length>3)this.blasts.shift();}
  flash(time,reduced=false){const b=this.blasts.at(-1),age=b?time-b.sceneTime:Infinity,d=b?.flashDuration??0;return age<0||d<=0||age>=d?0:Math.pow(1-age/d,1.55)*(reduced?.65:1);}
  draw(ctx,time,view,project,reduced=false){
    this.blasts=this.blasts.filter(b=>time-b.sceneTime<=NUCLEAR_RULES.cloudLife);
    for(const b of this.blasts){
      const f=nuclearCloudFrame(b,time,view,project,reduced);if(f.age<0||f.alpha<=0)continue;
      this.layer??=this.makeCanvas();
      paintCloudComposite(ctx,this.layer,view,f.alpha*CUT.nuclearCloudOpacity,cloud=>{
        paintCloud(cloud,f);paintBlastWord(cloud,f,reduced);
      });
    }
  }
}
