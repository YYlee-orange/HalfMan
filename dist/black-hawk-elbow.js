import {radarOriginX} from './radar.js';
import {drawBlastLetters} from './effects.js';

const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{const u=clamp(t);return u*u*(3-2*u);};
export const BLACK_HAWK_ELBOW_SKILL=Object.freeze({windup:1,thrust:.23,hold:.08,retract:.42});
export const ELBOW_STRIKE_END=BLACK_HAWK_ELBOW_SKILL.windup+BLACK_HAWK_ELBOW_SKILL.thrust;
export const ELBOW_DURATION=ELBOW_STRIKE_END+BLACK_HAWK_ELBOW_SKILL.hold+BLACK_HAWK_ELBOW_SKILL.retract;
export const ELBOW_HIT_DURATION=.69;

export function elbowFrame(age,view,ground,radarScale){
  const {windup,thrust,hold,retract}=BLACK_HAWK_ELBOW_SKILL;
  const stroke=smooth((age-windup)/thrust),retreat=smooth((age-ELBOW_STRIKE_END-hold)/retract);
  const reach=stroke*(1-retreat),scale=view.art*radarScale;
  const radarX=radarOriginX(radarScale)*view.sx;
  const startX=Math.max(view.width+69*scale,radarX+140*scale),endX=radarX-125*scale;
  return {x:startX+(endX-startX)*reach,y:ground*view.sy-(150+18*(1-reach))*scale,
    scale,rx:46*scale,ry:123*scale,tilt:(1-reach)*.14,visible:age>=windup&&age<ELBOW_DURATION};
}

export function drawElbowArm(ctx,frame){
  if(!frame.visible)return;
  const {x,y,scale,tilt}=frame;
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(scale,scale);
  ctx.fillStyle='#784534';ctx.beginPath();ctx.moveTo(226,-165);
  ctx.bezierCurveTo(208,-188,169,-186,144,-162);
  ctx.bezierCurveTo(123,-144,107,-119,83,-105);
  ctx.bezierCurveTo(52,-87,22,-69,-1,-50);
  ctx.bezierCurveTo(-18,-36,-34,-31,-44,-13);
  ctx.bezierCurveTo(-55,4,-57,29,-46,48);
  ctx.bezierCurveTo(-35,67,-17,67,3,76);
  ctx.bezierCurveTo(40,94,74,103,107,99);
  ctx.bezierCurveTo(139,95,158,83,181,76);
  ctx.lineTo(199,70);
  ctx.bezierCurveTo(214,75,233,68,241,59);
  ctx.bezierCurveTo(247,52,246,46,242,40);
  ctx.bezierCurveTo(245,32,238,23,231,22);
  ctx.bezierCurveTo(228,16,222,13,215,16);
  ctx.bezierCurveTo(207,13,201,16,196,22);
  ctx.bezierCurveTo(186,26,185,37,177,44);
  ctx.bezierCurveTo(153,46,128,45,104,39);
  ctx.bezierCurveTo(81,33,61,20,46,7);
  ctx.bezierCurveTo(64,-3,77,-13,88,-25);
  ctx.bezierCurveTo(109,-41,132,-35,159,-47);
  ctx.bezierCurveTo(181,-57,189,-72,196,-87);
  ctx.bezierCurveTo(228,-95,244,-137,226,-165);ctx.closePath();ctx.fill();ctx.clip();
  ctx.fillStyle='#4d2923';ctx.beginPath();ctx.moveTo(231,-164);
  ctx.bezierCurveTo(229,-136,209,-115,185,-110);
  ctx.bezierCurveTo(158,-104,151,-82,130,-66);
  ctx.bezierCurveTo(111,-51,88,-53,72,-34);
  ctx.bezierCurveTo(58,-18,37,-2,15,7);
  ctx.bezierCurveTo(39,19,58,45,88,58);
  ctx.bezierCurveTo(119,72,150,68,179,60);
  ctx.bezierCurveTo(198,55,205,54,218,59);
  ctx.bezierCurveTo(230,61,239,54,247,46);
  ctx.lineTo(262,110);ctx.lineTo(119,126);ctx.lineTo(-15,89);
  ctx.bezierCurveTo(-41,77,-56,58,-58,35);
  ctx.bezierCurveTo(-40,58,-11,54,6,41);
  ctx.bezierCurveTo(16,31,13,20,5,11);
  ctx.bezierCurveTo(33,-8,53,-32,69,-53);
  ctx.bezierCurveTo(101,-90,144,-111,174,-135);
  ctx.bezierCurveTo(201,-157,221,-168,231,-164);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(191,31);
  ctx.bezierCurveTo(200,24,211,26,218,33);
  ctx.bezierCurveTo(218,38,209,41,203,38);
  ctx.bezierCurveTo(199,37,195,39,190,43);
  ctx.quadraticCurveTo(191,36,191,31);ctx.fill();
  ctx.restore();
}

const BURST=[[-91,-7],[-55,-19],[-66,-49],[-29,-37],[-18,-65],[4,-43],[33,-67],[39,-35],[74,-48],[62,-19],[96,-4],
  [67,12],[86,34],[50,33],[39,61],[15,43],[-7,67],[-20,44],[-54,57],[-50,31],[-87,34],[-70,11]];
const MAN_WORD=[
  ['M',-54,7,-.20,.89,48],['A',-15,-2,-.08,1.01,39],
  ['N',25,-1,.08,1.02,44],['!',60,6,.18,.96,23],
];

function impactPop(age,delay,life,reduced){
  const t=(age-delay)/life;
  if(t<0||t>=1)return null;
  const rise=clamp(t/.36)-1,arrival=1+3.05*rise**3+2.05*rise**2;
  return {scale:reduced?1:arrival*(1-smooth((t-.58)/.42)),opacity:clamp(t*15)*(1-smooth((t-.68)/.32))};
}

export function drawElbowImpact(ctx,point,age,scale,reduced){
  const base=impactPop(age,0,.60,reduced),word=impactPop(age,.09,.60,reduced);
  const size=scale*1.43;
  ctx.save();ctx.translate(point.x-49*size,point.y-26*size);ctx.scale(size,size);
  if(base){
    ctx.save();ctx.globalAlpha=base.opacity;ctx.scale(base.scale,base.scale);ctx.rotate(-.12);
    ctx.fillStyle='#ffcb67';ctx.strokeStyle='#f47e2a';ctx.lineWidth=6;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(...BURST[0]);for(const p of BURST.slice(1))ctx.lineTo(...p);
    ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  if(word){
    ctx.save();ctx.globalAlpha=word.opacity;ctx.scale(word.scale,word.scale);ctx.rotate(-.06);
    drawBlastLetters(ctx,MAN_WORD,'#30221d');ctx.restore();
  }
  ctx.restore();
}
