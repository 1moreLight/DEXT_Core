import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Grip, Layers3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROOM_CANVAS, WIDGET_PERMISSIONS, type Content, type Desk, type WidgetDefinition } from "@/lib/room-v2";
import { avoidIconObstacles, clampPlacement, type Rect } from "@/lib/widget-layout";

const ICON_GRID = { cellWidth: 96, cellHeight: 120, columns: 19, rows: 7 } as const;

function assetUrl(roomPath: string | null, src: string) {
  const roomName = roomPath?.split(/[\\/]/).filter(Boolean).pop();
  return roomName
    ? `http://lib.localhost/${encodeURIComponent(roomName)}/${src.split("/").map(encodeURIComponent).join("/")}`
    : "";
}

function Background({ content, roomPath }: { content: Content | null; roomPath: string | null }) {
  if (!content) return <div className="absolute inset-0 bg-black" />;
  const src = assetUrl(roomPath, content.src);
  if (content.type === "image") return <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  if (content.type === "video") return <video src={src} muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />;
  return <iframe src={src} title={content.name} sandbox="allow-scripts" className="pointer-events-none absolute inset-0 h-full w-full border-0" />;
}

function dockReserve(desk: Desk): Rect | null {
  const dock = desk.dock;
  if (dock?.enabled === false) return null;
  const position = dock?.position ?? "bottom";
  if (position === "top") return { x: 0, y: 0, width: ROOM_CANVAS.width, height: 100 };
  if (position === "left") return { x: 0, y: 0, width: 120, height: ROOM_CANVAS.height };
  if (position === "right") return { x: ROOM_CANVAS.width - 120, y: 0, width: 120, height: ROOM_CANVAS.height };
  return { x: 0, y: ROOM_CANVAS.height - 100, width: ROOM_CANVAS.width, height: 100 };
}

function placementObstacles(widgets: WidgetDefinition[]): Rect[] {
  return widgets.map(({ placement }) => ({
    x: placement.x - 40,
    y: placement.y - 40,
    width: placement.width,
    height: placement.height,
  }));
}

interface DesktopCanvasEditorProps {
  desks: Desk[];
  activeDesk: number;
  roomPath: string | null;
  selectedWidgetId: string | null;
  onActiveDesk: (index: number) => void;
  onSelectWidget: (id: string | null) => void;
  onBeginChange: () => void;
  onDeskChange: (desk: Desk, message?: string) => void;
}

