import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ChevronDown, ChevronUp, Grip, Layers3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROOM_CANVAS,
  WIDGET_PERMISSIONS,
  type Content,
  type Desk,
  type WidgetDefinition,
} from "@/lib/room-v2";
import type { DockConfig } from "@/lib/dock";
import {
  alignWidgetPlacements,
  avoidIconObstacles,
  clampPlacement,
  deskDockReserve,
  desktopIconGrid,
  snapPlacement,
  widgetPlacementObstacles,
  type WidgetAlignment,
} from "@/lib/widget-layout";
import { HotspotEditor, SceneCapabilityEditor } from "@/components/SceneCapabilityEditor";

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

interface DesktopCanvasEditorProps {
  desks: Desk[];
  activeDesk: number;
  roomDock: DockConfig;
  roomPath: string | null;
  selectedWidgetId: string | null;
  permissionReview: { declared: string[]; granted: string[]; current: boolean } | null;
  onPermissionChange: (approved: boolean) => void;
  onActiveDesk: (index: number) => void;
  onSelectWidget: (id: string | null) => void;
  onBeginChange: () => void;
  onDeskChange: (desk: Desk, message?: string) => void;
}

export function DesktopCanvasEditor({
  desks,
  activeDesk,
  roomDock,
  roomPath,
  selectedWidgetId,
  permissionReview,
  onPermissionChange,
  onActiveDesk,
  onSelectWidget,
  onBeginChange,
  onDeskChange,
}: DesktopCanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(selectedWidgetId ? [selectedWidgetId] : []));
  const desk = desks[activeDesk];
  const selected = desk?.widgets.find((widget) => widget.id === selectedWidgetId)
    ?? desk?.widgets.find((widget) => selectedIds.has(widget.id))
    ?? null;
  const selectedWidgets = desk?.widgets.filter((widget) => selectedIds.has(widget.id)) ?? [];
  const scene = !selected && desk?.background?.type === "html" ? desk.background : null;

  useEffect(() => {
    setSelectedIds(new Set());
    onSelectWidget(null);
  }, [activeDesk]);

  useEffect(() => {
    if (selectedWidgetId && !selectedIds.has(selectedWidgetId)) {
      setSelectedIds(new Set([selectedWidgetId]));
    }
  }, [selectedWidgetId]);

  if (!desk) return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">没有可编辑的 Desk</div>;
  const iconGrid = desktopIconGrid(desk.iconSize);
  const effectiveDock = { ...roomDock, ...desk.dock };

  const replaceWidget = (id: string, next: WidgetDefinition, message?: string) => {
    onDeskChange({ ...desk, widgets: desk.widgets.map((widget) => widget.id === id ? next : widget) }, message);
  };

  const replaceWidgets = (next: Map<string, WidgetDefinition>, message?: string) => {
    onDeskChange({ ...desk, widgets: desk.widgets.map((widget) => next.get(widget.id) ?? widget) }, message);
  };

  const selectWidget = (id: string | null, additive = false) => {
    if (!id) {
      setSelectedIds(new Set());
      onSelectWidget(null);
      return;
    }
    if (!additive) {
      setSelectedIds(new Set([id]));
      onSelectWidget(id);
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    onSelectWidget(next.has(id) ? id : [...next][0] ?? null);
  };

  const finishPlacement = (widgets: WidgetDefinition[], originWidgets: WidgetDefinition[]) => {
    const reserved = deskDockReserve(desk, roomDock);
    const avoided = avoidIconObstacles(
      desk.icons,
      widgetPlacementObstacles(widgets),
      iconGrid,
      reserved ? [{
        x: reserved.x - 40,
        y: reserved.y - 40,
        width: reserved.width + 80,
        height: reserved.height + 80,
      }] : []
    );
    if (!avoided.committed) {
      onDeskChange({ ...desk, widgets: originWidgets, icons: desk.icons }, "空间不足，Widget 已恢复原位");
      return false;
    }
    const detail = avoided.moved.length
      ? `Widget 已更新，并移动 ${avoided.moved.length} 个被遮挡图标`
      : "Widget 布局已更新";
    onDeskChange({ ...desk, widgets, icons: avoided.icons }, detail);
    return true;
  };

  const startPlacement = (event: ReactPointerEvent<HTMLButtonElement>, widget: WidgetDefinition, resize: boolean) => {
    if (event.button !== 0 || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    if (additive) {
      selectWidget(widget.id, true);
      return;
    }
    const dragIds = !resize && selectedIds.has(widget.id) ? new Set(selectedIds) : new Set([widget.id]);
    if (!selectedIds.has(widget.id)) selectWidget(widget.id);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / ROOM_CANVAS.width;
    const moving = desk.widgets.filter((item) => dragIds.has(item.id));
    const origins = new Map(moving.map((item) => [item.id, { ...item.placement }]));
    const origin = { ...widget.placement };
    const originWidgets = structuredClone(desk.widgets);
    const minX = Math.min(...moving.map((item) => item.placement.x));
    const minY = Math.min(...moving.map((item) => item.placement.y));
    const maxX = Math.max(...moving.map((item) => item.placement.x + item.placement.width));
    const maxY = Math.max(...moving.map((item) => item.placement.y + item.placement.height));
    let latest = desk.widgets;
    let started = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (move: PointerEvent) => {
      if (!started && Math.hypot(move.clientX - startX, move.clientY - startY) < 3) return;
      if (!started) {
        started = true;
        onBeginChange();
      }
      let dx = (move.clientX - startX) / scale;
      let dy = (move.clientY - startY) / scale;
      const updates = new Map<string, WidgetDefinition>();
      if (resize) {
        const placement = snapPlacement(
          clampPlacement({ ...origin, width: origin.width + dx, height: origin.height + dy }),
          desk.widgets.filter((item) => item.id !== widget.id).map((item) => item.placement),
        );
        updates.set(widget.id, { ...widget, placement });
      } else {
        dx = Math.min(Math.max(dx, -minX), ROOM_CANVAS.width - maxX);
        dy = Math.min(Math.max(dy, -minY), ROOM_CANVAS.height - maxY);
        const primary = snapPlacement(
          { ...origin, x: origin.x + dx, y: origin.y + dy },
          desk.widgets.filter((item) => !dragIds.has(item.id)).map((item) => item.placement),
        );
        dx += primary.x - (origin.x + dx);
        dy += primary.y - (origin.y + dy);
        for (const item of moving) {
          const itemOrigin = origins.get(item.id)!;
          updates.set(item.id, { ...item, placement: clampPlacement({ ...itemOrigin, x: itemOrigin.x + dx, y: itemOrigin.y + dy }) });
        }
      }
      latest = desk.widgets.map((item) => updates.get(item.id) ?? item);
      replaceWidgets(updates);
    };
    const removeListeners = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onCancel);
    };
    const finish = () => {
      removeListeners();
      if (started) finishPlacement(latest, originWidgets);
    };
    const onUp = () => finish();
    const onCancel = () => {
      removeListeners();
      if (started) onDeskChange({ ...desk, widgets: originWidgets, icons: desk.icons }, "已取消 Widget 布局调整");
    };
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

  const alignSelection = (alignment: WidgetAlignment) => {
    if (selectedWidgets.length < 2) return;
    onBeginChange();
    const placements = alignWidgetPlacements(selectedWidgets.map((item) => item.placement), alignment);
    replaceWidgets(new Map(selectedWidgets.map((item, index) => [item.id, { ...item, placement: placements[index] }])), "已对齐所选 Widget");
  };

  const moveSelectionToEdge = (front: boolean) => {
    if (!selectedWidgets.length) return;
    onBeginChange();
    const selected = new Set(selectedWidgets.map((item) => item.id));
    const ordered = desk.widgets.slice().sort((a, b) => a.placement.z - b.placement.z || a.id.localeCompare(b.id));
    const nextOrder = front
      ? [...ordered.filter((item) => !selected.has(item.id)), ...ordered.filter((item) => selected.has(item.id))]
      : [...ordered.filter((item) => selected.has(item.id)), ...ordered.filter((item) => !selected.has(item.id))];
    const updates = new Map(nextOrder.map((item, index) => [item.id, { ...item, placement: { ...item.placement, z: Math.min(255, index) } }]));
    replaceWidgets(updates, front ? "所选 Widget 已置顶" : "所选 Widget 已置底");
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2">
          {desks.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => { onActiveDesk(index); selectWidget(null); }}
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
            onPointerDown={() => selectWidget(null)}
            className="relative aspect-video max-h-full w-full max-w-[calc((100vh-15rem)*16/9)] overflow-hidden bg-black shadow-[0_18px_70px_rgba(0,0,0,.28)] ring-1 ring-border"
          >
            <Background content={desk.background} roomPath={roomPath} />
            {scene?.hotspots?.map((hotspot) => (
              <div
                key={`scene-${hotspot.id}`}
                className="pointer-events-none absolute z-[450] border border-dashed border-amber-300/90 bg-amber-300/10 text-[7px] text-amber-100"
                style={{
                  left: `${hotspot.placement.x / ROOM_CANVAS.width * 100}%`,
                  top: `${hotspot.placement.y / ROOM_CANVAS.height * 100}%`,
                  width: `${hotspot.placement.width / ROOM_CANVAS.width * 100}%`,
                  height: `${hotspot.placement.height / ROOM_CANVAS.height * 100}%`,
                }}
              >{hotspot.label}</div>
            ))}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:5%_8.888%]" />

            {desk.widgets.slice().sort((a, b) => a.placement.z - b.placement.z).map((widget) => {
              const placement = widget.placement;
              const isSelected = selectedIds.has(widget.id);
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
                  {isSelected && widget.hotspots.map((hotspot) => (
                    <span
                      key={hotspot.id}
                      className="pointer-events-none absolute border border-dashed border-amber-300/90 bg-amber-300/10 text-[7px] text-amber-100"
                      style={{
                        left: `${hotspot.placement.x / placement.width * 100}%`,
                        top: `${hotspot.placement.y / placement.height * 100}%`,
                        width: `${hotspot.placement.width / placement.width * 100}%`,
                        height: `${hotspot.placement.height / placement.height * 100}%`,
                        zIndex: 260,
                      }}
                    >{hotspot.label}</span>
                  ))}
                </div>
              );
            })}

            {desk.icons.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="pointer-events-none absolute z-[300] flex w-[5%] flex-col items-center gap-1 text-white drop-shadow"
                style={{ left: `${(40 + (item.x ?? 0) * iconGrid.cellWidth) / ROOM_CANVAS.width * 100}%`, top: `${(40 + (item.y ?? 0) * iconGrid.cellHeight) / ROOM_CANVAS.height * 100}%` }}
              >
                {item.icon_png ? <img src={`data:image/png;base64,${item.icon_png}`} alt="" className="aspect-square w-[58%] object-contain" /> : <span className="flex aspect-square w-[58%] items-center justify-center rounded-md bg-slate-700 text-[10px]">{item.glyph ?? "?"}</span>}
                <span className="max-w-full truncate text-[8px]">{item.label}</span>
              </div>
            ))}

            <div className={`pointer-events-none absolute z-[400] rounded-full border border-white/15 bg-black/55 backdrop-blur ${effectiveDock.position === "top" ? "left-1/2 top-[2%] h-[7%] w-[34%] -translate-x-1/2" : effectiveDock.position === "left" ? "bottom-[10%] left-[1.5%] top-[10%] w-[6%]" : effectiveDock.position === "right" ? "bottom-[10%] right-[1.5%] top-[10%] w-[6%]" : "bottom-[2%] left-1/2 h-[7%] w-[34%] -translate-x-1/2"}`} />
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-border pl-3">
        <div className="flex items-center gap-2 pb-3">
          <Layers3 className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-medium">{selectedWidgets.length > 1 ? `已选择 ${selectedWidgets.length} 个 Widget` : selected?.name ?? desk.name}</div>
            <div className="text-[11px] text-muted-foreground">{selected ? selectedWidgets.length > 1 ? "多选布局" : "Widget 实例" : `${desk.widgets.length} Widget · ${desk.icons.length} 图标`}</div>
          </div>
        </div>
        {selected ? (
          <div className="space-y-4">
            {selectedWidgets.length > 1 && (
              <div className="space-y-2 rounded-md border border-border p-2">
                <div className="text-[11px] font-medium">多选对齐</div>
                <div className="grid grid-cols-3 gap-1">
                  <Button variant="outline" size="icon" title="左对齐" onClick={() => alignSelection("left")}><AlignStartVertical /></Button>
                  <Button variant="outline" size="icon" title="水平居中" onClick={() => alignSelection("center-x")}><AlignCenterVertical /></Button>
                  <Button variant="outline" size="icon" title="右对齐" onClick={() => alignSelection("right")}><AlignEndVertical /></Button>
                  <Button variant="outline" size="icon" title="顶对齐" onClick={() => alignSelection("top")}><AlignStartHorizontal /></Button>
                  <Button variant="outline" size="icon" title="垂直居中" onClick={() => alignSelection("center-y")}><AlignCenterHorizontal /></Button>
                  <Button variant="outline" size="icon" title="底对齐" onClick={() => alignSelection("bottom")}><AlignEndHorizontal /></Button>
                </div>
              </div>
            )}
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
                <Button variant="outline" size="sm" onClick={() => moveSelectionToEdge(false)}>置底</Button>
                <Button variant="outline" size="sm" onClick={() => moveSelectionToEdge(true)}>置顶</Button>
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
                    return (
                      <label key={permission} className="flex items-center gap-2 text-[10px] text-muted-foreground" title={permission}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            onBeginChange();
                            const permissions = event.target.checked
                              ? [...selected.permissions, permission]
                              : selected.permissions.filter((item) => item !== permission);
                            replaceWidget(selected.id, { ...selected, permissions }, "Widget 能力声明已更新；分享导入后仍需本机授权");
                          }}
                        />
                        <span className="truncate">{permission}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
              <div className="mt-2">
                <HotspotEditor
                  hotspots={selected.hotspots}
                  bounds={{ width: selected.placement.width, height: selected.placement.height }}
                  onBeginChange={onBeginChange}
                  onChange={(hotspots) => replaceWidget(selected.id, {
                    ...selected,
                    hotspots,
                    permissions: hotspots.length && !selected.permissions.includes("action.invoke")
                      ? [...selected.permissions, "action.invoke"]
                      : selected.permissions,
                  }, "Widget 可信热点已更新")}
                />
              </div>
              <div className="mt-2 rounded-md border border-border p-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">本机运行授权</span>
                  <span className={permissionReview?.current && permissionReview.granted.length === permissionReview.declared.length ? "text-emerald-500" : "text-amber-500"}>
                    {permissionReview?.current && permissionReview.granted.length === permissionReview.declared.length ? "当前版本已批准" : "未批准或已失效"}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-muted-foreground">授权仅保存在本机；Room 内容变化或重新导入后自动失效，不会写入分享包。</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => onPermissionChange(true)} disabled={!selected.permissions.length}>批准声明</Button>
                  <Button variant="outline" size="sm" onClick={() => onPermissionChange(false)}>撤销</Button>
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <div className="truncate font-mono text-[10px] text-muted-foreground" title={selected.src}>{selected.src}</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full text-destructive hover:text-destructive"
                onClick={() => {
                  onBeginChange();
                  const removing = new Set(selectedWidgets.map((widget) => widget.id));
                  onDeskChange({ ...desk, widgets: desk.widgets.filter((widget) => !removing.has(widget.id)) }, selectedWidgets.length > 1 ? `已移除 ${selectedWidgets.length} 个 Widget` : `已移除 Widget「${selected.name}」`);
                  selectWidget(null);
                }}
              >
                <Trash2 /> {selectedWidgets.length > 1 ? `删除 ${selectedWidgets.length} 个 Widget` : "删除 Widget"}
              </Button>
            </div>
          </div>
        ) : scene ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Scene 的 HTML/CSS/Canvas 构图保持自由；这里只声明受控数据与官方命中热点。</p>
            <SceneCapabilityEditor
              scene={scene}
              permissionReview={permissionReview}
              onPermissionChange={onPermissionChange}
              onBeginChange={onBeginChange}
              onSceneChange={(next, message) => onDeskChange({ ...desk, background: next }, message)}
            />
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
