import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ExternalLink, FileJson, FolderOpen, Info, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Theme = "light" | "dark" | "system";

type CoreIdentity = {
  product_name: string;
  runtime_identity: string;
  process_id: number;
  base_directory: string;
  app_data_directory: string;
  grpc_pipe_name: string;
  assembly_version: string;
};

type DextSettings = {
  startup: boolean;
  fullscreenPause: boolean;
  batteryPause: boolean;
  powerSavePause: boolean;
  audioVolume: number;
  audioOnlyOnDesktop: boolean;
};

type AboutInfo = {
  configuratorVersion: string;
  documents: Array<{ id: string; label: string }>;
};

type SettingsPageProps = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  libDir: string;
  onChangeLib: (path: string) => void;
  coreIdentity: CoreIdentity | null;
  setStatus: (message: string) => void;
};

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsPage(props: SettingsPageProps) {
  const [settings, setSettings] = useState<DextSettings | null>(
    IS_TAURI
      ? null
      : {
          startup: true,
          fullscreenPause: true,
          batteryPause: false,
          powerSavePause: true,
          audioVolume: 70,
          audioOnlyOnDesktop: true,
        }
  );
  const [saving, setSaving] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [about, setAbout] = useState<AboutInfo | null>(
    IS_TAURI ? null : { configuratorVersion: "0.1.0", documents: [] }
  );

  useEffect(() => {
    if (!IS_TAURI || !props.coreIdentity) return;
    invoke<DextSettings>("get_dext_settings")
      .then(setSettings)
      .catch((error) => props.setStatus(`读取设置失败：${String(error)}`));
  }, [props.coreIdentity]);

  useEffect(() => {
    if (!IS_TAURI) return;
    invoke<AboutInfo>("about_info")
      .then(setAbout)
      .catch((error) => props.setStatus(`读取关于信息失败：${String(error)}`));
  }, []);

  async function patch(next: Partial<DextSettings>) {
    if (!settings) return;
    if (!IS_TAURI) {
      setSettings({ ...settings, ...next });
      return;
    }
    setSaving(true);
    try {
      const updated = await invoke<DextSettings>("patch_dext_settings", { patch: next });
      setSettings(updated);
      props.setStatus("Dext 设置已保存");
    } catch (error) {
      props.setStatus(`设置保存失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function chooseLibrary() {
    if (!IS_TAURI) return;
    const selected = await open({ directory: true, multiple: false, defaultPath: props.libDir });
    if (typeof selected !== "string") return;
    setLibraryBusy(true);
    try {
      const validated = await invoke<string>("validate_room_library", { path: selected });
      props.onChangeLib(validated);
      props.setStatus(`Room 库已切换到 ${validated}；旧 Room 未迁移`);
    } catch (error) {
      props.setStatus(`Room 库路径不可用：${String(error)}`);
    } finally {
      setLibraryBusy(false);
    }
  }

  async function openAbout(documentId: string) {
    try {
      await invoke("open_about_document", { documentId });
    } catch (error) {
      props.setStatus(`打开关于文档失败：${String(error)}`);
    }
  }

  async function openDextDirectory(kind: "data" | "logs", label: string) {
    try {
      await invoke("open_dext_directory", { kind });
    } catch (error) {
      props.setStatus(`打开${label}失败：${String(error)}`);
    }
  }

  async function exportDiagnostics() {
    if (!IS_TAURI) return;
    const path = await save({
      defaultPath: "dext-diagnostics.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await invoke("export_diagnostics", { path });
      props.setStatus(`诊断已导出到 ${path}`);
    } catch (error) {
      props.setStatus(`导出诊断失败：${String(error)}`);
    }
  }

  const disabled = saving || (IS_TAURI && !props.coreIdentity);
  const rows: Array<[keyof DextSettings, string, string]> = [
    ["startup", "开机启动", "使用 Dext 自有 Windows 启动项"],
    ["fullscreenPause", "全屏应用时暂停", "减少游戏或演示期间的资源占用"],
    ["batteryPause", "电池供电时暂停", "仅在接通电源时保持壁纸运行"],
    ["powerSavePause", "节能模式时暂停", "跟随 Windows 节能状态"],
    ["audioOnlyOnDesktop", "仅桌面可见时播放声音", "其他窗口覆盖桌面时静音"],
  ];

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">常规与性能</h2>
            </div>
            <div className="divide-y divide-border border-y border-border">
              <div className="flex items-center justify-between gap-6 py-4">
                <div>
                  <div className="text-sm font-medium">配置器主题</div>
                  <div className="text-xs text-muted-foreground">只影响配置器，不触发 Core UI 重启</div>
                </div>
                <select
                  value={props.theme}
                  onChange={(event) => props.setTheme(event.target.value as Theme)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="system">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>
              {rows.map(([key, title, description]) => (
                <div key={key} className="flex items-center justify-between gap-6 py-4">
                  <div>
                    <div className="text-sm font-medium">{title}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                  <Toggle
                    label={title}
                    checked={Boolean(settings?.[key])}
                    disabled={disabled || !settings}
                    onChange={(value) => void patch({ [key]: value })}
                  />
                </div>
              ))}
              <label className="block py-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">全局壁纸音量</span>
                  <span className="tabular-nums text-muted-foreground">{settings?.audioVolume ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings?.audioVolume ?? 0}
                  disabled={disabled || !settings}
                  onChange={(event) => setSettings((current) => current ? { ...current, audioVolume: Number(event.target.value) } : current)}
                  onPointerUp={(event) => void patch({ audioVolume: Number(event.currentTarget.value) })}
                  className="w-full accent-[var(--primary)]"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold">Room 库与诊断</h2>
            <div className="space-y-3 border-y border-border py-4">
              <label className="block text-xs font-medium text-muted-foreground">Room 库路径</label>
              <div className="flex gap-2">
                <Input value={props.libDir} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={chooseLibrary} disabled={!IS_TAURI || libraryBusy}>
                  <FolderOpen className="h-4 w-4" /> {libraryBusy ? "验证中" : "选择"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">切换路径不会迁移旧 Room；Core 的 WallpaperDir 与此路径相互独立。</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" disabled={!props.coreIdentity} onClick={() => void openDextDirectory("data", "数据目录")}>
                  打开数据目录 <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={!props.coreIdentity} onClick={() => void openDextDirectory("logs", "日志目录")}>
                  打开日志目录 <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={!props.coreIdentity} onClick={exportDiagnostics}>
                  <FileJson className="h-3.5 w-3.5" /> 导出诊断
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5 border-l border-border pl-6">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">关于 Dext</h2>
          </div>
          <dl className="space-y-3 text-xs">
            <div><dt className="text-muted-foreground">配置器</dt><dd className="mt-0.5 font-medium">Dext {about?.configuratorVersion ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Core</dt><dd className="mt-0.5 font-medium">{props.coreIdentity ? `Dext ${props.coreIdentity.assembly_version}` : "未连接"}</dd></div>
            <div><dt className="text-muted-foreground">运行身份</dt><dd className="mt-0.5 break-all font-mono">{props.coreIdentity?.runtime_identity ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Core 路径</dt><dd className="mt-0.5 break-all font-mono">{props.coreIdentity?.base_directory ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Pipe</dt><dd className="mt-0.5 break-all font-mono">{props.coreIdentity?.grpc_pipe_name ?? "—"}</dd></div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            Dext 携带自己的 Lively Core fork，不依赖用户另外安装的原版 Lively。上游许可证与来源保留在仓库 LICENSE、NOTICE/README 中。
          </p>
          <div className="space-y-2 border-t border-border pt-4">
            {about?.documents.map((document) => (
              <Button
                key={document.id}
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between px-0 text-left"
                onClick={() => void openAbout(document.id)}
              >
                <span>{document.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </Button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
