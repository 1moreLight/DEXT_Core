import type {RoomV3,V3Button} from "./v3-document";
export type ButtonSettings={action:string|null;deskId:string|null;targetId:string|null;skin:string|null};
export type PersonalButton={id:string;name:string;scope:string;defaultAction:string|null;defaultDeskId:string|null;effectiveAction:string|null;effectiveDeskId:string|null;isBound:boolean;personal:ButtonSettings|null};
export type PersonalTarget={id:string;name:string;kind:"application"|"file"|"url";target:string;arguments:string;workingDirectory:string;useCount:number};
export type PersonalSnapshot={revision:number;buttons:PersonalButton[];targets:PersonalTarget[];skins:{id:string;name:string}[]};
export type PersonalReply={status:string;roomId:string;installationStamp:string;editor:PersonalSnapshot|null};
export function discoverV3Buttons(room:RoomV3):(V3Button&{sources:string[]})[] {
  return (room.buttons??[]).map(button=>{
    const sources:string[]=[];
    if(room.roomScene)sources.push("Room 场景");
    for(const [label,content] of [["启动",room.start],["待机",room.idle]] as const)
      if(content?.buttonIds?.includes(button.id))sources.push(label);
    for(const desk of room.desks) {
      if(desk.background?.buttonIds?.includes(button.id))sources.push("背景 · "+desk.name);
      for(const icon of desk.icons)if(icon.buttonId===button.id)sources.push("图标 · "+desk.name+" · "+(icon.label??icon.id));
    }
    for(const component of room.components??[])if(component.buttonIds?.includes(button.id))
      sources.push((component.role==="dock"?"Dock":"Widget")+" · "+component.id);
    return {...button,sources};
  });
}
export const sameSource=(a:string,b:string)=>a.replace(/^\\\\\?\\/,"").replace(/\//g,"\\").replace(/\\+$/,"").toLowerCase()===b.replace(/^\\\\\?\\/,"").replace(/\//g,"\\").replace(/\\+$/,"").toLowerCase();
