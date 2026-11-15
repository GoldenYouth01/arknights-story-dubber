import music from "../backend/media-index/music.json";
import {portraitUrl} from "../lib/portrait.mjs";
export {portraitUrl};

const ASSET_ROOT="https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/";
const HISTORY="2c7efe3c96ff8eb96af777ff7508144b4485654a";
const musicIndex=music as Record<string,string>;
export function musicUrl(name:string,revision=HISTORY){
  const key=name.replace(/^\$/,'');
  const asset=musicIndex[key]||Object.entries(musicIndex).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1];
  if(!asset)return null;
  return ASSET_ROOT+revision+"/assets/dyn/audio/"+asset.toLowerCase()+".mp3";
}
export function setupStaticMedia(){
  (globalThis as any).__terraPortraitUrl=(name:string)=>portraitUrl(name);
}
