import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Bot, Download, FileCheck2, FolderOpen, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreatorPackReport {
  token: string;
  previewUrl: string;
  kind: "scene" | "widget";
  id: string;
  name: string;
  entry: string;
  resources: string[];
  permissions: string[];
  hotspots: number;
  totalBytes: number;
  checks: string[];
}

interface CreatorImportDialogProps {
  roomPath: string;
  roomJson: Record<string, unknown>;
  activeDesk: number;
  deskCount: number;
  onImported: () => Promise<void>;
  onClose: () => void;
}

function sceneTargets(deskCount: number) {
  const targets: Array<[string, string]> = [
    ["background", "当前 Desk 背景"],
    ["start", "Room 启动画面"],
    ["idle", "Room 待机画面"],
  ];
  for (let index = 1; index < deskCount; index += 1) {
    targets.push([`switch:${index - 1}>${index}`, `切换 ${index} → ${index + 1}`]);
    targets.push([`switch:${index}>${index - 1}`, `切换 ${index + 1} → ${index}`]);
  }
  if (deskCount > 2) {
    targets.push([`switch:0>${deskCount - 1}`, `切换 1 → ${deskCount}`]);
    targets.push([`switch:${deskCount - 1}>0`, `切换 ${deskCount} → 1`]);
  }
  return targets;
}

function previewCapabilityData(permission: string): unknown {
  const now = Date.now();
  const values: Record<string, unknown> = {
    "time.read": { epochMs: now, iso: new Date(now).toISOString() },
    "locale.read": { language: "zh-CN", timeZone: "Asia/Shanghai" },
    "viewport.read": { width: 1920, height: 1080 },
    "desk.read": { index: 0, count: 3, name: "创作预览" },
    "playback.read": { paused: false },
    "audio.spectrum": Array.from({ length: 64 }, (_, index) => 0.18 + Math.sin(index / 4) * 0.12),
    "hardware.cpu.read": { usage: 42 },
    "hardware.gpu.read": { usage: 36 },
    "hardware.memory.read": { totalMb: 32768, availableMb: 18432, usedPercent: 43.75 },
    "hardware.network.read": { downBytesPerSecond: 2_450_000, upBytesPerSecond: 180_000 },
    "now-playing.read": { hasSession: true, title: "Dext Preview", artist: "Offline Fixture", album: "Creator Kit", playbackStatus: "playing", positionSeconds: 84, durationSeconds: 240, artwork: null },
    "now-playing.artwork.read": { hasSession: true, title: "Dext Preview", artist: "Offline Fixture", album: "Creator Kit", playbackStatus: "playing", positionSeconds: 84, durationSeconds: 240, artwork: null },
    "system.volume.read": { level: 0.62, muted: false, available: true },
  };
  return values[permission] ?? null;
}

