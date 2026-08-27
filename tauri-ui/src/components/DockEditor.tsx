import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import {
  type DockConfig,
  type DockIconItem,
  DEFAULT_DOCK_STYLE,
  DOCK_SKIN_PRESETS,
} from "@/lib/dock";

interface DockEditorProps {
  dock: DockConfig;
  setDock: (d: DockConfig) => void;
  // Desk[] 与最小结构间存在逆变问题，用 any[] 保持与 App 的 setDesks 直接可赋值
  desks: any[];
  setDesks: React.Dispatch<React.SetStateAction<any[]>>;
  activeDesk: number;
  touch: () => void;
  setStatus: (s: string) => void;
}

const DOCK_POSITION_LABELS: Record<string, string> = {
  bottom: "底部",
  top: "顶部",
  left: "左侧",
  right: "右侧",
};

// 小的本地控件（项目只有 Button/Input 两个原件，YAGNI 不引入 Select/Switch 依赖）
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DockEditor({ dock, setDock, desks, setDesks, activeDesk, touch, setStatus }: DockEditorProps) {
  // 本地草稿状态；父组件的 dock/desks 变化（开房间/切桌/预览回写）时同步进来
  const [globalDock, setGlobalDock] = useState<DockConfig>(dock);
  const [deskDocks, setDeskDocks] = useState<DockConfig[]>(desks.map((d) => d.dock ?? {}));
  const [skin, setSkin] = useState<string>(() => localStorage.getItem("dext.dockSkin") ?? "hud");

  useEffect(() => setGlobalDock(dock), [dock]);
  useEffect(() => setDeskDocks(desks.map((d) => d.dock ?? {})), [desks]);

  const deskDock = deskDocks[activeDesk] ?? {};
  const deskStyle = deskDock.style ?? {};
  const gStyle = globalDock.style ?? {};

  function saveGlobal() {
    setDock(globalDock);
    touch();
    setStatus("全局 Dock 配置已保存");
  }

  // ---- 每桌覆盖：写回父级 desks（这样 room.json 保存时能带上 desks[i].dock）----
  function updateDesk(patch: Partial<DockConfig>) {
    const next = { ...deskDock, ...patch };
    setDeskDocks((prev) => prev.map((d, i) => (i === activeDesk ? next : d)));
    setDesks((prev) => prev.map((d, i) => (i === activeDesk ? { ...d, dock: next } : d)));
    touch();
  }

  function updateDeskStyle(patch: Partial<NonNullable<DockConfig["style"]>>) {
    updateDesk({ style: { ...deskStyle, ...patch } });
  }

  function addDeskIcon() {
    const icons = [...(deskDock.icons ?? []), { label: "新图标", glyph: "?", color: "#3b82f6" }];
    updateDesk({ icons });
  }

  function patchDeskIcon(i: number, patch: Partial<DockIconItem>) {
    const icons = (deskDock.icons ?? []).map((ic, j) => (j === i ? { ...ic, ...patch } : ic));
    updateDesk({ icons });
  }

  function removeDeskIcon(i: number) {
    const icons = (deskDock.icons ?? []).filter((_, j) => j !== i);
    updateDesk({ icons });
  }

  function applySkin(name: string) {
    setSkin(name);
    localStorage.setItem("dext.dockSkin", name);
    setStatus(`皮肤「${name}」已选中；把 DOCK_SKIN_PRESETS.${name} 的片段贴进房间 room.css 生效（导出房间会自动带上）`);
    touch();
  }

  const selCls =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

  return (
    <div className="max-w-2xl space-y-5 overflow-y-auto p-1">
      {/* ── 全局 Dock ── */}
      <section className="space-y-2">
        <h3 className="font-medium">全局 Dock 设置（所有桌默认）</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="位置">
            <select
              className={selCls}
              value={globalDock.position ?? "bottom"}
              onChange={(e) => setGlobalDock({ ...globalDock, position: e.target.value as DockConfig["position"] })}
            >
              {Object.entries(DOCK_POSITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="指示器">
            <select
              className={selCls}
              value={globalDock.indicator ?? "text"}
              onChange={(e) => setGlobalDock({ ...globalDock, indicator: e.target.value as "text" | "dots" })}
            >
              <option value="text">文字 1/3</option>
              <option value="dots">圆点</option>
            </select>
          </Field>
          <Field label="自动隐藏（Apple 式）">
            <label className="flex h-8 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!globalDock.autoHide}
                onChange={(e) => setGlobalDock({ ...globalDock, autoHide: e.target.checked })}
              />
              {globalDock.autoHide ? "开启" : "关闭"}
            </label>
          </Field>
          <Field label="背景色（rgba/hex）">
            <Input
              value={gStyle.bg ?? DEFAULT_DOCK_STYLE.bg}
              placeholder={DEFAULT_DOCK_STYLE.bg}
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, bg: e.target.value } })}
            />
          </Field>
          <Field label="毛玻璃 blur(px)">
            <Input
              type="number"
              value={gStyle.blur ?? DEFAULT_DOCK_STYLE.blur}
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, blur: Number(e.target.value) } })}
            />
          </Field>
          <Field label="圆角">
            <Input
              value={gStyle.radius ?? DEFAULT_DOCK_STYLE.radius}
              placeholder="999px / 16px"
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, radius: e.target.value } })}
            />
          </Field>
          <Field label="间距 gap(px)">
            <Input
              type="number"
              value={gStyle.gap ?? DEFAULT_DOCK_STYLE.gap}
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, gap: Number(e.target.value) } })}
            />
          </Field>
          <Field label="内边距 pad">
            <Input
              value={gStyle.pad ?? DEFAULT_DOCK_STYLE.pad}
              placeholder="10px 20px"
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, pad: e.target.value } })}
            />
          </Field>
          <Field label="图标尺寸(px)">
            <Input
              type="number"
              value={gStyle.icon ?? DEFAULT_DOCK_STYLE.icon}
              onChange={(e) => setGlobalDock({ ...globalDock, style: { ...gStyle, icon: Number(e.target.value) } })}
            />
          </Field>
          <Field label="显示开关">
            <label className="flex h-8 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={globalDock.enabled !== false}
                onChange={(e) => setGlobalDock({ ...globalDock, enabled: e.target.checked })}
              />
              {globalDock.enabled === false ? "隐藏整条" : "显示"}
            </label>
          </Field>
        </div>
        <Button size="sm" onClick={saveGlobal}>保存全局 Dock 配置</Button>
      </section>

      {/* ── 每桌覆盖 ── */}
      <section className="space-y-2">
        <h3 className="font-medium">
          当前桌覆盖 · {desks[activeDesk]?.name ?? `Desk ${activeDesk + 1}`}
        </h3>
        <p className="text-xs text-muted-foreground">
          不写 = 用全局配置；写了 = 该桌专用。切桌预览实时生效，保存房间后写入 desks[{activeDesk}].dock。
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="本桌位置">
            <select
              className={selCls}
              value={deskDock.position ?? ""}
              onChange={(e) => e.target.value && updateDesk({ position: e.target.value as DockConfig["position"] })}
            >
              <option value="">跟随全局</option>
              {Object.entries(DOCK_POSITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="本桌指示器">
            <select
              className={selCls}
              value={deskDock.indicator ?? ""}
              onChange={(e) => e.target.value && updateDesk({ indicator: e.target.value as "text" | "dots" })}
            >
              <option value="">跟随全局</option>
              <option value="text">文字</option>
              <option value="dots">圆点</option>
            </select>
          </Field>
          <Field label="本桌 autoHide">
            <select
              className={selCls}
              value={deskDock.autoHide === undefined ? "" : String(deskDock.autoHide)}
              onChange={(e) => updateDesk({ autoHide: e.target.value === "true" })}
            >
              <option value="">跟随全局</option>
              <option value="true">开</option>
              <option value="false">关</option>
            </select>
          </Field>
          <Field label="本桌背景色">
            <Input
              value={deskStyle.bg ?? ""}
              placeholder="跟随全局"
              onChange={(e) => updateDeskStyle({ bg: e.target.value })}
            />
          </Field>
        </div>

        {/* 本桌 dock 图标列表 */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">本桌常驻图标（{deskDock.icons?.length ?? 0}）</h4>
          <Button size="xs" variant="outline" onClick={addDeskIcon}>
            <Plus /> 加图标
          </Button>
        </div>
        {(deskDock.icons ?? []).length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            没有常驻图标——点「加图标」或复制桌面图标配置进 desks[{activeDesk}].dock.icons
          </p>
        )}
        <div className="space-y-1.5">
          {(deskDock.icons ?? []).map((ic, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 p-1.5">
              <Input
                className="h-7 flex-1"
                value={ic.label ?? ""}
                placeholder="名称"
                onChange={(e) => patchDeskIcon(i, { label: e.target.value })}
              />
              <Input
                className="h-7 w-16"
                value={ic.color ?? ""}
                placeholder="色"
                onChange={(e) => patchDeskIcon(i, { color: e.target.value })}
              />
              <Input
                className="h-7 w-12"
                value={ic.glyph ?? ""}
                placeholder="图标"
                onChange={(e) => patchDeskIcon(i, { glyph: e.target.value })}
              />
              <Button variant="ghost" size="icon-sm" title="删除" onClick={() => removeDeskIcon(i)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 皮肤预设 ── */}
      <section className="space-y-2">
        <h3 className="font-medium">Dock 皮肤预设（写入房间 room.css）</h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(DOCK_SKIN_PRESETS).map((name) => (
            <Button
              key={name}
              variant={skin === name ? "default" : "outline"}
              size="sm"
              onClick={() => applySkin(name)}
            >
              {name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          HUD = cockpit-room 风格（Consolas/青色）· Minimal = 扁平暗底 · Glass = 浅色毛玻璃。选中后请把片段贴进房间 room.css（房间导出 zip 时会自动带上）。
        </p>
      </section>
    </div>
  );
}
