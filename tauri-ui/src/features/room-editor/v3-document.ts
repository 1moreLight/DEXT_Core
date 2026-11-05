export type V3Content = { type: "image" | "video" | "gif" | "html"; src: string; capabilities?: string[]; buttonIds?: string[] };
export type V3Button = { id: string; name: string; scope: string; action?: { type: "desk.next" | "desk.previous" | "desk.go" | "binding.launch" | "dext.exit"; deskId?: string } };
export type V3Icon = { id: string; buttonId: string; x: number; y: number; label?: string; glyph?: string };
export type V3Component = { id: string; role: "widget" | "dock"; entry: string; placement: {x:number;y:number;width:number;height:number}; capabilities: string[]; buttonIds?: string[]; config?: Record<string, unknown> };
export type V3Desk = { id: string; name: string; icons: V3Icon[]; components: string[]; background?: V3Content; componentOverrides?: Record<string, Record<string, unknown>> };
export type RoomV3 = { version: 3; apiVersion: 1; id: string; name: string; startDesk: string; desks: V3Desk[]; resources: string[];
  transition?: {type:"slide"|"fade"|"none"|"author";durationMs:number}; components?: V3Component[]; buttons?: V3Button[];
  dockComponentId?: string; roomScene?: {entry:string;capabilities:string[];config?:Record<string,unknown>}; start?:V3Content;idle?:V3Content };
export type V3History = { present: RoomV3; past: RoomV3[]; future: RoomV3[] };
const copy = <T,>(value:T):T => structuredClone(value);
const id = (prefix:string) => prefix + "-" + crypto.randomUUID();
export function newV3Desk(index:number):V3Desk { return {id:id("desk"),name:"Desk " + (index+1),icons:[],components:[]}; }
export function ensureDeskSwitchIcons(room:RoomV3, deskId?:string):RoomV3 {
  const next=copy(room);
  const ensureButton=(action:"desk.previous"|"desk.next",name:string)=>{
    let button=next.buttons?.find(b=>b.scope==="room"&&b.action?.type===action);
    if(!button){
      button={id:id("button"),name,scope:"room",action:{type:action}};
      (next.buttons??=[]).push(button);
    }
    return button;
  };
  const previous=ensureButton("desk.previous","上一页");
  const forward=ensureButton("desk.next","下一页");
  const desks=deskId?next.desks.filter(d=>d.id===deskId):next.desks;
  for(const desk of desks){
    if(!desk.icons.some(icon=>icon.buttonId===previous.id))
      desk.icons.push({id:id("icon"),buttonId:previous.id,label:"上一页",glyph:"←",x:desk.icons.length%8,y:Math.floor(desk.icons.length/8)});
    if(!desk.icons.some(icon=>icon.buttonId===forward.id))
      desk.icons.push({id:id("icon"),buttonId:forward.id,label:"下一页",glyph:"→",x:desk.icons.length%8,y:Math.floor(desk.icons.length/8)});
  }
  return next;
}
export function createRoomV3(name:string):RoomV3 {
  const desks=[newV3Desk(0),newV3Desk(1)];
  return ensureDeskSwitchIcons({version:3,apiVersion:1,id:crypto.randomUUID(),name:name.trim(),startDesk:desks[0].id,desks,resources:[],transition:{type:"slide",durationMs:450}});
}
export function readRoomV3(json:string):RoomV3 {
  const room=JSON.parse(json) as RoomV3;
  if(room.version!==3||room.apiVersion!==1||!Array.isArray(room.desks)||!room.desks.length||!Array.isArray(room.resources)||
    !room.desks.every(d=>typeof d.id==="string"&&Array.isArray(d.icons)&&Array.isArray(d.components))||
    !room.desks.some(d=>d.id===room.startDesk)) throw new Error("不是可编辑的原生 Room v3");
  return room;
}
export function serializeRoomV3(room:RoomV3,importedResources:string[]=[]):string {
  const next=copy(room);next.resources=[...new Set([...next.resources,...importedResources])].sort();
  return JSON.stringify(next,null,2);
}
export function moveV3Desk(room:RoomV3,deskId:string,direction:-1|1):RoomV3 {
  const next=copy(room),index=next.desks.findIndex(d=>d.id===deskId),target=index+direction;
  if(index>=0&&target>=0&&target<next.desks.length) [next.desks[index],next.desks[target]]=[next.desks[target],next.desks[index]];
  return next;
}
export function removeV3Desk(room:RoomV3,deskId:string):RoomV3 {
  if(room.desks.length<2) throw new Error("至少保留一个 Desk");
  const next=copy(room);next.desks=next.desks.filter(d=>d.id!==deskId);
  if(next.startDesk===deskId) next.startDesk=next.desks[0].id;
  next.buttons=(next.buttons??[]).filter(b=>b.scope!==deskId).map(b=>{
    if(b.action?.type==="desk.go"&&b.action.deskId===deskId) delete b.action;return b;
  });
  const buttons=new Set(next.buttons.map(b=>b.id));
  const cleanReferences=(content:{buttonIds?:string[]}|undefined)=>{if(content?.buttonIds)content.buttonIds=content.buttonIds.filter(id=>buttons.has(id));};
  for(const d of next.desks){d.icons=d.icons.filter(icon=>buttons.has(icon.buttonId));cleanReferences(d.background);}
  for(const component of next.components??[])cleanReferences(component);
  cleanReferences(next.start);cleanReferences(next.idle);
  return next;
}
export function v3IconCreationIssue(room:RoomV3,deskId:string,newButton:boolean):string|null {
  const desk=room.desks.find(d=>d.id===deskId);
  if(!desk)return "Desk 已不存在";
  if(desk.icons.length>=512)return "这个 Desk 的图标数量已达上限";
  if(newButton&&(room.buttons?.length??0)>=1024)return "这个 Room 的按钮数量已达上限，可复用现有按钮";
  return null;
}
export function addV3Icon(room:RoomV3,deskId:string,label:string,action:"desk.next"|"desk.previous"|"binding.launch"):RoomV3 {
  const issue=v3IconCreationIssue(room,deskId,true);if(issue)throw new Error(issue);
  const next=copy(room),desk=next.desks.find(d=>d.id===deskId);if(!desk)throw new Error("Desk 已不存在");
  const buttonId=id("button"),index=desk.icons.length;
  (next.buttons??=[]).push({id:buttonId,name:label,scope:deskId,action:{type:action}});
  desk.icons.push({id:id("icon"),buttonId,label,glyph:action==="desk.next"?"→":action==="desk.previous"?"←":"◇",x:index%8,y:Math.floor(index/8)});
  return next;
}
export function createV3History(room:RoomV3):V3History { return {present:copy(room),past:[],future:[]}; }
export function recordV3Change(history:V3History,room:RoomV3):V3History {
  if(JSON.stringify(history.present)===JSON.stringify(room))return history;
  return {present:copy(room),past:[...history.past.slice(-49),copy(history.present)],future:[]};
}
export function undoV3(history:V3History):V3History {
  if(!history.past.length)return history;
  return {present:copy(history.past[history.past.length-1]),past:history.past.slice(0,-1),future:[copy(history.present),...history.future]};
}
export function redoV3(history:V3History):V3History {
  if(!history.future.length)return history;
  return {present:copy(history.future[0]),past:[...history.past.slice(-49),copy(history.present)],future:history.future.slice(1)};
}


