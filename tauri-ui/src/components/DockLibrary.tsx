import { useMemo, useState } from "react";
import { ArrowLeft, FileUp, Pencil, Plus, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DockPresetInfo } from "@/lib/dock";

function DockVisual({ preset, compact = false }: { preset: DockPresetInfo; compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden ${compact ? "h-14 rounded-md" : "aspect-video w-full"}`}
      style={{ backgroundColor: preset.backdrop }}
    >
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_0.7px,transparent_0.8px)] [background-size:12px_12px]" />
      <div
        className={`absolute left-1/2 flex -translate-x-1/2 items-center border border-white/15 shadow-lg backdrop-blur-md ${
          compact ? "bottom-2 gap-1 rounded-full px-2 py-1" : "bottom-[14%] gap-2 rounded-full px-3 py-2"
        }`}
        style={{ backgroundColor: preset.surface }}
      >
        <span className={`${compact ? "h-2 w-2" : "h-3 w-3"} rounded-full bg-white/25`} />
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className={`${compact ? "h-4 w-4" : "h-7 w-7"} rounded-md border border-white/20`}
            style={{
              backgroundColor: item === 1 ? preset.accent : "rgba(255,255,255,0.12)",
              opacity: item === 1 ? 0.92 : 1,
            }}
          />
        ))}
        <span className={`${compact ? "h-2 w-2" : "h-3 w-3"} rounded-full bg-white/25`} />
      </div>
    </div>
  );
}

function DockPresetEditor({
  preset,
  onCancel,
  onSave,
}: {
  preset: DockPresetInfo;
  onCancel: () => void;
  onSave: (preset: DockPresetInfo) => DockPresetInfo;
}) {
  const [draft, setDraft] = useState<DockPresetInfo>({
    ...preset,
    name: preset.source === "builtin" ? `${preset.name} 副本` : preset.name,
    traits: [...preset.traits],
  });

  function save() {
    const name = draft.name.trim();
    const css = draft.css.trim();
    if (!name || !css) return;
    onSave({
      ...draft,
      name,
      description: draft.description.trim() || "本地 Dock 模板。",
      css,
      traits: draft.traits.filter(Boolean),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" /> 返回模板库
        </Button>
        <div>
          <h2 className="text-base font-semibold">编辑 Dock · {preset.name}</h2>
          <p className="text-xs text-muted-foreground">
            {preset.source === "builtin" ? "内置模板保存时会创建本地副本。" : "修改会保存到本地模板库。"}
          </p>
        </div>
        <Button className="ml-auto" size="sm" disabled={!draft.name.trim() || !draft.css.trim()} onClick={save}>
          <Save className="h-4 w-4" /> {preset.source === "builtin" ? "保存为副本" : "保存修改"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)] gap-4">
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-border p-4">
          <DockVisual preset={draft} />
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>名称</span>
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>说明</span>
            <textarea
              className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["背景", "backdrop"],
                ["Dock 表面", "surface"],
                ["强调色", "accent"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="space-y-1 text-xs text-muted-foreground">
                <span>{label}</span>
                <Input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </label>
            ))}
          </div>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>标签（逗号分隔）</span>
            <Input
              value={draft.traits.join(", ")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  traits: event.target.value.split(",").map((item) => item.trim()),
                })
              }
            />
          </label>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">Dock CSS</h3>
            <p className="text-xs text-muted-foreground">保存模板不会修改任何 Room；到 Room 编辑器选择后才会写入。</p>
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
            spellCheck={false}
            value={draft.css}
            onChange={(event) => setDraft({ ...draft, css: event.target.value })}
          />
        </section>
      </div>
    </div>
  );
}

export function DockLibrary({
  presets,
  onImport,
  onSave,
}: {
  presets: DockPresetInfo[];
  onImport: () => Promise<string | null>;
  onSave: (preset: DockPresetInfo) => DockPresetInfo;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(presets[0]?.id ?? "");
  const [editing, setEditing] = useState<DockPresetInfo | null>(null);
  const [importing, setImporting] = useState(false);
  const filtered = useMemo(
    () =>
      presets.filter((preset) =>
        `${preset.name} ${preset.description}`.toLowerCase().includes(query.toLowerCase())
      ),
    [presets, query]
  );
  const selected = filtered.find((preset) => preset.id === selectedId) ?? filtered[0] ?? null;

  async function importPreset() {
    if (importing) return;
    setImporting(true);
    try {
      const id = await onImport();
      if (id) setSelectedId(id);
    } finally {
      setImporting(false);
    }
  }

  if (editing) {
    return (
      <DockPresetEditor
        key={editing.id}
        preset={editing}
        onCancel={() => setEditing(null)}
        onSave={(draft) => {
          const saved = onSave(draft);
          setSelectedId(saved.id);
          setEditing(null);
          return saved;
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Dock 模板库</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              在这里导入和编辑 Dock；只有进入具体 Room 后选择，才会修改该 Room。
            </p>
          </div>
          <Button size="sm" onClick={() => void importPreset()} disabled={importing}>
            {importing ? <FileUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            新建
          </Button>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Dock..."
          />
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto pr-1 xl:grid-cols-3">
          {filtered.map((preset) => {
            const active = preset.id === selected?.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedId(preset.id)}
                className={`overflow-hidden rounded-xl border text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40"
                }`}
              >
                <DockVisual preset={preset} />
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{preset.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {preset.source === "builtin" ? "内置模板" : "本地模板"}
                    </div>
                  </div>
                  {active && (
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" title="已选中查看" />
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              没有匹配“{query}”的 Dock
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          以后从创意工坊下载的 Dock 会进入同一个模板库，不会自动套用到任何 Room。
        </p>
      </div>

      {selected && (
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border pl-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <DockVisual preset={selected} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {selected.source === "builtin" ? "内置" : "本地"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            {selected.traits.map((trait) => (
              <div key={trait} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected.accent }} />
                {trait}
              </div>
            ))}
          </div>
          <Button className="mt-auto" onClick={() => setEditing(selected)}>
            编辑 <Pencil className="h-4 w-4" />
          </Button>
        </aside>
      )}
    </div>
  );
}

export function RoomDockPicker({
  presets,
  activePreset,
  onApplyPreset,
}: {
  presets: DockPresetInfo[];
  activePreset: string | null;
  onApplyPreset: (preset: DockPresetInfo) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);

  async function choose(preset: DockPresetInfo) {
    if (saving || preset.id === activePreset) return;
    setSaving(true);
    try {
      await onApplyPreset(preset);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="shrink-0 rounded-lg border border-border bg-muted/15 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">当前 Room Dock</h3>
          <p className="text-[11px] text-muted-foreground">在这里选择才会写入当前 Room，并同步预览。</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {activePreset
            ? `当前：${presets.find((preset) => preset.id === activePreset)?.name ?? activePreset}`
            : "当前：默认样式"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => {
          const active = preset.id === activePreset;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={saving}
              onClick={() => void choose(preset)}
              className={`grid min-w-52 flex-1 grid-cols-[5rem_1fr] items-center gap-2 overflow-hidden rounded-lg border p-1.5 text-left transition-colors disabled:opacity-60 ${
                active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent/40"
              }`}
            >
              <DockVisual preset={preset} compact />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{preset.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {active ? "已用于此 Room" : "选择使用"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
