import { describe, it, expect } from "vitest";
import { createRoomV3, readRoomV3, serializeRoomV3, moveV3Desk, removeV3Desk, addV3Icon,
  createV3History, recordV3Change, undoV3, redoV3 } from "./v3-document";

describe("native v3 authoring", () => {
  it("creates two stable desks and keeps author fields through rename/order/save/reopen", () => {
    const room = createRoomV3("Local room");
    expect(room).toMatchObject({version:3, apiVersion:1, name:"Local room"});
    expect(room.desks).toHaveLength(2);
    const ids = room.desks.map((d: any) => d.id);
    room.roomScene = {entry:"scene/index.html", capabilities:["desk.read"], config:{tint:"blue"}};
    room.resources = ["scene/index.html","dock/index.html"];
    room.components = [{id:"dock",role:"dock",entry:"dock/index.html",placement:{x:0,y:800,width:1920,height:280},capabilities:[],config:{left:{kind:"time"}}}];
    room.dockComponentId = "dock";
    room.desks[1].components = ["dock"];
    room.desks[1].componentOverrides = {dock:{left:{kind:"timer"}}};
    const moved = moveV3Desk(room, ids[1], -1);
    moved.desks[0].name = "Renamed";
    const reopened = readRoomV3(serializeRoomV3(moved));
    expect(reopened.desks.map((d:any)=>d.id)).toEqual([ids[1],ids[0]]);
    expect(reopened.startDesk).toBe(ids[0]);
    expect(reopened.roomScene).toEqual(room.roomScene);
    expect(reopened.desks[0].componentOverrides).toEqual(room.desks[1].componentOverrides);
    expect(reopened.dockComponentId).toBe("dock");
  });
  it("undo/redo preserves imported inventory and original icon/button identities", () => {
    const room = createRoomV3("History");
    expect(room.desks[0].icons.map((icon) => icon.label)).toEqual(["上一页", "下一页"]);
    const next = addV3Icon(room, room.startDesk, "Next", "desk.next");
    const history = recordV3Change(createV3History(room), next);
    const undone = undoV3(history);
    expect(undone.present.desks[0].icons).toEqual(room.desks[0].icons);
    expect(redoV3(undone).present).toEqual(next);
    expect(JSON.parse(serializeRoomV3(undone.present, ["assets/selected.gif"])).resources).toContain("assets/selected.gif");
    const lastIcon = next.desks[0].icons[next.desks[0].icons.length - 1];
    const lastButton = next.buttons![next.buttons!.length - 1];
    expect(lastIcon?.buttonId).toBe(lastButton?.id);
    expect(lastButton?.scope).toBe(room.startDesk);
  });
  it("deleting the start Desk updates start and removes scoped buttons without redirecting goto", () => {
    const room = createRoomV3("Delete");
    room.buttons = [{id:"goto",name:"Go",scope:"room",action:{type:"desk.go",deskId:room.startDesk}},
      {id:"local",name:"Local",scope:room.startDesk,action:{type:"binding.launch"}}];
    room.components=[{id:"shared",role:"widget",entry:"widget/index.html",placement:{x:0,y:0,width:100,height:100},capabilities:[],buttonIds:["local","goto"]}];
    room.desks[1].components=["shared"];
    const next = removeV3Desk(room, room.startDesk);
    expect(next.startDesk).toBe(room.desks[1].id);
    expect(next.components![0].buttonIds).toEqual(["goto"]);
    expect(next.buttons).toEqual([{id:"goto",name:"Go",scope:"room"}]);
    expect(()=>removeV3Desk(next,next.startDesk)).toThrow("至少保留");
  });
});
