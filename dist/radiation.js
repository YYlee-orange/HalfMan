const TAU=Math.PI*2,HALF=Math.PI/6;
export function drawRadiation(ctx,x,y,r,color){
  ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=r*.08;
  ctx.beginPath();ctx.arc(0,0,r*.94,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.095,0,TAU);ctx.fill();
  for(let i=0;i<3;i++){const a=-Math.PI/6+i*TAU/3;ctx.beginPath();ctx.arc(0,0,r*.78,a-HALF,a+HALF);ctx.arc(0,0,r*.18,a+HALF,a-HALF,true);ctx.closePath();ctx.fill();}ctx.restore();
}
export function radiationSketch(x,y,r){
  const p=(a,radius)=>({x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius}),arc=(a,b,radius,n=14)=>Array.from({length:n+1},(_,i)=>p(a+(b-a)*i/n,radius));
  const strokes=[arc(0,TAU,r*.94,40),arc(0,TAU,r*.095,16)];
  for(let i=0;i<3;i++){
    const a=-Math.PI/6+i*TAU/3,fan=[...arc(a-HALF,a+HALF,r*.78),...arc(a+HALF,a-HALF,r*.18)];fan.push(fan[0]);strokes.push(fan);
    for(const radius of [.32,.48,.64])strokes.push(arc(a-HALF+.03,a+HALF-.03,r*radius,7));
  }
  return strokes;
}
