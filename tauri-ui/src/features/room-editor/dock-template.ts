import type { RoomV3, V3Button, V3Component } from "./v3-document";
export type DockDataSource = { capability: "time.read" | "hardware.read" | "media.read" | "audio.read"; path: string[]; format: "text" | "number" | "clock" | "countdown"; deadline?: string };
export type DockParameter = { id: string; name: string; type: "number" | "choice"; default: number | string; min?: number; max?: number; options?: {value:string;label:string}[] };
export type DockRegion = { id: string; name: string; kind: "data" | "button"; defaultSource?: DockDataSource; defaultAction?: V3Button["action"] };
export type DockTemplateDescriptor = { formatVersion: 1; id: string; name: string; entry: string; placement: V3Component["placement"]; parameters: DockParameter[]; regions: DockRegion[]; examples: {id:string;name:string;source:DockDataSource}[] };
export type DockImport = { entry: string; resources: string[] };
const copy = <T,>(value:T):T => structuredClone(value);
const object = (value:unknown):value is Record<string,unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value:Record<string,unknown>, key:string) => Object.prototype.hasOwnProperty.call(value,key);
const freshId = (prefix:string) => prefix + "-" + crypto.randomUUID();
const readonlyCapabilities = ["time.read","hardware.read","media.read","audio.read"];
export function readDockDescriptor(value:unknown):DockTemplateDescriptor|undefined {
  if(!object(value)||value.formatVersion!==1||typeof value.id!=="string"||typeof value.name!=="string"||typeof value.entry!=="string"||
    !object(value.placement)||!["x","y","width","height"].every(key=>typeof (value.placement as Record<string,unknown>)[key]==="number")||
    !Array.isArray(value.parameters)||!value.parameters.every(p=>object(p)&&typeof p.id==="string"&&typeof p.name==="string"&&
      (p.type==="number"?typeof p.default==="number":p.type==="choice"&&typeof p.default==="string"&&Array.isArray(p.options)&&p.options.every(o=>object(o)&&typeof o.value==="string"&&typeof o.label==="string")))||
    !Array.isArray(value.regions)||!value.regions.every(r=>object(r)&&typeof r.id==="string"&&typeof r.name==="string"&&["data","button"].includes(String(r.kind)))||
    !Array.isArray(value.examples)||!value.examples.every(e=>object(e)&&typeof e.id==="string"&&typeof e.name==="string"&&object(e.source)&&Array.isArray(e.source.path)))return undefined;
  return value as unknown as DockTemplateDescriptor;
}
export function dockComponent(room:RoomV3):V3Component|undefined { return room.components?.find(c=>c.id===room.dockComponentId&&c.role==="dock"); }
function requiredDock(room:RoomV3):V3Component {
  const dock=dockComponent(room);if(!dock||!readDockDescriptor(dock.config?.template)||!Array.isArray(dock.config?.enabledRegions))throw new Error("请先选择 Dock 模板");return dock;
}
function deskReference(room:RoomV3,dock:V3Component,deskId:string) {
  const desk=room.desks.find(d=>d.id===deskId);if(!desk)throw new Error("Desk 已不存在");
  if(!desk.components.includes(dock.id))throw new Error("这个 Desk 尚未引用 Dock");return desk;
}
// Same recursive object / explicit null / whole array rules as the author SDK.
function merge(shared:unknown,override:unknown):unknown {
  if(!object(shared)||!object(override))return copy(override);
  return Object.fromEntries([...new Set([...Object.keys(shared),...Object.keys(override)])].map(key=>
    [key,own(override,key)?object(shared[key])&&object(override[key])?merge(shared[key],override[key]):copy(override[key]):copy(shared[key])]));
}
export function effectiveDockConfig(room:RoomV3,deskId?:string):Record<string,unknown> {
  const dock=requiredDock(room);
  if(!deskId)return copy(dock.config!);
  const desk=deskReference(room,dock,deskId),override=desk.componentOverrides?.[dock.id];
  return override?merge(dock.config,override) as Record<string,unknown>:copy(dock.config!);
}
function setLeaf(config:Record<string,unknown>,path:string[],value:unknown):void {
  let node=config;
  for(const key of path.slice(0,-1)){if(!object(node[key]))node[key]={};node=node[key] as Record<string,unknown>;}
  node[path[path.length-1]]=copy(value);
}
function deleteLeaf(config:Record<string,unknown>,path:string[]):void {
  const key=path[0];
  if(path.length===1){delete config[key];return;}
  if(!object(config[key]))return;
  deleteLeaf(config[key],path.slice(1));
  if(Object.keys(config[key]).length===0)delete config[key];
}
function difference(shared:unknown,override:unknown):unknown {
  if(JSON.stringify(shared)===JSON.stringify(override))return undefined;
  if(!object(shared)||!object(override))return copy(override);
  const result:Record<string,unknown>={};
  for(const [key,value] of Object.entries(override)){
    const changed=difference(shared[key],value);if(changed!==undefined)result[key]=changed;
  }
  return Object.keys(result).length?result:undefined;
}
function writeOverride(room:RoomV3,dock:V3Component,deskId:string,override:Record<string,unknown>):void {
  const desk=deskReference(room,dock,deskId),changed=difference(dock.config,override);
  if(object(changed)&&Object.keys(changed).length)(desk.componentOverrides??={})[dock.id]=changed;
  else {if(desk.componentOverrides)delete desk.componentOverrides[dock.id];}
  if(desk.componentOverrides&&!Object.keys(desk.componentOverrides).length)delete desk.componentOverrides;
}
function slotIds(config:Record<string,unknown>|undefined):string[] {
  return object(config?.buttonSlots)?Object.values(config.buttonSlots).filter((v):v is string=>typeof v==="string"):[];
}
function allDockSlots(room:RoomV3,dock:V3Component):string[] {
  return [...slotIds(dock.config),...room.desks.flatMap(d=>slotIds(d.componentOverrides?.[dock.id]))];
}
function referencedButtons(room:RoomV3):Set<string> {
  return new Set([...(room.components??[]).flatMap(c=>c.buttonIds??[]),
    ...room.desks.flatMap(d=>[...d.icons.map(i=>i.buttonId),...(d.background?.buttonIds??[])]),
    ...(room.start?.buttonIds??[]),...(room.idle?.buttonIds??[])]);
}
function pruneRemovedButtons(room:RoomV3,dock:V3Component,candidates:string[]):void {
  const kept=new Set(allDockSlots(room,dock));
  dock.buttonIds=(dock.buttonIds??[]).filter(id=>!candidates.includes(id)||kept.has(id));
  const used=referencedButtons(room);
  room.buttons=(room.buttons??[]).filter(b=>!candidates.includes(b.id)||used.has(b.id));
}
function checkPath(path:string[],allowButtons=false):void {
  if(!path.length||path.some(key=>!key.length)||!["appearance","slots",...(allowButtons?["buttonSlots"]:[])].includes(path[0]))
    throw new Error("不是可编辑的 Dock 参数");
}
export function setDockValue(room:RoomV3,path:string[],value:unknown,deskId?:string):RoomV3 {
  checkPath(path);const next=copy(room),dock=requiredDock(next);
  if(!deskId)setLeaf(dock.config!,path,value);
  else {const desk=deskReference(next,dock,deskId),override=copy(desk.componentOverrides?.[dock.id]??{});setLeaf(override,path,value);writeOverride(next,dock,deskId,override);}
  return next;
}
export function resetDockValue(room:RoomV3,path:string[],deskId:string):RoomV3 {
  checkPath(path,true);const next=copy(room),dock=requiredDock(next),candidates=allDockSlots(next,dock);
  const desk=deskReference(next,dock,deskId),override=copy(desk.componentOverrides?.[dock.id]??{});
  deleteLeaf(override,path);writeOverride(next,dock,deskId,override);pruneRemovedButtons(next,dock,candidates);return next;
}
function enabledRegion(dock:V3Component,regionId:string):DockRegion {
  const descriptor=dock.config!.template as DockTemplateDescriptor;
  const region=descriptor.regions.find(r=>r.id===regionId);
  if(!region||!(dock.config!.enabledRegions as string[]).includes(regionId))throw new Error("Dock 区域已不存在");return region;
}
function validateAction(room:RoomV3,action:V3Button["action"]):void {
  if(action?.type==="desk.go"&&!room.desks.some(d=>d.id===action.deskId))throw new Error("目标 Desk 已不存在");
}
export function setDockAction(room:RoomV3,regionId:string,action:V3Button["action"],deskId?:string):RoomV3 {
  const next=copy(room),dock=requiredDock(next),region=enabledRegion(dock,regionId);validateAction(next,action);
  if(region.kind!=="button")throw new Error("这个区域不是按钮");
  let buttonId:string;
  if(deskId){
    const sharedId=object(dock.config!.buttonSlots)?dock.config!.buttonSlots[regionId]:undefined;
    const shared=next.buttons?.find(button=>button.id===sharedId);
    if(JSON.stringify(shared?.action)===JSON.stringify(action))return resetDockValue(room,["buttonSlots",regionId],deskId);
    const desk=deskReference(next,dock,deskId),override=copy(desk.componentOverrides?.[dock.id]??{});
    const existing=object(override.buttonSlots)?override.buttonSlots[regionId]:undefined;
    const current=next.buttons?.find(b=>b.id===existing&&b.scope===deskId);
    buttonId=current?.id??freshId("button");
    if(!current)(next.buttons??=[]).push({id:buttonId,name:region.name,scope:deskId});
    setLeaf(override,["buttonSlots",regionId],buttonId);writeOverride(next,dock,deskId,override);
    dock.buttonIds=[...new Set([...(dock.buttonIds??[]),buttonId])];
  }else buttonId=String((dock.config!.buttonSlots as Record<string,string>)[regionId]);
  const button=next.buttons?.find(b=>b.id===buttonId);if(!button)throw new Error("Dock 按钮已不存在");
  if(action)button.action=copy(action);else delete button.action;return next;
}
export function removeDockRegion(room:RoomV3,regionId:string):RoomV3 {
  const next=copy(room),dock=requiredDock(next);enabledRegion(dock,regionId);const candidates=allDockSlots(next,dock);
  dock.config!.enabledRegions=(dock.config!.enabledRegions as string[]).filter(id=>id!==regionId);
  for(const key of ["slots","buttonSlots"])deleteLeaf(dock.config!,[key,regionId]);
  for(const desk of next.desks){
    const override=desk.componentOverrides?.[dock.id];if(!override)continue;
    for(const key of ["slots","buttonSlots"])deleteLeaf(override,[key,regionId]);
    writeOverride(next,dock,desk.id,override);
  }
  pruneRemovedButtons(next,dock,candidates);return next;
}
export function setDeskDockReference(room:RoomV3,deskId:string,enabled:boolean):RoomV3 {
  const next=copy(room),dock=requiredDock(next),desk=next.desks.find(d=>d.id===deskId);if(!desk)throw new Error("Desk 已不存在");
  const candidates=allDockSlots(next,dock);
  if(enabled)desk.components=[...new Set([...desk.components,dock.id])];
  else {
    desk.components=desk.components.filter(id=>id!==dock.id);
    if(desk.componentOverrides){delete desk.componentOverrides[dock.id];if(!Object.keys(desk.componentOverrides).length)delete desk.componentOverrides;}
  }
  pruneRemovedButtons(next,dock,candidates);return next;
}
export function attachDockTemplate(room:RoomV3,descriptor:DockTemplateDescriptor,imported:DockImport):RoomV3 {
  const next=copy(room),old=dockComponent(next),managed=!!readDockDescriptor(old?.config?.template)&&Array.isArray(old?.config?.enabledRegions),previous=old?.config??{};
  const componentId=old?.id??freshId("dock"),candidates=old&&managed?allDockSlots(next,old):[];
  const oldRegions=managed?(previous.template as DockTemplateDescriptor).regions:[];
  const enabled=managed?(previous.enabledRegions as string[]):[];
  const appearance:Record<string,unknown>={},slots:Record<string,unknown>={},buttonSlots:Record<string,string>={};
  for(const parameter of descriptor.parameters) {
    const existing=object(previous.appearance)?previous.appearance[parameter.id]:undefined;
    const compatible=managed&&(previous.template as DockTemplateDescriptor).parameters.some(p=>p.id===parameter.id&&p.type===parameter.type)&&(parameter.type==="number"?typeof existing==="number"&&
      (parameter.min===undefined||existing>=parameter.min)&&(parameter.max===undefined||existing<=parameter.max):
      typeof existing==="string"&&parameter.options?.some(option=>option.value===existing));
    appearance[parameter.id]=compatible?copy(existing):copy(parameter.default);
  }
  for(const region of descriptor.regions){
    const same=enabled.includes(region.id)&&oldRegions.some(r=>r.id===region.id&&r.kind===region.kind);
    if(region.kind==="data"){
      const existing=same&&object(previous.slots)?previous.slots[region.id]:undefined;
      if(existing!==undefined)slots[region.id]=copy(existing);else if(region.defaultSource)slots[region.id]=copy(region.defaultSource);
    }else {
      const existing=same&&object(previous.buttonSlots)?previous.buttonSlots[region.id]:undefined;
      const current=next.buttons?.find(b=>b.id===existing&&b.scope==="room");
      const buttonId=current?.id??freshId("button");buttonSlots[region.id]=buttonId;
      if(!current){validateAction(next,region.defaultAction);(next.buttons??=[]).push({id:buttonId,name:region.name,scope:"room",...(region.defaultAction?{action:copy(region.defaultAction)}:{})});}
    }
  }
  const config={...previous,template:copy(descriptor),appearance,slots,buttonSlots,enabledRegions:descriptor.regions.map(r=>r.id)};
  const foreignIds=(old?.buttonIds??[]).filter(id=>!candidates.includes(id));
  const dock:V3Component={id:componentId,role:"dock",entry:imported.entry,placement:copy(descriptor.placement),
    capabilities:["desk.read",...readonlyCapabilities,"desk.navigate","binding.launch","dext.exit"],config,buttonIds:foreignIds};
  if(old)next.components=next.components!.map(c=>c.id===old.id?dock:c);else(next.components??=[]).push(dock);
  next.dockComponentId=componentId;
  if(!old)for(const desk of next.desks)desk.components.push(componentId);
  for(const desk of next.desks) {
    const override=desk.componentOverrides?.[componentId];if(!override)continue;
    for(const key of ["slots","buttonSlots"]){
      if(!object(override[key]))continue;
      for(const regionId of Object.keys(override[key])){
        const match=descriptor.regions.find(r=>r.id===regionId&&r.kind===(key==="slots"?"data":"button"));
        if(!match||!enabled.includes(regionId))deleteLeaf(override,[key,regionId]);
      }
    }
    if(object(override.appearance))for(const key of Object.keys(override.appearance))if(!descriptor.parameters.some(p=>p.id===key))deleteLeaf(override,["appearance",key]);
    writeOverride(next,dock,desk.id,override);
  }
  dock.buttonIds=[...new Set([...foreignIds,...allDockSlots(next,dock)])];
  pruneRemovedButtons(next,dock,candidates);
  next.resources=[...new Set([...next.resources,...imported.resources])].sort();return next;
}
