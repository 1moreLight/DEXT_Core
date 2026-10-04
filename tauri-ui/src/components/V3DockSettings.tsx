import {useEffect,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {dockRuntimeLabel,type V3DockPreferences,type V3DockStatus} from "@/lib/v3-dock-preferences";

const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
type Props = {corePid:number|null; setStatus:(message:string)=>void};
export function V3DockSettings({corePid,setStatus}:Props) {
  const [confirmed,setConfirmed] = useState<V3DockStatus|null>(null);
  const [draft,setDraft] = useState<V3DockPreferences|null>(null);
  const [height,setHeight] = useState("128");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const generation = useRef(0), requestBusy = useRef(false), dirty = useRef(false);
  const disabled = !native || corePid === null || busy || draft === null;

  useEffect(() => {
    const epoch = ++generation.current;
    requestBusy.current = false; dirty.current = false; setBusy(false); setError(null);
    setConfirmed(null); setDraft(null);
    if (!native || corePid === null) return;
    requestBusy.current = true; setBusy(true);
    invoke<V3DockStatus>("get_v3_dock_status").then(reply => {
      if (generation.current !== epoch) return;
      setConfirmed(reply);
      if (reply.preferences) {setDraft(reply.preferences); setHeight(String(reply.preferences.heightDip));}
      if (reply.status !== "accepted") setError(reply.message || "Dock 偏好暂不可读");
    }).catch(reason => {
      if (generation.current === epoch) setError("读取 Dock 偏好失败：" + String(reason));
    }).finally(() => {
      if (generation.current === epoch) {requestBusy.current = false; setBusy(false);}
    });
    return () => {generation.current++;};
  }, [corePid]);

  async function load() {
    if (!native || corePid === null || requestBusy.current) return;
    const epoch = generation.current; requestBusy.current = true; setBusy(true);
    try {
      const reply = await invoke<V3DockStatus>("get_v3_dock_status");
      if (generation.current !== epoch) return;
      setConfirmed(reply);
      if (!dirty.current && reply.preferences) {setDraft(reply.preferences); setHeight(String(reply.preferences.heightDip));}
      setError(reply.status === "accepted" ? null : reply.message || "Dock 偏好暂不可读");
    } catch(reason) {if (generation.current === epoch) setError("读取失败：" + String(reason));}
    finally {if (generation.current === epoch) {requestBusy.current = false; setBusy(false);}}
  }

  async function save() {
    if (disabled || requestBusy.current || !draft) return;
    const value = Number(height);
    if (!height.trim() || !Number.isInteger(value) || value < 48 || value > 240) {
      setError("高度请输入 48–240 DIP 的整数"); return;
    }
    const epoch = generation.current; requestBusy.current = true; setBusy(true); setError(null);
    try {
      const reply = await invoke<V3DockStatus>("set_v3_dock_preference", {patch:{enabled:draft.enabled,mode:draft.mode,heightDip:value}});
      if (generation.current !== epoch) return;
      if (reply.status !== "accepted" || !reply.preferences) {setError(reply.message || "保存失败，已确认偏好保持"); return;}
      setConfirmed(reply); setDraft(reply.preferences); setHeight(String(reply.preferences.heightDip)); dirty.current = false;
      setStatus("Dock 偏好已保存 · " + dockRuntimeLabel(reply.runtime));
    } catch(reason) {if (generation.current === epoch) setError("保存失败，已确认偏好保持：" + String(reason));}
    finally {if (generation.current === epoch) {requestBusy.current = false; setBusy(false);}}
  }

  function edit(patch:Partial<V3DockPreferences>) {dirty.current = true; setDraft(value => value ? {...value,...patch} : value);}
  return <section>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold">原生 Dock</h2>
      <Button variant="ghost" size="sm" disabled={!native || corePid === null || busy} onClick={() => void load()}>刷新状态</Button>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">所有 Room 共用这份本机偏好。显示模式和高度由 Dext 控制。</p>
    <div className="space-y-4 border-y border-border py-4">
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>启用原生 Dock</span><input type="checkbox" aria-label="启用原生 Dock" disabled={disabled} checked={draft?.enabled ?? false} onChange={event => edit({enabled:event.target.checked})}/>
      </label>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>显示方式</span>
        <select className="rounded-md border border-border bg-background px-3 py-2 text-xs" aria-label="Dock 显示方式" disabled={disabled} value={draft?.mode ?? "autohide"} onChange={event => edit({mode:event.target.value as V3DockPreferences["mode"]})}>
          <option value="autohide">触边展开，离开收起</option>
          <option value="reserve" disabled={!confirmed?.runtime.reserveAvailable}>常驻占位（暂不可运行）</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>高度</span><div className="flex items-center gap-2"><Input className="w-24" type="number" min={48} max={240} aria-label="Dock 高度" disabled={disabled} value={height} onChange={event => {dirty.current = true; setHeight(event.target.value);}}/><span className="text-xs text-muted-foreground">DIP</span></div>
      </label>
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" disabled={disabled} onClick={() => void save()}>{busy ? "处理中…" : "保存偏好"}</Button>
        <span className="text-xs text-muted-foreground">{!native ? "浏览器设计预览" : corePid === null ? "Core 未连接" : error ? "状态暂不可读" : confirmed ? dockRuntimeLabel(confirmed.runtime) : busy ? "正在读取" : "尚未读取"}</span>
      </div>
      {confirmed?.preferences && <p className="text-xs text-muted-foreground">已保存：{confirmed.preferences.enabled ? "启用" : "关闭"} · {confirmed.preferences.mode === "autohide" ? "自动隐藏" : "常驻占位"} · {confirmed.preferences.heightDip} DIP{confirmed.runtime.playerPid > 0 ? " · PID " + confirmed.runtime.playerPid : ""}</p>}
      {confirmed?.runtime.reason && corePid !== null && <p className="text-xs text-muted-foreground">{confirmed.runtime.reason}</p>}
      {confirmed?.preferences?.enabled && !confirmed.runtime.autoHideAvailable && <p className="text-xs text-amber-500">启用偏好已保存，Dock 当前尚不可运行。</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  </section>;
}
