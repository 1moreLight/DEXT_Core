import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "@/features/room-library/previews";
import type { AppInfo } from "@/features/runtime/types";

interface AppLibraryDialogProps {
  apps: AppInfo[];
  filteredApps: AppInfo[];
  query: string;
  selected: Set<string>;
  source: "auto" | "custom";
  onQuery: (value: string) => void;
  onAdd: () => void;
  onScan: () => void;
  onDelete: () => void;
  onToggleSelect: (app: AppInfo) => void;
  onClose: () => void;
}

export function AppLibraryDialog(props: AppLibraryDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [props.onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) props.onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="应用库管理"
        className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">应用库管理</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              管理有哪些应用可加入 Desk；上桌请在 Room 编辑里操作。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={props.onClose}>
            完成
          </Button>
        </div>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${
              props.source === "custom" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
            title={props.source === "custom" ? "library.json（可增删）" : "在线枚举（未持久化）"}
          >
            {props.source === "custom" ? "手动库" : "自动扫描"}
          </span>
          <Button variant="outline" size="sm" className="h-7" onClick={props.onAdd}>
            + 添加
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-destructive hover:text-destructive"
            disabled={!props.selected.size}
            onClick={props.onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={props.onScan}>
            扫描合并
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">已选 {props.selected.size} 项供删除</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <Input
            placeholder="搜索应用..."
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            className="mb-3"
          />
          {props.apps.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
              库为空——点「扫描合并」一键读取开始菜单，或「+ 添加」手动加入 lnk/exe。
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {props.filteredApps.map((app) => {
                const picked = props.selected.has(app.target);
                return (
                  <div
                    key={app.source + app.target}
                    className={`relative rounded-lg border transition-colors ${
                      picked ? "border-destructive/60" : "border-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => props.onToggleSelect(app)}
                      aria-pressed={picked}
                      title={`${app.target}\n单击${picked ? "取消选择" : "选择"}（供删除）`}
                      className={`flex h-full w-full min-h-28 flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors ${
                        picked ? "bg-destructive/10" : "bg-muted/45 hover:bg-accent"
                      }`}
                    >
                      <AppIcon app={app} />
                      <span className="line-clamp-2 text-xs leading-tight">{app.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${picked ? "取消选择" : "选择删除"} ${app.name}`}
                      aria-pressed={picked}
                      onClick={() => props.onToggleSelect(app)}
                      className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                        picked ? "border-destructive bg-destructive text-white" : "border-border bg-background/90 text-muted-foreground"
                      }`}
                    >
                      {picked ? "✓" : ""}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
