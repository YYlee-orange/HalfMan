import {BOMB_FIELDS,BOMB_DEFAULTS} from './bomb-settings.js';
import {SCORE_DEFAULTS} from './score-feedback.js';
import {NUCLEAR_FIELDS,NUCLEAR_DEFAULTS} from './nuclear-settings.js';
const row=(key,label,group,min,max,step,unit='',scale=1)=>({key,label,group,min,max,step,unit,scale});
export const CUT_FIELDS=Object.freeze([
  row('meteorSpeed','陨石初速度','陨石坠落',0,300,1,'px/s'),row('meteorGravity','陨石重力加速度','陨石坠落',0,400,1,'px/s²'),
  row('normalBase','基础分离力度','冲量',0,16,.1,'D/s'),row('normalExtra','快划额外力度','冲量',0,24,.1,'D/s'),
  row('alongBase','基础顺刀拖拽','冲量',0,4,.01,'D/s'),row('alongExtra','快划额外拖拽','冲量',0,6,.01,'D/s'),row('inherit','原有速度继承','冲量',0,3,.05,'倍'),
  row('speedFull','满力度所需划速','冲量',1,30,.5,'D/s'),row('variation','不对称浮动','冲量',0,.4,.01,'%',100),
  row('spinBase','基础旋转速度','旋转与节奏',0,1800,15,'°/s'),row('spinExtra','快划额外旋转','旋转与节奏',0,2400,15,'°/s'),
  row('hitStop','命中顿帧','旋转与节奏',0,.2,.005,'ms',1000),row('hitCooldown','连续切割间隔','旋转与节奏',0,.5,.01,'ms',1000),
  row('burst','初始爆发时长','旋转与节奏',.02,.6,.01,'ms',1000),row('spinRecovery','旋转回正速度','旋转与节奏',2,30,.5),
  row('formation','横放成形时长','旋转与节奏',.05,1,.01,'ms',1000),row('gravity','小人下落重力','旋转与节奏',0,1600,5),row('drag','水平空气阻力','旋转与节奏',0,8,.05),
  row('particleBase','基础碎屑数量','命中反馈',0,40,1,'个'),row('particleExtra','快划额外碎屑','命中反馈',0,40,1,'个'),
  row('particleSpeed','碎屑飞散速度','命中反馈',0,5,.1,'倍'),row('particleSize','碎屑与速度线大小','命中反馈',.1,8,.1,'倍'),row('particleLife','碎屑持续时间','命中反馈',.03,1.2,.01,'ms',1000),
  row('flashFrames','反色切线保留','命中反馈',0,12,1,'帧'),row('flashWidth','反色切线宽度','命中反馈',0,18,.5,'px'),
  row('bladeLife','基础刀光寿命','刀光与镜头',.02,.6,.005,'ms',1000),row('bladeExtra','快划额外寿命','刀光与镜头',0,.6,.005,'ms',1000),
  row('bladeWidth','刀光宽度','刀光与镜头',0,8,.1,'倍'),row('bladeLength','刀光最大长度','刀光与镜头',0,.8,.01,'屏宽%',100),
  row('cameraBase','基础镜头位移','刀光与镜头',0,40,.5,'px'),row('cameraExtra','快划额外位移','刀光与镜头',0,60,.5,'px'),row('cameraDuration','镜头回正时长','刀光与镜头',0,.6,.01,'ms',1000),
  ...BOMB_FIELDS,
  ...NUCLEAR_FIELDS,
  row('scoreGainScale','加分冲击放大','分数反馈',1,1.8,.01,'倍'),row('scoreHeavyScale','重扣分冲击放大','分数反馈',1,2,.01,'倍'),
  row('scoreRotation','数字倾斜幅度','分数反馈',0,8,.1,'°'),row('scoreRoll','数字滚动时长','分数反馈',.05,.22,.005,'ms',1000),
  row('scoreSourceLife','来源提示停留','分数反馈',.4,2,.05,'s'),row('scoreMerge','来源合并窗口','分数反馈',.05,.6,.01,'ms',1000),
  row('scoreCooldown','数字冲击间隔','分数反馈',.1,.6,.01,'ms',1000),
]);
export const CUT_BASELINE=Object.freeze({meteorSpeed:24,meteorGravity:34,normalBase:1.2,normalExtra:.8,alongBase:.12,alongExtra:.18,inherit:1,speedFull:12,variation:.15,
  spinBase:180,spinExtra:180,hitStop:.04,hitCooldown:.11,burst:.13,spinRecovery:11,formation:.27,gravity:175,drag:.85,
  particleBase:6,particleExtra:4,particleSpeed:1,particleSize:1,particleLife:.16,flashFrames:1,flashWidth:2,
  bladeLife:.065,bladeExtra:.05,bladeWidth:1,bladeLength:.25,cameraBase:2,cameraExtra:2,cameraDuration:.08,...BOMB_DEFAULTS,...SCORE_DEFAULTS,...NUCLEAR_DEFAULTS});
