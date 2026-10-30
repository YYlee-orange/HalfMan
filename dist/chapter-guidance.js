import {PencilHint,createPencilDrawing} from './pencil-hint.js';
import {farmGuidanceArea} from './farm-guidance-layout.js';

// Reusable handwritten chapter headings. Supply additional character strokes with
// each future chapter; no browser font is substituted into the pencil artwork.
const letters={
  曼:[[[28,9],[29,33]],[[28,9],[75,6],[75,31],[29,33]],[[30,21],[73,18]],
    [[14,45],[15,61]],[[14,45],[89,40],[88,58],[15,61]],[[39,44],[40,59]],[[64,42],[64,58]],
    [[25,71],[78,66],[65,82],[44,93],[12,99]],[[29,74],[47,85],[72,96],[94,98]]],
  之:[[[48,8],[57,14],[62,21]],[[23,36],[77,29],[56,54],[37,74],[22,83]],[[22,83],[38,80],[53,87],[74,92],[96,86]]],
  一:[[[9,56],[48,53],[94,47]]],
  切:[[[5,35],[27,29],[47,24]],[[21,8],[21,46],[23,61],[32,64],[45,59],[47,50]],[[56,21],[90,16],[88,49],[81,84],[72,90],[62,82]],[[69,24],[64,57],[56,75],[48,84]]],
  '！':[[[52,11],[50,37],[48,67]],[[47,85],[48,90]]],
  二:[[[23,31],[50,28],[80,25]],[[8,79],[51,75],[95,69]]],
  三:[[[20,23],[49,20],[82,17]],[[26,51],[50,48],[76,45]],[[8,87],[51,82],[95,76]]],
  四:[[[12,17],[14,95]],[[12,17],[90,9],[91,88],[14,95]],[[39,20],[39,48],[31,67],[22,76]],[[63,17],[64,61],[70,69],[83,63]]],
  五:[[[16,15],[50,12],[87,9]],[[43,16],[34,84]],[[22,45],[70,40],[71,84]],[[7,95],[51,90],[96,85]]],
  核:[[[4,34],[38,28]],[[22,8],[23,96]],[[23,36],[10,59],[3,73]],[[25,48],[39,64]],[[67,6],[74,18]],[[44,31],[69,26],[96,22]],[[63,30],[48,48],[64,59]],[[86,37],[72,62],[49,79]],[[96,56],[77,78],[47,97]],[[76,75],[96,95]]],
  平:[[[12,15],[50,12],[89,8]],[[23,29],[35,49]],[[79,24],[66,46]],[[5,61],[52,55],[97,49]],[[51,17],[52,57],[53,98]]],
  火:[[[20,31],[15,48],[8,59]],[[84,23],[70,43]],[[52,5],[50,42],[38,68],[22,87],[6,98]],[[51,40],[65,64],[81,83],[98,93]]],
  山:[[[50,5],[51,88]],[[13,34],[15,96],[89,87]],[[89,27],[89,87]]],
  防:[[[8,16],[29,10],[21,34],[31,49],[28,63],[17,59]],[[8,17],[9,56],[10,97]],
    [[55,9],[61,15],[65,23]],[[38,37],[64,33],[95,28]],
    [[64,36],[61,52],[83,47],[80,72],[74,91],[64,96],[54,90]],[[65,36],[58,61],[46,81],[34,92]]],
  空:[[[49,8],[55,14],[59,20]],[[20,30],[18,38],[13,44]],[[20,30],[52,26],[88,23],[85,38]],
    [[43,44],[32,55],[22,62]],[[65,43],[77,53],[91,58]],
    [[30,71],[54,67],[79,64]],[[55,68],[55,82],[56,94]],[[13,99],[54,96],[94,91]]],
  农:[[[48,7],[52,16],[54,24]],[[15,30],[53,27],[92,22],[84,39]],[[46,30],[32,53],[17,72],[5,81]],[[44,51],[45,92],[66,78]],[[86,44],[72,57],[63,61]],[[57,45],[69,67],[83,84],[97,92]]],
  业:[[[37,8],[38,48],[39,88]],[[63,6],[63,46],[64,87]],[[10,35],[20,49],[28,68]],[[91,30],[83,51],[75,68]],[[5,95],[48,91],[97,86]]],
};
export const CHAPTER_LETTER_STROKES=Object.freeze(letters);
export function createChapterDrawing({order,name,extraLetters={},avoidFarm=false,sketch=null}){
  const lines=[`曼之${order}`,name],width=400,bank={...letters,...extraLetters},strokes=[];
  for(const [row,text]of lines.entries()){
    const chars=[...text],advance=c=>c===' '?24:c==='!'?46:112,span=chars.reduce((n,c)=>n+advance(c),-12),reserve=row&&sketch?74:0,scale=Math.min(row?1.12:1,(width-48-reserve)/span);
    let cursor=(width-span*scale-reserve)/2;const y=row?160:13;
    chars.forEach(letter=>{
      if(letter===' '){cursor+=advance(letter)*scale;return;}if(letter==='!')letter='！';
      if(!bank[letter])throw Error(`Missing handwritten chapter character: ${letter}`);
      const narrow=letter==='！'&&sketch?.65:1;
      for(const points of bank[letter])strokes.push({kind:row?'chapter-name':'chapter-number',points:points.map(([x,py])=>({x:cursor+(x*narrow)*scale,y:y+py*scale}))});cursor+=advance(letter==='！'&&sketch?'!':letter)*scale;
    });
    if(row&&sketch==='radiation'){
      const cx=width-58,cy=206,r=31,add=points=>strokes.push({kind:'radiation',points});
      add(Array.from({length:25},(_,i)=>({x:cx+Math.cos(i/24*Math.PI*2)*7,y:cy+Math.sin(i/24*Math.PI*2)*7})));
      for(let i=0;i<3;i++){const a=-Math.PI/2+i*Math.PI*2/3;add([{x:cx+Math.cos(a-.45)*13,y:cy+Math.sin(a-.45)*13},...Array.from({length:8},(_,j)=>({x:cx+Math.cos(a-.45+j*.9/7)*r,y:cy+Math.sin(a-.45+j*.9/7)*r})),{x:cx+Math.cos(a+.45)*13,y:cy+Math.sin(a+.45)*13}]);}
    }
  }
  return createPencilDrawing(Object.freeze({text:lines.join('\n'),lines:Object.freeze(lines),width,height:300,delay:.06,writeDuration:1.3,hold:1.6,eraseDuration:1.05,strokeScale:1.9,avoidFarm}),strokes);
}
export const CHAPTER_ONE=createChapterDrawing({order:'一',name:'切！'});
export const CHAPTER_TWO=createChapterDrawing({order:'二',name:'防空'});
export const CHAPTER_THREE=createChapterDrawing({order:'三',name:'农业',avoidFarm:true});
export const CHAPTER_FOUR=createChapterDrawing({order:'四',name:'火山',avoidFarm:true});
export const CHAPTER_FIVE=createChapterDrawing({order:'五',name:'! 核平 !',avoidFarm:true,sketch:'radiation'});
const later=Object.freeze({tutorial:false,chapter:null});
export const LEVEL_GUIDANCE=Object.freeze({
  'man-1':Object.freeze({tutorial:true,chapter:CHAPTER_ONE}),
  'man-2':Object.freeze({tutorial:false,chapter:CHAPTER_TWO}),
  'man-3':Object.freeze({tutorial:false,chapter:CHAPTER_THREE}),
  'man-4':Object.freeze({tutorial:false,chapter:CHAPTER_FOUR}),
  'man-5':Object.freeze({tutorial:false,chapter:CHAPTER_FIVE}),
});
export const guidanceFor=levelId=>LEVEL_GUIDANCE[levelId]??later;
export function chapterHintLayout({width,height},drawing){
  if(drawing.config.avoidFarm){
    const area=farmGuidanceArea({width,height}),scale=Math.min(1,(area.width-12)/drawing.config.width,(area.height-8)/drawing.config.height),w=drawing.config.width*scale,h=drawing.config.height*scale;
    return{x:area.x+(area.width-w)/2,y:area.y+(area.height-h)/2,width:w,height:h,scale};
  }
  const {width:w,height:h}=drawing.config,margin=height<300?18:72;
  const scale=Math.max(.05,Math.min(1,(width-40)/w,(height-margin*2)/h));
  return{x:(width-w*scale)/2,y:(height-h*scale)/2,width:w*scale,height:h*scale,scale};
}
export class ChapterGuidance{
  constructor(){this.hints=new Map();this.levelId=null;this.hint=null;}
  get drawing(){return this.hint?.drawing??null;}
  start(levelId,time=0,reduced=false){
    this.stop();this.levelId=levelId;const drawing=guidanceFor(levelId).chapter;
    if(!drawing){this.hint=null;return;}
    if(!this.hints.has(drawing))this.hints.set(drawing,new PencilHint(drawing));
    this.hint=this.hints.get(drawing);this.hint.start(time,reduced);
  }
  stop(){this.hint?.stop();}
  setReduced(reduced){this.hint?.setReduced(reduced);}
  snapshot(time,reduced=false){
    if(this.hint&&this.hint.startAt!==null){
      const {drawing}=this.hint,due=this.hint.startAt+(this.hint.immediate?0:drawing.duration)+drawing.config.hold;
      if(time>=due)this.hint.erase(due,reduced);
    }
    const frame=this.hint?.snapshot(time,reduced)??{stage:'hidden',serial:0,writeTime:0,writeProgress:0,eraseProgress:0,completedStrokes:0};
    return{...frame,levelId:this.levelId,lines:this.drawing?.config.lines??[],strokeScale:this.drawing?.config.strokeScale??1};
  }
}
