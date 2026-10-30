// Isolated copy of the approved facility geometry, with preview-only idle motion.
export const idleScan=t=>Math.sin(t*.9)*.028;
export function drawFacilities(ctx,state,metrics){
 const palette={red:'#da3e3e',redSide:'#982b35',blue:'#3da9db',blueSide:'#236b9b',green:'#43ad64',greenSide:'#287344'};
 const model={realTime:state.time},camera={z:1},reduced=false,shelterPulse=-10;
 const buildingTime=()=>model.realTime;
 const CONFIG={ground:state.ground,shelterX:280,foodX:700};
 const RADAR_X=1240,RADAR_SCALE=1.8;
 const artScale=()=>metrics.art;
 const project=(x,y)=>({x:x*metrics.sx,y:y*metrics.sy});
 const radarPose=()=>({press:0,release:state.time-state.launchTime>=0&&state.time-state.launchTime<.5?Math.sin((state.time-state.launchTime)*20)*Math.exp(-(state.time-state.launchTime)*7):0,scan:idleScan(state.time),antenna:Math.sin(state.time*2.2)*.008});
function drawShelter(){
  const p=project(CONFIG.shelterX,CONFIG.ground),s=artScale()*camera.z;
  const age=model.realTime-shelterPulse;
  const wobble=!reduced?(age>=0&&age<.85?-.30*Math.sin(age*24)*Math.exp(-4.5*age):Math.sin(buildingTime()*1.6)*.013):0;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s*(1+wobble),s/(1+wobble));
  ctx.fillStyle=palette.blue;ctx.beginPath();ctx.moveTo(-235,0);ctx.bezierCurveTo(-215,-85,-112,-143,-20,-144);ctx.bezierCurveTo(19,-143,38,-113,38,-76);ctx.lineTo(38,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blueSide;ctx.beginPath();ctx.moveTo(-78,0);ctx.lineTo(-78,-70);ctx.bezierCurveTo(-77,-123,-46,-145,-20,-144);ctx.bezierCurveTo(-60,-111,-57,-79,-57,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blue;ctx.beginPath();ctx.moveTo(-58,0);ctx.lineTo(-58,-73);ctx.bezierCurveTo(-58,-138,38,-145,38,-72);ctx.lineTo(38,0);ctx.lineTo(21,0);ctx.lineTo(21,-68);ctx.bezierCurveTo(21,-114,-39,-113,-39,-68);ctx.lineTo(-39,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.blueSide;ctx.beginPath();ctx.moveTo(-39,0);ctx.lineTo(-39,-68);ctx.bezierCurveTo(-39,-113,21,-114,21,-68);ctx.lineTo(21,0);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawFood(front=false){
  const p=project(CONFIG.foodX,CONFIG.ground),s=artScale()*camera.z;
  const breathe=reduced?0:Math.sin(buildingTime()*2.1)*.012;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s*(1+breathe),s*(1-breathe));
  if(!front){
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.ellipse(0,-58,78,22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.greenSide;ctx.beginPath();ctx.ellipse(0,-58,66,15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.ellipse(0,-48,51,7,0,0,Math.PI*2);ctx.fill();
  }else{
    ctx.fillStyle=palette.green;ctx.beginPath();ctx.moveTo(-78,-58);ctx.bezierCurveTo(-76,-9,-69,0,-3,0);ctx.bezierCurveTo(61,0,71,-11,78,-58);ctx.bezierCurveTo(42,-36,-43,-35,-78,-58);ctx.closePath();ctx.fill();
    ctx.fillStyle=palette.greenSide;ctx.beginPath();ctx.moveTo(49,-41);ctx.bezierCurveTo(48,-18,45,-7,38,-2);ctx.bezierCurveTo(64,-6,71,-17,78,-58);ctx.bezierCurveTo(68,-50,61,-45,49,-41);ctx.closePath();ctx.fill();
    ctx.strokeStyle=palette.green;ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,-58,72,17,0,0,Math.PI);ctx.stroke();
  }
  ctx.restore();
}
function drawRadar(){
  const p=project(RADAR_X,CONFIG.ground),s=artScale()*RADAR_SCALE*camera.z;
  const {press,release,scan,antenna}=radarPose();
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-12,-161);ctx.lineTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(48,0);ctx.lineTo(-9,0);ctx.lineTo(2,-10);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(6,-165);ctx.lineTo(35,-9);ctx.lineTo(20,-9);ctx.lineTo(-4,-161);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(-10,-165+press*3);ctx.rotate(-.45+press*.018-release*.025+scan);
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(-91,0);ctx.bezierCurveTo(-85,62,83,61,91,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.ellipse(0,0,91,27,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.ellipse(0,-2,78,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-58,13);ctx.bezierCurveTo(-29,-3,18,-5,49,13);ctx.bezierCurveTo(18,28,-29,28,-58,13);ctx.fill();
  ctx.save();ctx.rotate(press*.025-release*.028+antenna);
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.moveTo(-8,9);ctx.lineTo(-16,-67);ctx.lineTo(-6,-69);ctx.lineTo(5,7);ctx.closePath();ctx.fill();
  ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.moveTo(-6,-69);ctx.lineTo(5,7);ctx.lineTo(0,9);ctx.lineTo(-11,-67);ctx.fill();
  ctx.fillStyle=palette.red;ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(-12,-76,15,0,Math.PI*2);ctx.clip();ctx.fillStyle=palette.redSide;ctx.beginPath();ctx.ellipse(-3,-75,9,17,-.2,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.restore();ctx.restore();ctx.restore();
}

 drawShelter();drawFood(false);drawFood(true);drawRadar();
}
