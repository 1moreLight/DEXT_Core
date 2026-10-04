import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {setV3ComponentPlacement,type RoomV3} from "./v3-document";
const fields=[["x","横坐标"],["y","纵坐标"],["width","宽度"],["height","高度"]] as const;
export function ComponentLayoutEditor(props:{room:RoomV3;onChange:(room:RoomV3)=>void;onMessage:(message:string)=>void}){
 const [id,setId]=useState(props.room.dockComponentId??props.room.components?.[0]?.id??"");
 const component=props.room.components?.find(c=>c.id===id);
 const [values,setValues]=useState({x:"0",y:"0",width:"480",height:"240"});
 useEffect(()=>{if(component)setValues(Object.fromEntries(fields.map(([key])=>[key,String(component.placement[key])])) as typeof values);},[component]);
 if(!props.room.components?.length)return null;
 const apply=()=>{
  try{
   if(fields.some(([key])=>!values[key].trim()))throw new Error("请填写完整位置和尺寸");
   const placement={x:Number(values.x),y:Number(values.y),width:Number(values.width),height:Number(values.height)};
   props.onChange(setV3ComponentPlacement(props.room,id,placement));props.onMessage("共享组件布局已应用到草稿；返回编辑器可撤销或保存。");
  }catch(error){props.onMessage(String(error));}
 };
 return <details className="rounded-lg border p-3"><summary className="text-sm">调整组件默认布局</summary>
  <select aria-label="试验台布局组件" className="mt-2 w-full rounded border bg-background p-2 text-sm" value={id} onChange={e=>setId(e.target.value)}>
   {props.room.components.map(c=><option key={c.id} value={c.id}>{c.role==="dock"?"Dock":"Widget"} · {c.id}</option>)}
  </select>
  <div className="mt-2 grid grid-cols-2 gap-2">{fields.map(([key,label])=><label key={key} className="text-xs">{label}<Input aria-label={"组件"+label} type="number" value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}</div>
  <Button className="mt-2" size="sm" variant="outline" disabled={!component} onClick={apply}>应用到草稿</Button>
  <p className="mt-2 text-xs text-muted-foreground">使用 1920 × 1080 设计坐标，影响所有引用该组件的 Desk。个人已保存位置仍优先。</p>
 </details>;
}
const examples:Record<string,unknown>={
 "time.read":{unixMilliseconds:Date.now()},
 "hardware.read":{cpuPercent:32,gpuPercent:19,ramPercent:48},
 "media.read":{title:"试验台示例歌曲",artist:"Dext",isPlaying:true},
 "audio.read":{volume:.5,muted:false}
};
const names=[["time.read","时间"],["hardware.read","硬件"],["media.read","媒体"],["audio.read","音量"]] as const;
export function SampleJsonEditor(props:{samples:Record<string,unknown>;onChange:(samples:Record<string,unknown>)=>void;onMessage:(message:string)=>void}){
 const [cap,setCap]=useState<string>("hardware.read"),[text,setText]=useState(JSON.stringify(examples["hardware.read"],null,2));
 const select=(value:string)=>{setCap(value);setText(JSON.stringify(Object.prototype.hasOwnProperty.call(props.samples,value)?props.samples[value]:examples[value],null,2));};
 const apply=()=>{
  try{const value:unknown=JSON.parse(text);props.onChange({...props.samples,[cap]:value});props.onMessage("自定义示例已发送到预览，不保存到 Room。");}
  catch{props.onMessage("示例 JSON 格式有误，已保留原示例。");}
 };
 const reset=()=>{const next={...props.samples};delete next[cap];props.onChange(next);setText(JSON.stringify(examples[cap],null,2));props.onMessage("已恢复该数据源的内置示例。");};
 return <details className="rounded-lg border p-3"><summary className="text-sm">自定义示例 JSON</summary>
  <select aria-label="自定义示例数据源" className="mt-2 w-full rounded border bg-background p-2 text-sm" value={cap} onChange={e=>select(e.target.value)}>{names.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
  <textarea aria-label="自定义示例 JSON" maxLength={65536} className="mt-2 min-h-40 w-full rounded border bg-background p-2 font-mono text-xs" value={text} onChange={e=>setText(e.target.value)}/>
  <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={apply}>使用示例</Button><Button size="sm" variant="outline" onClick={reset}>恢复内置示例</Button></div>
  <p className="mt-2 text-xs text-muted-foreground">支持任意合法 JSON，由作者内容解释；缺失或拒绝状态仍由上方开关决定。</p>
 </details>;
}
export function ResourceSourceViewer(props:{baseUrl:string|undefined;path:string;paths:string[];onSelect:(path:string)=>void}){
 const [text,setText]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{
  const abort=new AbortController();setText("");
  if(!props.path||!props.baseUrl){setNotice("选择源码资源后查看。");return;}
  setNotice("正在读取源码…");
  const read=async()=>{
   try{
    const url=props.baseUrl+props.path.split("/").map(encodeURIComponent).join("/");
    let response=await fetch(url,{headers:{Range:"bytes=0-262143"},signal:abort.signal});
    if(response.status===416)response=await fetch(url,{signal:abort.signal});
    if(!response.ok)throw new Error("资源读取失败（"+response.status+"）");
    const range=response.headers.get("Content-Range"),total=range?Number(range.split("/").pop()):0;
    const value=await response.text();if(abort.signal.aborted)return;
    setText(value);setNotice(total>262144?"仅显示前 256 KiB；内容未修改。":"源码只读，内容未修改。");
   }catch(error){if(!abort.signal.aborted)setNotice(String(error));}
  };
  void read();return()=>abort.abort();
 },[props.baseUrl,props.path]);
 const textual=props.paths.filter(path=>/\.(html?|css|js|json)$/i.test(path));
 return <div className="mt-3 space-y-2">
  <select aria-label="查看资源源码" className="w-full rounded border bg-background p-2 text-xs" value={props.path} disabled={!props.baseUrl} onChange={e=>props.onSelect(e.target.value)}>
   <option value="">选择 HTML / CSS / JS / JSON</option>{textual.map(path=><option key={path} value={path}>{path}</option>)}
  </select>
  <p className="text-xs text-muted-foreground">{notice}</p>
  {text&&<pre aria-label="资源源码" className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border bg-muted/30 p-3 text-[11px]">{text}</pre>}
 </div>;
}
