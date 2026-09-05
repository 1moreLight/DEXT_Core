import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROOM_CANVAS,
  SYSTEM_ACTION_IDS,
  WIDGET_PERMISSIONS,
  type Content,
  type TrustedHotspot,
} from "@/lib/room-v2";

export interface PermissionReviewView {
  declared: string[];
  granted: string[];
  current: boolean;
}

export function HotspotEditor({
  hotspots,
  bounds,
  onBeginChange,
  onChange,
}: {
  hotspots: TrustedHotspot[];
  bounds: { width: number; height: number };
  onBeginChange: () => void;
  onChange: (hotspots: TrustedHotspot[]) => void;
}) {
  const patch = (index: number, next: TrustedHotspot) => {
    onBeginChange();
    onChange(hotspots.map((item, itemIndex) => itemIndex === index ? next : item));
  };
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium">可信热点 · {hotspots.length}</summary>
      <div className="space-y-2 border-t border-border p-2">
        {hotspots.map((hotspot, index) => (
          <div key={hotspot.id} className="space-y-1.5 rounded border border-border/70 p-2">
            <div className="flex items-center gap-1">
              <Input value={hotspot.label} onFocus={onBeginChange} onChange={(event) => patch(index, { ...hotspot, label: event.target.value })} className="h-7 text-[10px]" aria-label="热点名称" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onBeginChange(); onChange(hotspots.filter((_, itemIndex) => itemIndex !== index)); }}><Trash2 className="h-3 w-3" /></Button>
            </div>
            <select
              value={hotspot.action.id}
              onChange={(event) => {
                const id = event.target.value as TrustedHotspot["action"]["id"];
                patch(index, { ...hotspot, action: id === "system.volume.set" ? { id, value: 0.5 } : id === "system.volume.mute" ? { id, value: true } : { id } });
              }}
              className="h-7 w-full rounded border border-input bg-background px-2 text-[10px]"
            >
              {SYSTEM_ACTION_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
            {hotspot.action.id === "system.volume.set" && (
              <Input type="number" min={0} max={1} step={0.05} value={Number(hotspot.action.value)} onFocus={onBeginChange} onChange={(event) => patch(index, { ...hotspot, action: { id: "system.volume.set", value: Math.min(1, Math.max(0, Number(event.target.value))) } })} className="h-7 text-[10px]" />
            )}
            {hotspot.action.id === "system.volume.mute" && (
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground"><input type="checkbox" checked={Boolean(hotspot.action.value)} onChange={(event) => patch(index, { ...hotspot, action: { id: "system.volume.mute", value: event.target.checked } })} />静音</label>
            )}
            <div className="grid grid-cols-4 gap-1">
              {(["x", "y", "width", "height"] as const).map((key) => (
                <label key={key} className="text-[9px] text-muted-foreground">{key}
                  <Input
                    type="number"
                    min={key === "width" || key === "height" ? 16 : 0}
                    max={key === "x" || key === "width" ? bounds.width : bounds.height}
                    value={hotspot.placement[key]}
                    onFocus={onBeginChange}
                    onChange={(event) => {
                      const value = Math.round(Number(event.target.value));
                      const placement = { ...hotspot.placement, [key]: value };
                      placement.width = Math.min(Math.max(16, placement.width), bounds.width);
                      placement.height = Math.min(Math.max(16, placement.height), bounds.height);
                      placement.x = Math.min(Math.max(0, placement.x), bounds.width - placement.width);
                      placement.y = Math.min(Math.max(0, placement.y), bounds.height - placement.height);
                      patch(index, { ...hotspot, placement });
                    }}
                    className="mt-0.5 h-6 px-1 text-[9px]"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={hotspots.length >= 64}
          onClick={() => {
            onBeginChange();
            let suffix = hotspots.length + 1;
            while (hotspots.some((item) => item.id === `hotspot-${suffix}`)) suffix += 1;
            onChange([...hotspots, {
              id: `hotspot-${suffix}`,
              label: `热点 ${suffix}`,
              placement: { x: 0, y: 0, width: Math.min(160, bounds.width), height: Math.min(64, bounds.height), z: 1 },
              action: { id: "system.media.toggle-play-pause" },
            }]);
          }}
        ><span className="text-sm leading-none">＋</span> 添加热点</Button>
      </div>
    </details>
  );
}

export function SceneCapabilityEditor({
  scene,
  permissionReview,
  onPermissionChange,
  onBeginChange,
  onSceneChange,
  compact = false,
}: {
  scene: Content;
  permissionReview: PermissionReviewView | null;
  onPermissionChange: (approved: boolean) => void;
  onBeginChange: () => void;
  onSceneChange: (scene: Content, message: string) => void;
  compact?: boolean;
}) {
  if (scene.type !== "html") {
    return <p className="text-[11px] text-muted-foreground">图片和视频不执行作者代码，因此没有系统能力或可信热点。</p>;
  }
  const permissions = scene.permissions ?? [];
  return (
    <div className={compact ? "grid gap-3 lg:grid-cols-3" : "space-y-3"}>
      <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium">Scene 能力声明 · {permissions.length}</summary>
        <div className="max-h-52 space-y-1 overflow-y-auto border-t border-border p-2">
          {WIDGET_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={permissions.includes(permission)}
                onChange={(event) => {
                  onBeginChange();
                  const next = event.target.checked ? [...permissions, permission] : permissions.filter((item) => item !== permission);
                  onSceneChange({ ...scene, permissions: next }, "Scene 能力声明已更新；需要重新授权");
                }}
              />
              {permission}
            </label>
          ))}
        </div>
      </details>
      <HotspotEditor
        hotspots={scene.hotspots ?? []}
        bounds={ROOM_CANVAS}
        onBeginChange={onBeginChange}
        onChange={(hotspots) => onSceneChange({
          ...scene,
          hotspots,
          permissions: hotspots.length && !permissions.includes("action.invoke") ? [...permissions, "action.invoke"] : permissions,
        }, "Scene 可信热点已更新")}
      />
      <div className="rounded-md border border-border p-2 text-[10px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">本机运行授权</span>
          <span className={permissionReview?.current && permissionReview.granted.length === permissionReview.declared.length ? "text-emerald-500" : "text-amber-500"}>
            {permissionReview?.current && permissionReview.granted.length === permissionReview.declared.length ? "当前版本已批准" : "未批准或已失效"}
          </span>
        </div>
        <p className="mt-1 leading-relaxed text-muted-foreground">仅保存在本机；Scene 或 Room 内容变化后自动失效。</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onPermissionChange(true)} disabled={!permissions.length}>批准声明</Button>
          <Button variant="outline" size="sm" onClick={() => onPermissionChange(false)}>撤销</Button>
        </div>
      </div>
    </div>
  );
}
