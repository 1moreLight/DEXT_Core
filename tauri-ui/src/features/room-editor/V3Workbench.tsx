import {useEffect,useMemo,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {discoverV3Buttons} from "./personal-editor";
import {serializeRoomV3,type RoomV3} from "./v3-document";
import {workbenchDocument} from "./workbench-document";
type Props={room:RoomV3;path:string;isTauri:boolean;deskId:string;onBack:()=>void};
type ResourceSession={token:string;baseUrl:string;missing:{path:string;message:string}[]};
type Settings={deskId:string;data:Record<string,string>;showButtons:boolean;showOccupied:boolean;showComponents:boolean;buttonId:string;cpuPercent:number;gpuPercent:number;audioLevel:number};
type PreviewButton={consumer:string;button:string;polygons:{x:number;y:number}[][]};
type Frame={consumerId:string;instanceId:string;kind:string;state:string;ready:boolean;initialized:boolean;pendingRequests:number};
type Item={id:string;key:string;kind:string;placeable:boolean;scale:number};
type Runtime={viewport:{width:number;height:number};currentDeskId:string;targetDeskId:string|null;transitionId:string|null;occupied:{id?:string;x:number;y:number;width:number;height:number}[];
  frames:{instances:Frame[];lastError:{code:string}|null};layout:{items:Item[];ready:boolean;error:string|null};lastError:{code:string}|null};
type Diagnostics={snapshot:{currentDeskId:string;targetDeskId:string|null;lifecycle:{stage:string;playbackPaused:boolean}};runtime:Runtime;buttons:PreviewButton[];data:Record<string,string>;events:{code:string;detail:string;time:string}[]};
const sources=[["time.read","时间"],["hardware.read","硬件"],["media.read","媒体"],["audio.read","音量"]] as const;
const sizes=[[1920,1080],[1280,720],[640,480],[1080,1920],[2560,1440]] as const;
export function V3Workbench(props:Props){
 const json=useMemo(()=>serializeRoomV3(props.room),[props.room]);
 const [session,setSession]=useState<ResourceSession|null>(null),[notice,setNotice]=useState(""),[reload,setReload]=useState(0),[ready,setReady]=useState(false);
 const [width,setWidth]=useState(1280),[height,setHeight]=useState(720),[availableWidth,setAvailableWidth]=useState(900);
 const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
 const [settings,setSettings]=useState<Settings>({deskId:props.deskId,data:{},showButtons:true,showOccupied:true,showComponents:false,buttonId:"",cpuPercent:32,gpuPercent:19,audioLevel:.5});
 const iframe=useRef<HTMLIFrameElement>(null),viewport=useRef<HTMLDivElement>(null),currentSettings=useRef(settings);
 currentSettings.current=settings;
 const authored=discoverV3Buttons(props.room),scale=Math.min(1,availableWidth/width,600/height);
 useEffect(()=>{
  let disposed=false,owned:string|null=null;setSession(null);setReady(false);setDiagnostics(null);
  if(!props.isTauri){setNotice("实际资源预览请在 Dext 配置器中打开；浏览器设计模式不读取本机 Room。");return;}
  setNotice("正在准备草稿资源…");
  void invoke<ResourceSession>("prepare_v3_workbench",{roomDir:props.path,roomJson:json}).then(result=>{
   owned=result.token;if(disposed){void invoke("release_v3_workbench",{token:result.token}).catch(()=>{});return;}
   setSession(result);setNotice(result.missing.length?"部分资源缺失，见资源诊断。":"正在启动正式宿主预览…");
  }).catch(error=>{if(!disposed)setNotice("预览准备失败："+String(error));});
  return()=>{disposed=true;if(owned)void invoke("release_v3_workbench",{token:owned}).catch(()=>{});};
 },[props.path,props.isTauri,json,reload]);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.source!==iframe.current?.contentWindow||!session||event.data?.token!==session.token)return;
   if(event.data.type==="dext:workbench:ready"){setReady(true);setNotice("草稿预览已就绪 · 示例数据");}
   else if(event.data.type==="dext:workbench:diagnostics")setDiagnostics(event.data.diagnostics as Diagnostics);
   else if(event.data.type==="dext:workbench:error")setNotice("预览运行失败："+String(event.data.message));
  };
  window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
 },[session]);
 useEffect(()=>{
  if(!viewport.current)return;
  const observer=new ResizeObserver(entries=>setAvailableWidth(Math.max(64,entries[0].contentRect.width)));
  observer.observe(viewport.current);return()=>observer.disconnect();
 },[]);
 const send=(value:Record<string,unknown>)=>{if(session)iframe.current?.contentWindow?.postMessage({type:"dext:workbench:control",token:session.token,settings:value},"*");};
 useEffect(()=>{send({...settings,deskId:undefined});},[settings,session]);
 const dimension=(raw:string,set:(value:number)=>void)=>{const value=Number(raw);if(Number.isInteger(value)&&value>=64&&value<=16384)set(value);};
 const actualButtonIds=new Set(diagnostics?.buttons.map(b=>b.button));
 const currentDesk=props.room.desks.find(d=>d.id===(diagnostics?.snapshot.targetDeskId||diagnostics?.snapshot.currentDeskId||settings.deskId));
 const selected=authored.find(b=>b.id===settings.buttonId);
 const frames=diagnostics?.runtime.frames.instances??[];
 const errors=[diagnostics?.runtime.lastError?.code,diagnostics?.runtime.frames.lastError?.code,diagnostics?.runtime.layout.error].filter(Boolean);
 const resourceFor=(consumer:string)=>consumer==="scene"?props.room.roomScene?.entry:consumer==="slot.start"?props.room.start?.src:consumer==="slot.idle"?props.room.idle?.src:
  consumer.startsWith("slot.background.")?props.room.desks.find(d=>d.id===consumer.slice(16))?.background?.src:props.room.components?.find(c=>"component."+c.id===consumer)?.entry;

 return <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" aria-label="v3 作者试验台">
  <header className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
   <Button variant="ghost" onClick={props.onBack}>返回 Room 编辑</Button><h1 className="font-medium">{props.room.name} · 试验台</h1>
   <span className="text-xs text-muted-foreground">当前草稿 · 独立预览 · 示例数据</span>
   <Button variant="outline" size="sm" disabled={!props.isTauri} onClick={()=>setReload(v=>v+1)}>重新载入资源</Button>
  </header>
  <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
   <label>尺寸<select aria-label="试验台尺寸预设" className="ml-2 rounded border bg-background p-2" value={sizes.some(([w,h])=>w===width&&h===height)?width+"x"+height:"custom"} onChange={e=>{if(e.target.value==="custom")return;const [w,h]=e.target.value.split("x").map(Number);setWidth(w);setHeight(h);}}>
    {sizes.map(([w,h])=><option key={w+"x"+h} value={w+"x"+h}>{w} × {h}</option>)}<option value="custom">自定义</option>
   </select></label>
   <Input aria-label="试验台宽度" className="w-24" type="number" min={64} max={16384} value={width} onChange={e=>dimension(e.target.value,setWidth)}/><span>×</span>
   <Input aria-label="试验台高度" className="w-24" type="number" min={64} max={16384} value={height} onChange={e=>dimension(e.target.value,setHeight)}/>
   <label>Desk<select aria-label="试验台 Desk" className="ml-2 rounded border bg-background p-2" value={diagnostics?.snapshot.targetDeskId||diagnostics?.snapshot.currentDeskId||settings.deskId} onChange={e=>{setSettings(s=>({...s,deskId:e.target.value}));send({deskId:e.target.value});}}>{props.room.desks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <span className="text-xs text-muted-foreground">显示缩放 {Math.round(scale*100)}% · HTML 实际视口 {width} × {height}</span>
  </div>
  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
   <div className="min-w-0 space-y-3">
    <div ref={viewport} className="min-h-48 overflow-hidden rounded-lg border bg-black p-0">
     {session?<div style={{width:width*scale,height:height*scale,position:"relative"}}>
      <iframe ref={iframe} key={session.token} title="正式 v3 宿主草稿预览" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={workbenchDocument}
       style={{border:0,width,height,transform:"scale("+scale+")",transformOrigin:"top left"}}
       onLoad={()=>iframe.current?.contentWindow?.postMessage({type:"dext:workbench:init",token:session.token,room:props.room,baseUrl:session.baseUrl,deskId:settings.deskId,settings:currentSettings.current},"*")}/>
     </div>:<p className="p-8 text-sm text-white/60">{notice}</p>}
    </div>
    <p role="status" className="text-xs text-muted-foreground">{notice}{ready&&currentDesk?" · 当前 "+currentDesk.name:""}{diagnostics?.snapshot.targetDeskId?" · 切换中":""}</p>
    <div className="flex flex-wrap gap-2">
     {(["starting","desktop","idle"] as const).map((stage,i)=><Button key={stage} size="sm" variant="outline" disabled={!ready} onClick={()=>send({stage})}>{["模拟启动","返回桌面","模拟待机"][i]}</Button>)}
     <Button size="sm" variant="outline" disabled={!ready} onClick={()=>send({paused:!diagnostics?.snapshot.lifecycle.playbackPaused})}>{diagnostics?.snapshot.lifecycle.playbackPaused?"恢复预览":"暂停预览"}</Button>
    </div>
    <details open className="rounded-lg border p-3"><summary className="text-sm">按钮检查 · {authored.length} 声明 / {actualButtonIds.size} 当前发布</summary>
     <select aria-label="定位预览按钮" className="mt-2 w-full rounded border bg-background p-2 text-sm" value={settings.buttonId} onChange={e=>setSettings(s=>({...s,buttonId:e.target.value,showButtons:true}))}>
      <option value="">全部当前按钮区域</option>{authored.map(b=><option key={b.id} value={b.id}>{b.name} · {b.id} · {actualButtonIds.has(b.id)?"当前已发布":"当前未发布"}</option>)}
     </select>
     {selected&&<p className="mt-2 break-all text-xs text-muted-foreground">{selected.sources.join(" / ")||"已声明，尚无呈现"}{!actualButtonIds.has(selected.id)?" · 当前未发布可见区域；检查Desk、阶段、资源和作者几何报告。":""}</p>}
     <ul className="mt-2 space-y-1 text-xs">{diagnostics?.buttons.filter(b=>!settings.buttonId||b.button===settings.buttonId).map((b,i)=><li key={b.consumer+":"+b.button+":"+i} className="break-all">{b.button} · {b.consumer} · {b.polygons.length} 个可见多边形</li>)}</ul>
    </details>
    <details className="rounded-lg border p-3"><summary className="text-sm">资源诊断 · {props.room.resources.length} 声明</summary>
     {session?.missing.map(value=><p key={value.path} className="mt-2 break-all text-xs text-amber-600">{value.path} · {value.message}</p>)}
     <ul className="mt-2 max-h-48 overflow-auto text-xs">{props.room.resources.map(path=><li key={path} className="break-all font-mono">{path}</li>)}</ul>
    </details>
   </div>
   <aside className="space-y-3">
    <div className="space-y-2 rounded-lg border p-3"><h2 className="text-sm font-medium">区域覆盖层</h2>
     {([["showButtons","按钮 · 青色"],["showOccupied","占用 · 红色"],["showComponents","组件 · 紫色"]] as const).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:e.target.checked}))}/>{label}</label>)}
     <p className="text-xs text-muted-foreground">覆盖层只用于诊断，不写入 Room。</p>
     {diagnostics?.runtime.occupied.map((area,i)=><p key={area.id||i} className="break-all text-xs">{area.id||"占用区域 "+(i+1)} · {Math.round(area.x)},{Math.round(area.y)} · {Math.round(area.width)} × {Math.round(area.height)}</p>)}

    </div>
    <div className="space-y-2 rounded-lg border p-3"><h2 className="text-sm font-medium">数据与授权模拟</h2>
     {sources.map(([cap,name])=><label key={cap} className="flex items-center justify-between gap-2 text-sm">{name}<select aria-label={name+"预览状态"} className="rounded border bg-background p-1" value={settings.data[cap]||"available"} onChange={e=>setSettings(s=>({...s,data:{...s.data,[cap]:e.target.value}}))}><option value="available">示例正常</option><option value="missing">数据缺失</option><option value="denied">拒绝授权</option><option value="error">数据错误</option></select></label>)}
     <p className="text-xs text-muted-foreground">预览不读取本机监控或个人目标；系统动作不可执行。</p>
    </div>
    <details open className="rounded-lg border p-3"><summary className="text-sm">运行诊断</summary>
     <p className="mt-2 text-xs">宿主 {ready?"就绪":"准备中"} · 布局 {diagnostics?.runtime.layout.ready?"就绪":"等待"} · {diagnostics?.snapshot.lifecycle.stage??"—"}</p>
     {errors.map((code,i)=><p key={i} className="mt-1 text-xs text-amber-600">{code}</p>)}
     {frames.map(frame=><div key={frame.instanceId} className="mt-2 rounded border p-2 text-xs"><p className="break-all">{frame.consumerId}</p><p className="mt-1 break-all text-muted-foreground">{resourceFor(frame.consumerId)}</p><p>{frame.state} · SDK {frame.initialized?"已初始化":"等待"} · {frame.pendingRequests} 请求</p></div>)}
     {diagnostics?.runtime.layout.items.filter(item=>!item.placeable||item.scale<1).map(item=><p key={item.key} className="mt-2 break-all text-xs text-amber-600">{item.id} · {item.placeable?"临时缩小 "+Math.round(item.scale*100)+"%":"当前尺寸放不下"}</p>)}
     {diagnostics?.events.slice(-5).map((event,i)=><p key={i} className="mt-2 break-all text-xs text-muted-foreground">{event.code} · {event.detail}</p>)}
    </details>
   </aside>
  </div>
 </section>;
}
