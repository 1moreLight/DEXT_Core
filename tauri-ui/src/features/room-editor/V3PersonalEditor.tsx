import {useEffect,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {AppPickerDialog,type AppPickerItem} from "@/components/AppPickerDialog";
import {addV3Presentation,type RoomV3} from "./v3-document";
import {discoverV3Buttons,sameSource,type ButtonSettings,type PersonalButton,type PersonalReply,type PersonalSnapshot,type PersonalTarget} from "./personal-editor";

type Props={room:RoomV3;path:string;deskId:string;apps:AppPickerItem[];isTauri:boolean;canApply:boolean;disabled:boolean;dirty:boolean;onChange:(room:RoomV3)=>void};
type Board={stamp:string;currentDesk:string;editor:PersonalSnapshot};
type Session={active:boolean;room_id:string;installation_stamp:string;current_desk_id:string;player_pid:number};
const empty:ButtonSettings={action:null,deskId:null,targetId:null,skin:null};
const actions=[["","继承作品默认"],["binding.launch","启动本机目标"],["desk.next","下一页"],["desk.previous","上一页"],["desk.go","前往 Desk"],["dext.exit","退出 Dext"]] as const;
const targetDraft=():PersonalTarget=>({id:crypto.randomUUID(),name:"",kind:"application",target:"",arguments:"",workingDirectory:"",useCount:0});
const appliedHint="先保存并应用这个 Room，再设置本机动作、目标和皮肤。";
const valid=(r:PersonalReply,roomId:string,stamp:string)=>r.status==="accepted"&&r.roomId===roomId&&r.installationStamp===stamp&&r.editor!==null;
const choice=(b:PersonalButton|undefined):ButtonSettings=>b?.personal?{...b.personal}:{...empty};
export function V3PersonalEditor(props:Props){
 const authored=discoverV3Buttons(props.room);
 const [query,setQuery]=useState(""),[scope,setScope]=useState("all"),[selected,setSelected]=useState(authored[0]?.id??"");
 const [board,setBoard]=useState<Board|null>(null),[settings,setSettings]=useState<ButtonSettings>({...empty});
 const [notice,setNotice]=useState(""),[pending,setPending]=useState(false),[form,setForm]=useState<PersonalTarget|null>(null),[picker,setPicker]=useState(false),[appQuery,setAppQuery]=useState("");
 const epoch=useRef(0),busy=useRef(false);
 useEffect(()=>{
  let disposed=false;epoch.current++;busy.current=false;setBoard(null);setPending(false);setForm(null);
  if(!props.isTauri||!props.canApply){setNotice(props.isTauri?"先启动 Core，再应用这个 Room。":"浏览器预览只编辑作品；本机设置请在配置器中使用。");return;}
  const refresh=async()=>{
   if(disposed||busy.current)return;const token=++epoch.current;
   const current=()=>!disposed&&epoch.current===token;
   try{
    const session=await invoke<Session>("v3_session_status");
    if(!current())return;
    if(!session.active||session.player_pid<=0||session.room_id!==props.room.id||!session.installation_stamp){setBoard(null);setNotice(appliedHint);return;}
    const source=await invoke<{sourcePath:string}|null>("active_room");
    if(!current())return;
    if(!source||!sameSource(source.sourcePath,props.path)){setBoard(null);setNotice("桌面运行的是另一份 Room，请应用当前作品。");return;}
    const reply=await invoke<PersonalReply>("get_v3_personal_editor",{roomId:props.room.id,installationStamp:session.installation_stamp});
    if(!current())return;
    if(!valid(reply,props.room.id,session.installation_stamp)){setBoard(null);setNotice(appliedHint);return;}
    setBoard(previous=>previous?.stamp===session.installation_stamp&&previous.currentDesk===session.current_desk_id&&JSON.stringify(previous.editor)===JSON.stringify(reply.editor)?previous:{stamp:session.installation_stamp,currentDesk:session.current_desk_id,editor:reply.editor!});
   }catch{if(current()){setBoard(null);setNotice("暂时无法读取本机设置，请确认 Core 正在运行。");}}
  };
  setNotice("正在读取本机设置…");void refresh();const timer=window.setInterval(()=>void refresh(),3000);
  return()=>{disposed=true;epoch.current++;window.clearInterval(timer);};
 },[props.room.id,props.path,props.isTauri,props.canApply]);
 useEffect(()=>{if(!authored.some(b=>b.id===selected))setSelected(authored[0]?.id??"");},[props.room,selected]);
 useEffect(()=>{setSettings(choice(board?.editor.buttons.find(b=>b.id===selected)));},[selected,board?.stamp]);
 const button=authored.find(b=>b.id===selected),confirmed=board?.editor.buttons.find(b=>b.id===selected);
 const canEdit=Boolean(board&&confirmed&&confirmed.scope===button?.scope&&confirmed.name===button?.name&&confirmed.defaultAction===(button?.action?.type??null)&&confirmed.defaultDeskId===(button?.action?.deskId??null)&&!props.dirty);
 const locked=props.disabled||pending;
 const save=async(edit:object)=>{
  if(!board||busy.current||locked||props.dirty)return false;
  const before=board,token=++epoch.current;busy.current=true;setPending(true);
  try{
   const reply=await invoke<PersonalReply>("edit_v3_personal",{roomId:props.room.id,installationStamp:before.stamp,edit});
   if(epoch.current!==token)return false;
   if(valid(reply,props.room.id,before.stamp)){
    setBoard({...before,editor:reply.editor!});setSettings(choice(reply.editor!.buttons.find(b=>b.id===selected)));
    setNotice("operation" in edit&&edit.operation==="locateButton"?"已请求定位当前可见区域。":"本机设置已保存。");return true;
   }
   if(reply.status==="staleSession"){setBoard(null);setNotice("运行副本已变化，请重新读取或应用当前作品。");}
   else{setSettings(choice(before.editor.buttons.find(b=>b.id===selected)));setNotice(reply.status==="notOperable"?"当前 Desk 或桌面阶段无法定位这个按钮。":reply.status==="missingBinding"?"目标已不存在，请重新选择。":"保存失败，已保留原本机设置。");}
  }catch{if(epoch.current===token){setSettings(choice(before.editor.buttons.find(b=>b.id===selected)));setNotice("保存失败，已保留原本机设置。");}}
  finally{if(epoch.current===token){busy.current=false;setPending(false);}}
  return false;
 };
 const shown=authored.filter(b=>(scope==="all"||b.scope===scope)&&[b.name,b.id,...b.sources].some(v=>v.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
 const target=board?.editor.targets.find(t=>t.id===settings.targetId);
 return <section aria-label="按钮与本机设置" className="space-y-3 rounded-lg border p-3">
  <div><h2 className="font-medium">按钮与本机设置</h2><p className="text-xs text-muted-foreground">查看作品入口，设置本机动作和图标外观。目标路径只保存在本机。</p></div>
  <div className="flex gap-2"><Input aria-label="搜索按钮" placeholder="名称、ID 或来源" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="按钮作用域" className="rounded border bg-background p-2 text-sm" value={scope} onChange={e=>setScope(e.target.value)}>
    <option value="all">全部</option><option value="room">Room</option>{props.room.desks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
   </select></div>
  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
   <div className="max-h-72 space-y-1 overflow-auto" aria-label="已声明按钮列表">{shown.map(b=><button key={b.id} type="button" aria-label={"选择按钮 "+b.name} aria-pressed={b.id===selected} disabled={pending} className={"block w-full rounded border p-2 text-left text-sm "+(b.id===selected?"border-cyan-500 bg-cyan-500/10":"")} onClick={()=>setSelected(b.id)}>
    <span className="block">{b.name}</span><span className="block break-all text-[10px] text-muted-foreground">{b.id}</span>
    <span className="text-xs text-muted-foreground">{board?.editor.buttons.find(x=>x.id===b.id)?.isBound?"已绑定":b.action?.type==="binding.launch"||!b.action?"未绑定":"默认动作"}</span>
   </button>)}{!shown.length&&<p className="text-xs text-muted-foreground">没有匹配的按钮。</p>}</div>
   {button&&<div className="space-y-3">
    <div><h3 className="text-sm font-medium">{button.name}</h3><p className="break-all text-xs text-muted-foreground">{button.sources.join(" / ")||"已声明，尚无呈现"}</p>
     <p className="text-xs text-muted-foreground">默认：{actions.find(([id])=>id===button.action?.type)?.[1]??"待配置"} · {button.scope==="room"?"Room":props.room.desks.find(d=>d.id===button.scope)?.name}</p></div>
    <fieldset disabled={locked||!canEdit} className="space-y-2">
     <label className="block text-sm">本机动作<select aria-label="本机动作" className="mt-1 w-full rounded border bg-background p-2" value={settings.action??""} onChange={e=>setSettings(s=>({...s,action:e.target.value||null,deskId:e.target.value==="desk.go"?(s.deskId??props.deskId):null}))}>{actions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     {settings.action==="desk.go"&&<label className="block text-sm">目标 Desk<select aria-label="目标 Desk" className="mt-1 w-full rounded border bg-background p-2" value={settings.deskId??""} onChange={e=>setSettings(s=>({...s,deskId:e.target.value}))}>{props.room.desks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
     <label className="block text-sm">本机目标<select aria-label="本机目标" className="mt-1 w-full rounded border bg-background p-2" value={settings.targetId??""} onChange={e=>setSettings(s=>({...s,targetId:e.target.value||null}))}>
      <option value="">未选择</option>{board?.editor.targets.map(t=><option key={t.id} value={t.id}>{t.name} · {t.kind}</option>)}
      {settings.targetId&&!target&&<option value={settings.targetId}>目标已失效</option>}
     </select></label>
     <label className="block text-sm">普通图标皮肤<select aria-label="普通图标皮肤" className="mt-1 w-full rounded border bg-background p-2" value={settings.skin??""} onChange={e=>setSettings(s=>({...s,skin:e.target.value||null}))}><option value="">默认</option>{board?.editor.skins.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}{settings.skin&&!board?.editor.skins.some(s=>s.id===settings.skin)&&<option value={settings.skin}>原皮肤 · {settings.skin}</option>}</select></label>
     <div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>void save({operation:"setButton",buttonId:button.id,...settings})}>保存本机设置</Button><Button variant="outline" size="sm" onClick={()=>void save({operation:"resetButton",buttonId:button.id})}>恢复作品默认</Button>
      <Button variant="outline" size="sm" onClick={()=>void save({operation:"locateButton",buttonId:button.id})}>定位桌面按钮</Button>
     </div>
    </fieldset>
    {canEdit&&button.scope!=="room"&&board?.currentDesk!==button.scope&&<p className="text-xs text-muted-foreground">按钮位于其他 Desk；切换到该 Desk 后可定位。</p>}
    <Button variant="outline" size="sm" disabled={locked||(button.scope!=="room"&&button.scope!==props.deskId)} onClick={()=>props.onChange(addV3Presentation(props.room,props.deskId,button.id))}>在当前 Desk 添加普通图标</Button>
    <p className="text-xs text-muted-foreground">普通图标与原入口使用同一按钮。添加呈现后请保存并应用；皮肤仅改变普通图标。</p>
   </div>}
  </div>
  <details className="rounded border p-2"><summary className="cursor-pointer text-sm">本机目标库 · {board?.editor.targets.length??0}</summary>
   <fieldset disabled={locked||!board||props.dirty} className="mt-2 space-y-2">
    <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>setForm(targetDraft())}>添加本机目标</Button><Button variant="outline" size="sm" onClick={()=>setPicker(true)}>从应用库选择</Button></div>
    {board?.editor.targets.map(t=><div key={t.id} className="flex items-center gap-2 rounded border p-2 text-sm"><span className="min-w-0 flex-1"><span className="block">{t.name} · {t.useCount} 个按钮引用</span><span className="block break-all text-xs text-muted-foreground">{t.target}</span></span>
     <Button variant="ghost" size="sm" onClick={()=>setForm({...t})}>编辑目标</Button><Button variant="ghost" size="sm" onClick={()=>{if(confirm("删除本机目标“"+t.name+"”？"+t.useCount+" 个按钮引用会解除；应用和文件保留。"))void save({operation:"removeTarget",targetId:t.id});}}>删除目标</Button></div>)}
    {form&&<div className="space-y-2 rounded border p-3" aria-label="本机目标表单">
     <Input aria-label="目标名称" placeholder="名称" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
     <select aria-label="目标类型" className="w-full rounded border bg-background p-2 text-sm" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as PersonalTarget["kind"],arguments:"",workingDirectory:""})}><option value="application">应用</option><option value="file">文件</option><option value="url">网页</option></select>
     <Input aria-label="目标路径或网址" placeholder={form.kind==="url"?"https://…":"完整本机路径"} value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/>
     {form.kind==="application"&&<><Input aria-label="启动参数" placeholder="启动参数（可选）" value={form.arguments} onChange={e=>setForm({...form,arguments:e.target.value})}/><Input aria-label="工作目录" placeholder="工作目录（可选）" value={form.workingDirectory} onChange={e=>setForm({...form,workingDirectory:e.target.value})}/></>}
     <div className="flex gap-2"><Button size="sm" onClick={()=>void save({operation:"upsertTarget",targetId:form.id,name:form.name,kind:form.kind,target:form.target,arguments:form.arguments,workingDirectory:form.workingDirectory}).then(ok=>{if(ok)setForm(null);})}>保存目标</Button><Button variant="ghost" size="sm" onClick={()=>setForm(null)}>取消</Button></div>
    </div>}
   </fieldset>
  </details>
  {picker&&<AppPickerDialog searchQuery={appQuery} onSearch={setAppQuery} title="选择应用库目标" description="选择后填写本机目标，保存后可用于多个按钮。" apps={props.apps.filter(a=>a.name.toLocaleLowerCase().includes(appQuery.toLocaleLowerCase()))} isSelected={()=>false} onToggle={a=>{setForm({...targetDraft(),name:a.name,target:a.target,arguments:a.arguments,workingDirectory:a.working_dir});setPicker(false);}} onClose={()=>setPicker(false)}/>}
  <p role="status" className="text-xs text-muted-foreground">{pending?"正在保存本机设置…":props.dirty?"作品有未保存或未应用修改，请先保存并应用后编辑本机设置。":!canEdit&&board?appliedHint:notice==="正在读取本机设置…"&&board?"正在编辑当前已应用副本的本机设置。":notice}</p>
 </section>;
}
