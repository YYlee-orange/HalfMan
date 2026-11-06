export const WEAPON_KEY='man-weapon-v1';
export const SCORE_METEOR_KEY='man-score-meteor-v1';
export function loadScoreMeteors(storage){try{return storage.getItem(SCORE_METEOR_KEY)!=='false';}catch{return true;}}
export const weaponName=type=>type==='laser'?'激光炮':'防空炮';
export function loadWeapon(storage){try{return storage.getItem(WEAPON_KEY)==='laser'?'laser':'cannon';}catch{return'cannon';}}
export function installWeaponChoice({button,dialog,onChange,onScoreChange=()=>{},onPause}){
  let storage;try{storage=window.localStorage;}catch{}
  let selected=loadWeapon(storage),scoreEnabled=loadScoreMeteors(storage);
  const scoreToggle=dialog.querySelector('#score-meteor-enabled');
  const choices=[...dialog.querySelectorAll('[data-weapon]')];
  function choose(type,persist=true){
    if(!['cannon','laser'].includes(type))return;
    selected=type;onChange(type);for(const node of choices)node.setAttribute('aria-pressed',String(node.dataset.weapon===type));
    dialog.querySelector('[data-weapon-status]').textContent=`已选择${weaponName(type)}`;
    button.textContent=`武器：${weaponName(type)}`;
    if(persist)try{storage?.setItem(WEAPON_KEY,type);}catch{}
  }
  function close(){dialog.close();button.setAttribute('aria-expanded','false');onPause(false);button.focus({preventScroll:true});}
  button.addEventListener('click',()=>{if(button.disabled)return;dialog.showModal();button.setAttribute('aria-expanded','true');onPause(true);choices.find(n=>n.dataset.weapon===selected)?.focus();});
  choices.forEach(node=>node.addEventListener('click',()=>choose(node.dataset.weapon)));
  dialog.querySelector('[data-weapon-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  scoreToggle.checked=scoreEnabled;onScoreChange(scoreEnabled);
  scoreToggle.addEventListener('change',()=>{scoreEnabled=scoreToggle.checked;onScoreChange(scoreEnabled);try{storage?.setItem(SCORE_METEOR_KEY,String(scoreEnabled));}catch{}});
  choose(selected,false);return{get selected(){return selected;},get scoreEnabled(){return scoreEnabled;}};
}
