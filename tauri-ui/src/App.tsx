import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";

interface WallpaperInfo {
  path: string;
  category: number;
  monitor: string;
  thumbnail: string;
}

export default function App() {
  const [stats, setStats] = useState("not connected");
  const [wallpapers, setWallpapers] = useState<WallpaperInfo[]>([]);

  async function refresh() {
    try {
      setStats(await invoke("core_stats"));
      setWallpapers(await invoke<WallpaperInfo[]>("get_wallpapers"));
    } catch (e) {
      setStats(`error: ${e}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">Lively Tauri UI</h1>
      <div className="mb-4 flex items-center gap-3">
        <Button onClick={refresh}>Refresh</Button>
        <span className="text-sm text-muted-foreground">{stats}</span>
      </div>
      <ul className="space-y-2">
        {wallpapers.map((w) => (
          <li
            key={w.path}
            className="rounded-md border border-border p-3 text-sm"
          >
            <div className="font-medium">{w.path.split(/[\\/]/).slice(-2).join("/")}</div>
            <div className="text-xs text-muted-foreground">
              category={w.category} monitor={w.monitor || "-"}
            </div>
          </li>
        ))}
        {wallpapers.length === 0 && (
          <li className="text-sm text-muted-foreground">no wallpapers returned</li>
        )}
      </ul>
    </main>
  );
}
