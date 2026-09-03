import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AppMode = "use" | "edit" | "settings";
export type AppTheme = "light" | "dark";

interface CoreIdentityView {
  process_id: number;
  base_directory: string;
  app_data_directory: string;
  grpc_pipe_name: string;
  runtime_identity: string;
}

export function AppHeader({
  mode,
  onMode,
  theme,
  onTheme,
  isTauri,
  coreIdentity,
  coreIdentityError,
  status,
  showPreview,
  canPreview,
  previewDisabledReason,
  onTogglePreview,
}: {
  mode: AppMode;
  onMode: (mode: AppMode) => void;
  theme: AppTheme;
  onTheme: (theme: AppTheme) => void;
  isTauri: boolean;
  coreIdentity: CoreIdentityView | null;
  coreIdentityError: string | null;
  status: string;
  showPreview: boolean;
  canPreview: boolean;
  previewDisabledReason?: string;
  onTogglePreview: () => void;
}) {
  const coreUnavailable = coreIdentityError
    ? /pipe|connect|unavailable|not running|退出|断开|未运行/i.test(coreIdentityError)
    : false;
  const tabClass = (active: boolean) => `rounded px-3 py-1 text-sm whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`;
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3">
      <div className="flex shrink-0 items-center gap-3">
        <h1 className="text-lg font-semibold">Dext</h1>
        <div className="flex shrink-0 rounded-md border border-border p-0.5">
          <button className={tabClass(mode === "use")} onClick={() => onMode("use")}>使用</button>
          <button className={tabClass(mode === "edit")} onClick={() => onMode("edit")}>编辑</button>
          <button className={tabClass(mode === "settings")} onClick={() => onMode("settings")}>设置</button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => onTheme(theme === "dark" ? "light" : "dark")} title={`切换到${theme === "dark" ? "浅色" : "深色"}主题`}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-medium ${!isTauri ? "border-border text-muted-foreground" : coreIdentity ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-destructive/50 bg-destructive/10 text-destructive"}`}
          title={!isTauri ? "UI 设计模式未连接 Core" : coreIdentity ? `PID ${coreIdentity.process_id}\nCore ${coreIdentity.base_directory}\nPipe ${coreIdentity.grpc_pipe_name}\nData ${coreIdentity.app_data_directory}\nIdentity ${coreIdentity.runtime_identity}` : coreIdentityError ?? "正在验证 Dext Core 身份"}
        >
          {!isTauri ? "Dext Core · mock" : coreIdentity ? "Dext Core 已连接" : coreIdentityError ? coreUnavailable ? "Dext Core 未运行" : "Dext Core 身份拒绝" : "正在验证 Dext Core"}
        </span>
        <span className="max-w-[30vw] truncate text-sm text-muted-foreground" title={status}>{status}</span>
        {mode === "edit" && isTauri && (
          <Button variant={showPreview ? "secondary" : "outline"} size="sm" disabled={!canPreview} title={!canPreview ? previewDisabledReason : undefined} onClick={onTogglePreview}>预览</Button>
        )}
      </div>
    </header>
  );
}
