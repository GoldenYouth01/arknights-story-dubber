import {useEffect,useState} from "react";

let visitorRequest:Promise<number>|null=null;
const CACHE_KEY="terra-visitor-count";

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
    const url=new URL(import.meta.env.BASE_URL,window.location.origin).href;
    visitorRequest=fetch("https://cdn.busuanzi.cc/api.php",{
      method:"POST",body:JSON.stringify({url,referrer:""}),signal:AbortSignal.timeout(10000),
    }).then(response=>{
      if(!response.ok)throw Error("Visitor service unavailable");
      return response.json();
    }).then(data=>{
      const value=Number((data as Record<string,unknown>).busuanzi_page_pv);
      if(!Number.isSafeInteger(value)||value<0)throw Error("Invalid visitor count");
      try{localStorage.setItem(CACHE_KEY,String(value));}catch{}
      return value;
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
  return <div className="visit-counter" role="status">
    <span className="eyebrow">TERRA VISITORS</span>
    <div><b>{visitors===null?(unavailable?"统计服务暂时无响应，正在重试…":"正在统计到访博士…"):<>{fresh?"累计访问":"上次记录"} <strong>{visitors.toLocaleString("zh-CN")}</strong> 人次</>}</b></div>
  </div>;
}
