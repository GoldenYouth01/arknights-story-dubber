"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Search,ChevronRight,CalendarDays,LibraryBig,Headphones} from "lucide-react";
import {CATEGORIES,timelineFrom,releaseDate} from "../lib/story.mjs";
import {isVoicedChapter} from "./audio";
import {STORY_CHRONOLOGY} from "./story-chronology";
const archiveCategories=CATEGORIES.filter(category=>category.id!=="other");
const ASSET_ROOT="https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/assets/dyn/";
const specialCovers:Record<string,string>={main_15:"avg/images/cg_smoke.png",main_16:"avg/images/66_i02.png",main_17:"avg/images/73_i01_1.png"};
function coverFor(g:any){return ASSET_ROOT+(specialCovers[g.id]||(g.category==="main"?`arts/ui/homebanners/zone/${g.id}.png`:`arts/ui/storyreview/hubs/activity/storyentrypic_${g.id==="1stact"?"act1d0":g.id}.png`));}
function storyEra(g:any){return STORY_CHRONOLOGY[g.id]?.era||"年代未详";}
function storyRank(g:any){const record=STORY_CHRONOLOGY[g.id];return record?.era.startsWith("泰拉历")?record.order:record?.era==="联动剧情"?100000+record.order:200000+(g.releasedAt||0);}
export default function StoryArchive({groups,currentId,onSelect,onRetry,focusGroupId}:any){
 const [view,setView]=useState("groups"),[category,setCategory]=useState("all"),[query,setQuery]=useState(""),[order,setOrder]=useState("oldest"),[limit,setLimit]=useState(80),[year,setYear]=useState("all"),[focused,setFocused]=useState<string|null>(focusGroupId||null);
 const q=query.trim().toLocaleLowerCase();
 const timeline=useMemo(()=>timelineFrom(groups),[groups]);
 const years=useMemo(()=>[...new Set<string>(timeline.filter((c:any)=>c.releasedAt).map(c=>releaseDate(c.releasedAt).slice(0,4)))].sort(),[timeline]);
 const eras=[...new Set(Object.values(STORY_CHRONOLOGY).map(item=>item.era))].filter(era=>era.startsWith("泰拉历")).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0])).concat("联动剧情","年代未详");
 const matches=(c:any,g?:any)=>!q||[c.title,c.code,c.operator,c.groupTitle,g?.title,g?.operator].filter(Boolean).join(" ").toLocaleLowerCase().includes(q);
 const visibleGroups=useMemo(()=>groups.filter((g:any)=>(!focused||g.id===focused)&&(category==="all"||g.category===category)).map((g:any)=>({...g,hasVoice:g.chapters.some((c:any)=>isVoicedChapter(c.id)),chapters:g.chapters.filter((c:any)=>matches(c,g))})).filter((g:any)=>g.chapters.length),[groups,category,q,focused]);
 const groupHasVoice=(g:any)=>g.chapters.some((c:any)=>isVoicedChapter(c.id));
 const entries=useMemo(()=>{const rows=groups.filter((c:any)=>(category==="all"||c.category===category)&&(year==="all"||(view==="story"?storyEra(c)===year:releaseDate(c.releasedAt).startsWith(year)))&&(matches(c)||c.chapters.some((chapter:any)=>matches(chapter,c))));if(view==="story")return [...rows].sort((a:any,b:any)=>(order==="newest"?-1:1)*(storyRank(a)-storyRank(b))||a.groupSort-b.groupSort);return order==="newest"?[...rows.filter((c:any)=>c.releasedAt).sort((a:any,b:any)=>b.releasedAt-a.releasedAt||a.groupSort-b.groupSort||a.sort-b.sort),...rows.filter((c:any)=>!c.releasedAt)]:[...rows].sort((a:any,b:any)=>(a.releasedAt||Infinity)-(b.releasedAt||Infinity)||a.groupSort-b.groupSort);},[groups,category,year,q,order,view]);
 const catalogRef=useRef<HTMLDivElement>(null),timelineRef=useRef<HTMLDivElement>(null);
 const currentTimelineIndex=entries.findIndex((g:any)=>g.chapters.some((c:any)=>c.id===currentId));
 const visibleLimit=Math.max(limit,currentTimelineIndex+1);
 useEffect(()=>{
  const frame=view==="groups"?catalogRef.current:timelineRef.current;
  const animation=requestAnimationFrame(()=>{
   const row=frame?.querySelector<HTMLElement>(".chapter-row.selected");
   if(!frame||!row)return;
   const bounds=frame.getBoundingClientRect(),target=row.getBoundingClientRect();
   frame.scrollTop+=target.top-bounds.top-(bounds.height-target.height)/2;
  });
  return()=>cancelAnimationFrame(animation);
 },[currentId,view,category,focused,q,order,year,groups.length]);
 const reset=(fn:()=>void)=>{fn();setFocused(null);setLimit(80);};
 return <div className="story-archive">
  <div className="archive-views" role="tablist" aria-label="剧情档案视图"><button role="tab" aria-selected={view==="groups"} onClick={()=>{setView("groups");setYear("all");}}><LibraryBig size={15}/>分类阅读</button><button role="tab" aria-selected={view==="timeline"} onClick={()=>{setView("timeline");setYear("all");}}><CalendarDays size={15}/>实装时间线</button>{category==="all"&&<button role="tab" aria-selected={view==="story"} onClick={()=>{setView("story");setYear("all");}}><CalendarDays size={15}/>剧情时间线</button>}</div>
  <label className="search"><Search size={17}/><input aria-label="搜索剧情档案" placeholder="搜索章节、活动、剧情或干员" value={query} onChange={e=>reset(()=>setQuery(e.target.value))}/></label>
  <div className="archive-categories" aria-label="剧情分类"><button className={category==="all"?"selected":""} onClick={()=>reset(()=>setCategory("all"))}>全部</button>{archiveCategories.map(c=><button key={c.id} className={category===c.id?"selected":""} onClick={()=>reset(()=>{setCategory(c.id);if(view==="story")setView("groups");})}>{c.label}</button>)}</div>
  {!groups.length?<div className="archive-empty"><p>剧情目录暂未加载。</p><button onClick={onRetry}>重新加载</button></div>:view==="groups"?<div className="catalog" ref={catalogRef}>{focused&&<p className="archive-focus">已定位到这部剧情 · <button onClick={()=>setFocused(null)}>查看全部目录</button></p>}{!visibleGroups.length&&<p className="muted">没有找到符合条件的剧情。</p>}<div className="archive-grid">{visibleGroups.filter((g:any)=>["main","side"].includes(g.category)).map((g:any)=><details className="archive-card" key={g.id} open={q||focused||g.chapters.some((c:any)=>c.id===currentId)?true:undefined}><summary><div className="archive-cover"><img src={coverFor(g)} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none";}}/><span>VOICE OF TERRA</span><b>{g.title}</b></div><div className="archive-card-meta"><b>{g.title}</b><small>{g.date||"日期待补"}</small>{g.hasVoice&&<span className="archive-voiced-badge"><Headphones size={12}/>有声</span>}</div></summary><div className="archive-card-chapters">{g.chapters.map((c:any)=><button className={"chapter-row "+(c.id===currentId?"selected":"")} key={c.id} onClick={()=>onSelect(c)}><span>{c.code||"ST"}</span><div><b>{c.title}</b><small>{c.tag}</small></div><ChevronRight size={16}/></button>)}</div></details>)}</div>{visibleGroups.filter((g:any)=>!["main","side"].includes(g.category)).map((g:any)=><details key={g.id} open={q||focused||g.chapters.some((c:any)=>c.id===currentId)?true:undefined}><summary><div><b>{g.operator?g.operator+" · ":""}{g.title}</b>{g.hasVoice&&<span className="archive-voiced-badge"><Headphones size={12}/>有声</span>}<small>{CATEGORIES.find(c=>c.id===g.category)?.label} · {g.date||"日期待补"}</small></div><span>{g.chapters.length}</span></summary>{g.chapters.map((c:any)=><button className={"chapter-row "+(c.id===currentId?"selected":"")} key={c.id} onClick={()=>onSelect(c)}><span>{c.code||"ST"}</span><div><b>{c.title}</b><small>{c.tag}</small></div><ChevronRight size={16}/></button>)}</details>)}</div>:<div className="archive-timeline">
   <div className="timeline-toolbar"><label>{view==="story"?"剧情年代":"实装年份"}<select aria-label={view==="story"?"剧情年代":"实装年份"} value={year} onChange={e=>reset(()=>setYear(e.target.value))}><option value="all">全部{view==="story"?"年代":"年份"}</option>{(view==="story"?eras:years).map(y=><option key={y} value={y}>{y}</option>)}</select></label><select aria-label="时间顺序" value={order} onChange={e=>reset(()=>setOrder(e.target.value))}><option value="oldest">从最早到最新</option><option value="newest">从最新到最早</option></select></div>
   <p className="timeline-note">{view==="story"?<>泰拉历时间参考玩家考据，穿插回忆的故事按主要发生时期排列；未能确认年代的剧情单独列出。<a href="https://fables.lone-trail.com/timeline/" target="_blank" rel="noreferrer">查看参考年表 ↗</a></>:"国服首次实装 · 同一活动内保留原剧情顺序"}</p>
   <div className="timeline-list" ref={timelineRef}>
   {!entries.length&&<p className="muted">没有找到符合条件的剧情。</p>}
   {entries.slice(0,visibleLimit).map((g:any,i:number,shown:any[])=>{const date=releaseDate(g.releasedAt);return <div key={g.id}>{(i===0||(view==="story"?storyEra(shown[i-1])!==storyEra(g):releaseDate(shown[i-1].releasedAt)!==date))&&<h3 className="timeline-date">{view==="story"?storyEra(g):date}</h3>}<details className="timeline-collection" data-release={g.releasedAt||"unknown"} open={g.chapters.some((c:any)=>c.id===currentId)?true:undefined}><summary className="timeline-row"><span className="timeline-dot"/><div><small>{CATEGORIES.find(k=>k.id===g.category)?.label}</small><div className="archive-title-line"><b>{g.category==="main"?"第 "+g.id.replace("main_","")+" 章 · ":g.operator?g.operator+" · ":""}{g.title}</b>{groupHasVoice(g)&&<span className="archive-voiced-badge"><Headphones size={12}/>有声</span>}</div><span>{g.chapters.length} 段剧情 · 点击展开</span></div><ChevronRight size={15}/></summary>{g.chapters.filter((c:any)=>matches(c,g)).map((c:any)=><button className={"chapter-row "+(c.id===currentId?"selected":"")} key={c.id} onClick={()=>onSelect(c)}><span>{c.code||"ST"}</span><div><b>{c.title}</b><small>{c.tag}</small></div><ChevronRight size={16}/></button>)}</details></div>;})}
   {entries.length>visibleLimit&&<button className="archive-more" onClick={()=>setLimit(n=>Math.max(n,visibleLimit)+80)}>继续查看 · 已显示 {Math.min(visibleLimit,entries.length)} / {entries.length}</button>}
   </div>
  </div>}
  <p className="source-note">剧情与演出素材归鹰角网络及相关权利人所有。<a href="https://github.com/ArknightsAssets/ArknightsGamedata" target="_blank" rel="noreferrer">数据来源</a></p>
 </div>;
}
