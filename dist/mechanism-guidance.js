import {PencilHint,createPencilDrawing} from './pencil-hint.js';
import {CHAPTER_TWO,CHAPTER_LETTER_STROKES} from './chapter-guidance.js';

// Pen centerlines rather than a browser font: letters can be written and rubbed out.
const letters={...CHAPTER_LETTER_STROKES,
  '！':[[[52,11],[50,37],[48,67]],[[47,85],[48,90]]],
  我:[[[13,23],[32,18],[47,10]],[[8,43],[34,38],[57,33]],[[34,20],[35,62],[34,91],[23,86]],[[8,69],[34,55],[54,44]],[[60,7],[62,42],[70,73],[82,91],[94,74]],[[90,38],[79,61],[57,83]],[[76,11],[85,16],[90,23]]],
  们:[[[27,10],[18,34],[5,51]],[[19,30],[20,94]],[[46,10],[52,16],[56,23]],[[39,33],[40,91]],[[61,24],[89,20],[90,85],[82,95],[72,88]]],
  安:[[[48,6],[54,13],[58,21]],[[18,27],[17,35],[11,43]],[[19,27],[53,24],[91,20],[85,38]],[[47,39],[33,63],[65,75],[91,92]],[[7,61],[51,56],[96,50]],[[76,51],[64,73],[43,87],[13,96]]],
  装:[[[13,9],[24,24]],[[6,48],[27,32]],[[29,7],[30,57]],[[42,25],[68,20],[94,15]],[[66,6],[67,43]],[[42,49],[69,45],[94,41]],[[47,54],[54,62]],[[9,71],[52,66],[96,60]],[[47,68],[28,83],[9,89]],[[33,80],[34,98],[60,86]],[[81,69],[70,81]],[[56,76],[76,90],[95,96]]],
  了:[[[13,18],[82,11],[58,36],[49,42]],[[49,42],[51,64],[51,88],[43,96],[29,87]]],
  护:[[[6,33],[35,27]],[[21,10],[22,55],[22,88],[15,94],[7,86]],[[5,64],[23,51],[37,42]],[[61,8],[69,15],[73,22]],[[48,33],[90,27],[89,52],[49,57]],[[50,33],[48,66],[37,92]]],
  盾:[[[32,15],[60,10],[86,5]],[[30,17],[26,54],[18,80],[7,97]],[[37,33],[65,29],[94,24]],[[65,17],[65,48]],[[44,51],[45,96]],[[44,51],[86,46],[87,91],[45,96]],[[47,66],[84,61]],[[47,81],[84,76]]],
  在:[[[9,27],[51,22],[94,17]],[[48,6],[38,35],[24,57],[6,73]],[[28,53],[30,96]],[[41,56],[67,52],[92,48]],[[67,33],[68,88]],[[35,96],[67,92],[98,87]]],
  这:[[[51,7],[57,13],[62,22]],[[35,32],[64,27],[94,22]],[[78,31],[66,51],[47,66],[32,73]],[[46,41],[64,52],[81,65],[94,69]],[[11,18],[16,23],[22,30]],[[5,47],[26,41],[19,58],[25,66],[15,82]],[[8,83],[26,79],[43,89],[66,94],[96,89]]],
  儿:[[[37,13],[37,42],[32,70],[22,87],[7,98]],[[64,8],[65,43],[66,79],[70,91],[85,92],[95,87],[97,73]]],
  打:[[[4,36],[34,29]],[[20,9],[21,54],[21,87],[15,96],[6,87]],[[5,67],[23,53],[38,42]],[[40,23],[66,18],[95,14]],[[73,20],[74,53],[74,86],[67,96],[53,85]]],
  开:[[[10,17],[49,14],[87,10]],[[4,43],[48,39],[93,35]],[[32,18],[32,51],[27,75],[14,92]],[[68,15],[68,52],[68,89]]],
  还:[[[36,22],[65,17],[95,12]],[[71,20],[60,40],[44,57],[30,67]],[[64,35],[65,78]],[[76,41],[86,51],[95,58]],[[10,17],[16,23],[22,30]],[[5,47],[26,41],[18,59],[24,67],[14,82]],[[8,83],[26,80],[47,91],[69,95],[98,90]]],
  炮:[[[16,24],[12,38],[7,46]],[[28,7],[29,42],[24,70],[9,94]],[[43,23],[34,39]],[[28,58],[39,74],[44,85]],[[64,8],[53,31],[42,43]],[[56,27],[92,21],[91,61],[84,75],[75,69]],[[57,43],[76,39],[76,59],[58,63]],[[56,44],[56,80],[62,92],[83,94],[96,88],[98,76]]],
  现:[[[4,23],[35,18]],[[6,48],[34,43]],[[21,22],[22,76]],[[3,87],[24,78],[39,69]],[[46,15],[47,63]],[[46,15],[87,10],[88,56]],[[68,26],[67,54],[58,77],[39,95]],[[71,57],[71,83],[77,94],[92,91],[97,77]]],
  中:[[[13,30],[15,71]],[[13,30],[84,23],[85,65],[15,71]],[[50,7],[51,48],[52,96]]],
  已:[[[15,18],[80,12],[81,49]],[[17,55],[49,52],[81,49]],[[16,31],[17,77],[22,91],[40,95],[79,91],[92,83],[93,72]]],
  不:[[[8,21],[50,17],[92,12]],[[58,22],[45,44],[25,65],[5,79]],[[52,40],[53,69],[54,96]],[[66,45],[81,58],[94,73]]],
  构:[[[5,32],[38,26]],[[22,8],[23,52],[24,96]],[[22,35],[13,57],[3,74]],[[25,46],[35,57],[41,67]],[[63,9],[52,32],[42,45]],[[56,27],[93,21],[91,61],[85,89],[76,96],[65,88]],[[68,40],[57,63],[50,75],[75,69]],[[68,58],[76,70],[80,80]]],
  成:[[[24,29],[58,24],[94,19]],[[25,30],[23,58],[15,81],[5,95]],[[25,51],[51,46],[50,68],[44,87],[35,82]],[[63,5],[65,39],[73,70],[85,93],[97,77]],[[92,36],[78,61],[60,81],[46,94]],[[79,6],[87,11],[92,17]]],
  威:[[[23,29],[58,24],[95,19]],[[23,30],[22,58],[14,82],[5,95]],[[34,46],[55,43],[75,39]],[[51,46],[39,66],[60,77],[78,91]],[[28,67],[54,61],[79,56]],[[68,56],[57,77],[39,90],[24,95]],[[74,6],[76,41],[82,74],[92,95],[99,78]],[[98,37],[85,60],[69,81]],[[86,7],[93,12],[97,17]]],
  胁:[[[8,18],[9,60],[4,93]],[[8,18],[33,13],[34,86],[27,95],[19,87]],[[11,42],[31,38]],[[11,64],[31,59]],[[42,38],[78,31],[77,59],[70,88],[61,94],[51,85]],[[61,10],[61,43],[53,69],[39,88]],[[86,44],[92,51],[97,59]],[[84,69],[91,77],[96,85]]],
  优:[[[28,10],[17,34],[4,52]],[[18,31],[19,95]],[[36,35],[67,29],[96,23]],[[59,8],[59,41],[51,70],[35,93]],[[72,33],[72,75],[77,92],[91,91],[98,78]],[[79,8],[86,14],[91,21]]],
  势:[[[5,24],[33,19]],[[20,6],[20,31],[21,49],[14,56],[6,49]],[[5,44],[22,33],[37,24]],[[41,22],[71,16],[70,37],[76,49],[89,50],[96,39]],[[60,5],[57,28],[45,48],[33,57]],[[65,30],[72,35],[77,42]],[[14,72],[80,63],[78,82],[70,96],[58,89]],[[48,53],[44,74],[31,88],[13,98]]],
};
export const MECHANISM_LETTER_STROKES=Object.freeze(letters);
export const MECHANISM_CUES=Object.freeze([
  Object.freeze({id:'shield-intro',text:'我们安装了护盾',lines:['我们安装了','护盾'],sketch:'shield'}),
  Object.freeze({id:'shield-open',text:'在这儿打开',lines:['在这儿打开'],target:'shield'}),
  Object.freeze({id:'cannon-intro',text:'我们还安装了防空炮',lines:['我们还安装了','防空炮'],sketch:'burst'}),
  Object.freeze({id:'cannon-open',text:'在这儿',lines:['在这儿'],target:'cannon'}),
  Object.freeze({id:'sky-secure',text:'现在空中已不构成威胁',lines:['现在空中已','不构成威胁'],center:true}),
  Object.freeze({id:'advantage',text:'优势在我！',lines:['优势在我！'],center:true,emphasis:1.25}),
]);
export const MECHANISM_TIMING=Object.freeze({write:1.4,hold:1.7,erase:1.05});
export const mechanismLead=(reduced,chapter=CHAPTER_TWO)=>(reduced?0:chapter.duration)+chapter.config.hold+(reduced?0:chapter.config.eraseDuration);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function mechanismPanel(view){
  const scale=Math.max(.08,Math.min(.95,(view.width-44)/560,view.height*.43/220)),width=560*scale,height=220*scale;
  return{x:(view.width-width)/2,y:Math.max(24,view.height*.36-height/2),width,height,scale};
}
export function createMechanismDrawing(index,view,targets={}){
  const cue=MECHANISM_CUES[index],panel=mechanismPanel(view),strokes=[],s=panel.scale;
  const add=(kind,points)=>strokes.push({kind,points:points.map(([x,y])=>({x:clamp(x,10,view.width-10),y:clamp(y,10,view.height-10)}))});
  const local=(kind,points)=>add(kind,points.map(([x,y])=>[panel.x+x*s,panel.y+y*s]));
  cue.lines.forEach((text,row)=>{
    const count=[...text].length,size=cue.emphasis??1,advance=(cue.target?88:77)*size,start=cue.target||cue.center?(560-count*advance)/2:17;
    [...text].forEach((letter,i)=>{
      const tilt=Math.sin(i*1.7+index)*.055,baseline=Math.sin(i*.8+index)*7,scale=.66*size;
      for(const stroke of letters[letter])local('letter',stroke.map(([x,y])=>{
        const px=(x-50)*scale,py=(y-50)*scale;
        return[start+i*advance+37*size+px*Math.cos(tilt)-py*Math.sin(tilt),row*108+44+baseline+px*Math.sin(tilt)+py*Math.cos(tilt)];
      }));
    });
  });
  if(cue.emphasis){
    const points=strokes.flatMap(stroke=>stroke.points),xs=points.map(p=>p.x),ys=points.map(p=>p.y),dx=view.width/2-(Math.min(...xs)+Math.max(...xs))/2,dy=view.height/2-(Math.min(...ys)+Math.max(...ys))/2;
    for(const p of points){p.x+=dx;p.y+=dy;}
  }
  if(cue.sketch==='shield'){
    local('shield',[[297,123],[332,110],[371,119],[369,151],[356,179],[334,198],[311,183],[299,155],[297,123]]);
    local('shield',[[309,131],[332,122],[358,128],[355,151],[348,171],[334,184]]);
    local('shield',[[333,130],[334,172]]);local('glint',[[280,131],[271,126]]);local('glint',[[383,114],[390,104]]);
  }
  if(cue.sketch==='burst'){
    local('rock',[[342,151],[335,131],[347,112],[365,106],[375,133],[342,151]]);
    local('rock',[[387,108],[405,116],[417,136],[393,149],[387,108]]);
    local('rock',[[344,166],[373,148],[381,185],[361,194],[345,184],[344,166]]);
    local('rock',[[399,165],[425,149],[428,171],[417,189],[398,192],[399,165]]);
    local('crack',[[376,117],[382,134],[373,144],[390,153],[385,176]]);
    local('hatch',[[347,128],[358,116]]);local('hatch',[[406,171],[418,158]]);
    for(const [x,y,dx,dy]of [[329,112,-12,-9],[413,107,12,-12],[438,151,17,0],[421,202,10,10],[338,202,-10,10],[323,166,-16,4]])local('burst',[[x,y],[x+dx,y+dy]]);
    local('chip',[[451,115],[461,116],[456,125],[451,115]]);local('chip',[[319,188],[314,197],[323,195],[319,188]]);
  }
  let target=null;
  if(cue.target&&targets[cue.target]){
    target={...targets[cue.target]};const start={x:panel.x+(cue.target==='shield'?340:245)*s,y:panel.y+106*s};
    const points=cue.target==='shield'?
      [[start.x,start.y],[start.x+44*s,start.y-5*s],[view.width-90,Math.min(target.y-140*s,start.y+75*s)],[view.width-48,Math.min(target.y-112*s,start.y+103*s)],[view.width-30,target.y-64*s],[target.x+22*s,target.y-23*s],[target.x,target.y]]:
      [[start.x,start.y],[start.x-74*s,start.y+26*s],[Math.max(22,target.x-94*s),target.y-124*s],[target.x-66*s,target.y-52*s],[target.x-20*s,target.y-24*s],[target.x,target.y]];
    add('arrow',points);
    const previous=points.at(-2),angle=Math.atan2(target.y-previous[1],target.x-previous[0]),r=22*Math.max(.6,s);
    add('arrow',[[target.x-Math.cos(angle-.55)*r,target.y-Math.sin(angle-.55)*r],[target.x,target.y],[target.x-Math.cos(angle+.55)*r,target.y-Math.sin(angle+.55)*r]]);
  }
  return createPencilDrawing(Object.freeze({text:cue.text,cue:cue.id,target,lines:cue.lines,width:view.width,height:view.height,delay:.04,writeDuration:MECHANISM_TIMING.write,hold:MECHANISM_TIMING.hold,eraseDuration:MECHANISM_TIMING.erase,strokeScale:1.55*(cue.emphasis??1)}),strokes);
}
export class MechanismGuidance{
  constructor(levels={}){this.levels=levels;this.startAt=null;this.serial=0;this.drawing=null;this.hint=null;this.key='';}
  start(level,time=0,reduced=false){this.stop();this.config=level==='man-2'?{cues:MECHANISM_CUES,createDrawing:createMechanismDrawing,chapter:CHAPTER_TWO}:this.levels[level];if(!this.config)return;this.startAt=time;this.serial++;this.initialReduced=reduced;this.lead=mechanismLead(reduced,this.config.chapter);}
  stop(){this.startAt=null;this.hint?.stop();this.drawing=null;this.key='';}
  snapshot(time,reduced,view,targets){
    const hidden={stage:'hidden',cue:null,index:-1,text:'',serial:this.serial};
    if(this.startAt===null||time<this.startAt+this.lead)return hidden;
    const write=this.initialReduced?0:MECHANISM_TIMING.write,erase=this.initialReduced?0:MECHANISM_TIMING.erase,duration=write+MECHANISM_TIMING.hold+erase;
    const elapsed=time-this.startAt-this.lead,index=Math.floor((elapsed+1e-8)/duration);
    if(index>=this.config.cues.length){this.drawing=null;return{...hidden,stage:'done'};}
    const cue=this.config.cues[index],target=targets?.[cue.target],key=[this.serial,index,view.width,view.height,target?.x?.toFixed(1),target?.y?.toFixed(1)].join(':');
    const cueStart=this.startAt+this.lead+index*duration;
    if(this.key!==key){this.key=key;this.drawing=this.config.createDrawing(index,view,targets);this.hint=new PencilHint(this.drawing);this.hint.start(cueStart,this.initialReduced);}
    const eraseAt=cueStart+write+MECHANISM_TIMING.hold;if(time>=eraseAt)this.hint.erase(eraseAt,reduced);
    return{...this.hint.snapshot(time,reduced),cue:cue.id,index,text:cue.text,serial:this.serial*10+index,target:this.drawing.config.target};
  }
}
