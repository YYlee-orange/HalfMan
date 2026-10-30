const row=(key,label,group,min,max,step,unit='',scale=1)=>({key,label,group,min,max,step,unit,scale});
export const BOMB_FIELDS=Object.freeze([
  row('bombChance','慢！召唤概率','炸弹规则',0,1,.005,'%',100),row('bombPenalty','主爆炸扣分','炸弹规则',0,3000,10,'分'),
  row('bombExpand','圆形扩散时长','炸弹蓄爆',.03,1,.01,'ms',1000),row('bombContract','收缩变亮时长','炸弹蓄爆',.03,1,.01,'ms',1000),
  row('bombChargeRadius','蓄爆圆最大半径','炸弹蓄爆',30,420,5,'px'),row('bombChargeOpacity','蓄爆圆透明度','炸弹蓄爆',.02,.8,.01,'%',100),
  row('bombAirRadius','空中爆炸半径','炸弹爆炸',40,600,5,'px'),row('bombBlastDuration','爆炸显现时长','炸弹爆炸',.1,1.5,.01,'ms',1000),
  row('bombDebrisCount','主爆炸碎屑数量','炸弹爆炸',0,240,1,'个'),row('bombDebrisSpeed','碎屑飞散速度','炸弹爆炸',0,1600,10,'px/s'),
  row('bombDebrisSize','碎屑最大尺寸','炸弹爆炸',1,24,.5,'px'),row('bombDebrisGravity','碎屑重力','炸弹爆炸',50,2400,10,'px/s²'),
  row('bombShake','主爆炸震屏幅度','炸弹爆炸',0,80,1,'px'),row('bombShakeDuration','主爆炸震屏时长','炸弹爆炸',.05,1.5,.01,'ms',1000),
  row('bombChildSpeed','子母弹飞散初速度','子母弹散落',0,900,5,'px/s'),row('bombChildSpread','子母弹散射角度','子母弹散落',0,240,2,'°'),
  row('bombChildVariation','子母弹速度浮动','子母弹散落',0,.6,.01,'%',100),row('bombChildGravity','子母弹重力','子母弹散落',50,1600,5,'px/s²'),
  row('bombChildDrag','子母弹空气阻力','子母弹散落',0,4,.05),row('bombChildSpin','子母弹旋转速度','子母弹散落',0,1440,15,'°/s'),
  row('bombChildTrail','子母弹尾迹长度','子母弹散落',.06,.8,.01,'ms',1000),row('bombChildTrailWidth','子母弹尾迹宽度','子母弹散落',.25,2,.05,'倍'),
  row('bombChildHitScale','子母弹接触范围','子母弹散落',.3,1.5,.05,'倍'),
  row('bombGroundRadius','子母弹落地爆炸半径','子母弹落地',25,180,5,'px'),row('bombGroundShake','子母弹落地震屏','子母弹落地',0,40,1,'px'),
]);
export const BOMB_DEFAULTS=Object.freeze({bombChance:.05,bombPenalty:500,bombExpand:.18,bombContract:.24,bombChargeRadius:150,bombChargeOpacity:.20,
  bombAirRadius:230,bombBlastDuration:.5,bombDebrisCount:80,bombDebrisSpeed:480,bombDebrisSize:8,bombDebrisGravity:900,bombShake:32,bombShakeDuration:.48,
  bombChildSpeed:310,bombChildSpread:160,bombChildVariation:.18,bombChildGravity:440,bombChildDrag:.12,bombChildSpin:420,
  bombChildTrail:.34,bombChildTrailWidth:1,bombChildHitScale:.7,bombGroundRadius:78,bombGroundShake:13});
