import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Props = { roomId:string; consumerId:string; isTauri:boolean; canApply:boolean; disabled:boolean };
type Capability = { capability:string; allowed:boolean };
type Grants = { status:string; roomId:string; installationStamp:string; consumers?:{consumerId:string; capabilities:Capability[]}[] };
type Session = { active:boolean; room_id:string; installation_stamp:string; player_pid:number; operable:boolean };
type Board = { stamp:string; capabilities:Capability[]; paused:boolean };
const sources = [
  ["time.read", "时间数据"], ["hardware.read", "硬件数据"],
  ["media.read", "媒体数据"], ["audio.read", "音量数据"],
] as const;
const appliedHint = "保存并应用这个 Room 后，可为当前运行副本允许数据读取。";

function capabilities(reply:Grants, roomId:string, consumerId:string, stamp:string):Capability[]|undefined {
  if (reply.status !== "accepted" || reply.roomId !== roomId || reply.installationStamp !== stamp) return;
  return reply.consumers?.find(consumer => consumer.consumerId === consumerId)?.capabilities
    .filter(item => sources.some(([id]) => item.capability === id));
}

export function V3ReadGrantPanel(props:Props) {
  const [board, setBoard] = useState<Board|null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const epoch = useRef(0), busy = useRef(false);

  useEffect(() => {
    let disposed = false;
    epoch.current++; busy.current = false; setPending(false); setBoard(null);
    if (!props.isTauri || !props.canApply) {
      setNotice(props.isTauri ? "先启动 Core，再应用这个 Room。" : "浏览器预览不读取本机授权；请在配置器中保存并应用 Room。");
      return;
    }
    const refresh = async () => {
      if (disposed || busy.current) return;
      const ticket = ++epoch.current;
      const current = () => !disposed && epoch.current === ticket;
      try {
        const session = await invoke<Session>("v3_session_status");
        if (!current()) return;
        if (!session.active || session.player_pid <= 0 || session.room_id !== props.roomId || !session.installation_stamp) {
          setBoard(null); setNotice(appliedHint); return;
        }
        const reply = await invoke<Grants>("get_v3_read_grants", { roomId:props.roomId, installationStamp:session.installation_stamp });
        if (!current()) return;
        const declared = capabilities(reply, props.roomId, props.consumerId, session.installation_stamp);
        if (!declared?.length) {
          setBoard(null); setNotice(reply.status === "accepted" ? "当前运行副本没有这个 Dock 的数据源，请保存并重新应用。" : appliedHint);
          return;
        }
        setBoard({stamp:session.installation_stamp, capabilities:declared, paused:!session.operable});
        setNotice(session.operable ? "正在编辑当前已应用副本的本机授权。" : "桌面暂不可读取；授权仍可保存，桌面恢复可用后读取。");
      } catch {
        if (current()) { setBoard(null); setNotice("暂时无法读取本机授权，请确认 Core 正在运行。"); }
      }
    };
    setNotice("正在读取本机授权…"); void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { disposed = true; epoch.current++; window.clearInterval(timer); };
  }, [props.roomId, props.consumerId, props.isTauri, props.canApply]);

  const change = async (capability:string, allow:boolean) => {
    if (!board || busy.current || props.disabled) return;
    const confirmed = board, ticket = ++epoch.current;
    busy.current = true; setPending(true);
    try {
      const reply = await invoke<Grants>("set_v3_read_grant", {
        roomId:props.roomId, installationStamp:confirmed.stamp, consumerId:props.consumerId,
        capabilities:[capability], allow,
      });
      if (epoch.current !== ticket) return;
      const declared = capabilities(reply, props.roomId, props.consumerId, confirmed.stamp);
      if (declared?.length) {
        setBoard({...confirmed, capabilities:declared});
        setNotice(confirmed.paused ? "授权已保存；桌面恢复可用后读取。" : "本机授权已保存。");
      } else if (reply.status === "staleSession") {
        setBoard(null); setNotice("运行副本已变化，正在重新读取本机授权；新副本需要重新允许。");
      } else {
        setNotice("授权保存失败，已保留原授权。请稍后重试。");
      }
    } catch {
      if (epoch.current === ticket) setNotice("授权保存失败，已保留原授权。请确认 Core 正在运行。");
    } finally {
      if (epoch.current === ticket) { busy.current = false; setPending(false); }
    }
  };

  return <section aria-label="本机数据授权" className="space-y-2 rounded-lg border p-3">
    <h3 className="text-sm font-medium">4 · 本机数据授权</h3>
    <p className="text-xs text-muted-foreground">这些选择保存在本机，作品更新后需重新允许。</p>
    {board && <fieldset disabled={props.disabled || pending} className="grid gap-2 sm:grid-cols-2">
      {sources.map(([id, name]) => {
        const item = board.capabilities.find(value => value.capability === id);
        return item && <label key={id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" aria-label={"允许 "+name} checked={item.allowed} onChange={event => void change(id, event.target.checked)} />
          {name}
        </label>;
      })}
    </fieldset>}
    <p role="status" className="text-xs text-muted-foreground">{pending ? "正在保存本机授权…" : notice}</p>
  </section>;
}
