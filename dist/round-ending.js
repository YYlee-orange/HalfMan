import {meteorView} from './body-geometry.js';
import {bombletView} from './bomb-physics.js';

// A cosmetic clock keeps debris and fading trails alive after simulation stops.
export class RoundEnding{
  constructor(){this.reset();}
  reset(){this.phase='idle';this.elapsed=0;this.delay=0;this.count=0;}
  get pending(){return this.phase==='exploding';}
  start(model,reduced=false){
    if(this.phase!=='idle'||model.status!=='ended')return [];
    // Every timed round shares the same ending, including newly added levels.
    const bodies=[
      ...model.meteors.filter(m=>!m.impacted&&!m.exploded&&!m.shotDown).map(body=>({body,point:meteorView(body,model.view),kind:body.kind})),
      ...model.bomblets.filter(c=>!c.impacted&&!c.shotDown).map(body=>({body,point:bombletView(body,model.view),kind:'child'})),
    ];
    const bursts=bodies.map(({body,point,kind})=>({id:body.id,kind,x:point.x/model.view.sx,y:point.y/model.view.sy,tone:body.tone??0,sceneTime:model.sceneTime}));
    if(model.nuclear.bomb)bursts.push({id:model.nextId++,kind:'nuclear',x:model.nuclear.bomb.x,y:model.nuclear.bomb.y,sceneTime:model.sceneTime});model.nuclear.cancel();
    model.meteors=[];model.bomblets=[];model.cannon.bullets=[];model.cannon.trigger=false;model.cannon.aiming=false;model.cannon.lastShot=-10;model.cannon.kicks=[];
    this.phase='exploding';this.count=bursts.length;this.delay=reduced?.24:bursts.length?1:.28;
    return bursts;
  }
  step(dt){
    if(this.phase==='idle'||!Number.isFinite(dt)||dt<=0)return false;
    this.elapsed+=dt;
    if(this.pending&&this.elapsed+1e-9>=this.delay){this.phase='results';return true;}
    return false;
  }
  snapshot(){return{phase:this.phase,elapsed:this.elapsed,delay:this.delay,count:this.count};}
}
