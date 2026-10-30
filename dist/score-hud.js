import {ScoreFeedback,scorePanelLayout} from './score-feedback.js';
export class ScoreHUD{
  constructor(root,settings){this.root=root;this.feedback=new ScoreFeedback(settings);this.motion=root.querySelector('.score-motion');this.digits=root.querySelector('.score-digits');this.value=root.querySelector('#score');this.sources=root.querySelector('.score-sources');this.cells=[];this.rows=new Map();}
  reset(value=0){this.feedback.reset(value);this.render();}
  receive(change){this.feedback.receive(change);}
  step(dt){this.feedback.step(dt);}
  settle(value){this.feedback.settle(value);this.render();}
  layout(width,height){const p=scorePanelLayout(width,height);Object.assign(this.root.style,{top:`${p.top}px`,right:`${p.right}px`,width:`${p.width}px`});this.root.classList.toggle('score-compact',p.compact);}
  render(reduced=false){
    const s=this.feedback.snapshot(reduced);if(this.value.textContent!==String(s.target))this.value.textContent=String(s.target);
    this.root.dataset.tone=s.tone;
    this.motion.style.transform=`translateY(${s.y}px) rotate(${s.rotation}deg) scale(${s.scale})`;
    this.motion.style.setProperty('--score-flash',`${s.flash*100}%`);
    this.root.dataset.digits=String(s.target).length>=6?'long':'normal';
    while(this.cells.length>s.digits.length)this.cells.pop().cell.remove();
    for(let i=0;i<s.digits.length;i++){
      if(!this.cells[i]){const cell=document.createElement('span'),track=document.createElement('span');cell.className='score-digit';track.className='score-digit-track';const chars=Array.from({length:3},()=>{const span=document.createElement('span');track.append(span);return span;});cell.append(track);this.digits.append(cell);this.cells.push({cell,track,chars});}
      const d=s.digits[i],{cell,track,chars}=this.cells[i],base=Math.floor(d.position),fraction=d.position-base;
      for(let j=0;j<3;j++){const text=String(((base+j-1)%10+10)%10);if(chars[j].textContent!==text)chars[j].textContent=text;}
      track.style.transform=`translateY(${-1-fraction}em)`;cell.style.opacity=String(d.opacity);
    }
    const ids=new Set(s.groups.map(r=>r.id));for(const [id,row]of this.rows)if(!ids.has(id)){row.root.remove();this.rows.delete(id);}
    for(const r of s.groups){
      let row=this.rows.get(r.id);
      if(!row){const root=document.createElement('div'),line=document.createElement('div'),amount=document.createElement('strong'),label=document.createElement('span'),detail=document.createElement('div');root.className='score-source';line.className='score-source-line';amount.className='score-source-amount';label.className='score-source-label';detail.className='score-source-detail';line.append(amount,label);root.append(line,detail);row={root,amount,label,detail};this.rows.set(r.id,row);}
      const before=this.sources.children[s.groups.indexOf(r)];if(before!==row.root)this.sources.insertBefore(row.root,before??null);
      row.root.dataset.tone=r.tone;row.root.dataset.direction=String(r.direction);row.root.style.opacity=String(r.opacity);row.root.style.transform=`translateY(${r.y}px)`;
      row.amount.style.transform=`rotate(${r.rotation}deg) scale(${r.scale})`;
      if(row.amount.textContent!==r.amount)row.amount.textContent=r.amount;
      if(row.label.textContent!==r.label)row.label.textContent=r.label;
      if(row.detail.textContent!==r.detail)row.detail.textContent=r.detail;
    }
    return s;
  }
}
