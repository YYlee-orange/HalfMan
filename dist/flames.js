import {variantOf} from './variants.js';
import {meteorView,personView} from './body-geometry.js';
import {bombletView} from './bomb-physics.js';
import {CUT} from './cut-settings.js';
export class FlameTracks{
  constructor(){this.clear();}
  clear(){this.trails=new Map();}
  remember(body,kind,point,time,metrics){
    let trail=this.trails.get(body.id);
    if(!trail){trail={id:body.id,kind,size:body.size,ratio:body.ratio??(kind==='bomblet'?body.width/body.height:variantOf(body.variantId).ratio),palette:kind==='bomblet'?'blue':undefined,born:body.cutMotion?body.releaseAt:time,visibleAt:body.cutMotion?body.releaseAt:undefined,birthSize:kind==='man'?body.birthSize:body.size,points:[],ended:null,reason:null};this.trails.set(body.id,trail);}
    if(body.source==='volcano'||body.volcanoTrail){
      trail.volcanic=true;
      trail.ascending=kind==='meteor'&&body.source==='volcano'&&body.fallStartedAt==null;
    }
    const q={x:point.x/metrics.sx,y:point.y/metrics.sy,time},last=trail.points.at(-1);
    if(!last||time-last.time>=.012||Math.hypot((last.x-q.x)*metrics.sx,(last.y-q.y)*metrics.sy)>2)trail.points.push(q);
    else if(last.time===time)trail.points[trail.points.length-1]=q;
    while(trail.points.length>2&&time-trail.points[0].time>(kind==='bomblet'?CUT.bombChildTrail:.82))trail.points.shift();
    return trail;
  }
  end(id,reason,time){const t=this.trails.get(id);if(t&&t.ended===null){t.ended=time;t.reason=reason;}}
  event(event,model){
    if(event.type==='nuclearBlast'){this.clear();return;}
    const v=model.view,time=event.sceneTime,pose=model.radarPose(),ground=model.ground;
    if(event.type==='summon'&&event.meteor)this.remember(event.meteor,'meteor',meteorView(event.meteor,v),time,v);
    if(event.type==='bombArm')this.end(event.id,'arming',time);
    if(event.type==='bombBurst')for(const c of event.children)this.remember(c,'bomblet',bombletView(c,v),time,v);
    if(event.type==='bombletImpact'){this.remember(event.child,'bomblet',bombletView(event.child,v),time,v);this.end(event.id,'landing',time);}
    if(event.type==='cut'&&event.meteor){
      const release=time+Math.max(0,(event.releaseAt??event.time)-event.time);
      const origin=meteorView(event.meteor,v);this.remember(event.meteor,'meteor',origin,time,v);this.end(event.id,'split',release);
      for(const id of event.children){const p=model.people.find(p=>p.id===id);if(!p)continue;
        const t=this.remember(p,'man',origin,time,v);t.reason='branch';t.born=release;t.visibleAt=release;
        t.points.push({x:personView(p,v,ground,time,pose).x/v.sx,y:personView(p,v,ground,time,pose).y/v.sy,time});
      }
    }
    if(event.type==='impact'&&event.meteor){this.remember(event.meteor,'meteor',meteorView(event.meteor,v),time,v);this.end(event.id,'landing',time);}
    if(event.type==='land'&&event.person){this.remember(event.person,'man',personView(event.person,v,ground,time,pose),time,v);this.end(event.id,'landing',time);}
    if(event.type==='death')this.end(event.id,'death',time);
    if(event.type==='cannonHit')this.end(event.id,'shotDown',time);
  }
  sync(model){
    const time=model.sceneTime,v=model.view,pose=model.radarPose();
    for(const m of model.meteors)if(!m.arm)this.remember(m,'meteor',meteorView(m,v),time,v);
    for(const c of model.bomblets??[])this.remember(c,'bomblet',bombletView(c,v),time,v);
    for(const p of model.people)if(p.state==='fall'&&!p.noTrail)this.remember(p,'man',personView(p,v,model.ground,time,pose),time,v);
    for(const [id,t]of this.trails)if(t.ended!==null&&time-t.ended>(t.reason==='split'?.42:.3))this.trails.delete(id);
  }
}
