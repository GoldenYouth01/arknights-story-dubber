import {useEffect,useState} from "react";

let visitorRequest:Promise<number>|null=null;
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
      const value=Number((data as Record<string,unknown>).busuanzi_page_uv);
      if(!Number.isSafeInteger(value)||value<0)throw Error("Invalid visitor count");
      return value;
    });
  }
  return visitorRequest;
}

export default function VisitCounter(){
  const [visitors,setVisitors]=useState<number|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    let active=true;
    loadVisitorCount().then(count=>{if(active)setVisitors(count);}).catch(()=>{if(active)setUnavailable(true);});
    return()=>{active=false;};
  },[]);
  return <div className="visit-counter" role="status">
    <span className="eyebrow">TERRA VISITORS</span>
    <div><b>{visitors===null?(unavailable?"访客统计暂不可用":"正在统计到访博士…"):<>已有 <strong>{visitors.toLocaleString("zh-CN")}</strong> 位博士到访</>}</b></div>
    <small>不蒜子提供 · 自 2026-11-15 起统计 · 按网络地址估算</small>
  </div>;
}
