import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addV3Icon, createV3History, moveV3Desk, newV3Desk, readRoomV3, recordV3Change, redoV3, removeV3Desk, removeV3Presentation,
  serializeRoomV3, undoV3, v3IconCreationIssue, type RoomV3, type V3Content, type V3History } from "./v3-document";

import { V3Workbench } from "./V3Workbench";
import { V3PersonalEditor } from "./V3PersonalEditor";
import type {AppPickerItem} from "@/components/AppPickerDialog";
import { V3DockEditor } from "./V3DockEditor";
import { V3ReadGrantPanel } from "./V3ReadGrantPanel";
import { attachDockTemplate, setDeskDockReference } from "./dock-template";
import type { DockTemplateDescriptor } from "./dock-template";

type Props = { room:RoomV3; path:string; apps:AppPickerItem[]; isTauri:boolean; canApply:boolean; onBack:()=>void; onDirty:(dirty:boolean)=>void;
  onSaved:()=>void; onApply:()=>Promise<void>; onApplied:()=>void;
  onSaveAs:(json:string)=>Promise<void>; onShare:()=>Promise<void> };
type Draft = {base:string;history:V3History;resources:string[]};
const labels = {image:"图片",video:"视频",gif:"GIF",html:"本地 HTML"} as const;
const extensions = {image:["png","jpg","jpeg","webp","svg","avif"],video:["mp4","webm"],gif:["gif"],html:["html","htm"]};
function recovered(props:Props):Draft {
  const base=serializeRoomV3(props.room);
  try {
    const draft=JSON.parse(localStorage.getItem("dext.v3.draft:"+props.path)??"null") as Draft|null;
    if(draft?.base===base&&Array.isArray(draft.resources)&&Array.isArray(draft.history?.past)&&Array.isArray(draft.history.future)){
      readRoomV3(serializeRoomV3(draft.history.present));return draft;
    }
  }catch{/* A damaged cache never replaces the saved author document. */}
  return {base,history:createV3History(props.room),resources:[...props.room.resources]};
}
export function V3RoomEditor(props:Props){
  const [draft,setDraft]=useState(()=>recovered(props));
  const room=draft.history.present;
  const [selected,setSelected]=useState(room.startDesk);
  const desk=room.desks.find(d=>d.id===selected)??room.desks[0];
  const iconCreationIssue=v3IconCreationIssue(room,desk.id,true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [workbenchOpen,setWorkbenchOpen]=useState(false);
  const dirty=serializeRoomV3(room,draft.resources)!==draft.base;
  const docks=(room.components??[]).filter(c=>c.role==="dock");
  const consumerNames:Record<string,string> = Object.fromEntries([
    ["scene","持续场景"],["slot.start","启动页面"],["slot.idle","待机页面"],
    ...room.desks.map(d=>["slot.background."+d.id,"背景 · "+d.name]),
    ...(room.components??[]).map(c=>["component."+c.id,(c.role==="widget"?"Widget · ":"Dock · ")+(typeof c.config?.title==="string"?c.config.title:c.id)]),
  ]);
  const change=(next:RoomV3)=>setDraft(current=>({...current,history:recordV3Change(current.history,next)}));
  const update=(edit:(next:RoomV3)=>void)=>{const next=structuredClone(room);edit(next);change(next);};
  useEffect(()=>{
    props.onDirty(dirty);
    try {localStorage.setItem("dext.v3.draft:"+props.path,JSON.stringify(draft));}
    catch {setMessage("草稿恢复缓存写入失败；请保存作品到磁盘");}
  },[draft,dirty,props.path]); // Parent receives only the dirty flag.
  async function save(){
    const json=serializeRoomV3(room,draft.resources);
    if(!props.isTauri){setMessage("浏览器设计模式：未写磁盘");return false;}
    await invoke("write_room",{path:props.path+"/room.json",roomJson:json});
    setDraft(current=>({...current,base:json}));props.onSaved();setMessage("已保存原生 Room v3");return true;
  }
  async function run(operation:()=>Promise<void>){
    if(busy)return;setBusy(true);setMessage("");
    try{await operation();}catch(error){setMessage("操作失败："+String(error));}finally{setBusy(false);}
  }
  async function pick(kind:V3Content["type"],slot:"background"|"start"|"idle"|"dock"){
    if(!props.isTauri){setMessage("选择本地素材请在桌面配置器中使用");return;}
    const source=await open({multiple:false,filters:[{name:labels[kind],extensions:extensions[kind]}]});
    if(typeof source!=="string")return;
    const result=await invoke<{content:V3Content;resources:string[]}>("import_v3_content",{roomDir:props.path,srcPath:source,contentType:kind});
    let next=structuredClone(room);
    if(slot==="dock"&&next.components?.find(c=>c.id===next.dockComponentId)?.config?.template)for(const d of next.desks)if(d.components.includes(next.dockComponentId!))next=setDeskDockReference(next,d.id,false);
    if(slot==="background")next.desks.find(d=>d.id===desk.id)!.background=result.content;
    else if(slot==="dock"){
      const componentId="dock-"+crypto.randomUUID();
      (next.components??=[]).push({id:componentId,role:"dock",entry:result.content.src,placement:{x:0,y:960,width:1920,height:120},capabilities:[]});
      const old=next.dockComponentId;next.dockComponentId=componentId;for(const d of next.desks){d.components=d.components.filter(id=>id!==old);if(d.componentOverrides&&old){delete d.componentOverrides[old];if(!Object.keys(d.componentOverrides).length)delete d.componentOverrides;}d.components.push(componentId);}
    }else next[slot]=result.content;
    setDraft(current=>({...current,resources:[...new Set([...current.resources,...result.resources])],history:recordV3Change(current.history,next)}));
    setMessage("素材已复制；保存后生效");
  }
  async function importDock(descriptor:DockTemplateDescriptor) {
    await run(async()=>{
      const imported=props.isTauri?await invoke<{entry:string;resources:string[];descriptor:DockTemplateDescriptor}>("import_v3_dock_template",{roomDir:props.path,templateId:descriptor.id})
        :{entry:descriptor.entry,resources:[],descriptor};
      const next=attachDockTemplate(room,imported.descriptor,imported);
      setDraft(current=>({...current,resources:[...new Set([...current.resources,...imported.resources])],history:recordV3Change(current.history,next)}));
      setMessage(props.isTauri?"Dock 模板已复制；保存后生效":"浏览器设计模式：仅编辑草稿，未复制模板文件");
    });
  }
  const contentPicker=(slot:"background"|"start"|"idle",content:V3Content|undefined)=>(
    <div className="space-y-2">
      <p className="break-all text-xs text-muted-foreground">{content?labels[content.type]+" · "+content.src:"尚未选择素材"}</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(labels) as V3Content["type"][]).map(kind=>
        <Button key={kind} variant="outline" size="sm" disabled={busy} onClick={()=>void run(()=>pick(kind,slot))}>选择{labels[kind]}</Button>)}
        {content&&<Button variant="ghost" size="sm" disabled={busy} onClick={()=>update(next=>{
          if(slot==="background")delete next.desks.find(d=>d.id===desk.id)!.background;else delete next[slot];
        })}>清除素材</Button>}
      </div>
    </div>
  );
  if(workbenchOpen)return <V3Workbench room={{...room,resources:[...new Set([...room.resources,...draft.resources])]}} path={props.path} isTauri={props.isTauri} deskId={desk.id} onBack={()=>setWorkbenchOpen(false)} onChange={change}/>;
  return <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label="原生 v3 Room 编辑器">
    <header className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <Button variant="ghost" disabled={busy} onClick={props.onBack}>返回房间库</Button>
      <Button variant="outline" disabled={busy} onClick={()=>setWorkbenchOpen(true)}>打开试验台</Button>
      <Button variant="outline" disabled={busy||Boolean(iconCreationIssue)} title={iconCreationIssue??("向 "+desk.name+" 添加应用图标")} onClick={()=>{
        change(addV3Icon(room,desk.id,"我的应用","binding.launch"));
        setMessage("已向 "+desk.name+" 添加应用图标。保存并应用后，在“按钮与本机设置”中选择这个图标并绑定本机应用。");
      }}>添加应用</Button>
      <span className="font-medium">{room.name}</span><span className="text-xs text-muted-foreground">v3 · {dirty?"未保存":"已保存"}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy||!draft.history.past.length} onClick={()=>setDraft(d=>({...d,history:undoV3(d.history)}))}>撤销</Button>
        <Button variant="outline" disabled={busy||!draft.history.future.length} onClick={()=>setDraft(d=>({...d,history:redoV3(d.history)}))}>重做</Button>
        <Button disabled={busy} onClick={()=>void run(async()=>{await save();})}>保存</Button>
        <Button variant="outline" disabled={busy||!props.canApply||!props.isTauri} title={!props.canApply?"先启动 Core，以复制本机绑定和皮肤":undefined}
          onClick={()=>void run(()=>props.onSaveAs(serializeRoomV3(room,draft.resources)))}>另存为</Button>
        <Button variant="outline" disabled={busy||!props.isTauri} onClick={()=>void run(async()=>{
          if(await save())await props.onShare();
        })}>保存并导出</Button>
        <Button variant="outline" disabled={busy||!props.canApply||!props.isTauri} title={!props.canApply?"先启动 Core":undefined} onClick={()=>void run(async()=>{
          if(!await save())return;await props.onApply();props.onApplied();setMessage("已保存并应用到桌面");
        })}>保存并应用</Button>
      </div>
    </header>
    {message&&<p role="status" className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{message}</p>}
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-3">
      <div className="space-y-4 overflow-auto rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between"><h2 className="font-medium">Desk 路线图</h2>
          <Button variant="outline" disabled={busy||room.desks.length>=64} onClick={()=>{const next=newV3Desk(room.desks.length);update(r=>{
            if(r.dockComponentId)next.components=[r.dockComponentId];r.desks.push(next);
          });setSelected(next.id);}}>添加 Desk</Button></div>
        <div className="flex items-center gap-3 text-sm"><span>默认切换</span>
          <select aria-label="默认切换" className="rounded border bg-background p-2" disabled={busy||room.transition?.type==="author"} value={room.transition?.type??"slide"}
            onChange={e=>update(r=>{r.transition={type:e.target.value as "slide"|"fade"|"none",durationMs:r.transition?.durationMs??450};})}>
            <option value="slide">滑动</option><option value="fade">淡入淡出</option><option value="none">无</option>
            {room.transition?.type==="author"&&<option value="author">作者场景</option>}
          </select>
          <Input aria-label="过渡时长" type="number" min={0} max={10000} className="w-28" disabled={busy} value={room.transition?.durationMs??450}
            onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=10000)update(r=>{r.transition={type:r.transition?.type??"slide",durationMs:n};});}}/>
          <span className="text-muted-foreground">毫秒</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">{room.desks.map((d,index)=><div key={d.id} className="contents">
          {index>0&&<span className="text-muted-foreground" aria-label="相邻切页">↔</span>}
          <button type="button" className={"min-w-40 rounded-xl border p-4 text-left "+(d.id===desk.id?"border-cyan-500 bg-cyan-500/10":"border-border")} onClick={()=>setSelected(d.id)}>
            <span className="block font-medium">{d.name} {d.id===room.startDesk?"· 起点":""}</span>
            <span className="text-xs text-muted-foreground">{d.background?labels[d.background.type]:"默认背景"} · {d.icons.length} 图标</span>
          </button>
        </div>)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="共享 Dock 引用" className="min-w-48 rounded border bg-background p-2 text-sm" disabled={busy} value={room.dockComponentId??""} onChange={e=>{
            const old=room.dockComponentId,id=e.target.value;let next=structuredClone(room);
            if(old&&next.components?.find(c=>c.id===old)?.config?.template)for(const d of next.desks)if(d.components.includes(old))next=setDeskDockReference(next,d.id,false);
            for(const d of next.desks){d.components=d.components.filter(c=>c!==old);if(d.componentOverrides&&old){delete d.componentOverrides[old];if(!Object.keys(d.componentOverrides).length)delete d.componentOverrides;}if(id&&!d.components.includes(id))d.components.push(id);}
            if(id)next.dockComponentId=id;else delete next.dockComponentId;change(next);
          }}>
            <option value="">无共享 Dock</option>{docks.map(d=><option key={d.id} value={d.id}>{d.config?.template?(d.config.template as DockTemplateDescriptor).name:d.id}</option>)}
          </select>
          <Button variant="outline" disabled={busy} onClick={()=>void run(()=>pick("html","dock"))}>添加本地 Dock</Button>
        </div>
        <V3DockEditor room={room} deskId={desk.id} isTauri={props.isTauri} canApply={props.canApply} disabled={busy} onChange={change} onImport={importDock} onMessage={setMessage}/>
        <V3ReadGrantPanel roomId={room.id} consumerNames={consumerNames} isTauri={props.isTauri} canApply={props.canApply} disabled={busy}/>
        <V3PersonalEditor room={room} path={props.path} deskId={desk.id} apps={props.apps} isTauri={props.isTauri} canApply={props.canApply} disabled={busy} dirty={dirty} onChange={change}/>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">启动和待机素材</summary>
          <div className="mt-3 space-y-4"><div><h3 className="mb-2 text-sm">启动</h3>{contentPicker("start",room.start)}</div>
            <div><h3 className="mb-2 text-sm">待机</h3>{contentPicker("idle",room.idle)}</div></div></details>
        <p className="text-xs text-muted-foreground">本地 HTML 请放在独立素材文件夹；选择入口会复制同目录及子目录中的配套文件。作品内容与个人绑定分别保存。</p>
      </div>
      <aside className="space-y-4 overflow-auto rounded-lg border bg-card p-4">
        <h2 className="font-medium">当前 Desk</h2>
        <label className="block space-y-1 text-sm">名称<Input aria-label="Desk 名称" disabled={busy} value={desk.name} onChange={e=>update(r=>{r.desks.find(d=>d.id===desk.id)!.name=e.target.value;})}/></label>
        <p className="break-all font-mono text-[10px] text-muted-foreground">{desk.id}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy||desk.id===room.startDesk} onClick={()=>update(r=>{r.startDesk=desk.id;})}>设为起点</Button>
          <Button variant="outline" size="sm" disabled={busy||room.desks[0].id===desk.id} onClick={()=>change(moveV3Desk(room,desk.id,-1))}>前移</Button>
          <Button variant="outline" size="sm" disabled={busy||room.desks[room.desks.length-1].id===desk.id} onClick={()=>change(moveV3Desk(room,desk.id,1))}>后移</Button>
          <Button variant="ghost" size="sm" disabled={busy||room.desks.length===1} onClick={()=>{if(confirm("删除 Desk？其专属按钮一并移除，指向它的按钮恢复待配置；可撤销。"))change(removeV3Desk(room,desk.id));}}>删除 Desk</Button></div>
        <div><h3 className="mb-2 text-sm font-medium">背景素材</h3>{contentPicker("background",desk.background)}</div>
        <div><h3 className="mb-2 text-sm font-medium">默认图标</h3>
          <div className="flex flex-wrap gap-2">{(["desk.previous","desk.next","binding.launch"] as const).map(action=>
            <Button key={action} variant="outline" size="sm" disabled={busy||Boolean(iconCreationIssue)} title={iconCreationIssue??undefined} onClick={()=>change(addV3Icon(room,desk.id,action==="desk.next"?"下一页":action==="desk.previous"?"上一页":"我的应用",action))}>
              {action==="desk.next"?"+ 下一页":action==="desk.previous"?"+ 上一页":"+ 添加应用"}</Button>)}</div>
          {iconCreationIssue&&<p className="mt-2 text-xs text-muted-foreground">{iconCreationIssue}</p>}
          <ul className="mt-3 space-y-2">{desk.icons.map(icon=><li key={icon.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
            <span>{icon.glyph} {icon.label}</span><Button variant="ghost" size="sm" disabled={busy} onClick={()=>change(removeV3Presentation(room,desk.id,icon.id))}>移除</Button></li>)}</ul>
        </div>
      </aside>
    </div>
  </section>;
}
