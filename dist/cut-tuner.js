import {CUT,CUT_FIELDS,CUT_DEFAULTS,CUT_BASELINE,applyCutSettings,setCutSetting,subscribeCutSettings,cutSettingsSnapshot,flushCutSettings,saveCutPreset,restoreCutPreset,readCutPreset} from './cut-settings.js';
import {NUCLEAR_RULES} from './nuclear.js';
const $=id=>document.getElementById(id);
export function installCutTuner({summon,summonBomb,launchNuclear=()=>false,enableMotion,onChange=()=>{}}){
  const panel=$('cut-tuner'),toggle=$('tuning-button'),body=$('tuner-body'),status=$('tuner-status'),inputs=new Map();
  let drag=null;
  const format=(field,value)=>`${Number((value*field.scale).toFixed(2))}${field.unit?` ${field.unit}`:''}`;
  for(const group of [...new Set(CUT_FIELDS.map(f=>f.group))]){
    const details=document.createElement('details');details.className='tuner-group';details.open=['陨石坠落','冲量'].includes(group);
    const heading=document.createElement('summary');heading.textContent=group;details.append(heading);
    for(const field of CUT_FIELDS.filter(f=>f.group===group)){
      const row=document.createElement('label');row.className='tuner-row';row.htmlFor=`cut-param-${field.key}`;
      const caption=document.createElement('span');caption.textContent=field.label;
      const value=document.createElement('output');value.htmlFor=row.htmlFor;
      const input=document.createElement('input');input.id=row.htmlFor;input.type='range';input.dataset.param=field.key;
      input.min=String(field.min*field.scale);input.max=String(field.max*field.scale);input.step=String(field.step*field.scale);
      input.addEventListener('input',()=>{setCutSetting(field.key,Number(input.value)/field.scale);status.textContent=field.key.startsWith('score')?'已生效。下一次分数变化使用新的反馈参数。':field.key==='nuclearCloudOpacity'?'已实时更新整朵蘑菇云的不透明度。':field.key.startsWith('nuclear')?'已生效，下一次核爆使用新的白光持续时间。':field.key.startsWith('bomb')?'已生效。点击“召唤慢！”可测试炸弹效果。':field.key==='meteorSpeed'?'已生效，下一颗陨石使用此初速度。':field.key==='meteorGravity'?'已生效，场上陨石已使用此加速度。':'已生效，切开下一颗陨石查看效果。';});
      inputs.set(field.key,{input,value,field});row.append(caption,value,input);details.append(row);
    }
    $('tuner-fields').append(details);
  }
  const sync=()=>{for(const {input,value,field}of inputs.values()){input.value=String(CUT[field.key]*field.scale);value.value=format(field,CUT[field.key]);}onChange();};
  subscribeCutSettings(sync);sync();
  const syncSaved=()=>{$('tuner-load').disabled=!readCutPreset();};syncSaved();
  function open(value){panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));if(value){syncSaved();const p=clampPosition(panel.offsetLeft,panel.offsetTop);panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;panel.style.right='auto';$('tuner-collapse').focus({preventScroll:true});}else toggle.focus({preventScroll:true});}
  toggle.addEventListener('click',()=>open(panel.hidden));$('tuner-close').addEventListener('click',()=>open(false));
  $('tuner-collapse').addEventListener('click',()=>{body.hidden=!body.hidden;$('tuner-collapse').textContent=body.hidden?'展开':'收起';$('tuner-collapse').setAttribute('aria-expanded',String(!body.hidden));});
  $('tuner-strong').addEventListener('click',()=>{applyCutSettings(CUT_DEFAULTS);status.textContent='已恢复默认参数。';});
  $('tuner-baseline').addEventListener('click',()=>{applyCutSettings(CUT_BASELINE);status.textContent='已切回上一版参数，可直接对照。';});
  $('tuner-summon').addEventListener('click',()=>{status.textContent=summon()===false?'字形尚未准备好，请稍后再试。':'已从屏幕外召唤一颗陨石。';});
  $('tuner-bomb').addEventListener('click',()=>{status.textContent=summonBomb()===false?'字形尚未准备好，请稍后再试。':'已从屏幕外召唤慢！划中后查看蓄爆和子母弹。';});
  $('tuner-nuclear').addEventListener('click',()=>{status.textContent=launchNuclear()===false?'请进入第五关后测试核弹。':`核弹预警已刷新，${NUCLEAR_RULES.warning} 秒后发射；重复点击会重新计时。`;});
  $('tuner-full-motion').addEventListener('click',()=>enableMotion());
  $('tuner-save').addEventListener('click',()=>{status.textContent=saveCutPreset()?'已保存到当前浏览器。后续试调可读取这份参数。':'保存失败：浏览器未允许本地存储，请用“复制参数”备份。';syncSaved();});
  $('tuner-load').addEventListener('click',()=>{status.textContent=restoreCutPreset()?'已读取保存的参数，全部滑条已同步。':'未找到可用的已保存参数。';syncSaved();});
  $('tuner-copy').addEventListener('click',async()=>{
    const text=JSON.stringify({version:1,values:cutSettingsSnapshot()},null,2);flushCutSettings();
    try{await navigator.clipboard.writeText(text);status.textContent='参数已复制，可直接发回给我。';$('tuner-export').hidden=true;}
    catch{$('tuner-export').value=text;$('tuner-export').hidden=false;$('tuner-export').focus();$('tuner-export').select();status.textContent='参数已展开，选中后即可复制。';}
  });
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();open(false);}event.stopPropagation();});
  function clampPosition(x,y){return{x:Math.max(0,Math.min(innerWidth-panel.offsetWidth,x)),y:Math.max(0,Math.min(innerHeight-44,y))};}
  const header=$('tuner-drag');
  header.addEventListener('pointerdown',event=>{
    if(event.target.closest('button'))return;const rect=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    header.setPointerCapture(event.pointerId);event.preventDefault();
  });
  header.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const p=clampPosition(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;panel.style.right='auto';});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(type,()=>{drag=null;});
  window.addEventListener('resize',()=>{if(panel.hidden)return;const p=clampPosition(panel.offsetLeft,panel.offsetTop);panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;panel.style.right='auto';});
}