export function addV3Presentation(room:RoomV3,deskId:string,buttonId:string):RoomV3 {
  const next=copy(room),desk=next.desks.find(d=>d.id===deskId),button=next.buttons?.find(b=>b.id===buttonId);
  if(!desk||!button)throw new Error("Desk 或按钮已不存在");
  if(button.scope!=="room"&&button.scope!==deskId)throw new Error("按钮作用域不属于这个 Desk");
  const issue=v3IconCreationIssue(room,deskId,false);if(issue)throw new Error(issue);
  const index=desk.icons.length;
  desk.icons.push({id:id("icon"),buttonId,label:button.name,glyph:"◇",x:index%8,y:Math.floor(index/8)});
  return next;
}
export function removeV3Presentation(room:RoomV3,deskId:string,iconId:string):RoomV3 {
  const next=copy(room),desk=next.desks.find(d=>d.id===deskId);if(!desk)throw new Error("Desk 已不存在");
  desk.icons=desk.icons.filter(icon=>icon.id!==iconId);
  return next;
}

export function setV3ComponentPlacement(room:RoomV3,componentId:string,placement:V3Component["placement"]):RoomV3 {
  if(![placement.x,placement.y,placement.width,placement.height].every(Number.isFinite)||
     placement.x<0||placement.y<0||placement.width<=0||placement.height<=0||
     placement.x+placement.width>1920||placement.y+placement.height>1080)
    throw new Error("组件位置和尺寸必须留在 1920 × 1080 设计画布内");
  const next=copy(room),component=next.components?.find(c=>c.id===componentId);
  if(!component)throw new Error("组件已不存在");
  component.placement={...placement};return next;
}
