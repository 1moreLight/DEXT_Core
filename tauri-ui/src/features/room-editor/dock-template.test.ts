import { describe, it, expect } from "vitest";
import { createRoomV3, readRoomV3, serializeRoomV3, moveV3Desk, removeV3Desk } from "./v3-document";
import { attachDockTemplate, setDockValue, resetDockValue, removeDockRegion, effectiveDockConfig, setDockAction, setDeskDockReference } from "./dock-template";
import type { DockTemplateDescriptor } from "./dock-template";
const template:DockTemplateDescriptor={formatVersion:1,id:"panels",name:"Panels",entry:"index.html",
  placement:{x:0,y:900,width:1920,height:180},
  parameters:[{id:"height",name:"Height",type:"number",default:180,min:100,max:280}],
  regions:[{id:"left",name:"CPU",kind:"data",defaultSource:{capability:"hardware.read",path:["cpuPercent"],format:"number"}},
    {id:"middle",name:"Time",kind:"data",defaultSource:{capability:"time.read",path:["unixMilliseconds"],format:"clock"}},
    {id:"right",name:"GPU",kind:"data",defaultSource:{capability:"hardware.read",path:["gpuPercent"],format:"number"}},
    {id:"previous",name:"Previous",kind:"button",defaultAction:{type:"desk.previous"}},
    {id:"next",name:"Next",kind:"button",defaultAction:{type:"desk.next"}}],examples:[]};
