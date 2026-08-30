import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MonitorPlay } from "lucide-react";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type RoomPreviewFrameProps = {
  roomPath: string | null;
  deskIndex?: number;
  className?: string;
  label?: string;
};

export function RoomPreviewFrame({
  roomPath,
  deskIndex = 0,
  className = "",
  label = "Room 预览",
}: RoomPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setRoom(null);
    setError(null);
    if (!roomPath || !IS_TAURI) return;
    invoke<string>("read_room", { path: `${roomPath}\\room.json` })
      .then((text) => {
        if (!disposed) setRoom(JSON.parse(text) as Record<string, unknown>);
      })
      .catch((reason) => {
        if (!disposed) setError(`预览读取失败：${String(reason)}`);
      });
    return () => {
      disposed = true;
    };
  }, [roomPath]);

  const postRoom = useCallback(() => {
    if (!roomPath || !room) return;
    const roomName = roomPath.split(/[\\/]/).filter(Boolean).pop();
    if (!roomName) return;
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "dext:room",
        room,
        deskIndex,
        assetBase: `http://lib.localhost/${encodeURIComponent(roomName)}/`,
      },
      "http://dext.localhost"
    );
  }, [deskIndex, room, roomPath]);

  useEffect(() => postRoom(), [postRoom]);

  return (
    <div
      className={`relative aspect-video overflow-hidden border border-border bg-muted/40 ${className}`}
      aria-label={label}
    >
      {IS_TAURI && roomPath ? (
        <iframe
          ref={frameRef}
          src="http://dext.localhost/index.html?preview=1"
          onLoad={postRoom}
          title={label}
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <MonitorPlay className="h-7 w-7" />
          <span className="text-xs">{roomPath ? "UI 设计模式预览" : "选择 Room 后显示预览"}</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-4 text-center text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
