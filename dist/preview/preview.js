import {PreviewModel,segmentDistance} from './model.js';
import {drawFacilities} from './facilities.js';
import {drawPlume,drawExplosion,drawRadio} from './fire.js';
import {strongestShake} from '../fx-physics.js';
import {halfFlip,GRAYS} from '../variants.js';

const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let glyphs=new Map(),paths=new Map(),model,playing=!reduced,speed=1,lastTick=0,dpr=1;
let width=1440,height=810,pointer=null,blade=[],shake={x:0,y:0};
const sceneButtons=[...document.querySelectorAll('[data-scene]')];
const project=(x,y)=>({x:x*model.metrics.sx,y:y*model.metrics.sy});
const dark=()=>document.documentElement.dataset.theme==='dark';
const glyphColor=tone=>GRAYS[dark()?'dark':'light'][tone||0];

function rebuild(time=0){
  const fontId=$('font').value,g=glyphs.get(fontId),mode=model?.mode||'full';
  model=new PreviewModel({width,height,fontId,ratio:g.width/g.height,size:82*Number($('size').value)});
  model.setMode(mode);if(time>0)model.seek(time);
  $('seek').max=model.duration;updateControls();
}
function resize(){
  const rect=canvas.getBoundingClientRect(),time=model?.time||0;
  width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  if(glyphs.size)rebuild(time);
}
function fullGlyph(m){
  const g=glyphs.get(m.fontId),p=project(m.x,m.y),size=m.size*model.metrics.character;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(m.tilt);ctx.scale(size/g.height,size/g.height);
  ctx.translate(-g.width/2,-g.height/2);ctx.fillStyle=glyphColor(m.tone);ctx.fill(paths.get(m.fontId));ctx.restore();
}
function halfGlyph(body,worker=false){
  const g=glyphs.get(body.fontId||model.fontId),part=g.halves[body.part],age=worker?100:model.time-body.born;
  const birth=worker?1:ease(age/.27),s=model.metrics.character;
  const size=mix(body.birthSize??body.size,body.size,birth)*s,angle=mix(body.birthTilt||0,part.rotation,birth);
  let p=project(body.x,body.y),sx=1,sy=1,lean=0;
  if(birth<1){
    const center=project(body.birthX,body.birthY),offset=(body.part?1:-1)*body.birthSize*(g.width/g.height)/4*s;
    p={x:mix(center.x+Math.cos(body.birthTilt)*offset,p.x,birth),y:mix(center.y+Math.sin(body.birthTilt)*offset,p.y,birth)};
  }
  if(worker||body.landed){
    const phase=model.time*6+(body.id||0)*1.7;
    lean=worker?.12+Math.sin(phase)*.12:Math.sin(phase)*.08;
    sy=1-Math.max(0,Math.sin(phase))*(worker?.08:.04);sx=1/sy;
    p.y+=(1-sy)*body.size*(g.width/g.height)/4*s;
    if(body.landed){
      const a=model.time-body.landedAt;
      if(a<.28){const squash=.22*Math.sin(a/.28*Math.PI)*Math.exp(-a*4);sx*=1+squash;sy*=1-squash;p.y+=squash*body.size*(g.width/g.height)/4*s;}
    }
  }
  ctx.save();ctx.translate(p.x,p.y);ctx.transform(1,0,lean,1,0,0);
  ctx.scale(sx,sy*halfFlip(body.part,age));ctx.rotate(angle);ctx.scale(size/g.height,size/g.height);
  ctx.translate(-part.pivot[0],-part.pivot[1]);ctx.beginPath();ctx.rect(...part.clip);ctx.clip();
  ctx.fillStyle=glyphColor(body.tone);ctx.fill(paths.get(g.id));ctx.restore();
}
function cameraShake(){
  return strongestShake(model.events,model.time,reduced);
}
function drawBlade(now,ink){
  blade=blade.filter(p=>now-p.time<.15);if(blade.length<2)return;
  ctx.save();ctx.strokeStyle=ink;ctx.lineCap='round';
  for(let i=1;i<blade.length;i++){
    const a=blade[i-1],b=blade[i],life=1-(now-b.time)/.15;
    ctx.globalAlpha=life*.8;ctx.lineWidth=(1+i/blade.length*4)*life;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
}
function draw(now){
  const paper=dark()?'#191e1c':'#f7f8f5',ink=dark()?'#e5eae4':'#292d2b',m=model.metrics;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);
  shake=cameraShake();ctx.save();ctx.translate(shake.x,shake.y);
  const ground=780*m.sy;ctx.strokeStyle=ink;ctx.globalAlpha=.65;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,ground);ctx.lineTo(width,ground);ctx.stroke();ctx.globalAlpha=1;
  drawFacilities(ctx,{time:model.time,ground:780,launchTime:model.launchTime},m);
  for(const t of model.trails)drawPlume(ctx,t,model.time,project,m);
  for(const meteor of model.meteors)fullGlyph(meteor);
  for(const worker of model.workers)if(worker.alive)halfGlyph(worker,true);
  for(const person of model.people)halfGlyph(person);
  drawRadio(ctx,model,m,project);
  for(const burst of model.bursts)drawExplosion(ctx,burst,model.time,project,m,ink);
  ctx.restore();drawBlade(now,ink);
}
function updateControls(){
  if(!model)return;
  $('play').textContent=playing?'暂停':'播放';$('play').disabled=false;$('restart').disabled=false;
  const m=model.meteors[0];$('cut').disabled=!m||(m.y+model.extents(m).ry)*model.metrics.sy<=0;
  $('phase').textContent=model.phase();
  const sizeName={'.72':'小档','0.72':'小档','1':'中档','1.32':'大档'}[$('size').value];
  $('status').textContent=`${glyphs.get(model.fontId).label} · ${sizeName}${model.scene==='collision'?` · 沿途撞击 ${model.deaths} 人`:''}`;
  $('clock').value=`${model.time.toFixed(1)} / ${model.duration.toFixed(1)} s`;
  $('seek').value=String(model.time);
}
function setPlaying(value){playing=value;lastTick=0;updateControls();}
function frame(now){
  const t=now/1000,dt=lastTick?Math.min(.06,t-lastTick):0;lastTick=t;
  if(model){if(playing)model.step(dt*speed);draw(t);updateControls();}
  requestAnimationFrame(frame);
}

