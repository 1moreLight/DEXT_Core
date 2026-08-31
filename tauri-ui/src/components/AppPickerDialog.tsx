import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export interface AppPickerItem {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
}

interface AppPickerDialogProps<TApp extends AppPickerItem> {
  title: string;
  description: string;
  apps: TApp[];
  isSelected: (app: TApp) => boolean;
  onToggle: (app: TApp) => void;
  onClose: () => void;
  emptyMessage?: string;
}

export function AppPickerDialog<TApp extends AppPickerItem>({
  title,
  description,
  apps,
  isSelected,
  onToggle,
  onClose,
  emptyMessage = "还没有可用应用。请先关闭此窗口，再到侧栏“应用库”添加或扫描应用。",
}: AppPickerDialogProps<TApp>) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            完成
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {apps.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {apps.map((app) => {
                const selected = isSelected(app);
                return (
                  <button
                    key={`${app.target}\u0000${app.arguments}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggle(app)}
                    className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted/45 hover:border-border hover:bg-accent"
                    }`}
                    title={`${app.target}\n单击${selected ? "移出" : "加入"}`}
                  >
                    {app.icon_png ? (
                      <img
                        src={`data:image/png;base64,${app.icon_png}`}
                        alt=""
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-muted text-sm font-medium">
                        {app.name.slice(0, 1).toLocaleUpperCase()}
                      </span>
                    )}
                    <span className="line-clamp-2 text-xs leading-tight">{app.name}</span>
                    {selected && (
                      <span className="absolute right-2 top-2 text-[10px] font-semibold text-primary">
                        已加入 ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
