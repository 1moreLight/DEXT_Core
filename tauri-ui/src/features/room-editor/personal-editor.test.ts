import {it,expect} from "vitest";
import {createRoomV3,addV3Presentation,removeV3Presentation,createV3History,recordV3Change,undoV3,redoV3} from "./v3-document";
import {discoverV3Buttons} from "./personal-editor";
it("a normal presentation reuses an authored button and undo/redo retains its own identity",()=>{
 const room=createRoomV3("Refs");room.buttons=[{id:"open",name:"Open",scope:"room"}];
 for(const desk of room.desks)desk.icons=[];
 const next=addV3Presentation(room,room.startDesk,"open"),second=addV3Presentation(next,room.startDesk,"open");
 expect(second.buttons).toEqual(room.buttons);expect(second.desks[0].icons.map(i=>i.buttonId)).toEqual(["open","open"]);
 expect(second.desks[0].icons[0].id).not.toBe(second.desks[0].icons[1].id);
 const history=recordV3Change(createV3History(room),second);expect(redoV3(undoV3(history)).present).toEqual(second);
 const removed=removeV3Presentation(second,room.startDesk,second.desks[0].icons[0].id);
 expect(removed.buttons).toEqual(room.buttons);expect(removed.desks[0].icons).toEqual([second.desks[0].icons[1]]);
});
it("presentation scope must match and discovery finds unbound scene background Dock and inactive Desk",()=>{
 const room=createRoomV3("All");room.buttons=[{id:"global",name:"G",scope:"room"},{id:"local",name:"L",scope:room.desks[1].id}];
 room.roomScene={entry:"scene/index.html",capabilities:[]};room.desks[1].background={type:"html",src:"bg/index.html",buttonIds:["local"]};
 room.components=[{id:"dock",role:"dock",entry:"dock/index.html",placement:{x:0,y:960,width:1920,height:120},capabilities:[],buttonIds:["global"]}];
 expect(()=>addV3Presentation(room,room.startDesk,"local")).toThrow("作用域");
 const found=discoverV3Buttons(room);expect(found.map(b=>b.id).sort()).toEqual(["global","local"]);
 expect(found.find(b=>b.id==="global")!.sources).toContain("Dock · dock");expect(found.find(b=>b.id==="local")!.sources).toContain("背景 · Desk 2");
 expect(found.every(b=>b.sources.includes("Room 场景"))).toBe(true);
});
it("deleting a sole ordinary presentation preserves a discoverable declared button",()=>{
 const room=createRoomV3("Keep");room.buttons=[{id:"open",name:"Open",scope:"room"}];
 for(const desk of room.desks)desk.icons=[];
 const next=addV3Presentation(room,room.startDesk,"open");expect(removeV3Presentation(next,room.startDesk,next.desks[0].icons[0].id).buttons).toEqual(room.buttons);
});
