export const SCORE_METEOR=Object.freeze({
  chance:.02,cutPoints:17,idleTimeout:.8,cutLimitMin:39,cutLimitMax:49,chargeDuration:.46,
  fragmentMin:6,fragmentMax:9,fragmentPoints:13,
  slowScale:.16,zoom:1.95,bodyScale:1.24,blur:5,minimumCutGap:.065,blastShake:50,blastShakeDuration:.6,
});
export const FRENZY_DEFAULTS=Object.freeze({frenzySlowScale:SCORE_METEOR.slowScale,frenzyZoom:SCORE_METEOR.zoom,frenzyBlur:SCORE_METEOR.blur,frenzyBlastShake:SCORE_METEOR.blastShake});
export const FRENZY_FIELDS=Object.freeze([
  {key:'frenzySlowScale',label:'连切世界速度',group:'分数陨石·特写',min:.03,max:1,step:.01,unit:'倍',scale:1},
  {key:'frenzyZoom',label:'连切最大特写倍率',group:'分数陨石·特写',min:1,max:2.5,step:.05,unit:'倍',scale:1},
  {key:'frenzyBlur',label:'连切背景模糊',group:'分数陨石·特写',min:0,max:14,step:.5,unit:'px',scale:1},
  {key:'frenzyBlastShake',label:'切爆震屏幅度',group:'分数陨石·特写',min:0,max:100,step:1,unit:'px',scale:1},
]);
