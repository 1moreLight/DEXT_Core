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

export type PersonalEditCommand =
  | ({operation:"setButton";buttonId:string}&ButtonSettings)
  | {operation:"resetButton"|"locateButton";buttonId:string}
  | {operation:"upsertTarget";targetId:string;name:string;kind:PersonalTarget["kind"];target:string;arguments:string;workingDirectory:string}
  | {operation:"removeTarget";targetId:string};
export function settingsAfterPersonalEdit(draft:ButtonSettings,selectedId:string,edit:PersonalEditCommand,confirmed:PersonalSnapshot,accepted:boolean):ButtonSettings {
  if((edit.operation==="setButton"||edit.operation==="resetButton"&&accepted)&&edit.buttonId===selectedId){
    const button=confirmed.buttons.find(b=>b.id===selectedId);
    return button?.personal?{...button.personal}:{action:null,deskId:null,targetId:null,skin:null};
  }
  if(accepted&&edit.operation==="removeTarget"&&draft.targetId===edit.targetId)return {...draft,targetId:null};
  return {...draft};
}

export function buttonBindingLabel(authored:V3Button,confirmed?:PersonalButton):string {
  const action=confirmed?confirmed.effectiveAction:authored.action?.type;
  if(!action)return "未绑定";
  if(action==="binding.launch")return confirmed?.isBound?"已绑定":"未绑定";
  return confirmed?.personal?.action?"本机动作":"默认动作";
}

export function targetFormAfterPersonalEdit(form:PersonalTarget|null,edit:PersonalEditCommand,accepted:boolean):PersonalTarget|null {
  return accepted&&form&&(edit.operation==="upsertTarget"||edit.operation==="removeTarget")&&edit.targetId===form.id?null:form;
}
