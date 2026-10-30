export const PROGRESSION=Object.freeze({interval:30,summonStep:.2,radarStep:.05,radarCap:1.5,growthDuration:.9});
export function progressionAt(elapsed){
  const time=Number.isFinite(elapsed)?Math.max(0,elapsed):0,stage=Math.floor((time+1e-8)/PROGRESSION.interval);
  // Integer fifths avoid a phantom bonus chance at exact integer multipliers.
  const summonUnits=5+stage;
  // The same smooth scale drives geometry, hit tests, anchors and charge accounting.
  const radarTargetFactor=Math.min(PROGRESSION.radarCap,1+stage*PROGRESSION.radarStep),previous=Math.min(PROGRESSION.radarCap,1+Math.max(0,stage-1)*PROGRESSION.radarStep);
  const growthProgress=stage===0?1:Math.max(0,Math.min(1,(time-stage*PROGRESSION.interval)/PROGRESSION.growthDuration));
  const eased=growthProgress*growthProgress*(3-2*growthProgress),radarFactor=previous+(radarTargetFactor-previous)*eased;
  return{stage,summonMultiplier:summonUnits/5,guaranteed:Math.floor(summonUnits/5),extraChance:(summonUnits%5)/5,radarFactor,radarTargetFactor,growthProgress};
}
