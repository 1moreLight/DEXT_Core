import { useRef, useState } from "react";
import { Code, Film } from "lucide-react";
import type { Content } from "@/lib/room-v2";
import type { AppInfo, CoverRef, RoomInfo } from "@/features/runtime/types";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function AppIcon({ app, size = "h-10 w-10" }: { app: AppInfo; size?: string }) {
  return app.icon_png ? (
    <img src={`data:image/png;base64,${app.icon_png}`} alt="" className={size} />
  ) : (
    <div className={`${size} rounded bg-muted`} />
  );
}

export type CoverTile =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string }
  | { kind: "gradient"; from: string; to: string };

const GRADIENTS: [string, string][] = [
  ["#0f172a", "#334155"],
  ["#1e1b4b", "#6d28d9"],
  ["#064e3b", "#0f766e"],
  ["#7c2d12", "#c2410c"],
  ["#831843", "#be185d"],
  ["#082f49", "#0369a1"],
];

function nameGradient(name: string): CoverTile {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return { kind: "gradient", from, to };
}

function coverTileOf(cover: CoverRef, room: RoomInfo): CoverTile {
  const url = IS_TAURI && cover.src
    ? `http://lib.localhost/${encodeURIComponent(room.name)}/${cover.src.split(/[\\/]/).map(encodeURIComponent).join("/")}`
    : "";
  if (cover.kind === "video") return { kind: "video", url };
  return url ? { kind: "image", url } : nameGradient(room.name);
}

export function roomCovers(room: RoomInfo): CoverTile[] {
  const tiles = (room.covers ?? []).map((cover) => coverTileOf(cover, room));
  return tiles.length ? tiles : [nameGradient(room.name)];
}

export function RoomBackgroundPreview({ room, className = "", label }: { room: RoomInfo; className?: string; label: string }) {
  return (
    <div className={`aspect-video overflow-hidden border border-border bg-muted/40 ${className}`} aria-label={label}>
      <CoverTileBox tile={roomCovers(room)[0]} autoPlay />
    </div>
  );
}

function VideoTile({ url, autoPlay = false }: { url: string; autoPlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  if (!url) {
    return <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-black"><Film className="h-5 w-5 text-white/40" /></div>;
  }
  return (
    <video
      ref={ref}
      src={url}
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload={autoPlay ? "auto" : "metadata"}
      className="h-full w-full object-cover"
      onMouseEnter={autoPlay ? undefined : () => { ref.current?.play().catch(() => {}); }}
      onMouseLeave={autoPlay ? undefined : () => {
        const video = ref.current;
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
      }}
    />
  );
}

function CoverTileBox({ tile, autoPlay = false }: { tile: CoverTile; autoPlay?: boolean }) {
  if (tile.kind === "gradient") return <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${tile.from}, ${tile.to})` }} />;
  if (tile.kind === "video") return <VideoTile url={tile.url} autoPlay={autoPlay} />;
  return <img src={tile.url} alt="" draggable={false} className="h-full w-full object-cover" />;
}

export function CoverStack({ tiles, autoPlayMain = false }: { tiles: CoverTile[]; autoPlayMain?: boolean }) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, tiles.length - 1);
  const base = tiles[safeIndex];
  const piled = tiles.filter((_, tileIndex) => tileIndex !== safeIndex).slice(0, 2);
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <CoverTileBox tile={base} autoPlay={autoPlayMain} />
      {piled.length > 0 && (
        <div className="absolute inset-0 flex items-end justify-end p-[4%]">
          {piled.map((tile, pileIndex) => {
            const realIndex = tiles.indexOf(tile);
            return (
              <div
                key={realIndex}
                role="button"
                onClick={(event) => { event.stopPropagation(); setIndex(realIndex); }}
                title="点击换到主展示位"
                className="w-[30%] aspect-video cursor-pointer overflow-hidden rounded-md border border-white/90 bg-black shadow-lg transition-transform hover:scale-105"
                style={{
                  transform: `rotate(${(pileIndex - (piled.length - 1) / 2) * 5}deg)`,
                  marginLeft: pileIndex > 0 ? "-8%" : undefined,
                  zIndex: piled.length - pileIndex,
                }}
              >
                <CoverTileBox tile={tile} />
              </div>
            );
          })}
        </div>
      )}
      {tiles.length > 1 + piled.length && <span className="absolute bottom-[5%] left-[3.5%] rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">+{tiles.length - 1 - piled.length}</span>}
    </div>
  );
}

function roomContentUrl(content: Content | null, roomPath: string | null): string {
  const roomName = roomPath?.split(/[\\/]/).filter(Boolean).pop();
  return content && roomName
    ? `http://lib.localhost/${encodeURIComponent(roomName)}/${content.src.split("/").map(encodeURIComponent).join("/")}`
    : "";
}

export function ContentInspector({ content, roomPath, emptyLabel }: { content: Content | null; roomPath: string | null; emptyLabel: string }) {
  const url = roomContentUrl(content, roomPath);
  const typeLabel = content?.type === "image" ? "图片" : content?.type === "video" ? "视频" : content?.type === "html" ? "HTML" : "未选择";
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex aspect-video w-44 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {!content ? <span className="px-3 text-center text-[11px] text-muted-foreground">{emptyLabel}</span>
          : content.type === "image" ? <img src={url} alt={content.name} className="h-full w-full object-cover" />
          : content.type === "video" ? <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          : <div className="flex flex-col items-center gap-1 text-muted-foreground"><Code className="h-5 w-5" /><span className="text-[10px]">HTML 场景</span></div>}
      </div>
      <dl className="min-w-0 max-w-44 space-y-1 text-[11px]">
        <div><dt className="text-muted-foreground">素材</dt><dd className="truncate font-medium" title={content?.name}>{content?.name ?? "未选择"}</dd></div>
        <div><dt className="text-muted-foreground">路径</dt><dd className="truncate font-mono" title={content?.src}>{content?.src ?? "—"}</dd></div>
        <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${content ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" /><span>{typeLabel}</span></div>
      </dl>
    </div>
  );
}