const imported={entry:"assets/first/index.html",resources:["assets/first/index.html","assets/first/style.css","assets/first/template.json"]};
const newRoom=()=>attachDockTemplate(createRoomV3("Dock"),template,imported);
const button=(room:ReturnType<typeof newRoom>,region:string,deskId?:string)=>String((effectiveDockConfig(room,deskId).buttonSlots as Record<string,string>)[region]);
describe("native Dock template authoring",()=>{
  it("replaces appearance without changing common component/button identities or imported inventory",()=>{
    const room=newRoom(),componentId=room.dockComponentId,previous=button(room,"previous");
    room.desks[0].name="Renamed";
    const reordered=moveV3Desk(room,room.desks[1].id,-1);
    const replacement=attachDockTemplate(reordered,{...template,id:"navigation",name:"Navigation",regions:template.regions.filter(r=>r.kind==="button")},
      {entry:"assets/second/index.html",resources:["assets/second/index.html"]});
    const reopened=readRoomV3(serializeRoomV3(replacement));
    expect(reopened.dockComponentId).toBe(componentId);
    expect(button(reopened,"previous")).toBe(previous);
    expect(reopened.resources).toEqual(expect.arrayContaining([...imported.resources,"assets/second/index.html"]));
    expect(reopened.desks.every(d=>d.components.includes(componentId!))).toBe(true);
    expect(room.components![0].entry).toBe(imported.entry);
  });
  it("stores only changed leaves, inherits later shared values, and reset resumes inheritance",()=>{
    let room=newRoom();const deskId=room.desks[1].id;
    room=setDockValue(room,["slots","left"],{capability:"time.read",path:["unixMilliseconds"],format:"countdown",deadline:"2030-01-01T00:00:00Z"},deskId);
    room=setDockValue(room,["slots","right","path"],["availableMemoryMB"]);
    expect((effectiveDockConfig(room,deskId).slots as any).left.format).toBe("countdown");
    expect((effectiveDockConfig(room,deskId).slots as any).right.path).toEqual(["availableMemoryMB"]);
    expect(room.desks[1].componentOverrides![room.dockComponentId!]).not.toHaveProperty("slots.right");
    room=resetDockValue(room,["slots","left"],deskId);
    expect(room.desks[1].componentOverrides).toBeUndefined();
    expect((effectiveDockConfig(room,deskId).slots as any).left.capability).toBe("hardware.read");
    room=setDockValue(room,["appearance","height"],180,deskId);
    expect(room.desks[1].componentOverrides).toBeUndefined();
  });
  it("matches SDK object inheritance, explicit null, and whole array replacement",()=>{
    let room=newRoom();const deskId=room.desks[1].id;
    room=setDockValue(room,["slots","left"],{capability:"hardware.read",path:["cpuPercent"],format:"number",extra:{prefix:"CPU",color:"blue"},levels:[1,2,3]});
    room=setDockValue(room,["slots","left","extra","prefix"],null,deskId);
    room=setDockValue(room,["slots","left","levels"],[9],deskId);
    expect((effectiveDockConfig(room,deskId).slots as any).left).toMatchObject({extra:{prefix:null,color:"blue"},levels:[9]});
    expect(room.desks[1].componentOverrides![room.dockComponentId!]).toEqual({slots:{left:{extra:{prefix:null},levels:[9]}}});
  });
  it("removes region differences and unused buttons but keeps a button referenced by an icon; re-add gets a fresh ID",()=>{
    let room=newRoom();const original=button(room,"previous"),next=button(room,"next"),desk=room.desks[1];
    room=setDockValue(room,["slots","left","format"],"text",desk.id);
    room.desks[1].icons.push({id:"also-previous",buttonId:original,x:0,y:0});
    room=removeDockRegion(room,"left");
    expect(room.desks[1].componentOverrides).toBeUndefined();
    room=removeDockRegion(room,"previous");room=removeDockRegion(room,"next");
    expect(room.buttons!.some(b=>b.id===original)).toBe(true);
    expect(room.buttons!.some(b=>b.id===next)).toBe(false);
    expect(room.components![0].buttonIds).not.toContain(original);
    room=attachDockTemplate(room,template,imported);
    expect(button(room,"previous")).not.toBe(original);
    expect(button(room,"next")).not.toBe(next);
  });
  it("Desk default actions have stable separate identities, reset removes only the scoped default",()=>{
    let room=newRoom();const deskId=room.desks[1].id,shared=button(room,"next");
    room=setDockAction(room,"next",{type:"desk.go",deskId:room.startDesk},deskId);
    const scoped=button(room,"next",deskId);
    expect(scoped).not.toBe(shared);
    expect(room.buttons!.find(b=>b.id===scoped)!.scope).toBe(deskId);
    room=setDockAction(room,"next",{type:"binding.launch"},deskId);
    expect(button(room,"next",deskId)).toBe(scoped);
    const inherited=setDockAction(room,"next",{type:"desk.next"},deskId);
    expect(button(inherited,"next",deskId)).toBe(shared);
    expect(inherited.buttons!.some(b=>b.id===scoped)).toBe(false);
    room=resetDockValue(room,["buttonSlots","next"],deskId);
    expect(button(room,"next",deskId)).toBe(shared);
    expect(room.buttons!.some(b=>b.id===scoped)).toBe(false);
    expect(()=>setDockAction(room,"next",{type:"desk.go",deskId:"missing"})).toThrow("Desk");
  });
  it("removing a Desk reference clears differences and local defaults, restores shared config on re-enable",()=>{
    let room=newRoom();const deskId=room.desks[1].id;
    room=setDockAction(room,"next",{type:"binding.launch"},deskId);
    const local=button(room,"next",deskId);
    room=setDockValue(room,["appearance","height"],220,deskId);
    room=setDeskDockReference(room,deskId,false);
    expect(room.desks[1].components).not.toContain(room.dockComponentId);
    expect(room.desks[1].componentOverrides).toBeUndefined();
    expect(room.buttons!.some(b=>b.id===local)).toBe(false);
    expect(()=>setDockValue(room,["appearance","height"],190,deskId)).toThrow("引用");
    room=setDeskDockReference(room,deskId,true);
    expect(effectiveDockConfig(room,deskId).appearance).toEqual({height:180});
  });
  it("deleting the Desk leaves no scoped template binding and no invalid goto destination",()=>{
    let room=newRoom();const deskId=room.desks[1].id;
    room=setDockAction(room,"next",{type:"desk.go",deskId},deskId);
    const local=button(room,"next",deskId);
    room=setDockAction(room,"previous",{type:"desk.go",deskId});
    room=removeV3Desk(room,deskId);
    expect(room.buttons!.some(b=>b.id===local)).toBe(false);
    expect(room.components![0].buttonIds).not.toContain(local);
    expect(room.buttons!.find(b=>b.id===button(room,"previous"))!.action).toBeUndefined();
    expect(button(room,"next",room.startDesk)).toBe(button(room,"next"));
  });
});
