"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Search,ChevronRight,CalendarDays,Headphones} from "lucide-react";
import {CATEGORIES,releaseDate} from "../lib/story.mjs";
import {isVoicedChapter} from "./audio";
import {STORY_CHRONOLOGY} from "./story-chronology";
const archiveCategories=CATEGORIES.filter(category=>category.id!=="other");
const ASSET_ROOT="https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/assets/dyn/";
const specialCovers:Record<string,string>={main_15:"avg/images/cg_smoke.png",main_16:"avg/images/66_i02.png",main_17:"avg/images/73_i01_1.png"};
function coverFor(g:any){return ASSET_ROOT+(specialCovers[g.id]||(g.category==="main"?`arts/ui/homebanners/zone/${g.id}.png`:`arts/ui/storyreview/hubs/activity/storyentrypic_${g.id==="1stact"?"act1d0":g.id}.png`));}
function storyEra(g:any){return STORY_CHRONOLOGY[g.id]?.era||"年代未详";}
function storyRank(g:any){const record=STORY_CHRONOLOGY[g.id];return record?.era.startsWith("泰拉历")?record.order:record?.era==="联动剧情"?100000+record.order:200000+(g.releasedAt||0);}
export default function StoryArchive({groups,currentId,onSelect,onRetry,focusGroupId}:any){
 const [view,setView]=useState("timeline"),[category,setCategory]=useState("all"),[query,setQuery]=useState(""),[order,setOrder]=useState("oldest"),[year,setYear]=useState("all"),[selected,setSelected]=useState<string|null>(null);
 const listRef=useRef<HTMLDivElement>(null),savedScroll=useRef(0);
 const q=query.trim().toLocaleLowerCase(),storyView=category==="all"&&view==="story";
 const matches=(g:any)=>!q||[g.title,g.operator,...g.chapters.flatMap((c:any)=>[c.title,c.code,c.operator])].filter(Boolean).join(" ").toLocaleLowerCase().includes(q);
 const years=[...new Set<string>(groups.filter((g:any)=>g.releasedAt).map((g:any)=>releaseDate(g.releasedAt).slice(0,4)))].sort();
 const eras=[...new Set(Object.values(STORY_CHRONOLOGY).map(item=>item.era))].filter(era=>era.startsWith("泰拉历")).sort().concat("联动剧情","年代未详");
 const entries=useMemo(()=>groups.filter((g:any)=>(category==="all"||g.category===category)&&matches(g)&&(year==="all"||(storyView?storyEra(g)===year:releaseDate(g.releasedAt).startsWith(year)))).sort((a:any,b:any)=>{
  if(storyView){const datedA=storyEra(a).startsWith("泰拉历"),datedB=storyEra(b).startsWith("泰拉历");if(datedA!==datedB)return datedA?-1:1;return (order==="newest"?-1:1)*(storyRank(a)-storyRank(b))||a.groupSort-b.groupSort;}
  if(!a.releasedAt||!b.releasedAt)return a.releasedAt?-1:b.releasedAt?1:0;
  return (order==="newest"?-1:1)*(a.releasedAt-b.releasedAt)||a.groupSort-b.groupSort;
 }),[groups,category,q,year,storyView,order]);
 const active=groups.find((g:any)=>g.id===selected);
 const buckets=useMemo(()=>{const result:{label:string;items:any[]}[]=[];for(const g of entries){const label=category==="all"?(storyView?storyEra(g):releaseDate(g.releasedAt)):"";let bucket=result[result.length-1];if(!bucket||bucket.label!==label){bucket={label,items:[]};result.push(bucket);}bucket.items.push(g);}return result;},[entries,category,storyView]);
 useEffect(()=>{const frame=listRef.current;if(!frame)return;const raf=requestAnimationFrame(()=>{
  if(selected){const row=frame.querySelector<HTMLElement>(".chapter-row.selected");frame.scrollTop=row?row.offsetTop-frame.offsetTop-frame.clientHeight/2:0;}
  else frame.scrollTop=savedScroll.current;
 });return()=>cancelAnimationFrame(raf);},[selected]);
 useEffect(()=>{const frame=listRef.current;if(!frame||selected)return;const raf=requestAnimationFrame(()=>{const row=frame.querySelector<HTMLElement>('[data-current="true"]');if(row){frame.scrollTop+=row.getBoundingClientRect().top-frame.getBoundingClientRect().top-frame.clientHeight/3;savedScroll.current=frame.scrollTop;}});return()=>cancelAnimationFrame(raf);},[currentId]);
 const reset=()=>{setSelected(null);savedScroll.current=0;if(listRef.current)listRef.current.scrollTop=0;};
 const chooseCategory=(id:string)=>{reset();setCategory(id);setYear("all");};
 const hasVoice=(g:any)=>g.chapters.some((c:any)=>isVoicedChapter(c.id));
 const badge=(g:any)=>hasVoice(g)&&<span className="archive-voiced-badge"><Headphones size={12}/>有声</span>;
 const open=(g:any)=>{savedScroll.current=listRef.current?.scrollTop||0;setSelected(g.id);};
 return <div className="story-archive archive-browser">
  <nav className="archive-categories" aria-label="剧情分类"><button className={category==="all"?"selected":""} onClick={()=>chooseCategory("all")}>全部</button>{archiveCategories.map(c=><button key={c.id} className={category===c.id?"selected":""} onClick={()=>chooseCategory(c.id)}>{c.label}</button>)}</nav>
  <div className="archive-main">
   {active?<div className="archive-detail-heading"><button onClick={()=>setSelected(null)}><ChevronRight className="back-arrow" size={17}/>返回目录</button><h3>{active.title}</h3><small>{active.date} · {active.chapters.length} 段剧情</small>{badge(active)}</div>:<>
    {category==="all"&&<div className="archive-views" role="tablist" aria-label="剧情时间线"><button role="tab" aria-selected={!storyView} onClick={()=>{reset();setView("timeline");setYear("all");}}><CalendarDays size={15}/>实装时间线</button><button role="tab" aria-selected={storyView} onClick={()=>{reset();setView("story");setYear("all");}}><CalendarDays size={15}/>剧情时间线</button></div>}
    <label className="search"><Search size={17}/><input aria-label="搜索剧情档案" placeholder="搜索章节、活动、剧情或干员" value={query} onChange={e=>{reset();setQuery(e.target.value);}}/></label>
    <div className="timeline-toolbar"><label>{storyView?"剧情年代":"实装年份"}<select aria-label={storyView?"剧情年代":"实装年份"} value={year} onChange={e=>{reset();setYear(e.target.value);}}><option value="all">全部</option>{(storyView?eras:years).map(y=><option key={y}>{y}</option>)}</select></label><select aria-label="时间顺序" value={order} onChange={e=>{reset();setOrder(e.target.value);}}><option value="oldest">从最早到最新</option><option value="newest">从最新到最早</option></select></div>
    {storyView&&<p className="timeline-note">按故事主要发生时期排列，年代未详的剧情单独列出。<a href="https://fables.lone-trail.com/timeline/" target="_blank" rel="noreferrer">考据参考 ↗</a></p>}
   </>}
   <div className="archive-content" ref={listRef}>
    {active?active.chapters.map((c:any)=><button className={"chapter-row "+(c.id===currentId?"selected":"")} key={c.id} aria-current={c.id===currentId?"true":undefined} onClick={()=>onSelect(c)}><span>{c.code||"ST"}</span><div><b>{c.title}</b><small>{c.tag}</small></div><ChevronRight size={16}/></button>):buckets.map((bucket,i)=><section className="archive-bucket" key={bucket.label+i}>
     {bucket.label&&<h3 className="timeline-date">{bucket.label}</h3>}
     <div className="archive-grid">{bucket.items.map((g:any)=>{
      const card=["main","side"].includes(g.category),current=g.id===focusGroupId||g.chapters.some((c:any)=>c.id===currentId);
      return <button key={g.id} className={card?"archive-card":"archive-group-row"} data-current={current?"true":undefined} onClick={()=>open(g)}>
       {card&&<div className="archive-cover"><img src={coverFor(g)} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none";}}/><span>VOICE OF TERRA</span><b>{g.title}</b></div>}
       <div className="archive-card-meta"><b>{g.operator?g.operator+" · ":""}{g.title}</b><small>{g.date||"日期待补"}</small>{badge(g)}</div>{!card&&<ChevronRight size={16}/>}
      </button>;
     })}</div>
    </section>)}
    {!active&&!entries.length&&<p className="muted">没有找到符合条件的剧情。{!groups.length&&<button onClick={onRetry}>重新加载</button>}</p>}
   </div>
  </div>
  <p className="source-note">剧情与演出素材归鹰角网络及相关权利人所有。<a href="https://github.com/ArknightsAssets/ArknightsGamedata" target="_blank" rel="noreferrer">数据来源</a></p>
 </div>;
}
