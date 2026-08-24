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

export default function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [status, setStatus] = useState("loading...");

  async function refresh() {
    try {
      setApps(await invoke<AppInfo[]>("get_installed_apps"));
      setStatus(`${apps.length} apps`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function launch(app: AppInfo) {
    setStatus(`launching ${app.name}...`);
    try {
      await invoke("launch_app", {
        target: app.target,
        arguments: app.arguments,
        workingDir: app.working_dir,
      });
      setStatus(`launched ${app.name}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">Dext · App Picker</h1>
      <div className="mb-4 flex items-center gap-3">
        <Button onClick={refresh}>Refresh</Button>
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {apps.map((app) => (
          <button
            key={app.source}
            onClick={() => launch(app)}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 hover:bg-accent"
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
        ))}
      </div>
    </main>
  );
}
