export const NUCLEAR_DEFAULTS=Object.freeze({nuclearFlash:.5,nuclearCloudOpacity:.8});
export const NUCLEAR_FIELDS=Object.freeze([
  {key:'nuclearFlash',label:'核爆白光持续时间',group:'核弹效果',min:0,max:2,step:.01,unit:'ms',scale:1000},
  {key:'nuclearCloudOpacity',label:'蘑菇云整体不透明度',group:'核弹效果',min:0,max:1,step:.01,unit:'%',scale:100},
]);
