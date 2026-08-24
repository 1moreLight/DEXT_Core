import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";

interface AppInfo {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
  source: string;
}

interface RoomIcon {
  label: string;
  icon_png: string;
  launch: { target: string; args: string; workdir: string };
}

interface Desk {
  name: string;
  background: string;
  icons: RoomIcon[];
}

const BACKGROUND = "assets/desk1-bg.png";

function appToIcon(a: AppInfo): RoomIcon {
  return {
    label: a.name,
    icon_png: a.icon_png,
    launch: { target: a.target, args: a.arguments, workdir: a.working_dir },
  };
}

export default function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [desks, setDesks] = useState<Desk[]>([
    { name: "主页", background: BACKGROUND, icons: [] },
  ]);
  const [activeDesk, setActiveDesk] = useState(0);
  const [status, setStatus] = useState("loading...");

  useEffect(() => {
    invoke<AppInfo[]>("get_installed_apps")
      .then((list) => {
        setApps(list);
        setStatus(`${list.length} apps`);
      })
      .catch((e) => setStatus(`error: ${e}`));
  }, []);

  function toggle(app: AppInfo) {
    setDesks((prev) => {
      const desk = prev[activeDesk];
      const has = desk.icons.some((i) => i.launch.target === app.target);
      const icons = has
        ? desk.icons.filter((i) => i.launch.target !== app.target)
        : [...desk.icons, appToIcon(app)];
      return prev.map((d, i) => (i === activeDesk ? { ...desk, icons } : d));
    });
  }

  function isSelected(app: AppInfo) {
    return desks[activeDesk].icons.some((i) => i.launch.target === app.target);
  }

  function addDesk() {
    setDesks((prev) => [
      ...prev,
      { name: `Desk ${prev.length + 1}`, background: BACKGROUND, icons: [] },
    ]);
    setActiveDesk(desks.length);
  }

  function removeDesk(index: number) {
    if (desks.length === 1) return;
    setDesks((prev) => prev.filter((_, i) => i !== index));
    setActiveDesk(0);
  }

  function renameDesk(index: number, name: string) {
    setDesks((prev) => prev.map((d, i) => (i === index ? { ...d, name } : d)));
  }

  async function saveAndApply() {
    const total = desks.reduce((n, d) => n + d.icons.length, 0);
    if (total === 0) {
      setStatus("先选择至少一个应用");
      return;
    }
    try {
      setStatus("saving...");
      await invoke("save_room", {
        roomJson: JSON.stringify({ desks }, null, 2),
      });
      await invoke("set_wallpaper", {
        folder: "D:\\midDOW\\lively-core-separation\\wallpapers\\dext-room",
      });
      setStatus(`已应用 ${desks.length} 个 Desk / ${total} 个应用`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  const desk = desks[activeDesk];

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dext · Room 编辑</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{status}</span>
          <Button onClick={saveAndApply}>保存并应用到桌面</Button>
        </div>
      </div>

      {/* desk tabs */}
      <div className="mb-4 flex items-center gap-2">
        {desks.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 rounded-md border px-3 py-1.5 ${
              i === activeDesk
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            <button
              className="text-sm"
              onClick={() => setActiveDesk(i)}
              onDoubleClick={() => renameDesk(i, prompt("Desk 名称", d.name) ?? d.name)}
            >
              {d.name} ({d.icons.length})
            </button>
            {desks.length > 1 && (
              <button
                className="ml-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => removeDesk(i)}
                title="删除此 Desk"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addDesk}>
          + Desk
        </Button>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        正在编辑「{desk.name}」· 单击勾选/取消，勾选的应用会作为图标放到该 Desk
      </p>
      <div className="grid grid-cols-8 gap-3">
        {apps.map((app) => {
          const on = isSelected(app);
          return (
            <button
              key={app.source}
              onClick={() => toggle(app)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 hover:bg-accent ${
                on ? "border-primary ring-2 ring-primary" : "border-border"
              }`}
              title={app.target}
            >
              {app.icon_png ? (
                <img
                  src={`data:image/png;base64,${app.icon_png}`}
                  alt=""
                  className="h-10 w-10"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-muted" />
              )}
              <span className="line-clamp-2 text-center text-xs">{app.name}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
