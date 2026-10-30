// Gameplay owns these rules. The feedback layer only consumes scoreChange records.
export const SCORE_RULES=Object.freeze({cutPoints:100,survivorPoints:5});
export function scoreTotal({cuts,alive,penalty,bonus=0},rules=SCORE_RULES){
  return Math.max(0,cuts*rules.cutPoints+alive*rules.survivorPoints+bonus-penalty);
}
export function scoreSource(kind,rules=SCORE_RULES,value=0){
  if(kind==='farm')return{key:'farm',label:'农场收成',count:1,tone:'gain',emphasis:'normal',components:[{key:'farm',label:'收成',value}]};
  if(kind==='cannonMan'||kind==='cannonBomb')return{key:kind,label:kind==='cannonMan'?'炮击「曼」':'炮击「慢！」',count:1,tone:'gain',emphasis:'normal',components:[{key:'cannon',label:'击落',value}]};
  if(kind==='cut')return{key:'cut',label:'切开「曼」',count:1,tone:'gain',emphasis:'normal',components:[
    {key:'cut',label:'切割',value:rules.cutPoints},
    {key:'born',label:'新增',count:2,unit:' man',value:2*rules.survivorPoints}]};
  if(kind==='death')return{key:'death',label:'损失',count:1,unit:' man',tone:'loss',emphasis:'light',components:[{key:'lost',label:'人力',value:-rules.survivorPoints}]};
  return{key:'bomb',label:'「慢！」爆炸',count:1,tone:'loss',emphasis:'heavy',components:[{key:'bomb',label:'爆炸',value:-value}]};
}
export function scoreChange(before,after,source){
  const delta=after-before,components=source.components??[];
  const clipped=Math.abs(components.reduce((n,p)=>n+p.value,0)-delta)>1e-7;
  return{before,after,delta,source:{...source,components:clipped?[]:components.map(p=>({...p}))},clipped};
}
