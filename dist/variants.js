import {FONT_SPECS} from './glyph-metrics.js';
export const SIZE_LEVELS=Object.freeze([.72,1,1.32]);
export const GRAYS=Object.freeze({light:['#292929','#686868','#a0a0a0'],dark:['#eeeeee','#bdbdbd','#898989']});
export const VARIANTS=Object.freeze(FONT_SPECS.flatMap((font,fontIndex)=>
  [0,1,2].flatMap(tone=>SIZE_LEVELS.map((sizeScale,sizeLevel)=>Object.freeze({
    id:fontIndex*9+tone*3+sizeLevel,fontId:font.id,fontLabel:font.label,ratio:font.ratio,tone,sizeLevel,sizeScale,
  })))));
export function variantOf(id=1){return VARIANTS[id]||VARIANTS[1];}
export function halfHeight(person){return person.size*variantOf(person.variantId).ratio/4;}
export function halfFlip(part,age,reduced=false){
  if(part!==0)return 1;if(reduced)return -1;
  const t=Math.max(0,Math.min(1,(age-.22)/.42));
  return Math.cos(Math.PI*(t*t*(3-2*t)));
}
