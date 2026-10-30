const clamp=n=>Math.max(0,Math.min(1,n));
export const HINT=Object.freeze({text:'狂点这里',width:420,height:244,tip:{x:361,y:224},delay:.08,writeDuration:1.4,eraseDuration:1.05});
// Hand-drawn centerlines, in writing order. No font rendering or glyph substitution.
const characters=[
  {x:0,y:0,strokes:[
    [[27,10],[20,23],[7,38]],[[8,23],[19,31],[27,46],[26,73],[20,89],[13,83]],[[23,44],[14,58],[3,69]],
    [[40,24],[59,21],[77,20]],[[37,48],[54,45],[73,42]],[[57,23],[58,48],[60,78]],[[35,83],[57,79],[84,73]],
  ]},
  {x:101,y:3,strokes:[
    [[52,8],[52,23],[50,43]],[[53,25],[65,24],[81,21]],[[24,45],[25,55],[27,67]],
    [[25,44],[48,41],[72,39],[71,52],[70,64]],[[27,67],[48,65],[72,63]],
    [[21,79],[17,86],[12,91]],[[39,78],[41,84],[42,91]],[[58,77],[61,83],[65,88]],[[77,76],[83,80],[89,85]],
  ]},
  {x:203,y:-1,strokes:[
    [[57,9],[61,12],[65,18]],[[37,29],[59,27],[85,23]],[[75,29],[68,43],[56,59],[39,70]],
    [[46,37],[61,49],[79,61],[90,64]],[[15,20],[18,24],[21,30]],
    [[9,46],[26,40],[19,55],[25,61],[16,76]],[[11,77],[23,73],[40,81],[61,86],[94,82]],
  ]},
  {x:306,y:1,strokes:[
    [[22,15],[23,33],[24,55]],[[23,15],[48,12],[77,10],[77,29],[76,50]],
    [[25,35],[49,32],[73,30]],[[26,55],[49,53],[76,50]],[[50,15],[50,43],[49,84]],
    [[18,70],[49,67],[82,64]],[[9,92],[49,88],[92,84]],
  ]},
];
const strokes=characters.flatMap(c=>c.strokes.map(points=>({kind:'letter',points:points.map(([x,y])=>({x:x+c.x,y:y+c.y}))})));
strokes.push(
  {kind:'arrow',points:[{x:225,y:135},{x:249,y:125},{x:272,y:128},{x:291,y:149},{x:288,y:172},{x:267,y:190},{x:247,y:186},{x:249,y:171},{x:270,y:156},{x:296,y:155},{x:323,y:168},{x:345,y:193},{x:361,y:224}]},
  {kind:'arrow',points:[{x:326,y:216},{x:343,y:216},{x:361,y:224}]},
  {kind:'arrow',points:[{x:361,y:224},{x:363,y:204},{x:370,y:188}]},
);
function smooth(points){
  const result=[points[0]];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    const count=Math.max(5,Math.ceil(Math.hypot(c.x-b.x,c.y-b.y)/1.3));
    for(let j=1;j<=count;j++){
      const t=j/count,t2=t*t,t3=t2*t,axis=k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);
      result.push({x:axis('x'),y:axis('y')});
    }
  }
  return result;
}
const noise=seed=>{let n=Math.imul(seed+1,1597334677);n^=n>>>16;return(n>>>0)/4294967295;};
export function createPencilDrawing(config,sourceStrokes){
  let cursor=config.delay;
  const timedStrokes=sourceStrokes.map((stroke,index)=>{
    const points=smooth(stroke.points),distances=[0];
    for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    const length=distances.at(-1),duration=Math.max(.045,length/850),start=cursor,end=start+duration;
    cursor=end+.028;
    return{index,kind:stroke.kind,points,distances,length,start,end};
  });
  // Preserve stroke order and rhythm, with a fixed deadline for the whole sketch.
  const scale=(config.writeDuration-config.delay)/(timedStrokes.at(-1).end-config.delay);
  const strokes=Object.freeze(timedStrokes.map(s=>({...s,start:config.delay+(s.start-config.delay)*scale,end:config.delay+(s.end-config.delay)*scale})));
  const segments=strokes.flatMap(s=>s.points.slice(1).map((b,i)=>({a:s.points[i],b,time:s.start+(s.end-s.start)*s.distances[i+1]/s.length})));
  const eraserChunks=Object.freeze(Array.from({length:35},(_,i)=>{
    const row=Math.floor(i/7),column=row%2?6-i%7:i%7;
    return{x:column*config.width/7-6,y:(row+.5)*config.height/5+(noise(i*9)-.5)*3,width:config.width/7+12,height:config.height/5+14.2+(noise(i*7)-.5)*4,tilt:(noise(i*11)-.5)*4};
  }));
  return Object.freeze({config,strokes,segments,eraserChunks,duration:strokes.at(-1).end});
}
export const RADAR_DRAWING=createPencilDrawing(HINT,strokes);
export const PENCIL_STROKES=RADAR_DRAWING.strokes;
export const HINT_WRITE_DURATION=RADAR_DRAWING.duration;
export const ERASER_CHUNKS=RADAR_DRAWING.eraserChunks;
export function pencilHintLayout(v,target){
  const top=v.height<300?16:86;
  const scale=Math.max(.08,Math.min(.86,Math.max(.6,v.art*.82),(v.width-32)/HINT.width,(target.x-16)/HINT.tip.x,(v.width-target.x-16)/(HINT.width-HINT.tip.x),(target.y-top)/HINT.tip.y));
  return{x:target.x-HINT.tip.x*scale,y:target.y-HINT.tip.y*scale,scale,width:HINT.width*scale,height:HINT.height*scale,tip:{...target}};
}
export class PencilHint{
  constructor(drawing=RADAR_DRAWING){this.drawing=drawing;this.serial=0;this.startAt=null;this.eraseAt=null;this.eraseWriteTime=0;this.eraseDuration=drawing.config.eraseDuration;this.immediate=false;}
  start(time=0,reduced=false){this.serial++;this.startAt=time;this.eraseAt=null;this.eraseWriteTime=0;this.eraseDuration=this.drawing.config.eraseDuration;this.immediate=reduced;}
  stop(){this.startAt=null;}
  setReduced(reduced){if(reduced){this.immediate=true;if(this.eraseAt!==null)this.eraseDuration=0;}}
  erase(time,reduced=false){
    if(this.startAt===null||this.eraseAt!==null)return false;
    const duration=this.drawing.duration;
    this.eraseWriteTime=this.immediate?duration:Math.min(duration,Math.max(0,time-this.startAt));this.eraseAt=time;this.eraseDuration=reduced?0:this.drawing.config.eraseDuration;return true;
  }
  snapshot(time,reduced=false){
    if(this.startAt===null)return{stage:'hidden',serial:this.serial,writeTime:0,writeProgress:0,eraseProgress:0,completedStrokes:0};
    const duration=this.drawing.duration;
    const writeTime=this.eraseAt===null?Math.min(duration,Math.max(0,time-this.startAt)):this.eraseWriteTime;
    const erased=this.eraseAt!==null,eraseProgress=erased?(this.eraseDuration?clamp((time-this.eraseAt)/this.eraseDuration):1):0;
    const shownTime=reduced||this.immediate?duration:writeTime;
    return{stage:erased?(eraseProgress>=1?'done':'erasing'):(shownTime>=duration?'shown':'writing'),serial:this.serial,
      writeTime:shownTime,writeProgress:shownTime/duration,eraseProgress,completedStrokes:this.drawing.strokes.filter(s=>s.end<=shownTime).length};
  }
}
function pencilSegment(ctx,segment,index,color,strokeScale=1){
  const {a,b}=segment,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
  ctx.strokeStyle=color;ctx.fillStyle=color;
  for(let fiber=0;fiber<3;fiber++){
    const seed=index*17+fiber*563,offset=((fiber-1)*1.25+(noise(seed)-.5)*.55)*strokeScale;
    if(fiber&&noise(seed+4)<.16)continue;
    ctx.globalAlpha=fiber?.29+noise(seed+1)*.25:.40;ctx.lineWidth=(fiber?.65+noise(seed+2)*.55:2.3)*strokeScale;
    ctx.beginPath();ctx.moveTo(a.x+nx*offset,a.y+ny*offset);ctx.lineTo(b.x+nx*offset,b.y+ny*offset);ctx.stroke();
  }
  if(noise(index*23)<.38){ctx.globalAlpha=.2+noise(index*13)*.3;ctx.beginPath();ctx.arc(b.x+nx*(noise(index*5)-.5)*4.2,b.y+ny*(noise(index*5)-.5)*4.2,.2+noise(index*7)*.35,0,Math.PI*2);ctx.fill();}
}
// Two transparent, reusable layers isolate erasing from the sky and gameplay canvas.
export class PencilHintRenderer{
  constructor(makeCanvas=()=>document.createElement('canvas'),drawing=RADAR_DRAWING){
    this.drawing=drawing;
    const {width,height}=drawing.config;
    this.ink=makeCanvas();this.rubbed=makeCanvas();
    for(const canvas of [this.ink,this.rubbed]){canvas.width=width*2;canvas.height=height*2;}
    this.inkContext=this.ink.getContext('2d');this.rubContext=this.rubbed.getContext('2d');
    this.inkContext.setTransform(2,0,0,2,0,0);this.inkContext.lineCap='round';this.serial=-1;this.next=0;this.lastTime=-1;this.color='';
  }
  draw(ctx,frame,layout,dark=false){
    if(frame.stage==='hidden'||frame.stage==='done')return;
    const {segments,eraserChunks,config:{width,height}}=this.drawing;
    const color=this.drawing.config.colors?.[dark?'dark':'light']??(dark?'#b1b1b1':'#686868');
    if(this.serial!==frame.serial||frame.writeTime<this.lastTime||color!==this.color){
      this.inkContext.clearRect(0,0,width,height);this.next=0;this.serial=frame.serial;this.color=color;
    }
    while(this.next<segments.length&&segments[this.next].time<=frame.writeTime){pencilSegment(this.inkContext,segments[this.next],this.next,color,this.drawing.config.strokeScale??1);this.next++;}
    this.lastTime=frame.writeTime;let layer=this.ink;
    if(frame.stage==='erasing'){
      const rub=this.rubContext;rub.save();rub.setTransform(1,0,0,1,0,0);rub.clearRect(0,0,this.rubbed.width,this.rubbed.height);rub.drawImage(this.ink,0,0);
      rub.setTransform(2,0,0,2,0,0);rub.globalCompositeOperation='destination-out';rub.lineCap='round';rub.globalAlpha=1;
      for(let i=0;i<eraserChunks.length;i++){
        const amount=clamp(frame.eraseProgress*eraserChunks.length-i);if(!amount)break;
        const e=eraserChunks[i];rub.lineWidth=e.height;rub.beginPath();rub.moveTo(e.x,e.y);rub.lineTo(e.x+e.width*amount,e.y+e.tilt*amount);rub.stroke();
      }
      rub.restore();layer=this.rubbed;
    }
    ctx.save();ctx.globalAlpha=this.drawing.config.opacity??(dark?.46:.52);ctx.drawImage(layer,layout.x,layout.y,layout.width,layout.height);ctx.restore();
  }
}
