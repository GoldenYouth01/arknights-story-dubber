import portraits from "../backend/media-index/portraits.json" with {type:"json"};

const ASSET_ROOT="https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/";
const aliases={npc_10002:"npc_10002_1"};

function assetName(name){
  if(Object.hasOwn(portraits,name))return name;
  const withoutExpression=name.replace(/#[^$]*/,"");
  if(Object.hasOwn(portraits,withoutExpression))return withoutExpression;
  const base=name.replace(/[#\$].*$/,"");
  if(Object.hasOwn(portraits,base))return base;
  const alias=aliases[name]||aliases[base];
  return alias&&Object.hasOwn(portraits,alias)?alias:null;
}

export function portraitUrl(name,revision="cn"){
  const asset=assetName(name);
  if(!asset)return null;
  const folder=portraits[asset];
  const path=folder==="characters"?"":encodeURIComponent(folder)+"/";
  return ASSET_ROOT+revision+"/assets/dyn/avg/characters/"+path+encodeURIComponent(asset)+".png";
}
