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

// ponytail: single-desk room, multi-desk editing later
export default function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selected, setSelected] = useState<AppInfo[]>([]);
  const [status, setStatus] = useState("loading...");

  async function refresh() {
    try {
      const list = await invoke<AppInfo[]>("get_installed_apps");
      setApps(list);
      setStatus(`${list.length} apps · 已选 ${selected.length}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(app: AppInfo) {
    setSelected((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  }

  async function saveAndApply() {
    if (selected.length === 0) {
      setStatus("先选择至少一个应用");
      return;
    }
    const room = {
      desks: [
        {
          name: "主页",
          background: "assets/desk1-bg.png",
          icons: selected.map((a) => ({
            label: a.name,
            icon_png: a.icon_png,
            launch: {
              target: a.target,
              args: a.arguments,
              workdir: a.working_dir,
            },
          })),
        },
      ],
    };
    try {
      setStatus("saving...");
      await invoke("save_room", { roomJson: JSON.stringify(room, null, 2) });
      await invoke("set_wallpaper", { folder: "D:\\midDOW\\dext-room-wallpaper" });
      setStatus(`已应用 ${selected.length} 个应用`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dext · 编辑主页 Desk</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{status}</span>
          <Button onClick={saveAndApply}>保存并应用到桌面</Button>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-3">
        {apps.map((app) => {
          const idx = selected.indexOf(app);
          return (
            <button
              key={app.source}
              onClick={() => toggle(app)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 hover:bg-accent ${
                idx >= 0 ? "border-primary ring-2 ring-primary" : "border-border"
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
