"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {BookOpen,Settings2,Volume2,VolumeX,Play,Pause,History,ChevronLeft,ChevronRight,X,Maximize,Minimize,Headphones,Check,RefreshCw,LoaderCircle,SkipForward,Triangle,Save,PictureInPicture2} from "lucide-react";
import StoryArchive from "./story-archive";
import StoryMusic from "./story-music";
import DesktopPet from "./desktop-pet";
import VisitCounter from "./visit-counter";
import ThemeSelector,{type Theme} from "../app/theme-selector";
import {StaticDialogueAudio,KALTSIT,staticAudioPath,isVoicedChapter} from "./audio";
import {CATALOG,loadStory} from "./story-api";
import {nextIndex,nextChapter,resolveScene,MEDIA_ROOT} from "../lib/story.mjs";
type Scene={background:string|null;cg:string|null;actors:{key:string;url:string}[];focus:number};
type Step={id:string;type:string;text?:string;speaker?:string;route:string[]|null;choices?:{label:string;value:string}[];scene:Scene};
type Chapter={id:string;title:string;code:string;tag:string};
type Group={id:string;title:string;chapters:Chapter[]};
type Voice={id:string;speaker:string;version:string;aliases?:string[];kind?:string};
type DocumentPictureInPictureApi={requestWindow:(options:{width:number;height:number;preferInitialWindowPlacement?:boolean;disallowReturnToOpener?:boolean})=>Promise<Window>};
const FIRST:Chapter={id:"activities/act55side/level_act55side_st01",title:"复生的奇迹",code:"TL-ST-1",tag:"幕间"};
const BG=MEDIA_ROOT+"backgrounds/bg_cher_1.png";
function IconButton({label,onClick,active=false,children}:any){return <button className={"icon-button "+(active?"active":"")} title={label} aria-label={label} onClick={onClick}>{children}</button>;}
const portraitBounds=new Map<string,{left:number;right:number;top:number;bottom:number}>();
function Actor({actor,focus,total}:any){
 const [failed,setFailed]=useState(false),[placement,setPlacement]=useState({scale:1,offset:0});
 const imgRef=useRef<HTMLImageElement>(null);
 useEffect(()=>setFailed(false),[actor.key]);
 const fit=useCallback((img:HTMLImageElement,bounds:{left:number;right:number;top:number;bottom:number})=>{
  const width=img.clientWidth,height=img.clientHeight,nw=img.naturalWidth,nh=img.naturalHeight;
  if(!width||!height||!nw||!nh)return;
  const fittedHeight=Math.min(height,width*nh/nw),fittedWidth=fittedHeight*nw/nh;
  const visibleHeight=fittedHeight*(bounds.bottom-bounds.top),visibleWidth=fittedWidth*(bounds.right-bounds.left);
  const scale=Math.max(.65,Math.min(2.5,.82*height/Math.max(visibleHeight,1),1.15*width/Math.max(visibleWidth,1)));
  setPlacement({scale,offset:scale*fittedHeight*(1-bounds.bottom)});
 },[]);
 const onLoad=useCallback((event:React.SyntheticEvent<HTMLImageElement>)=>{
  const img=event.currentTarget;
  let bounds=portraitBounds.get(actor.url);
  if(!bounds){
   try{
    const canvas=document.createElement("canvas"),size=256;
    canvas.width=size;canvas.height=size;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(context){context.drawImage(img,0,0,size,size);const pixels=context.getImageData(0,0,size,size).data;let left=size,right=0,top=size,bottom=0;
     for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(pixels[(y*size+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
     if(right>left&&bottom>top)bounds={left:left/size,right:right/size,top:top/size,bottom:bottom/size};}
   }catch{/* Remote images without canvas access retain their original geometry. */}
   bounds||={left:0,right:1,top:0,bottom:1};portraitBounds.set(actor.url,bounds);
  }
  fit(img,bounds);
 },[actor.url,fit]);
 useEffect(()=>{const onResize=()=>{const img=imgRef.current,bounds=portraitBounds.get(actor.url);if(img&&bounds)fit(img,bounds);};window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize);},[actor.url,fit]);
 if(failed)return null;
 return <img ref={imgRef} alt="" crossOrigin="anonymous" className={"actor "+(focus?"focused":"dimmed")+" "+(total===1?"solo":"")+" actor-slot-"+(actor.slot||"m")} style={{opacity:actor.opacity,transform:`translateY(${placement.offset}px) scale(${placement.scale})`,transformOrigin:"center bottom"}} src={actor.url} onLoad={onLoad} onError={()=>setFailed(true)}/>;
}
export default function Theater(){
 const [chapter,setChapter]=useState<Chapter>(FIRST),[steps,setSteps]=useState<Step[]>([]),[index,setIndex]=useState(0),[choice,setChoice]=useState<string|null>(null),[decisions,setDecisions]=useState<Record<string,string>>({});
 const [catalog,setCatalog]=useState<Group[]>(CATALOG),[loading,setLoading]=useState(true),[error,setError]=useState(""),[drawer,setDrawer]=useState<string|null>(null);
 const [history,setHistory]=useState<{index:number;step:Step;choice:string|null}[]>([]),[typing,setTyping]=useState(true),[shown,setShown]=useState(0),[theme,setTheme]=useState<Theme>("dark");
 const readerVoice=KALTSIT;
 const [listening,setListening]=useState(false);const listeningRef=useRef(false),moveRef=useRef<()=>void>(()=>{}),backRef=useRef<()=>void>(()=>{});
 const [auto,setAuto]=useState(false),[muted,setMuted]=useState(false),[musicVolume,setMusicVolume]=useState(.35),[volume,setVolume]=useState(.85),[rate,setRate]=useState(1);
 const [voiceStatus,setVoiceStatus]=useState("idle"),[voiceError,setVoiceError]=useState("");
 const [petWindow,setPetWindow]=useState<Window|null>(null),petWindowRef=useRef<Window|null>(null);
 const [started,setStarted]=useState(false),[ended,setEnded]=useState(false),[full,setFull]=useState(false),[saved,setSaved]=useState<any>(null),[saves,setSaves]=useState<any[]>([]),[saveName,setSaveName]=useState(""),[mode,setMode]=useState<"dialogue"|"scroll">("dialogue"),[toast,setToast]=useState("");
 const [focusGroupId,setFocusGroupId]=useState(()=>new URLSearchParams(window.location.search).get("group"));
 const chapterEpoch=useRef(0);
 const player=useRef<any>(null),advanceRef=useRef<()=>void>(()=>{}),stage=useRef<HTMLDivElement>(null),scrollReader=useRef<HTMLElement>(null);
 const step=steps[index],text=step?.text||"",characters=Array.from(text),complete=mode==="scroll"||!typing||shown>=characters.length;
 useEffect(()=>{player.current=new StaticDialogueAudio({onState:(state:string,msg?:string)=>{setVoiceStatus(state);setVoiceError(msg||"");if("mediaSession" in navigator)navigator.mediaSession.playbackState=state==="playing"?"playing":state==="paused"?"paused":"none";}});return()=>{player.current?.dispose();window.speechSynthesis?.cancel();};},[]);
 useEffect(()=>{
  try{const manual=JSON.parse(localStorage.getItem("terra-manual-save")||"null");const slots=JSON.parse(localStorage.getItem("terra-save-slots")||"null");setSaves(Array.isArray(slots)?slots:manual?[{...manual,name:manual.name||"旧版存档"}]:[]);const s=manual||JSON.parse(localStorage.getItem("zhousheng-progress")||"null");if(s)setSaved(s);const settings=JSON.parse(localStorage.getItem("zhousheng-settings")||"null");if(settings){setTyping(settings.typing??true);setVolume(settings.volume??.85);setMusicVolume(settings.musicVolume??.35);setTheme(settings.theme==="light"?"light":"dark");setMode(settings.mode==="scroll"?"scroll":"dialogue");}}catch{}
 },[]);
 useEffect(()=>{localStorage.setItem("zhousheng-settings",JSON.stringify({typing,volume,musicVolume,theme,mode}));},[typing,volume,musicVolume,theme,mode]);
 const loadChapter=useCallback(async(c:Chapter,resume?:any)=>{
  const requestId=++chapterEpoch.current;player.current?.stop();window.speechSynthesis?.cancel();setStarted(false);setLoading(true);setError("");setEnded(false);setHistory([]);setChapter(c);setSteps([]);
  try{const j:any=await loadStory(c.id);if(requestId!==chapterEpoch.current)return;if(!j.steps.length)throw Error("本章暂时没有可读取的台词");setSteps(j.steps);setIndex(Math.min(resume?.index||0,j.steps.length-1));setChoice(resume?.choice||null);setDecisions(resume?.decisions||{});if(listeningRef.current&&isVoicedChapter(c.id))setStarted(true);else if(!isVoicedChapter(c.id)){setListening(false);listeningRef.current=false;}}
  catch(e){if(requestId===chapterEpoch.current)setError((e as Error).message||"章节加载失败");}finally{if(requestId===chapterEpoch.current)setLoading(false);}
 },[]);
 useEffect(()=>{let resume=null;try{resume=JSON.parse(localStorage.getItem("terra-manual-save")||localStorage.getItem("zhousheng-progress")||"null");}catch{}loadChapter(resume?.chapter||FIRST,resume);},[loadChapter]);
 useEffect(()=>{if(focusGroupId&&CATALOG.some(group=>group.id===focusGroupId))setDrawer("chapters");},[focusGroupId]);
 useEffect(()=>{setShown(0);if(!step||!typing)return;const timer=setInterval(()=>setShown(n=>Math.min(n+1,Array.from(step.text||"").length)),30);return()=>clearInterval(timer);},[step?.id,typing]);
 useEffect(()=>{if(!step||loading||!started)return;const data={chapter,index,choice,decisions,time:Date.now()};localStorage.setItem("zhousheng-progress",JSON.stringify(data));},[chapter,index,choice,decisions,step,loading,started]);
 useEffect(()=>{player.current?.setOptions({volume,rate});},[volume,rate]);
 const voiceFor=useCallback((line:Step)=>staticAudioPath(line.id)?readerVoice:null,[]);
 const playCurrent=useCallback(()=>{
  if(!step||step.type!=="line"||ended)return;
  player.current?.stop();window.speechSynthesis?.cancel();setVoiceError("");
  if(!started||muted){setVoiceStatus("silent");return;}
  const voice=voiceFor(step);
  if(voice){const playback=player.current.play(step,voice,{onEnd:()=>{if(listeningRef.current)moveRef.current();}});const ni=nextIndex(steps,index,choice);if(ni>=0&&steps[ni].type==="line"){const nv=voiceFor(steps[ni]);if(nv){const active=player.current,generation=active.generation;playback.then(()=>setTimeout(()=>{if(active===player.current&&active.generation===generation&&active.current&&!active.paused)active.prefetch(steps[ni],nv);},800));}}return;}
  setVoiceStatus("unavailable");
 },[step,started,muted,voiceFor,steps,index,choice,ended]);
 useEffect(()=>{playCurrent();return()=>{player.current?.stop();window.speechSynthesis?.cancel();};},[playCurrent]);
 const move=useCallback((selected?:string)=>{
  if(!step)return;if(step.type==="choice"&&!selected)return;
  player.current?.stop();window.speechSynthesis?.cancel();
  if(selected)setDecisions(d=>({...d,[step.id]:selected}));
  const route=selected??choice;const next=nextIndex(steps,index,route);
  setHistory(h=>[...h,{index,step,choice}].slice(-200));
  if(next<0){setEnded(true);setVoiceStatus("ended");return;}
  setChoice(route);setIndex(next);
 },[step,choice,index,steps]);
 moveRef.current=()=>move();
 useEffect(()=>{if(!ended||drawer)return;const group=catalog.find(g=>g.chapters.some(c=>c.id===chapter.id));const next=group?.chapters[group.chapters.findIndex(c=>c.id===chapter.id)+1];if(!next)return;const timer=window.setTimeout(()=>{void loadChapter(next).then(()=>setStarted(true));},3000);return()=>clearTimeout(timer);},[ended,drawer,catalog,chapter.id,loadChapter]);
 useEffect(()=>{if(step?.type!=="choice"||(!auto&&!listening)||!started||drawer||ended)return;const timer=window.setTimeout(()=>move(step.choices?.[0]?.value),3000);return()=>clearTimeout(timer);},[step,auto,listening,started,drawer,ended,move]);
 const advance=useCallback(()=>{if(drawer||loading||ended)return;if(!started){setStarted(true);return;}if(step?.type==="choice")return;if(!complete){setShown(characters.length);return;}move();},[drawer,loading,ended,started,step,complete,characters.length,move]);
 advanceRef.current=advance;
 useEffect(()=>{
  if(listening||!auto||!started||!complete||drawer||ended||step?.type!=="line"||["loading","playing","paused","error"].includes(voiceStatus))return;
  const timer=setTimeout(()=>move(),voiceStatus==="ended"?700:Math.max(1600,text.length*110));return()=>clearTimeout(timer);
 },[listening,auto,started,complete,drawer,ended,step,voiceStatus,text,move]);
 useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==="Escape"){setDrawer(null);return;}const target=e.target as HTMLElement;if(target.closest("input,textarea,select,[contenteditable=true]"))return;if(drawer)return;if((e.key==="Enter"||e.key===" ")&&target.closest("button,a")&&target.getAttribute("aria-label")!=="全屏")return;if(e.key===" "||e.key==="Enter"||e.key==="ArrowRight"){e.preventDefault();advanceRef.current();}if(e.key.toLowerCase()==="a")setAuto(v=>!v);if(e.key.toLowerCase()==="h")setDrawer("history");};window.addEventListener("keydown",listener);return()=>window.removeEventListener("keydown",listener);},[drawer]);
 useEffect(()=>{if(mode==="scroll"&&scrollReader.current)scrollReader.current.scrollTop=scrollReader.current.scrollHeight;},[index,mode]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2500);return()=>clearTimeout(t);},[toast]);
 const previousChapter=(()=>{const group=catalog.find(g=>g.chapters.some(c=>c.id===chapter.id));if(!group)return null;const i=group.chapters.findIndex(c=>c.id===chapter.id);return i>0?group.chapters[i-1]:null;})();
 backRef.current=()=>{if(previousChapter)void loadChapter(previousChapter).then(()=>setStarted(true));};
 const openDrawer=(name:string)=>{setDrawer(name);if(!listeningRef.current){setAuto(false);player.current?.pause();}};
 const scene=step?resolveScene(steps,index,decisions):null;
 const lastMusic=useRef<any>(null);if(scene?.music)lastMusic.current=scene.music;else if(scene?.musicStopped)lastMusic.current=null;
 useEffect(()=>{
  if(!("mediaSession" in navigator))return;
  navigator.mediaSession.metadata=new MediaMetadata({title:step?.type==="choice"?"请选择剧情分支":chapter.code+" · "+chapter.title,artist:step?.speaker||"旁白",album:"泰拉之声 · 随身听"});
  const handlers:Record<string,()=>void>={play:()=>{setStarted(true);if(player.current?.current)player.current.resume();else playCurrent();},pause:()=>player.current?.pause(),nexttrack:()=>moveRef.current(),previoustrack:()=>backRef.current(),stop:()=>{player.current?.stop();setListening(false);listeningRef.current=false;}};
  for(const [action,handler] of Object.entries(handlers)){try{navigator.mediaSession.setActionHandler(action as MediaSessionAction,handler);}catch{}}
  return()=>{for(const action of Object.keys(handlers)){try{navigator.mediaSession.setActionHandler(action as MediaSessionAction,null);}catch{}}};
 },[step?.id,chapter,playCurrent]);
 useEffect(()=>{if(!listening){petWindowRef.current?.close();petWindowRef.current=null;setPetWindow(null);}},[listening]);
 useEffect(()=>()=>{petWindowRef.current?.close();},[]);
 const openPet=()=>{
  const api=(window as Window & {documentPictureInPicture?:DocumentPictureInPictureApi}).documentPictureInPicture;
  if(!api){setToast("当前浏览器不支持悬浮桌宠，随身听仍可使用");return;}
  if(petWindowRef.current&&!petWindowRef.current.closed){petWindowRef.current.focus();return;}
  void api.requestWindow({width:180,height:220,preferInitialWindowPlacement:true,disallowReturnToOpener:true}).then(pip=>{
   if(!listeningRef.current){pip.close();return;}
   pip.document.title="凯尔希 · 泰拉之声";
   petWindowRef.current=pip;
   pip.addEventListener("pagehide",()=>{if(petWindowRef.current===pip){petWindowRef.current=null;setPetWindow(null);}},{once:true});
   setPetWindow(pip);
  }).catch(()=>setToast("悬浮桌宠未能打开，随身听仍可使用"));
 };
 const toggleListening=()=>{if(!isVoicedChapter(chapter.id))return;const enabled=!listening;setListening(enabled);listeningRef.current=enabled;setAuto(false);if(enabled){setStarted(true);setMuted(false);if(started)playCurrent();setToast("随身听已开启");}};
 const nextSection=nextChapter(catalog,chapter.id);
 const currentGroup=catalog.find(g=>g.chapters.some(c=>c.id===chapter.id));
 const nextInStory=currentGroup?.chapters[currentGroup.chapters.findIndex(c=>c.id===chapter.id)+1];
 const continueSection=async()=>{if(!nextSection)return;setDrawer(null);await loadChapter(nextSection);setStarted(true);};
 const fullScreen=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await stage.current?.requestFullscreen();setFull(!!document.fullscreenElement);(document.activeElement as HTMLElement)?.blur?.();};
 return <main className="theater" data-theme={theme} ref={stage}>
  <StoryMusic music={scene?.music||lastMusic.current} volume={musicVolume*(scene?.musicVolume??1)} active={(started||loading)&&!(listening&&voiceStatus==="paused")}/>
  <div className="scene" onClick={advance} aria-hidden="true">
   <img key={scene?.background||"blank"} className="background" style={{opacity:started&&!scene?.background?0:undefined}} src={scene?.background||BG} alt="" onError={e=>{e.currentTarget.style.opacity="0";}}/>
   <div className="scene-shade"/>
   {!scene?.cg&&<div className="actors">{scene?.actors?.map((actor,i)=><Actor key={actor.key+i} actor={actor} focus={scene.focus<0||scene.focus===i} total={scene.actors.length}/>)}</div>}
   {scene?.cg&&<img key={scene.cg} className="cg" src={scene.cg} alt="剧情 CG" onError={e=>{e.currentTarget.style.opacity="0";}}/>}
   <div className="scene-grain"/><div className="vignette"/>
  </div>
  <header className="topbar">
   <button className="brand" onClick={()=>openDrawer("chapters")}><b>泰拉之声</b><span className="brand-en">VOICE OF TERRA</span></button>
   <div className="chapter-heading"><span>{catalog.find(g=>g.chapters.some(c=>c.id===chapter.id))?.title||"剧情档案"}</span><span className="divider"/><b>{chapter.code} · {chapter.title}</b><span className="tag">{chapter.tag}</span></div>
   <div className="top-actions"><button className={"listen-toggle "+(listening?"active":"")} onClick={toggleListening} disabled={!isVoicedChapter(chapter.id)} title={isVoicedChapter(chapter.id)?"收听有声剧情":"本章仅支持阅读"}><Headphones size={16}/><span>{listening?"随身听中":"随身听"}</span></button>{listening&&"documentPictureInPicture" in window&&<button className="top-labeled" onClick={openPet} aria-label="打开桌宠"><PictureInPicture2 size={18}/><small>桌宠</small></button>}<a className="top-labeled" aria-label="GitHub 项目" href="https://github.com/luoul-123/voice-of-terra-for-arknights" target="_blank" rel="noreferrer"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.8 1.4 3.5 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.4-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 3 .1 3.3a4.7 4.7 0 0 1 1.2 3.2c0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg><small>GitHub</small></a><button className="top-labeled" onClick={()=>openDrawer("chapters")} aria-label="剧情档案"><BookOpen size={19}/><small>剧情档案</small></button><button className="top-labeled" onClick={()=>openDrawer("settings")} aria-label="阅读设置"><Settings2 size={19}/><small>阅读设置</small></button></div>
  </header>
  <aside className="scene-meta"><span className="tiny-cross">+</span><span>RHODES ISLAND</span><div/><span>STORY ARCHIVE / {chapter.code}</span></aside>
  {loading&&<div className="center-card loading"><LoaderCircle className="spin" size={27}/><h2>正在打开泰拉的故事</h2><p>加载章节与演出资源</p></div>}
  {error&&<div className="center-card"><h2>这一页暂时没有打开</h2><p>{error}</p><button className="primary" onClick={()=>loadChapter(chapter)}><RefreshCw size={16}/>重新加载</button><button onClick={()=>openDrawer("chapters")}>选择其他章节</button></div>}
  {!loading&&!error&&!started&&<div className="entry-overlay"><div className="entry-copy"><span className="eyebrow">ARKNIGHTS · VOICED STORY THEATER</span><h1>让故事，<br/>有声而至<span>。</span></h1><p>{isVoicedChapter(chapter.id)?"本章节支持有声阅读，点击「随身听」即可收听。":"本章节的有声内容仍在持续更新，先来读读这段故事吧。"}</p><div className="entry-actions"><button className="primary" onClick={()=>setStarted(true)}><Play size={17} fill="currentColor"/>进入剧情<span>{chapter.code} / {chapter.title}</span></button>{saved&&<button className="text-button" onClick={()=>loadChapter(saved.chapter,saved).then(()=>setStarted(true))}>继续上次阅读 <ChevronRight size={15}/></button>}</div></div><div className="entry-number">{chapter.code.split("-")[0]||"TERRA"}<span>{catalog.find(g=>g.chapters.some(c=>c.id===chapter.id))?.title||chapter.title}</span></div></div>}
  {started&&step?.type==="choice"&&!ended&&<div className="choice-panel"><span className="eyebrow">博士，你的选择{(auto||listening)&&" · 3 秒后默认选择第一项"}</span>{step.choices?.map((c,i)=><button key={c.value+i} onClick={()=>move(c.value)}><span>0{i+1}</span>{c.label}<ChevronRight size={17}/></button>)}</div>}
  {ended&&<div className="center-card chapter-complete"><span className="eyebrow">TO BE CONTINUED</span><h2>本段故事已读完</h2>{nextInStory?<><p>3 秒后继续：{nextInStory.code} · {nextInStory.title}</p><button className="primary" onClick={continueSection}>立即继续 <ChevronRight size={17}/></button></>:<p>这一系列暂时读完了，去探索其他故事吧。</p>}<button onClick={()=>openDrawer("chapters")}>打开剧情档案</button></div>}
  {started&&!loading&&!error&&mode==="scroll"&&!ended&&<section className="scroll-reader" aria-label="滚动阅读" key={chapter.id} ref={scrollReader}>{[...history.map(h=>h.step),step].filter(s=>s?.type==="line").map((s,i)=><p key={s.id+":"+i}><b>{s.speaker||"旁白"}</b><span>{s.text}</span></p>)}<button onClick={advance}>继续阅读 <ChevronRight size={16}/></button></section>}
  {started&&!loading&&!error&&mode==="dialogue"&&step?.type==="line"&&!ended&&<section className="dialogue-shell" aria-label="剧情对话">
   <div className="dialogue-header"><div className="speaker-rule"/><h2>{step.speaker||"旁白"}</h2></div>
   <button className="dialogue-text" onClick={advance} aria-label={complete?"下一句":"显示完整台词"}><span>{typing?characters.slice(0,shown).join(""):text}</span><span className="advance-glyph">{complete?<Triangle size={11} fill="currentColor"/>:<span className="typing-cursor"/>}</span></button>
   <div className="dialogue-bottom"><span className="line-number">{String(index+1).padStart(3,"0")} <span>/ {String(steps.length).padStart(3,"0")}</span></span>{voiceError&&<span className="click-hint" role="alert">{voiceError}</span>}</div>
  </section>}
  <footer className="controlbar">
   <div className="control-left"><button onClick={()=>openDrawer("chapters")}><BookOpen size={16}/>目录</button><span className="control-sep"/><button onClick={()=>openDrawer("history")}><History size={16}/>回顾</button><button disabled={loading||!step} onClick={()=>openDrawer("saves")}><Save size={16}/>存档</button></div>
   <div className="control-center"><button className="chapter-nav-button" aria-label="上一章" title="上一章" disabled={loading||!previousChapter} onClick={()=>backRef.current()}><ChevronLeft size={19}/><small>上一章</small></button><button className={"auto-button "+(auto?"active":"")} onClick={()=>{if(listening){if(voiceStatus==="paused")player.current.resume();else player.current.pause();}else{if(!started)setStarted(true);setAuto(a=>!a);}}}>{(listening?voiceStatus!=="paused":auto)?<Pause size={14}/>:<Play size={14}/>}<span className="play-label">{listening?(voiceStatus==="paused"?"播放":"暂停"):"自动"}</span><span>{listening?"LISTEN":"AUTO"}</span></button><button className="chapter-nav-button" aria-label="下一章" title={nextSection?"下一章："+nextSection.code+" · "+nextSection.title+" · "+nextSection.tag:"没有下一章"} disabled={loading||!nextSection} onClick={continueSection}><small>下一章</small><SkipForward size={19}/></button></div>
   <div className="control-right"><button className="voice-control" aria-label={muted?"打开配音":"关闭配音"} onClick={()=>{if(isVoicedChapter(chapter.id))setMuted(m=>!m);}}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}<small>{muted?"打开配音":"关闭配音"}</small></button><span className="control-sep"/><IconButton label="全屏" onClick={fullScreen}>{full?<Minimize size={17}/>:<Maximize size={17}/>}</IconButton></div>
  </footer>
  <input className="progress-track" type="range" aria-label="剧情进度，拖动跳转" min="0" max={Math.max(0,steps.length-1)} value={index} onChange={e=>{setHistory([]);setIndex(+e.target.value);setEnded(false);setStarted(true);}} style={{background:`linear-gradient(90deg,var(--mint) ${steps.length?(index+1)/steps.length*100:0}%,#ffffff20 0)`}}/>
  {listening&&started&&<div className="listen-badge"><Headphones size={13}/>{ended?"本节播放完毕":step?.type==="choice"?"等待你的选择":voiceStatus==="error"?"播放遇到问题，请重试":voiceStatus==="paused"?"已暂停":voiceStatus==="loading"?"正在准备下一句":"随身听 · 可切换到后台"}</div>}
  {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  {drawer&&<div className="drawer-backdrop" onClick={()=>setDrawer(null)}><aside className={"drawer"+(drawer==="chapters"?" archive-drawer":drawer==="history"?" history-drawer":drawer==="saves"?" saves-drawer":"")} onClick={e=>e.stopPropagation()}>
   <div className="drawer-head"><div><span className="eyebrow">{drawer==="chapters"?"STORY ARCHIVE":drawer==="history"?"BACKLOG":drawer==="saves"?"SAVE SLOTS":"PREFERENCES"}</span><h2>{{chapters:"剧情档案",history:"对话回顾",settings:"阅读设置",saves:"存档管理"}[drawer]}</h2></div><IconButton label="关闭面板" onClick={()=>setDrawer(null)}><X size={21}/></IconButton></div>
   {listening&&started&&<div className="drawer-player"><Headphones size={17}/><div><b>{ended?"本段播放完毕":step?.type==="choice"?"等待剧情选择":voiceStatus==="paused"?"收听已暂停":"正在收听"} · {chapter.code}</b><span>{step?.speaker||"旁白"} · {text.slice(0,32)}</span></div><button aria-label={voiceStatus==="paused"?"继续随身听":"暂停随身听"} onClick={()=>voiceStatus==="paused"?player.current?.resume():player.current?.pause()}>{voiceStatus==="paused"?<Play size={16}/>:<Pause size={16}/>}</button>{ended&&nextSection&&<button aria-label="确认进入下一段" onClick={continueSection}><ChevronRight size={17}/></button>}<button aria-label="随身听下一句" onClick={()=>move()}><SkipForward size={17}/></button></div>}
   {drawer==="chapters"&&<StoryArchive groups={catalog} currentId={chapter.id} focusGroupId={focusGroupId} onSelect={(c:Chapter)=>{const url=new URL(window.location.href);url.searchParams.delete("group");window.history.replaceState(null,"",url);setFocusGroupId(null);setDrawer(null);loadChapter(c);}} onRetry={()=>setCatalog(CATALOG)}/>}
   {drawer==="history"&&<div className="backlog">{!history.length?<p className="muted">读过的台词会出现在这里。</p>:history.map((h,i)=><div className="backlog-entry" key={i}><span>{String(h.index+1).padStart(3,"0")}</span><div><b>{h.step.speaker||"博士的选择"}</b><p>{h.step.text||"选择对话分支"}</p></div></div>)}</div>}
   {drawer==="saves"&&<div className="save-manager"><p>存档保存在当前浏览器中。</p><div className="save-form"><input aria-label="存档名称" placeholder="给这个存档命名" value={saveName} maxLength={32} onChange={e=>setSaveName(e.target.value)}/><button className="primary" onClick={()=>{const snapshot={chapter,index,choice,decisions,time:Date.now(),name:saveName.trim()||`${chapter.code} · ${chapter.title}`};const updated=[snapshot,...saves];localStorage.setItem("terra-save-slots",JSON.stringify(updated));localStorage.setItem("terra-manual-save",JSON.stringify(snapshot));setSaves(updated);setSaved(snapshot);setSaveName("");setToast("已保存新存档");}}>新建存档</button></div>{saves.map((s,i)=><div className="save-slot" key={s.time+i}><div><b>{s.name||s.chapter?.title||"旧存档"}</b><small>{s.chapter?.code} · {new Date(s.time).toLocaleString("zh-CN")}</small></div><button onClick={()=>{setDrawer(null);void loadChapter(s.chapter,s).then(()=>setStarted(true));}}>读取</button><input aria-label="修改存档名称" defaultValue={s.name||""} maxLength={32} onBlur={e=>{const name=e.target.value.trim();if(!name||name===s.name)return;const updated=saves.map((item,n)=>n===i?{...item,name}:item);setSaves(updated);localStorage.setItem("terra-save-slots",JSON.stringify(updated));}}/><button onClick={()=>{const updated=saves.filter((_,n)=>n!==i);setSaves(updated);localStorage.setItem("terra-save-slots",JSON.stringify(updated));}}>删除</button></div>)}</div>}
   {drawer==="settings"&&<div className="settings">
    <ThemeSelector value={theme} onChange={setTheme}/>
    <div className="reading-modes"><button className={mode==="dialogue"?"selected":""} onClick={()=>setMode("dialogue")}><b>对话框点击模式</b><span>点击推进台词</span></button><button className={mode==="scroll"?"selected":""} onClick={()=>setMode("scroll")}><b>鼠标滚动模式</b><span>滚动查看已读文本，背景演出仍在下方显示</span></button></div>
    <div className="setting-row"><div><b>逐字显示台词</b><p>点击补全，再点击推进剧情</p></div><button className={"switch "+(typing?"on":"")} aria-label="逐字显示台词" aria-pressed={typing} onClick={()=>setTyping(t=>!t)}><span/></button></div>
    <label className="slider-setting"><span>背景音乐音量 <b>{Math.round(musicVolume*100)}%</b></span><input aria-label="背景音乐音量" type="range" min="0" max="1" step=".05" value={musicVolume} onChange={e=>setMusicVolume(+e.target.value)}/></label>
    <label className="slider-setting"><span>配音音量 <b>{Math.round(volume*100)}%</b></span><input type="range" min="0" max="1" step=".05" aria-label="配音音量" value={volume} onChange={e=>setVolume(+e.target.value)}/></label>
    <label className="slider-setting"><span>播放速度 <b>{rate.toFixed(1)}×</b></span><input type="range" min=".7" max="1.5" step=".1" aria-label="播放速度" value={rate} onChange={e=>setRate(+e.target.value)}/></label>
    <VisitCounter/>
    <a className="developer-log-link" href="https://github.com/luoul-123/voice-of-terra-for-arknights/blob/main/web/docs/developer-log.md" target="_blank" rel="noopener noreferrer">开发者日志 <span aria-hidden="true">↗</span></a>
   </div>}
  </aside></div>}
  {petWindow&&createPortal(<DesktopPet chapter={chapter.code} speaker={step?.speaker||"旁白"} dialogue={text} status={ended?"ended":step?.type==="choice"?"choice":muted?"silent":voiceStatus} rate={rate} onToggle={()=>voiceStatus==="paused"?player.current?.resume():player.current?.pause()} onRateChange={setRate} onReturn={()=>window.focus()}/>,petWindow.document.body)}
 </main>;
}