export function DesktopCanvasEditor({
  desks,
  activeDesk,
  roomPath,
  selectedWidgetId,
  onActiveDesk,
  onSelectWidget,
  onBeginChange,
  onDeskChange,
}: DesktopCanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const desk = desks[activeDesk];
  const selected = desk?.widgets.find((widget) => widget.id === selectedWidgetId) ?? null;

  if (!desk) return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">没有可编辑的 Desk</div>;

  const replaceWidget = (id: string, next: WidgetDefinition, message?: string) => {
    onDeskChange({ ...desk, widgets: desk.widgets.map((widget) => widget.id === id ? next : widget) }, message);
  };

  const finishPlacement = (id: string, next: WidgetDefinition) => {
    const widgets = desk.widgets.map((widget) => widget.id === id ? next : widget);
    const reserved = dockReserve(desk);
    const avoided = avoidIconObstacles(
      desk.icons,
      placementObstacles(widgets),
      ICON_GRID,
      reserved ? [{ ...reserved, x: reserved.x - 40, y: reserved.y - 40 }] : []
    );
    const detail = avoided.unresolved.length
      ? `Widget 已更新；${avoided.unresolved.length} 个图标没有合法避让位置`
      : avoided.moved.length
        ? `Widget 已更新，并移动 ${avoided.moved.length} 个被遮挡图标`
        : "Widget 布局已更新";
    onDeskChange({ ...desk, widgets, icons: avoided.icons }, detail);
  };

  const startPlacement = (event: ReactPointerEvent<HTMLButtonElement>, widget: WidgetDefinition, resize: boolean) => {
    if (event.button !== 0 || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectWidget(widget.id);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / ROOM_CANVAS.width;
    const origin = { ...widget.placement };
    let latest = widget;
    let started = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (move: PointerEvent) => {
      if (!started && Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return;
      if (!started) {
        started = true;
        onBeginChange();
      }
      const dx = (move.clientX - startX) / scale;
      const dy = (move.clientY - startY) / scale;
      const placement = clampPlacement(resize
        ? { ...origin, width: origin.width + dx, height: origin.height + dy }
        : { ...origin, x: origin.x + dx, y: origin.y + dy });
      latest = { ...widget, placement };
      replaceWidget(widget.id, latest);
    };
    const finish = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onCancel);
      if (started) finishPlacement(widget.id, latest);
    };
    const onUp = () => finish();
    const onCancel = () => finish();
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onCancel);
  };

  const patchPlacement = (patch: Partial<WidgetDefinition["placement"]>) => {
    if (!selected) return;
    replaceWidget(selected.id, { ...selected, placement: clampPlacement({ ...selected.placement, ...patch }) });
  };

  const moveLayer = (delta: number) => {
    if (!selected) return;
    onBeginChange();
    const z = Math.min(255, Math.max(0, selected.placement.z + delta));
    replaceWidget(selected.id, { ...selected, placement: { ...selected.placement, z } }, delta > 0 ? "Widget 已上移一层" : "Widget 已下移一层");
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2">
          {desks.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => { onActiveDesk(index); onSelectWidget(null); }}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors ${index === activeDesk ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {item.name} <span className="opacity-65">· {item.widgets.length}</span>
            </button>
          ))}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">1920 × 1080 逻辑画布</span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/35 p-4">
          <div
            ref={canvasRef}
            role="application"
            aria-label={`${desk.name} 桌面画布`}
            onPointerDown={() => onSelectWidget(null)}
            className="relative aspect-video max-h-full w-full max-w-[calc((100vh-15rem)*16/9)] overflow-hidden bg-black shadow-[0_18px_70px_rgba(0,0,0,.28)] ring-1 ring-border"
          >
            <Background content={desk.background} roomPath={roomPath} />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:5%_8.888%]" />

            {desk.widgets.slice().sort((a, b) => a.placement.z - b.placement.z).map((widget) => {
              const placement = widget.placement;
              const isSelected = widget.id === selectedWidgetId;
              return (
                <div
                  key={widget.id}
                  className={`group absolute overflow-hidden bg-slate-950/75 ${isSelected ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-black/40" : "ring-1 ring-white/10"}`}
                  style={{
                    left: `${placement.x / ROOM_CANVAS.width * 100}%`,
                    top: `${placement.y / ROOM_CANVAS.height * 100}%`,
                    width: `${placement.width / ROOM_CANVAS.width * 100}%`,
                    height: `${placement.height / ROOM_CANVAS.height * 100}%`,
                    zIndex: placement.z,
                  }}
                >
                  <iframe
                    src={assetUrl(roomPath, widget.src)}
                    title={widget.name}
                    sandbox="allow-scripts"
                    className="pointer-events-none h-full w-full border-0"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,.18),transparent_45%)] text-[10px] font-medium text-white/55">
                    {widget.name}
                  </div>
                  <button
                    type="button"
                    aria-label={`移动 ${widget.name}`}
                    onPointerDown={(event) => startPlacement(event, widget, false)}
                    className="absolute inset-0 cursor-move bg-transparent outline-none"
                  />
                  {isSelected && (
                    <button
                      type="button"
                      aria-label={`缩放 ${widget.name}`}
                      onPointerDown={(event) => startPlacement(event, widget, true)}
                      className="absolute bottom-0 right-0 flex h-5 w-5 cursor-nwse-resize items-center justify-center bg-cyan-400 text-slate-950"
                    >
                      <Grip className="h-3 w-3" />
                    </button>
                  )}
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {widget.name}
                  </span>
                </div>
              );
            })}

            {desk.icons.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="pointer-events-none absolute z-[300] flex w-[5%] flex-col items-center gap-1 text-white drop-shadow"
                style={{ left: `${(40 + (item.x ?? 0) * ICON_GRID.cellWidth) / ROOM_CANVAS.width * 100}%`, top: `${(40 + (item.y ?? 0) * ICON_GRID.cellHeight) / ROOM_CANVAS.height * 100}%` }}
              >
                {item.icon_png ? <img src={`data:image/png;base64,${item.icon_png}`} alt="" className="aspect-square w-[58%] object-contain" /> : <span className="flex aspect-square w-[58%] items-center justify-center rounded-md bg-slate-700 text-[10px]">{item.glyph ?? "?"}</span>}
                <span className="max-w-full truncate text-[8px]">{item.label}</span>
              </div>
            ))}

            <div className={`pointer-events-none absolute z-[400] rounded-full border border-white/15 bg-black/55 backdrop-blur ${desk.dock?.position === "top" ? "left-1/2 top-[2%] h-[7%] w-[34%] -translate-x-1/2" : desk.dock?.position === "left" ? "bottom-[10%] left-[1.5%] top-[10%] w-[6%]" : desk.dock?.position === "right" ? "bottom-[10%] right-[1.5%] top-[10%] w-[6%]" : "bottom-[2%] left-1/2 h-[7%] w-[34%] -translate-x-1/2"}`} />
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-border pl-3">
        <div className="flex items-center gap-2 pb-3">
          <Layers3 className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-medium">{selected?.name ?? desk.name}</div>
            <div className="text-[11px] text-muted-foreground">{selected ? "Widget 实例" : `${desk.widgets.length} Widget · ${desk.icons.length} 图标`}</div>
          </div>
        </div>
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key} className="text-[11px] text-muted-foreground">
                  {key}
                  <Input
                    type="number"
                    min={key === "width" || key === "height" ? 64 : 0}
                    value={selected.placement[key]}
                    onFocus={onBeginChange}
                    onChange={(event) => patchPlacement({ [key]: Number(event.target.value) })}
                    className="mt-1 h-8"
                  />
                </label>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>层级</span><span>{selected.placement.z}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => moveLayer(-1)}><ChevronDown /> 下移</Button>
                <Button variant="outline" size="sm" onClick={() => moveLayer(1)}><ChevronUp /> 上移</Button>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-muted-foreground">能力声明</div>
              <div className="flex flex-wrap gap-1">
                {selected.permissions.length ? selected.permissions.map((permission) => <span key={permission} className="rounded bg-muted px-1.5 py-1 text-[10px]">{permission}</span>) : <span className="text-xs text-muted-foreground">无</span>}
              </div>
              <details className="mt-2 rounded-md border border-border">
                <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium">审阅和修改声明</summary>
                <div className="max-h-44 space-y-1 overflow-y-auto border-t border-border p-2">
                  {WIDGET_PERMISSIONS.map((permission) => {
                    const checked = selected.permissions.includes(permission);
                    const unavailable = permission === "network.proxy";
                    return (
                      <label key={permission} className={`flex items-center gap-2 text-[10px] ${unavailable ? "text-muted-foreground/55" : "text-muted-foreground"}`} title={unavailable ? "本工作包保持离线，不开放代理联网" : permission}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={unavailable}
                          onChange={(event) => {
                            onBeginChange();
                            const permissions = event.target.checked
                              ? [...selected.permissions, permission]
                              : selected.permissions.filter((item) => item !== permission);
                            replaceWidget(selected.id, { ...selected, permissions }, "Widget 能力声明已更新；分享导入后仍需本机授权");
                          }}
                        />
                        <span className="truncate">{permission}</span>
                        {unavailable && <span className="ml-auto">离线</span>}
                      </label>
                    );
                  })}
                </div>
              </details>
            </div>
            <div className="border-t border-border pt-3">
              <div className="truncate font-mono text-[10px] text-muted-foreground" title={selected.src}>{selected.src}</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full text-destructive hover:text-destructive"
                onClick={() => {
                  onBeginChange();
                  onDeskChange({ ...desk, widgets: desk.widgets.filter((widget) => widget.id !== selected.id) }, `已移除 Widget「${selected.name}」`);
                  onSelectWidget(null);
                }}
              >
                <Trash2 /> 删除 Widget
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>选择画布中的 Widget 后编辑位置、尺寸、层级和权限。</p>
            <p>Scene 内部构图仍由 HTML/CSS/Canvas 自由决定，不会被强制拆成卡片。</p>
          </div>
        )}
      </aside>
    </div>
  );
}