export function CreatorImportDialog({
  roomPath,
  roomJson,
  activeDesk,
  deskCount,
  onImported,
  onClose,
}: CreatorImportDialogProps) {
  const desktopAvailable = "__TAURI_INTERNALS__" in window;
  const [report, setReport] = useState<CreatorPackReport | null>(null);
  const [sceneTarget, setSceneTarget] = useState("background");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function discard() {
    if (report?.token) {
      try { await invoke("discard_creator_import", { token: report.token }); } catch { /* already consumed */ }
    }
  }

  async function close() {
    await discard();
    onClose();
  }

  async function exportContext() {
    const destination = await save({
      defaultPath: `${roomPath.split(/[\\/]/).filter(Boolean).pop() || "room"}-ai-context.zip`,
      filters: [{ name: "Dext AI 创作上下文", extensions: ["zip"] }],
    });
    if (!destination) return;
    setBusy("正在导出上下文…");
    setMessage(null);
    try {
      await invoke("export_ai_context", { destination, roomJson: JSON.stringify(roomJson, null, 2) });
      setMessage("已导出当前 Room、提示词、Schema、SDK、模板和 fixtures。可交给任意前端 AI 离线生成创作包。");
    } catch (error) {
      setMessage(`导出失败：${error}`);
    } finally {
      setBusy(null);
    }
  }

  async function inspectPack() {
    const archivePath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Dext Creator Pack", extensions: ["zip"] }],
    });
    if (typeof archivePath !== "string") return;
    await discard();
    setReport(null);
    setBusy("正在执行离线安全检查…");
    setMessage(null);
    try {
      const next = await invoke<CreatorPackReport>("inspect_creator_pack", { archivePath });
      setReport(next);
      setMessage("检查通过。预览没有系统授权、网络、同源权限或 Room 写入能力。确认后才会写入当前 Room。");
    } catch (error) {
      setMessage(`创作包已拒绝：${error}`);
    } finally {
      setBusy(null);
    }
  }

  async function confirmImport() {
    if (!report) return;
    setBusy("正在事务式写入 Room…");
    setMessage(null);
    try {
      await invoke("confirm_creator_import", {
        token: report.token,
        roomDir: roomPath,
        roomJson: JSON.stringify(roomJson, null, 2),
        deskIndex: activeDesk,
        sceneTarget: report.kind === "scene" ? sceneTarget : null,
      });
      setReport(null);
      await onImported();
      onClose();
    } catch (error) {
      setMessage(`导入失败：${error}`);
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  function initializePreview(frame: HTMLIFrameElement) {
    if (!report || !frame.contentWindow) return;
    const type = report.kind === "widget" ? "dext:widget:init" : "dext:scene:init";
    frame.contentWindow.postMessage({
      type,
      protocol: 1,
      instanceId: report.token,
      token: report.token,
      permissions: report.permissions,
      viewport: { width: 1920, height: 1080 },
      config: {},
      widgetId: report.kind === "widget" ? report.id : undefined,
      deskIndex: activeDesk,
      kind: report.kind === "scene" ? "preview" : undefined,
    }, "*");
    for (const capability of report.permissions.filter((permission) => permission !== "action.invoke")) {
      frame.contentWindow.postMessage({
        type: "dext:capability",
        protocol: 1,
        instanceId: report.token,
        token: report.token,
        capability,
        data: previewCapabilityData(capability),
      }, "*");
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="AI 创作导入">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><Bot className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold">AI 前端创作</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">导出规范给 AI，检查并预览其 Scene / Widget 包；Dext 不连接任何外部模型。</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void close()} aria-label="关闭"><X className="h-4 w-4" /></Button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Download className="h-4 w-4 text-primary" /> 1. 交给 AI</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">上下文包含当前 Room、正式提示词、两个 Schema、SDK 类型、Scene/Widget 模板和安全说明。</p>
              <Button className="mt-3 w-full" variant="outline" onClick={() => void exportContext()} disabled={Boolean(busy) || !desktopAvailable}>
                导出 AI 上下文
              </Button>
            </section>
            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><FolderOpen className="h-4 w-4 text-primary" /> 2. 检查生成包</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">先解压到临时区，检查路径、资源、权限、远程内容和危险 Web API，不会修改 Room。</p>
              <Button className="mt-3 w-full" onClick={() => void inspectPack()} disabled={Boolean(busy) || !desktopAvailable}>
                选择 .dext-content.zip
              </Button>
            </section>
            {!desktopAvailable && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">浏览器设计模式只展示界面；文件检查和导入请在桌面配置器中执行。</p>}
            {message && <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${message.includes("失败") || message.includes("拒绝") ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/30 bg-primary/5 text-muted-foreground"}`}>{message}</p>}
            {busy && <p className="text-xs font-medium text-primary">{busy}</p>}
          </aside>

          <section className="min-h-[430px] overflow-hidden rounded-xl border border-border bg-muted/20">
            {report ? (
              <div className="grid h-full min-h-[560px] lg:grid-rows-[minmax(300px,1fr)_auto]">
                <div className="relative min-h-[300px] bg-[#080d10]">
                  <iframe
                    key={report.token}
                    title={`${report.name} 隔离预览`}
                    src={report.previewUrl}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    onLoad={(event) => initializePreview(event.currentTarget)}
                    className="h-full min-h-[300px] w-full border-0"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[10px] text-white/75 backdrop-blur">隔离预览 · 仅离线 mock 数据</span>
                </div>
                <div className="border-t border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-emerald-500" /><strong className="text-sm">{report.name}</strong><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{report.kind}</span></div>
                      <p className="mt-1 text-xs text-muted-foreground">{report.id} · {report.resources.length} 个资源 · {(report.totalBytes / 1024).toFixed(1)} KiB · {report.hotspots} 个可信热点</p>
                    </div>
                    <div className="flex items-end gap-2">
                      {report.kind === "scene" && (
                        <label className="grid gap-1 text-[10px] text-muted-foreground">写入位置
                          <select value={sceneTarget} onChange={(event) => setSceneTarget(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                            {sceneTargets(deskCount).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                      )}
                      <Button onClick={() => void confirmImport()} disabled={Boolean(busy)}>确认写入 Room</Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> 安全报告</div>
                      <ul className="mt-2 space-y-1 text-[11px] leading-4 text-muted-foreground">{report.checks.map((check) => <li key={check}>✓ {check}</li>)}</ul>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs font-medium">能力声明</div>
                      <div className="mt-2 flex flex-wrap gap-1">{report.permissions.length ? report.permissions.map((permission) => <span key={permission} className="rounded bg-muted px-1.5 py-1 text-[10px]">{permission}</span>) : <span className="text-[11px] text-muted-foreground">无系统能力</span>}</div>
                      <p className="mt-2 text-[10px] leading-4 text-amber-600 dark:text-amber-400">写入后仍未授权；保存内容版本后需在属性检查器中由本机用户批准。</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[430px] flex-col items-center justify-center px-8 text-center">
                <ShieldCheck className="h-9 w-9 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">还没有通过检查的创作包</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">选择包后，这里会同时显示隔离预览、资源清单、权限声明和安全检查结果。未确认前不会写入 Room。</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
