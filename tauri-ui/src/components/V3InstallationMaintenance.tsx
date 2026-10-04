import {useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {Button} from "@/components/ui/button";
type Candidate={name:string;kind:string;roomId:string|null;manifestSha256:string|null;resourceBytes:number;metadataReady:boolean;recorded:boolean;problem:string|null};
type Report={currentPresent:boolean;currentProblem:string|null;candidates:Candidate[];truncated:boolean;nextOffset:number|null};
export function V3InstallationMaintenance({isTauri,coreRunning,setStatus}:{isTauri:boolean;coreRunning:boolean;setStatus:(message:string)=>void}){
  const [report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false);
  async function refresh(offset=0){
    setBusy(true);
    try{
      const next=await invoke<Report>("v3_installation_recovery",{offset});
      setReport(current=>offset&&current?{...next,candidates:[...current.candidates,...next.candidates.filter(item=>!current.candidates.some(old=>old.name===item.name))]}:next);
    }
    catch(error){setStatus("旧安装读取失败："+String(error));}
    finally{setBusy(false);}
  }
  async function maintain(candidate:Candidate,operation:"restore"|"cleanup"){
    if(coreRunning||!candidate.manifestSha256)return;
    setBusy(true);
    try{
      const reply=await invoke<{message:string}>("maintain_v3_installation",{name:candidate.name,manifestSha256:candidate.manifestSha256,operation});
      setStatus(reply.message);
      setReport(await invoke<Report>("v3_installation_recovery",{offset:0}));
    }catch(error){setStatus("维护未完成："+String(error)+"；保留记录可重新读取后重试");}
    finally{setBusy(false);}
  }
  return <section className="space-y-3 border-y border-border py-4">
    <div className="flex items-center justify-between"><h3 className="text-sm font-medium">旧安装恢复与空间清理</h3><Button variant="outline" size="sm" disabled={!isTauri||busy} onClick={()=>void refresh()}>{busy?"处理中…":"读取旧安装"}</Button></div>
    <p className="text-xs text-muted-foreground">退出 Core 后可维护。恢复会保留当前安装；清理释放所选旧安装空间，源 Room 和个人绑定保持。</p>
    {report&&<p className="text-xs text-muted-foreground">{report.currentPresent?"当前安装目录存在":"当前安装缺失，可选择完整旧代恢复"}{report.truncated?"；还有下一页":""}</p>}
    {report?.currentProblem&&<p className="text-xs text-amber-600 dark:text-amber-300">当前安装清单有问题：{report.currentProblem}</p>}
    {report?.candidates.map(candidate=><div key={candidate.name} className="space-y-2 rounded-md border border-border p-3">
      <div className="break-all text-xs font-medium">{candidate.roomId??"未确认作品"} · {(candidate.resourceBytes/1048576).toFixed(1)} MiB</div>
      <p className="break-all text-[10px] text-muted-foreground">{candidate.name}</p>
      <p className="text-xs text-muted-foreground">{candidate.kind==="orphanRecord"?"已发布安装的遗留记录，可清理":candidate.metadataReady?"清单可读，执行前会复核完整资源":candidate.recorded?"有目录身份记录，执行前复核剩余资源":"无法确认所有权，保留目录"}{candidate.problem&&candidate.kind!=="orphanRecord"?"；"+candidate.problem:""}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy||coreRunning||!candidate.metadataReady||!candidate.manifestSha256} onClick={()=>void maintain(candidate,"restore")}>恢复此安装</Button>
        <Button variant="outline" size="sm" disabled={busy||coreRunning||(!candidate.metadataReady&&!candidate.recorded)||!candidate.manifestSha256} onClick={()=>void maintain(candidate,"cleanup")}>清理此残留</Button>
      </div>
    </div>)}
    {report?.nextOffset!=null&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void refresh(report.nextOffset!)}>读取下一页</Button>}
    {report?.candidates.length===0&&<p className="text-xs text-muted-foreground">没有可识别的旧安装残留。</p>}
  </section>;
}