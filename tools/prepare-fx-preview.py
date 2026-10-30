"""Prepare isolated preview assets and facility art; never modify the live game."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'dist/preview'
out.mkdir(exist_ok=True)
data=json.loads((ROOT/'dist/assets/glyphs.json').read_text(encoding='utf-8'))
assert [g['id'] for g in data['glyphs']]==['yahei','simsun','youyuan']
(out/'glyphs.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
game=(ROOT/'dist/game.js').read_text(encoding='utf-8')
art=game[game.index('function drawShelter()'):game.index('function drawPerson(p)')]
art=art.replace('-.30*Math.sin(age*24)*Math.exp(-4.5*age):0','-.30*Math.sin(age*24)*Math.exp(-4.5*age):Math.sin(model.realTime*1.6)*.013')
art=art.replace('ctx.scale(s,s);\n  if(!front)', 'ctx.scale(s*(1+Math.sin(model.realTime*2.1)*.012),s*(1-Math.sin(model.realTime*2.1)*.012));\n  if(!front)')
art=art.replace('ctx.rotate(-.45+press*.018-release*.025)', 'ctx.rotate(-.45+press*.018-release*.025+idleScan(model.realTime))')
art=art.replace('ctx.rotate(press*.025-release*.028)', 'ctx.rotate(press*.025-release*.028+Math.sin(model.realTime*2.2)*.008)')
prefix='''// Isolated copy of the approved facility geometry, with preview-only idle motion.
export const idleScan=t=>Math.sin(t*.9)*.028;
export function drawFacilities(ctx,state,metrics){
 const palette={red:'#da3e3e',redSide:'#982b35',blue:'#3da9db',blueSide:'#236b9b',green:'#43ad64',greenSide:'#287344'};
 const model={realTime:state.time},camera={z:1},reduced=false,shelterPulse=-10;
 const buildingTime=()=>model.realTime;
 const CONFIG={ground:state.ground,shelterX:280,foodX:700};
 const RADAR_X=1240,RADAR_SCALE=1.8;
 const artScale=()=>metrics.art;
 const project=(x,y)=>({x:x*metrics.sx,y:y*metrics.sy});
 const radarPose=()=>({press:0,release:state.time-state.launchTime>=0&&state.time-state.launchTime<.5?Math.sin((state.time-state.launchTime)*20)*Math.exp(-(state.time-state.launchTime)*7):0,scan:idleScan(state.time),antenna:Math.sin(state.time*2.2)*.008});
'''
(out/'facilities.js').write_text(prefix+art+'\n drawShelter();drawFood(false);drawFood(true);drawRadar();\n}\n',encoding='utf-8')
print(json.dumps({'previewFonts':[g['id'] for g in data['glyphs']],'files':['preview/glyphs.json','preview/facilities.js']},ensure_ascii=True))
