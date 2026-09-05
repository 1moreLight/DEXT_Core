import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/features/room-library/previews";
import type { AppInfo } from "@/features/runtime/types";

interface EditorAppLibraryProps {
  apps: AppInfo[];
  filteredApps: AppInfo[];
  query: string;
  selected: Set<string>;
  source: "auto" | "custom";
  onQuery: (value: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onScan: () => void;
  onToggleSelect: (app: AppInfo) => void;
}

export function EditorAppLibrary(props: EditorAppLibraryProps) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-xs ${props.source === "custom" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`} title={props.source === "custom" ? "library.json（可增删）" : "在线枚举（未持久化）"}>{props.source === "custom" ? "手动库" : "自动扫描"}</span>
        <Button variant="outline" size="sm" className="h-7" onClick={props.onAdd}>+ 添加</Button>
        <Button variant="outline" size="sm" className="h-7 text-destructive hover:text-destructive" disabled={!props.selected.size} onClick={props.onDelete}><Trash2 className="h-3.5 w-3.5" /> 删除</Button>
        <Button variant="outline" size="sm" className="h-7" onClick={props.onScan}>扫描合并</Button>
        <span className="ml-auto text-xs text-muted-foreground">已选 {props.selected.size} 项供删除</span>
      </div>
      <Input placeholder="搜索应用..." value={props.query} onChange={(event) => props.onQuery(event.target.value)} className="mb-3" />
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-6 gap-2 overflow-y-auto pr-1">
        {props.apps.length === 0 && <div className="col-span-6 py-16 text-center text-sm text-muted-foreground">库为空——点「扫描合并」一键读取开始菜单，或「+ 添加」手动加入 lnk/exe</div>}
        {props.filteredApps.map((app) => {
          const picked = props.selected.has(app.target);
          return (
            <div key={app.source + app.target} className={`relative rounded-lg border transition-colors ${picked ? "border-destructive/60" : "border-transparent"}`}>
              <div className={`flex h-full w-full flex-col items-center gap-1.5 rounded-lg p-3 ${picked ? "bg-destructive/10" : ""}`} title={app.target}>
                <AppIcon app={app} /><span className="line-clamp-2 text-center text-xs leading-tight">{app.name}</span>
              </div>
              <button type="button" aria-label={`${picked ? "取消选择" : "选择删除"} ${app.name}`} aria-pressed={picked} onClick={() => props.onToggleSelect(app)} className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border text-[10px] ${picked ? "border-destructive bg-destructive text-white" : "border-border bg-background/90 text-muted-foreground"}`}>{picked ? "✓" : ""}</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
