import {FARM_CROPS,farmGeometry} from './farm.js';
import {levelFeatures} from './level-rules.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
export const FARM_RULES=Object.freeze({capacity:9,cycle:12,hungerRate:20,walkSpeed:34,exitSpeed:48,halfWidth:230,deckY:-8});
export const onFarm=p=>p.state==='farm'||p.state==='farmExit';
export function farmFoot(p,view,time,reduced=false){
  const g=farmGeometry(view,time,reduced);return{x:g.x+p.farm.x*g.scale*g.sx,y:g.y+p.farm.y*g.scale*g.sy};
}
// One-way swept top surface, in unshaken screen coordinates. Both body extent
// and platform motion participate, so fast falls cannot tunnel through the deck.
export function farmContact(a,b,old,g){
  const top=f=>f.y+FARM_RULES.deckY*f.scale*f.sy;
  const da=a.y+(a.ry??0)-top(old),db=b.y+(b.ry??0)-top(g);
  if(da>1e-7||db<0||db-da<=1e-9)return null;
  const t=clamp(-da/(db-da),0,1),x=mix(a.x,b.x,t),cx=mix(old.x,g.x,t),unit=mix(old.scale*old.sx,g.scale*g.sx,t),radius=Math.max(a.rx??0,b.rx??0);
  if(Math.abs(x-cx)>FARM_RULES.halfWidth*unit+radius)return null;
  return{surface:'farm',t,x:clamp(x,cx-FARM_RULES.halfWidth*unit,cx+FARM_RULES.halfWidth*unit),y:mix(top(old),top(g),t),localX:clamp((x-cx)/unit,-FARM_RULES.halfWidth,FARM_RULES.halfWidth),normal:{x:0,y:-1}};
}
export const farmYield=(n,random=Math.random)=>5*(1+Math.floor(clamp(random(),0,.999999999)*5))+2*(n-1);
export function emptyCrop(people,x){
  const occupied=new Set(people.filter(p=>p.state==='farm').map(p=>p.farm.cropId));
  return FARM_CROPS.filter(c=>!occupied.has(c.id)).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]??null;
}
export function farmEnabled(level){return levelFeatures(level).farm;}
