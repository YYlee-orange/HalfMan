import {PencilHint,createPencilDrawing} from './pencil-hint.js';
import {CUT_LETTER_STROKES} from './cut-hint.js';

export const PRAISE_HINT=Object.freeze({text:'不赖',width:280,height:180,delay:.04,writeDuration:.8,eraseDuration:1.05,hold:1.1,angle:-12});
export const BOMB_HINT=Object.freeze({text:'「慢！」字号陨石，不要打！',width:560,height:300,delay:.06,writeDuration:1.4,eraseDuration:1.05,hold:2.2});
// Writable graphite centerlines. These are drawings, not rendered font outlines.
const letters={
  不:[[[9,20],[48,17],[88,12]],[[48,19],[39,43],[24,66],[6,82]],[[51,35],[51,64],[50,93]],[[63,48],[77,61],[91,75]]],
  赖:[[[4,21],[45,16]],[[9,33],[10,54]],[[9,33],[42,28],[41,51],[10,54]],[[26,7],[27,48],[26,92]],[[25,54],[15,72],[3,83]],[[29,55],[42,68],[48,78]],
    [[68,8],[58,24],[51,31]],[[65,18],[87,12],[79,31]],[[57,37],[58,70]],[[57,37],[88,31],[87,68]],[[74,43],[74,65],[65,80],[50,94]],[[78,76],[90,86],[97,93]]],
  慢:[[[9,30],[5,46]],[[22,23],[27,32]],[[18,7],[18,50],[18,94]],
    [[40,12],[41,34]],[[40,12],[81,9],[81,31],[41,34]],[[42,23],[79,20]],
    [[34,44],[35,60]],[[34,44],[89,39],[88,56],[35,60]],[[51,43],[52,58]],[[69,41],[69,56]],
    [[39,70],[82,65],[69,83],[49,93],[31,98]],[[44,72],[61,84],[85,95],[95,95]]],
  字:[[[47,8],[52,17]],[[17,28],[16,43]],[[17,28],[85,22],[81,38]],[[31,48],[71,43],[52,61],[53,85],[46,94],[35,91]],[[15,73],[49,69],[84,65]]],
  号:[[[27,13],[27,40]],[[27,13],[77,9],[77,36],[27,40]],[[10,53],[51,49],[90,45]],[[35,51],[29,70],[81,62],[77,84],[67,95],[52,90]]],
  要:[[[9,15],[50,12],[92,8]],[[18,28],[18,49]],[[18,28],[84,22],[83,45],[18,49]],[[40,14],[40,47]],[[61,11],[61,46]],
    [[45,49],[32,73],[75,90],[92,93]],[[10,65],[50,62],[93,57]],[[72,50],[63,73],[47,89],[16,98]]],
  打:[[[4,36],[43,29]],[[24,9],[23,80],[17,93],[8,87]],[[2,67],[24,56],[43,46]],[[49,24],[93,16]],[[73,21],[74,80],[68,95],[55,88]]],
  ...CUT_LETTER_STROKES,
};
const stroke=(kind,points)=>({kind,points:points.map(([x,y])=>({x,y}))});
function word(letter,x,y,scale=1){return letters[letter].map(points=>stroke('letter',points.map(([px,py])=>[x+px*scale,y+py*scale])));}
const praiseStrokes=[...word('不',24,39),...word('赖',142,38)].map(s=>({...s,points:s.points.map(p=>{
  const a=PRAISE_HINT.angle*Math.PI/180,x=p.x-140,y=p.y-90;return{x:140+x*Math.cos(a)-y*Math.sin(a),y:90+x*Math.sin(a)+y*Math.cos(a)};
})}));
export const PRAISE_DRAWING=createPencilDrawing(PRAISE_HINT,praiseStrokes);
const warningStrokes=[
  stroke('quote',[[20,13],[17,24]]),stroke('quote',[[29,11],[26,22]]),...word('慢',33,5,.78),
  stroke('punctuation',[[120,20],[118,57]]),stroke('punctuation',[[118,70],[119,71]]),
  stroke('quote',[[137,11],[134,22]]),stroke('quote',[[146,9],[143,20]]),
  ...word('字',164,6,.78),...word('号',249,8,.78),...word('陨',334,4,.78),...word('石',419,7,.78),
  ...word('不',52,145),...word('要',163,142),...word('打',274,143),
  stroke('punctuation',[[388,153],[385,206]]),stroke('punctuation',[[385,226],[386,227]]),
  // Open palm facing the viewer: thumb, four separate raised fingers, two creases.
  stroke('hand',[[450,234],[440,220],[438,209],[442,203],[448,204],[456,215],[457,169],[460,162],[464,161],[468,166],[468,200],
    [471,153],[474,146],[479,146],[483,152],[483,198],[486,161],[489,155],[494,156],[498,163],[498,204],
    [501,180],[505,176],[510,179],[513,186],[514,228],[511,246],[500,259],[478,264],[461,257],[451,244],[450,234]]),
  stroke('crease',[[459,232],[472,221],[487,220]]),stroke('crease',[[472,247],[487,241],[501,241]]),
];
export const BOMB_DRAWING=createPencilDrawing(BOMB_HINT,warningStrokes);
export function feedbackHintLayout(view,drawing){
  const {width,height}=view,top=height<300?16:92,config=drawing.config;
  const scale=Math.max(.05,Math.min(.95,(width-40)/config.width,(height-2*top)/config.height));
  const w=config.width*scale,h=config.height*scale;return{x:(width-w)/2,y:(height-h)/2,width:w,height:h,scale};
}
const visible=frame=>!['hidden','done'].includes(frame.stage);
export class TutorialFeedback{
  constructor(cutHint){this.cut=cutHint;this.praise=new PencilHint(PRAISE_DRAWING);this.warning=new PencilHint(BOMB_DRAWING);this.reset();}
  reset(){this.praise.stop();this.warning.stop();this.praisePending=false;this.praised=false;this.bombSeen=false;this.praisePausedAt=null;}
  setReduced(reduced){this.praise.setReduced(reduced);this.warning.setReduced(reduced);}
  onCut(time,reduced=false){if(this.cut.erase(time,reduced)&&!this.praised)this.praisePending=true;}
  rewardCut(time,reduced=false){
    if(this.praised)return false;
    this.praise.start(time,reduced);this.praisePending=false;this.praised=true;
    if(visible(this.warning.snapshot(time,reduced)))this.praisePausedAt=time;
    return true;
  }
  onBomb(time,reduced=false){
    if(this.bombSeen)return false;
    this.update(time,reduced);this.bombSeen=true;
    if(visible(this.praise.snapshot(time,reduced)))this.praisePausedAt=time;
    this.warning.start(time,reduced);return true;
  }
  update(time,reduced=false){
    if(this.warning.startAt!==null&&this.warning.eraseAt===null){
      const due=this.warning.startAt+(this.warning.immediate?0:BOMB_DRAWING.duration)+BOMB_HINT.hold;
      if(time>=due)this.warning.erase(due,reduced);
    }
    const warningVisible=visible(this.warning.snapshot(time,reduced));
    if(!warningVisible&&this.praisePausedAt!==null){
      const end=this.warning.eraseAt+this.warning.eraseDuration,shift=Math.max(0,end-this.praisePausedAt);
      this.praise.startAt+=shift;if(this.praise.eraseAt!==null)this.praise.eraseAt+=shift;this.praisePausedAt=null;
    }
    if(!warningVisible&&this.praisePending&&this.cut.snapshot(time,reduced).stage==='done'){
      this.rewardCut(time,reduced);
    }
    if(!warningVisible&&this.praise.startAt!==null&&this.praise.eraseAt===null){
      const due=this.praise.startAt+(this.praise.immediate?0:PRAISE_DRAWING.duration)+PRAISE_HINT.hold;
      if(time>=due)this.praise.erase(due,reduced);
    }
  }
  snapshot(time,reduced=false){
    this.update(time,reduced);
    const warning=this.warning.snapshot(time,reduced),praise=this.praise.snapshot(this.praisePausedAt??time,reduced),cut=this.cut.snapshot(time,reduced);
    return{active:visible(warning)?'warning':visible(praise)?'praise':visible(cut)?'cut':null,warning,praise,praisePending:this.praisePending,praised:this.praised,bombSeen:this.bombSeen};
  }
}
