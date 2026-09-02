import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { AppPickerDialog } from "@/components/AppPickerDialog";
import {
  type DockConfig,
  type DockIconItem,
  DEFAULT_DOCK_STYLE,
} from "@/lib/dock";
import type { Desk } from "@/lib/room-v2";

interface DockEditorProps {
  dock: DockConfig;
  setDock: (d: DockConfig) => void;
  apps: DockAppInfo[];
  desks: Desk[];
  setDesks: React.Dispatch<React.SetStateAction<Desk[]>>;
  activeDesk: number;
  touch: () => void;
  setStatus: (s: string) => void;
}

interface DockAppInfo {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
}

type DockIconScope = "global" | "desk";

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

export function DockEditor({
  dock,
  setDock,
  apps,
  desks,
  setDesks,
  activeDesk,
  touch,
  setStatus,
}: DockEditorProps) {
  // 本地草稿状态；父组件的 dock/desks 变化（开房间/切桌/预览回写）时同步进来
  const [globalDock, setGlobalDock] = useState<DockConfig>(dock);
  const [deskDocks, setDeskDocks] = useState<DockConfig[]>(desks.map((d) => d.dock ?? {}));
  const [iconScope, setIconScope] = useState<DockIconScope>("global");
  const [appPickerOpen, setAppPickerOpen] = useState(false);

  useEffect(() => setGlobalDock(dock), [dock]);
  useEffect(() => setDeskDocks(desks.map((d) => d.dock ?? {})), [desks]);

  const deskDock = deskDocks[activeDesk] ?? {};
  const deskStyle = deskDock.style ?? {};
  const gStyle = globalDock.style ?? {};
  const deskHasOwnIcons = Object.prototype.hasOwnProperty.call(deskDock, "icons");
  const globalIcons = globalDock.icons ?? [];
  const deskIcons = deskHasOwnIcons ? deskDock.icons ?? [] : globalIcons;
  const scopedIcons = iconScope === "global" ? globalIcons : deskIcons;
  const scopedTargets = new Set(
    scopedIcons.map((icon) => icon.launch?.target).filter((target): target is string => !!target)
  );

  function saveGlobal() {
    setDock(globalDock);
    touch();
    setStatus("全局 Dock 配置已保存");
  }

  function updateGlobalIcons(icons: DockIconItem[], message: string) {
    const next = { ...globalDock, icons };
    setGlobalDock(next);
    setDock(next);
    touch();
    setStatus(message);
  }

  // ---- 每桌覆盖：写回父级 desks（这样 room.json 保存时能带上 desks[i].dock）----
  function updateDesk(patch: Partial<DockConfig>) {
    const next = { ...deskDock, ...patch };
    setDeskDocks((prev) => prev.map((d, i) => (i === activeDesk ? next : d)));
    setDesks((prev) => prev.map((d, i) => (i === activeDesk ? { ...d, dock: next } : d)));
    touch();
  }

  function replaceDeskDock(next: DockConfig) {
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

  function toggleDockApp(app: DockAppInfo) {
    if (scopedTargets.has(app.target)) {
      const index = scopedIcons.findIndex((icon) => icon.launch?.target === app.target);
      if (index >= 0) removeScopedIcon(index);
      return;
    }
    const icon: DockIconItem = {
      label: app.name,
      icon_png: app.icon_png,
      action: `启动 ${app.name}`,
      launch: {
        target: app.target,
        args: app.arguments,
        workdir: app.working_dir,
      },
    };
    const nextIcons = [...scopedIcons, icon];
    if (iconScope === "global") {
      updateGlobalIcons(nextIcons, `已将「${app.name}」加入全局 Dock，记得保存 Room`);
    } else {
      updateDesk({ icons: nextIcons });
      setStatus(`已将「${app.name}」加入当前桌 Dock，记得保存 Room`);
    }
  }

  function removeScopedIcon(index: number) {
    const icon = scopedIcons[index];
    const nextIcons = scopedIcons.filter((_, i) => i !== index);
    if (iconScope === "global") {
      updateGlobalIcons(nextIcons, `已从全局 Dock 移除「${icon.label ?? "图标"}」`);
    } else {
      updateDesk({ icons: nextIcons });
      setStatus(`已从当前桌 Dock 移除「${icon.label ?? "图标"}」`);
    }
  }

  function resetDeskIcons() {
    const next = { ...deskDock };
    delete next.icons;
    replaceDeskDock(next);
    setStatus("当前桌 Dock 图标已恢复跟随全局");
  }

  const selCls =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

  return (
    <div className="max-w-2xl space-y-5 overflow-y-auto p-1">
      <div>
        <h3 className="font-medium">当前 Room Dock 参数</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          这些设置只属于正在编辑的 Room；Dock 模板库本身不会在这里被修改。
        </p>
      </div>
      <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-medium">常驻应用</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              从现有应用库写入真图标和启动信息；修改后使用 Room 顶栏的“保存”落盘。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border bg-background p-0.5">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs ${
                  iconScope === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setIconScope("global")}
              >
                全局 Dock · {globalIcons.length}
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs ${
                  iconScope === "desk" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setIconScope("desk")}
              >
                {desks[activeDesk]?.name ?? `Desk ${activeDesk + 1}`} · {deskIcons.length}
              </button>
            </div>
            <Button size="sm" onClick={() => setAppPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> 放入应用
            </Button>
          </div>
        </div>

        {iconScope === "desk" && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-2 text-xs">
            <span className="text-muted-foreground">
              {deskHasOwnIcons
                ? "当前桌使用独立图标列表（会整体替换全局列表）"
                : "当前桌正在跟随全局；首次增删会创建独立列表"}
            </span>
            {deskHasOwnIcons && (
              <Button size="xs" variant="ghost" onClick={resetDeskIcons}>
                恢复跟随全局
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-medium">
            {iconScope === "global" ? "全局 Dock" : "当前桌 Dock"} 已选（{scopedIcons.length}）
          </div>
          {scopedIcons.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              暂无常驻应用。点击“放入应用”从应用库中选择。
            </p>
          )}
          {scopedIcons.map((icon, index) => (
            <div
              key={`${icon.launch?.target ?? icon.label ?? "dock-icon"}-${index}`}
              className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5"
            >
              {icon.icon_png ? (
                <img
                  src={`data:image/png;base64,${icon.icon_png}`}
                  alt=""
                  className="h-7 w-7 shrink-0 object-contain"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-xs">
                  {icon.glyph ?? "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{icon.label ?? "未命名图标"}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {icon.launch?.target ?? "自定义占位图标"}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" title="从 Dock 移除" onClick={() => removeScopedIcon(index)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>
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

      {appPickerOpen && (
        <AppPickerDialog
          title={`放入应用 · ${iconScope === "global" ? "全局 Dock" : `${desks[activeDesk]?.name ?? `Desk ${activeDesk + 1}`} Dock`}`}
          description="点击应用即可加入或移出当前 Dock 作用域；修改后使用 Room 顶栏的“保存”落盘。"
          apps={apps}
          isSelected={(app) => scopedTargets.has(app.target)}
          onToggle={toggleDockApp}
          onClose={() => setAppPickerOpen(false)}
        />
      )}

    </div>
  );
}