sceneButtons.forEach(button=>button.addEventListener('click',()=>{
  if(!model)return;model.setMode(button.dataset.scene);$('seek').max=model.duration;
  sceneButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));blade=[];setPlaying(true);
}));
$('play').addEventListener('click',()=>setPlaying(!playing));
$('restart').addEventListener('click',()=>{model.reset();blade=[];setPlaying(true);});
$('cut').addEventListener('click',()=>{model.cut();updateControls();});
$('speed').addEventListener('change',()=>{speed=Number($('speed').value);});
for(const id of ['font','size'])$(id).addEventListener('change',()=>{rebuild();setPlaying(true);});
$('seek').addEventListener('input',()=>{playing=false;model.seek(Number($('seek').value));blade=[];updateControls();});
$('theme').addEventListener('click',()=>{document.documentElement.dataset.theme=dark()?'light':'dark';$('theme').textContent=dark()?'浅色':'深色';});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
function point(event){const r=canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top,time:performance.now()/1000};}
canvas.addEventListener('pointerdown',event=>{
  if(!model)return;pointer={id:event.pointerId,point:point(event)};blade=[pointer.point];canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  const p=point(event),a=pointer.point;blade.push(p);pointer.point=p;
  if(Math.hypot(p.x-a.x,p.y-a.y)<2)return;
  const meteor=model.meteors[0];if(!meteor)return;
  const center=project(meteor.x,meteor.y);center.x+=shake.x;center.y+=shake.y;
  if(segmentDistance(center,a,p)<=meteor.size*.53*model.metrics.character){model.cut();updateControls();}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;});

window.__FX_PREVIEW__=Object.freeze({
  get ready(){return!!model;},
  snapshot:()=>model?{...model.snapshot(),playing,speed,mode:model.mode,metrics:{...model.metrics},workers:model.workers.map(w=>({...w})),bursts:model.bursts.map(b=>({...b})),fonts:[...glyphs.keys()]}:null,
});
try{
  const response=await fetch('./glyphs.json');if(!response.ok)throw new Error(`字形资源 ${response.status}`);
  const data=await response.json();glyphs=new Map(data.glyphs.map(g=>[g.id,g]));paths=new Map(data.glyphs.map(g=>[g.id,new Path2D(g.path)]));
  resize();new ResizeObserver(resize).observe(canvas.parentElement);requestAnimationFrame(frame);
}catch(error){
  $('phase').textContent='预览加载失败，请刷新重试';console.error(error);
}
