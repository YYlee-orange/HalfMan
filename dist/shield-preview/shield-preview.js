import {ShieldControl} from '../shield-control.js';
import {BackgroundSky,drawBackground} from '../background.js';
import {previewFrame,previewLayout,drawShield,drawPreviewRadar,SHIELD_ART,SHIELD_CELLS} from './visuals.js';
const $=id=>document.getElementById(id),canvas=$('shield-scene'),ctx=canvas.getContext('2d'),sky=new BackgroundSky(62431);
const cycleEnd=19+SHIELD_ART.readySettle;
const shieldControl=new ShieldControl($('shield-control'),playCycle);
let dark=matchMedia('(prefers-color-scheme: dark)').matches,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let width=1,height=1,dpr=1,position=cycleEnd,ambient=0,cycle=false,running=true,lastTime=performance.now(),held=false,lastState=null,inspectTransition=false;
const names={ready:'护盾就绪',active:'护盾开启中',cooldown:'护盾冷却中'};
function theme(){document.documentElement.dataset.theme=dark?'dark':'light';$('theme').textContent=dark?'切换浅色':'切换深色';}
function render(){
  const frame=previewFrame(position,ambient,reduced),layout=previewLayout(width,height);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=dark?'#191e1c':'#f7f8f5';ctx.fillRect(0,0,width,height);
  drawBackground(ctx,sky,{width,height,dark,reduced});
  ctx.strokeStyle=dark?'#3c4640':'#d9dfd8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(width*.08,layout.ground);ctx.lineTo(width*.94,layout.ground);ctx.stroke();
  drawPreviewRadar(ctx,layout,ambient,reduced);drawShield(ctx,frame,layout);
  const control=$('shield-control');control.style.left=`${layout.control.x}px`;control.style.top=`${layout.control.y}px`;control.dataset.state=frame.state;control.dataset.inspect=String(inspectTransition);
  shieldControl.render(frame,{inspect:inspectTransition});
  if(lastState!==frame.state){$('phase').textContent=frame.state==='active'?'护盾开启中，演示期间不可中断':frame.state==='cooldown'?'护盾冷却中':'护盾就绪';lastState=frame.state;}
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(!cycle&&b.dataset.view===frame.state)));
  $('position').value=String(position);$('clock').textContent=frame.state==='ready'?'就绪':`${names[frame.state]} ${frame.remaining.toFixed(1)} s`;
  $('pause').disabled=false;$('pause').textContent=running?'暂停':'继续';
}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);render();}
new ResizeObserver(resize).observe(canvas);
function playCycle(){position=0;cycle=true;running=true;inspectTransition=false;lastTime=performance.now();render();}
$('play-cycle').addEventListener('click',playCycle);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{position={ready:cycleEnd,active:1.4,cooldown:8}[button.dataset.view];cycle=false;running=true;inspectTransition=true;render();}));
$('pause').addEventListener('click',()=>{running=!running;lastTime=performance.now();render();});
$('position').addEventListener('input',e=>{position=Number(e.target.value);cycle=false;running=false;inspectTransition=false;render();});
$('theme').addEventListener('click',()=>{dark=!dark;theme();render();});
const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',e=>{reduced=e.matches;render();});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();});
function step(dt){if(!Number.isFinite(dt)||dt<=0||!running||document.hidden)return;ambient+=dt;sky.step(dt,reduced);if(cycle){position=Math.min(cycleEnd,position+dt);if(position===cycleEnd)cycle=false;}}
function tick(now){const dt=Math.max(0,(now-lastTime)/1000);lastTime=now;if(!held)step(Math.min(dt,.1));render();requestAnimationFrame(tick);}
window.__SHIELD_PREVIEW__={get snapshot(){return{...previewFrame(position,ambient,reduced),running,cycle,dark,layout:previewLayout(width,height),cells:SHIELD_CELLS.length};}};
if(new URLSearchParams(location.search).has('qa'))window.__SHIELD_PREVIEW_QA__={hold:value=>{held=value;lastTime=performance.now();},step:dt=>{step(dt);render();}};
theme();resize();requestAnimationFrame(tick);
