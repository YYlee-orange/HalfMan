// Hand-drawn 饭 centerlines, using the bowl's existing dark green and transform.
export const RICE_STROKES=Object.freeze([
  [[-20,-39],[-23,-34],[-28,-28]],
  [[-26,-29],[-17,-30],[-20,-24]],
  [[-23,-24],[-24,-13],[-16,-17]],
  [[4,-39],[-3,-36],[-12,-34]],
  [[-12,-34],[-12,-25],[-15,-17],[-19,-11]],
  [[-9,-29],[5,-30],[1,-23],[-5,-16],[-12,-11]],
  [[-10,-27],[-5,-22],[1,-16],[9,-11]],
]);
export function drawRiceMark(ctx,color){
  ctx.save();ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  RICE_STROKES.forEach((stroke,i)=>{ctx.lineWidth=i%3===0?2.5:2.2;ctx.beginPath();stroke.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();});ctx.restore();
}
