import {useEffect, useRef, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {open} from "@tauri-apps/plugin-dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import type {AppInfo} from "@/features/runtime/types";

type Pin = {name:string; target:string; arguments:string; workingDirectory:string};
type TaskbarState = {mode:"auto"|"hidden"|"visible"; hidden:boolean; visible:boolean|null; error:string|null};
type State = {autoHide?:boolean; reserveSpace?:boolean; runtime?:{owner:string;visible:boolean;waiting:boolean;blocked?:string|null;reservation?:{registered:boolean;ready:boolean;error:string|null}}; taskbar?:TaskbarState; enabled:boolean; pins:Pin[]; groups:{key:string; name:string; pinned:boolean; windows:{handle:number; title:string}[]}[]; error:string|null};
const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function ApplicationDockSettings({corePid,setStatus}:{corePid:number|null;setStatus:(message:string)=>void}) {
  const [state,setState] = useState<State|null>(null);
  const [apps,setApps] = useState<AppInfo[]>([]);
  const [query,setQuery] = useState("");
  const [picker,setPicker] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const epoch = useRef(0), pending = useRef(false), mutation = useRef(false), request = useRef(0);
  const connected = native && corePid !== null;
  useEffect(() => {
    const version = ++epoch.current;
    pending.current = false; mutation.current = false; setBusy(false); setState(null); setError(null);
    if (!connected) return;
    async function refresh() {
      if (pending.current) return;
      const ticket = ++request.current;
      pending.current = true;
      try {
        const reply = await invoke<State>("get_application_dock_status");
        if (version === epoch.current && ticket === request.current) {setState(reply); setError(null);}
      } catch(reason) {
        if (version === epoch.current && ticket === request.current) setError("读取应用 Dock 失败：" + String(reason));
      } finally {if (version === epoch.current && ticket === request.current) pending.current = false;}
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {window.clearInterval(timer); epoch.current++;};
  }, [corePid,connected]);

  async function edit(patch:unknown) {
    if (!connected || mutation.current) return;
    const version = epoch.current;
    ++request.current; mutation.current = true; pending.current = true; setBusy(true);
    try {
      const reply = await invoke<State>("edit_application_dock",{patch});
      if (version !== epoch.current) return;
      setState(reply); setError(null); setStatus((patch as {operation?:string}).operation === "taskbar" ? "任务栏请求已保存，实际状态见下方" : "系统应用 Dock 已保存");
    } catch(reason) {if (version === epoch.current) setError(String(reason));}
    finally {if (version === epoch.current) {pending.current = false; mutation.current = false; setBusy(false);}}
  }
  async function chooseApps() {
    setPicker(value => !value);
    if (apps.length) return;
    const version = epoch.current;
    try {
      const list = await invoke<AppInfo[]>("get_installed_apps");
      if (version === epoch.current) setApps(list);
    } catch(reason) {if (version === epoch.current) setError("应用列表读取失败：" + String(reason));}
  }
  async function chooseFile() {
    const version = epoch.current;
    try {
      const path = await open({multiple:false,filters:[{name:"应用与快捷方式",extensions:["exe","lnk"]}]});
      if (!path || version !== epoch.current) return;
      const app = await invoke<AppInfo>("resolve_app",{path});
      if (version === epoch.current) await pin(app);
    } catch(reason) {if (version === epoch.current) setError(String(reason));}
  }
  async function pin(app:AppInfo) {
    await edit({operation:"pin", app:{name:app.name,target:app.target,arguments:app.arguments,workingDirectory:app.working_dir}});
  }
  const disabled = !connected || busy || !state;
  const matches = apps.filter(app => app.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="mb-8 rounded-xl border border-border p-4 space-y-4">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-sm font-semibold">系统应用 Dock</h2><p className="mt-1 text-xs text-muted-foreground">固定常用应用，查看和切换正在运行的窗口。</p></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="启用系统应用 Dock" disabled={disabled} checked={state?.enabled ?? false} onChange={event => void edit({operation:"enable",enabled:event.target.checked})}/>启用</label>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="自动隐藏应用 Dock" disabled={disabled} checked={state?.autoHide ?? false} onChange={event => void edit({operation:"autoHide",autoHide:event.target.checked})}/>自动隐藏：移到主屏底部中央唤出</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="应用 Dock 常驻占位" disabled={disabled} checked={state?.reserveSpace ?? false} onChange={event => void edit({operation:"reserveSpace",reserveSpace:event.target.checked})}/>常驻占位：最大化窗口为 Dock 留出空间</label>
    <p className="text-xs text-muted-foreground">自动隐藏与常驻占位互斥；都不选时，Dock 浮在窗口上方。</p>
    {state?.reserveSpace && <p role="status" className="text-xs text-muted-foreground">{state.runtime?.reservation?.ready ? "Windows 已确认 Dock 工作区占位" : state.runtime?.reservation?.error ?? "等待 Dock 就绪并确认工作区…"}</p>}
    <p className="text-xs text-muted-foreground">点击启动或切换；当前单窗口应用再次点击最小化；多个窗口点击选择。右键可固定应用。全屏时隐藏，退出全屏后恢复。</p>
    <p className="text-xs text-muted-foreground">启用系统应用 Dock 时，主题独立 Dock 暂停；关闭后按原主题设置恢复。桌面内的主题内容保持。</p>
    {state?.runtime?.blocked && <p role="status" className="text-xs text-muted-foreground">{state.runtime.blocked === "fullscreen" ? "检测到全屏应用，Dock 暂时隐藏；退出全屏后恢复。" : "锁屏期间 Dock 保持隐藏。"}</p>}
    {state?.runtime?.waiting && <p role="status" className="text-xs text-muted-foreground">正在等待主题 Dock 关闭并释放占位…</p>}
    <div className="rounded-lg border border-border p-3 space-y-2">
      <h3 className="text-sm font-medium">Windows 任务栏</h3>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!connected || busy} onClick={() => void edit({operation:"taskbar",mode:"hidden"})}>隐藏 Windows 任务栏</Button>
        <Button size="sm" disabled={!connected || busy} onClick={() => void edit({operation:"taskbar",mode:"visible"})}>恢复 Windows 任务栏</Button>
        <Button size="sm" variant="ghost" disabled={!connected || busy} onClick={() => void edit({operation:"taskbar",mode:"auto"})}>跟随 Dock</Button>
      </div>
      <p className="text-xs text-muted-foreground">开发调试时可点恢复；恢复模式会保持，直到再次选择隐藏或跟随 Dock。退出 Core 后释放 Dext 的任务栏接管。</p>
      {state?.taskbar && <p role="status" className="text-xs text-muted-foreground">
        模式：{state.taskbar.mode === "hidden" ? "手动隐藏" : state.taskbar.mode === "visible" ? "保持恢复" : "跟随 Dock"} ·
        {state.taskbar.hidden ? " Dext 已确认隐藏" : state.taskbar.visible === true ? " Windows 任务栏当前可见" : state.taskbar.visible === false ? " Windows 任务栏当前不可见" : " 暂未找到 Windows 任务栏"}
      </p>}
      {state?.taskbar?.error && <p role="alert" className="text-xs text-destructive">{state.taskbar.error}</p>}
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void chooseApps()}>{picker ? "收起应用列表" : "从应用列表固定"}</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void chooseFile()}>选择本机程序</Button>
    </div>
    {picker && <div className="space-y-2">
      <Input aria-label="搜索要固定的应用" placeholder="搜索应用" value={query} onChange={event => setQuery(event.target.value)}/>
      <div className="max-h-52 overflow-y-auto divide-y divide-border">{matches.slice(0,100).map(app => {
        const pinned = state?.pins.some(pin => pin.target.toLowerCase() === app.target.toLowerCase());
        return <div key={app.target + app.arguments} className="flex items-center gap-2 py-2">
          {app.icon_png && <img src={"data:image/png;base64," + app.icon_png} alt="" className="h-7 w-7"/>}
          <span className="flex-1 truncate text-sm">{app.name}</span>
          <Button size="sm" variant="ghost" disabled={disabled || pinned} onClick={() => void pin(app)}>{pinned ? "已固定" : "固定"}</Button>
        </div>;
      })}</div>
      {matches.length > 100 && <p className="text-xs text-muted-foreground">显示前 100 个结果，可输入名称缩小范围。</p>}
    </div>}
    <div className="space-y-2">
      <h3 className="text-xs font-medium">已固定 · {state?.pins.length ?? 0}</h3>
      {state?.pins.map(pin => <div key={pin.target} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate" title={pin.target}>{pin.name}</span><Button size="sm" variant="ghost" disabled={disabled} onClick={() => void edit({operation:"unpin",target:pin.target})}>取消固定</Button></div>)}
      {state?.pins.length === 0 && <p className="text-xs text-muted-foreground">尚未固定应用。启用后，已打开的应用也会出现在 Dock 中。</p>}
    </div>
    <p className="text-xs text-muted-foreground">{!native ? "浏览器设计预览" : !connected ? "Core 未连接" : state ? (state.enabled ? "已启用" : "已关闭") + " · " + state.groups.filter(group => group.windows.length > 0).length + " 个运行应用" : "正在读取…"}</p>
    <p className="text-xs text-muted-foreground">本机设置会自动保存，关闭配置器后继续运行。当前显示在主屏工作区底部。</p>
    {(error || state?.error) && <p role="alert" className="text-xs text-destructive">{error || state?.error}</p>}
  </section>;
}
