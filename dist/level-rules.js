const basic=Object.freeze({shield:false,cannon:false,farm:false,volcano:false,nuclear:false});
const defense=Object.freeze({...basic,shield:true,cannon:true});
const agriculture=Object.freeze({...defense,farm:true});
export const LEVEL_FEATURES=Object.freeze({
  'man-1':basic,
  'man-2':defense,
  'man-3':agriculture,
  'man-4':Object.freeze({...agriculture,volcano:true}),
  'man-5':Object.freeze({...agriculture,volcano:true,nuclear:true}),
});
export const AVAILABLE_LEVEL_COUNT=Object.keys(LEVEL_FEATURES).length;
export const levelFeatures=id=>LEVEL_FEATURES[id]??basic;
export const DEFAULT_ROUND_SECONDS=180;
export const LEVEL_ROUND_SECONDS=Object.freeze({'man-5':300});
export const levelRoundSeconds=id=>LEVEL_ROUND_SECONDS[id]??DEFAULT_ROUND_SECONDS;
