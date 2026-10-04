import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { V3ReadGrantPanel } from "./V3ReadGrantPanel";
import panels from "../../../../creator-kit/v3/dock-templates/three-panels/template.json";
import navigation from "../../../../creator-kit/v3/dock-templates/navigation-bar/template.json";
import { dockComponent, readDockDescriptor, effectiveDockConfig, setDockValue, resetDockValue, setDockAction, removeDockRegion, setDeskDockReference } from "./dock-template";
import type { DockTemplateDescriptor, DockDataSource, DockRegion } from "./dock-template";
import type { RoomV3, V3Button } from "./v3-document";
const builtIns = [panels,navigation] as DockTemplateDescriptor[];
type Props={room:RoomV3;deskId:string;isTauri:boolean;canApply:boolean;disabled:boolean;onChange:(room:RoomV3)=>void;onImport:(descriptor:DockTemplateDescriptor)=>Promise<void>;onMessage:(message:string)=>void};
const sources=[["time.read","时间"],["hardware.read","硬件"],["media.read","媒体"],["audio.read","音量"]];
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const selectStyle="w-full rounded border bg-background p-2 text-sm";
export function V3DockEditor(props:Props){
 const [templates,setTemplates]=useState(builtIns),[editDesk,setEditDesk]=useState(false);
 const {room,deskId}=props,dock=dockComponent(room),desk=room.desks.find(d=>d.id===deskId)!;
 const descriptor=Array.isArray(dock?.config?.enabledRegions)?readDockDescriptor(dock?.config?.template):undefined;
 const assigned=!!dock&&desk.components.includes(dock.id),scope=editDesk?deskId:undefined;
 const config=descriptor?effectiveDockConfig(room,editDesk&&assigned?deskId:undefined):{},prefix=editDesk?desk.name:"共享";
 const override=dock?desk.componentOverrides?.[dock.id]:undefined;
 useEffect(()=>{
  if(!props.isTauri)return;let disposed=false;
  invoke<DockTemplateDescriptor[]>("list_v3_dock_templates").then(result=>{if(!disposed)setTemplates(result);})
   .catch(error=>{if(!disposed)props.onMessage("Dock 模板读取失败："+String(error));});return()=>{disposed=true;};
 },[props.isTauri]);
 const apply=(operation:()=>RoomV3)=>{try{props.onChange(operation());}catch(error){props.onMessage(String(error));}};
 const set=(path:string[],value:unknown)=>apply(()=>setDockValue(room,path,value,scope));
 const changed=(path:string[])=>{let node:unknown=override;for(const key of path){if(!object(node)||!Object.prototype.hasOwnProperty.call(node,key))return false;node=node[key];}return true;};
 const reset=(path:string[],name:string)=>(editDesk&&changed(path)?<Button variant="ghost" size="sm" disabled={props.disabled} aria-label={"恢复继承 "+name} onClick={()=>apply(()=>resetDockValue(room,path,deskId))}>恢复继承</Button>:null);
 const binding=(region:DockRegion)=>room.buttons?.find(button=>button.id===(object(config.buttonSlots)?config.buttonSlots[region.id]:undefined));
 const chooseAction=(region:DockRegion,value:string)=>{
  const action:V3Button["action"]=value==="none"?undefined:value==="desk.go"?{type:"desk.go",deskId:room.startDesk}:{type:value as NonNullable<V3Button["action"]>["type"]};
  apply(()=>setDockAction(room,region.id,action,scope));
 };
 return <section aria-label="Dock 模板编辑" className="space-y-4 rounded-xl border bg-background/50 p-4">
  <div><h3 className="text-sm font-medium">1 · Dock 外观</h3><p className="mt-1 text-xs text-muted-foreground">选择模板后自动识别区域；再次选择可恢复已删除区域。</p></div>
  <div className="grid grid-cols-2 gap-2">{templates.map(template=><Button key={template.id} variant="outline" className={"h-auto justify-start whitespace-normal p-3 "+(descriptor?.id===template.id?"border-cyan-500 bg-cyan-500/10":"")} disabled={props.disabled} aria-label={"选择 "+template.name} onClick={()=>void props.onImport(template)}>
   <span className="text-left"><span className="block">{template.name}</span><span className="mt-1 block text-[11px] font-normal text-muted-foreground">{template.regions.filter(r=>r.kind==="data").length} 数据区 · {template.regions.filter(r=>r.kind==="button").length} 按钮区</span></span>
  </Button>)}</div>
  {descriptor&&dock&&<>
   <div><h3 className="text-sm font-medium">2 · 共享交互 / Desk 差异</h3><div className="mt-2 flex gap-2">
    <Button size="sm" variant={!editDesk?"secondary":"ghost"} disabled={props.disabled} onClick={()=>setEditDesk(false)}>共享配置</Button>
    <Button size="sm" variant={editDesk?"secondary":"ghost"} disabled={props.disabled} onClick={()=>setEditDesk(true)}>当前 Desk 差异</Button></div>
    <p className="mt-2 text-xs text-muted-foreground">{editDesk?"仅保存当前 Desk 修改的字段；恢复继承后继续跟随共享配置。":"所有引用此 Dock 的 Desk 默认使用这些值。"}</p>
    {editDesk&&!assigned&&<p role="status" className="mt-2 text-sm text-amber-600">当前 Desk 尚未引用 Dock；勾选下方引用后可编辑。</p>}
   </div>
   <fieldset disabled={props.disabled||(editDesk&&!assigned)} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">{descriptor.parameters.map(parameter=>{
     const value=object(config.appearance)?config.appearance[parameter.id]:parameter.default;
     return <div key={parameter.id} className="space-y-1 text-xs"><div className="flex items-center justify-between">{parameter.name}{reset(["appearance",parameter.id],parameter.name)}</div>
      {parameter.type==="number"?<Input type="number" aria-label={prefix+" · "+parameter.name} min={parameter.min} max={parameter.max} value={typeof value==="number"?value:parameter.default} onChange={e=>{
       const n=Number(e.target.value);if(e.target.value!==""&&Number.isFinite(n)&&(parameter.min===undefined||n>=parameter.min)&&(parameter.max===undefined||n<=parameter.max))set(["appearance",parameter.id],n);
      }}/>:<select aria-label={prefix+" · "+parameter.name} className={selectStyle} value={String(value)} onChange={e=>set(["appearance",parameter.id],e.target.value)}>
       {parameter.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>}
     </div>;
    })}</div>
    <div className="space-y-3">{descriptor.regions.filter(region=>(config.enabledRegions as string[]).includes(region.id)).map(region=>{
     const candidate=object(config.slots)?config.slots[region.id]:undefined;
     const source=(object(candidate)&&Array.isArray(candidate.path)&&candidate.path.every(key=>typeof key==="string")?candidate:undefined) as DockDataSource|undefined,button=binding(region);
     const example=descriptor.examples.find(v=>JSON.stringify(v.source)===JSON.stringify(source))?.id??"";
     return <div key={region.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between"><span className="text-sm font-medium">{region.name} <span className="text-[10px] font-normal text-muted-foreground">{region.kind==="data"?"数据":"按钮"}</span></span>
       {!editDesk&&<Button size="sm" variant="ghost" aria-label={"删除区域 "+region.name} onClick={()=>apply(()=>removeDockRegion(room,region.id))}>删除区域</Button>}
       {reset([region.kind==="data"?"slots":"buttonSlots",region.id],region.name)}</div>
      {region.kind==="data"?<>
       <select aria-label={prefix+" · "+region.name+" 示例"} className={selectStyle} value={example} onChange={e=>{const selected=descriptor.examples.find(v=>v.id===e.target.value);if(selected)set(["slots",region.id],selected.source);}}>
        <option value="">自定义数据</option>{descriptor.examples.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
       <div className="grid grid-cols-2 gap-2">
        <select aria-label={prefix+" · "+region.name+" 数据源"} className={selectStyle} value={source?.capability??""} onChange={e=>set(["slots",region.id],{...source,capability:e.target.value,path:source?.path??[],format:source?.format??"text"})}>
         <option value="">未选择</option>{sources.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
        <select aria-label={prefix+" · "+region.name+" 显示方式"} className={selectStyle} value={source?.format??"text"} onChange={e=>set(["slots",region.id,"format"],e.target.value)}>
         <option value="text">文字 / JSON</option><option value="number">数值</option><option value="clock">本地时钟</option><option value="countdown">倒计时</option></select>
       </div>
       <Input aria-label={prefix+" · "+region.name+" 数据路径"} placeholder="数据字段，例如 cpuPercent" value={source?.path?.join(".")??""} onChange={e=>set(["slots",region.id,"path"],e.target.value?e.target.value.split("."):[])}/>
       {source?.format==="countdown"&&<Input aria-label={prefix+" · "+region.name+" 截止时间"} placeholder="公开示例截止时间：2030-01-01T00:00:00Z" value={source.deadline??""} onChange={e=>set(["slots",region.id,"deadline"],e.target.value)}/>}
       <p className="text-[11px] text-muted-foreground">所有已开放只读源均可选择。缺数据或格式不匹配时保留外框，隐藏读数。</p>
      </>:<>
       <select aria-label={prefix+" · "+region.name+" 默认动作"} className={selectStyle} value={button?.action?.type??"none"} onChange={e=>chooseAction(region,e.target.value)}>
        <option value="none">不设默认动作</option><option value="desk.previous">上一页</option><option value="desk.next">下一页</option><option value="desk.go">转到 Desk</option><option value="binding.launch">待绑定应用</option><option value="dext.exit">退出 Dext</option></select>
       {button?.action?.type==="desk.go"&&<select aria-label={prefix+" · "+region.name+" 目标 Desk"} className={selectStyle} value={button.action.deskId} onChange={e=>apply(()=>setDockAction(room,region.id,{type:"desk.go",deskId:e.target.value},scope))}>
        {room.desks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}
       <details className="text-[10px] text-muted-foreground"><summary className="cursor-pointer">作者按钮标识</summary><p className="mt-1 break-all">{button?.id}</p></details>
      </>}
     </div>;
    })}</div>
   </fieldset>
   <div><h3 className="text-sm font-medium">3 · Desk 引用</h3><p className="mt-1 text-xs text-muted-foreground">组件引用与 Desk 切页分别编辑；取消引用会清除该 Desk 的 Dock 差异。</p>
    <div className="mt-2 flex flex-wrap gap-3">{room.desks.map(d=><label key={d.id} className="text-sm"><input type="checkbox" aria-label={d.name+" 引用 Dock"} className="mr-2" disabled={props.disabled} checked={d.components.includes(dock.id)} onChange={e=>apply(()=>setDeskDockReference(room,d.id,e.target.checked))}/>{d.name}</label>)}</div>
   </div>
  </>}
  {dock&&<V3ReadGrantPanel key={room.id+":"+dock.id} roomId={room.id} consumerId={"component."+dock.id} isTauri={props.isTauri} canApply={props.canApply} disabled={props.disabled}/>}
  {dock&&!descriptor&&<p className="text-xs text-muted-foreground">当前本地 Dock 没有模板区域描述。选择官方模板即可配置数据与按钮。</p>}
 </section>;
}
