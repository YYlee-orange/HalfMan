import {createPencilDrawing} from './pencil-hint.js';

// Preserve the game's graphite tutorial language. DESIGN_VARIANCE 5,
// MOTION_INTENSITY 4, VISUAL_DENSITY 2: a brief, sparse gameplay instruction.
export const CUT_HINT=Object.freeze({text:'划动切开陨石',width:500,height:276,delay:.06,writeDuration:1.4,eraseDuration:1.05});
// Explicit pen centerlines keep both the lettering and the sketch writable.
const characters=[
  {x:4,y:2,strokes:[ // 划
    [[6,34],[30,29],[56,23]],[[30,7],[33,38],[42,65],[55,83],[61,70]],
    [[53,37],[40,58],[25,78],[8,91]],[[45,10],[51,15],[55,22]],
    [[72,23],[73,43],[73,62]],[[90,7],[89,48],[88,81],[82,93],[72,87]],
  ]},
  {x:110,y:0,strokes:[ // 动
    [[7,17],[28,16],[49,13]],[[3,34],[28,32],[53,29]],
    [[27,34],[17,53],[12,66],[31,64],[48,60]],[[40,48],[47,60],[52,72]],
    [[61,29],[89,24],[87,56],[82,84],[73,90],[64,82]],[[75,10],[72,42],[62,69],[49,89]],
  ]},
  {x:218,y:3,strokes:[ // 切
    [[5,35],[27,29],[47,24]],[[21,8],[21,46],[23,61],[32,64],[45,59],[47,50]],
    [[56,21],[90,16],[88,49],[81,84],[72,90],[62,82]],[[69,24],[64,57],[56,75],[48,84]],
  ]},
  {x:326,y:0,strokes:[ // 开
    [[10,17],[49,14],[87,10]],[[4,43],[48,39],[93,35]],
    [[32,18],[32,51],[27,75],[14,92]],[[68,15],[68,52],[68,89]],
  ]},
  {x:100,y:124,strokes:[ // 陨
    [[7,12],[29,8],[22,31],[31,47],[29,58],[18,57]],[[7,13],[8,52],[9,93]],
    [[44,14],[44,37]],[[44,14],[82,9],[83,32]],[[44,37],[63,35],[81,32]],
    [[41,47],[42,75]],[[42,47],[86,41],[87,72]],
    [[64,51],[63,69],[55,82],[33,96]],[[68,78],[81,85],[94,93]],
  ]},
  {x:210,y:127,strokes:[ // 石
    [[8,19],[48,16],[87,12]],[[42,18],[32,40],[16,63],[4,73]],
    [[34,52],[35,88]],[[34,52],[82,46],[82,82]],[[35,88],[58,85],[82,82]],
  ]},
];
const strokes=characters.flatMap(c=>c.strokes.map(points=>({kind:'letter',points:points.map(([x,y])=>({x:x+c.x,y:y+c.y}))})));
export const CUT_LETTER_STROKES=Object.freeze({陨:characters[4].strokes,石:characters[5].strokes});
const sketch=(kind,points)=>({kind,points:points.map(([x,y])=>({x,y}))});
// Two offset rock halves, sparse graphite hatching, and a single swipe between them.
strokes.push(
  sketch('rock',[[363,187],[345,172],[343,153],[354,134],[378,124],[398,129],[409,142],[363,187]]),
  sketch('rock',[[387,211],[432,166],[447,178],[454,200],[445,224],[420,238],[399,232],[387,211]]),
  sketch('hatch',[[352,159],[369,141]]),sketch('hatch',[[355,173],[386,139]]),sketch('hatch',[[365,175],[399,140]]),
  sketch('hatch',[[398,215],[432,181]]),sketch('hatch',[[407,224],[442,188]]),sketch('hatch',[[421,225],[443,205]]),
  sketch('slash',[[329,249],[368,211],[411,170],[469,112]]),
  sketch('motion',[[336,137],[329,129]]),sketch('motion',[[372,113],[370,104]]),
  sketch('motion',[[459,222],[467,229]]),sketch('motion',[[424,246],[425,256]]),
);
export const CUT_DRAWING=createPencilDrawing(CUT_HINT,strokes);
export function cutHintLayout(view){
  const {width,height}=view,top=height<300?16:92;
  const scale=Math.max(.05,Math.min(.95,(width-40)/CUT_HINT.width,(height-2*top)/CUT_HINT.height));
  const w=CUT_HINT.width*scale,h=CUT_HINT.height*scale;
  return{x:(width-w)/2,y:(height-h)/2,width:w,height:h,scale};
}