export const CUT_DEFAULTS=Object.freeze({...CUT_BASELINE,meteorSpeed:30,normalBase:2,normalExtra:2.8,alongBase:.3,alongExtra:.59,inherit:.7,speedFull:5,variation:.14,
  spinBase:540,spinExtra:720,hitStop:.075,hitCooldown:.18,burst:.20,spinRecovery:7,formation:.36,gravity:375,drag:.95,
  particleBase:18,particleExtra:15,particleSpeed:1.6,particleSize:2.9,particleLife:.46,flashFrames:4,flashWidth:6,
  bladeLife:.13,bladeExtra:.10,bladeWidth:1.2,bladeLength:.45,cameraBase:12,cameraExtra:10,cameraDuration:.19});
export const CUT={...CUT_DEFAULTS};
export const CUT_STORAGE_KEY='man-cut-tuning-v1';
export const CUT_PRESET_KEY='man-cut-saved-preset-v1';
export const CUT_DEFAULTS_REVISION=1;
const listeners=new Set(),fields=new Map(CUT_FIELDS.map(f=>[f.key,f]));
let saveTimer;
export const cutSettingsSnapshot=()=>({...CUT});
export function sanitizeCutSettings(values,fallback=CUT_DEFAULTS){
  const clean={...fallback};if(!values||typeof values!=='object')return clean;
  for(const f of CUT_FIELDS){const value=values[f.key];if(typeof value==='number'&&Number.isFinite(value))clean[f.key]=Math.max(f.min,Math.min(f.max,f.step===1?Math.round(value):value));}
  return clean;
}
export function flushCutSettings(){
  clearTimeout(saveTimer);try{if(typeof localStorage!=='undefined'){localStorage.setItem(CUT_STORAGE_KEY,JSON.stringify({version:1,defaultsRevision:CUT_DEFAULTS_REVISION,values:CUT}));return true;}}catch{}
  return false;
}
export function cutSettingsFromDraft(saved){
  if(saved?.version!==1)return {...CUT_DEFAULTS};
  const values=sanitizeCutSettings(saved.values);
  // Apply the requested preset once on upgrade, retaining separately tuned meteor physics.
  return saved.defaultsRevision===CUT_DEFAULTS_REVISION?values:{...CUT_DEFAULTS,meteorSpeed:values.meteorSpeed,meteorGravity:values.meteorGravity};
}
export function readCutPreset(){
  try{
    if(typeof localStorage==='undefined')return null;
    const saved=JSON.parse(localStorage.getItem(CUT_PRESET_KEY)||'null');
    if(saved?.version!==1||!saved.values||typeof saved.values!=='object'||Array.isArray(saved.values))return null;
    const known=CUT_FIELDS.filter(f=>Object.hasOwn(saved.values,f.key));
    if(!known.length||known.some(f=>typeof saved.values[f.key]!=='number'||!Number.isFinite(saved.values[f.key])))return null;
    return{savedAt:saved.savedAt,values:sanitizeCutSettings(saved.values)};
  }catch{return null;}
}
export function saveCutPreset(){
  try{
    if(typeof localStorage==='undefined')return false;
    localStorage.setItem(CUT_PRESET_KEY,JSON.stringify({version:1,savedAt:Date.now(),values:cutSettingsSnapshot()}));
    flushCutSettings();return true;
  }catch{return false;}
}
export function restoreCutPreset(){
  const saved=readCutPreset();if(!saved)return false;
  applyCutSettings(saved.values);return true;
}
export function applyCutSettings(values,{persist=true}={}){
  Object.assign(CUT,sanitizeCutSettings(values,CUT));
  for(const listener of listeners)listener(cutSettingsSnapshot());
  if(persist){clearTimeout(saveTimer);saveTimer=setTimeout(flushCutSettings,150);}
  return cutSettingsSnapshot();
}
export function setCutSetting(key,value,options){if(!fields.has(key))return cutSettingsSnapshot();return applyCutSettings({[key]:value},options);}
export function subscribeCutSettings(listener){listeners.add(listener);return()=>listeners.delete(listener);}
try{if(typeof localStorage!=='undefined')Object.assign(CUT,cutSettingsFromDraft(JSON.parse(localStorage.getItem(CUT_STORAGE_KEY)||'null')));}catch{}
if(typeof window!=='undefined')window.addEventListener('pagehide',flushCutSettings);
