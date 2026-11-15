import {useEffect,useState} from "react";

let visitorRequest:Promise<number>|null=null;
const CACHE_KEY="terra-visitor-count";
const COUNTER_KEY="voice-of-terra-for-arknights-pageviews-20261115";
// Last verified Busuanzi page PV before its API stopped responding.
// Visits between that reading and this switchover cannot be reconstructed.
const PREVIOUS_MINIMUM=7;

function cachedVisitorCount(){
  try{
    const saved=localStorage.getItem(CACHE_KEY);
    if(saved===null)return null;
    const value=Number(saved);
    return Number.isSafeInteger(value)&&value>=0?value:null;
  }catch{return null;}
}

export function loadVisitorCount(){
  if(!visitorRequest){
    if(window.location.hostname!=="luoul-123.github.io")return Promise.reject(Error("Visitor count is only available on the public site"));
    visitorRequest=fetch("https://countapi.mileshilliard.com/api/v1/hit/"+COUNTER_KEY,{
      cache:"no-store",signal:AbortSignal.timeout(10000),
    }).then(response=>{
      if(!response.ok)throw Error("Visitor service unavailable");
      return response.json();
    }).then(data=>{
      const recorded=Number((data as Record<string,unknown>).value);
      if(!Number.isSafeInteger(recorded)||recorded<0)throw Error("Invalid visitor count");
      const minimum=Math.max(PREVIOUS_MINIMUM+recorded,cachedVisitorCount()??0);
      try{localStorage.setItem(CACHE_KEY,String(minimum));}catch{}
      return minimum;
    }).catch(error=>{visitorRequest=null;throw error;});
  }
  return visitorRequest;
}

export default function VisitCounter(){
  const [visitors,setVisitors]=useState<number|null>(cachedVisitorCount);
  const [unavailable,setUnavailable]=useState(false);
  const [fresh,setFresh]=useState(false);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{loadVisitorCount().then(count=>{if(active){setVisitors(count);setFresh(true);setUnavailable(false);clearInterval(timer);}}).catch(()=>{if(active)setUnavailable(true);});};
    const timer=window.setInterval(refresh,60_000);
    refresh();
    return()=>{active=false;clearInterval(timer);};
  },[]);
  return <div className="visit-counter" role="status" title="旧统计服务故障期间的访问无法补算，当前数字从最后一次确认的 7 次记录接续。">
    <span className="eyebrow">TERRA VISITORS</span>
    <div><b>{visitors===null?(unavailable?"统计服务暂时无响应，正在重试…":"正在统计到访博士…"):<>{fresh?"累计至少":"上次记录至少"} <strong>{visitors.toLocaleString("zh-CN")}</strong> 人次</>}</b></div>
  </div>;
}
