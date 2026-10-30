export function jumpProgress(jump){
  const anticipation=jump.anticipation||0;
  return Math.max(0,Math.min(1,(jump.elapsed-anticipation)/(jump.duration-anticipation)));
}
