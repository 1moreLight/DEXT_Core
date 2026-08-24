import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface RoomInfo {
  name: string;
  path: string;
  desks: number;
  icons: number;
}

type Mode = "use" | "edit";

const DEFAULT_LIB = "D:\\midDOW\\lively-core-separation\\rooms";

function newDesk(index: number): Desk {
  return { name: `Desk ${index + 1}`, background: "", icons: [] };
}

function AppIcon({ app, size = "h-10 w-10" }: { app: AppInfo; size?: string }) {
  return app.icon_png ? (
    <img src={`data:image/png;base64,${app.icon_png}`} alt="" className={size} />
  ) : (
    <div className={`${size} rounded bg-muted`} />
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("use");
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [desks, setDesks] = useState<Desk[]>([newDesk(0)]);
  const [activeDesk, setActiveDesk] = useState(0);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [status, setStatus] = useState("loading...");
  const [libDir, setLibDir] = useState(
    () => localStorage.getItem("dext.libDir") ?? DEFAULT_LIB
  );
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [roomPath, setRoomPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [appliedRoom, setAppliedRoom] = useState<string | null>(() =>
    localStorage.getItem("dext.appliedRoom")
  );
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    invoke<AppInfo[]>("get_installed_apps")
      .then((list) => {
        setApps(list);
        setStatus(`${list.length} apps`);
      })
      .catch((e) => setStatus(`error: ${e}`));
  }, []);

  useEffect(() => {
    refreshRooms(libDir).then(async (list) => {
      const last = localStorage.getItem("dext.roomPath");
      const target = list.find((r) => r.path === last)?.path ?? list[0]?.path;
      if (target) await openRoom(target, false);
    });
  }, []);

  async function refreshRooms(dir: string): Promise<RoomInfo[]> {
    try {
      const list = await invoke<RoomInfo[]>("list_rooms", { dir });
      setRooms(list);
      return list;
    } catch (e) {
      setStatus(`error: ${e}`);
      return [];
    }
  }

  async function openRoom(path: string, checkDirty = true) {
    if (
      checkDirty &&
      dirty &&
      !confirm("当前房间有未保存的修改，丢弃并切换？")
    )
      return;
    try {
      const json = await invoke<string>("read_room", { path: `${path}\\room.json` });
      const room = JSON.parse(json);
      setDesks(room.desks?.length ? room.desks : [newDesk(0)]);
      setActiveDesk(0);
      setRoomPath(path);
      setDirty(false);
      localStorage.setItem("dext.roomPath", path);
      setStatus(`已打开 ${path.split("\\").pop()}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  function touch() {
    setDirty(true);
  }

  async function saveRoom(): Promise<boolean> {
    if (!roomPath) return false;
    try {
      await invoke("write_room", {
        path: `${roomPath}\\room.json`,
        roomJson: JSON.stringify({ desks }, null, 2),
      });
      setDirty(false);
      return true;
    } catch (e) {
      setStatus(`error: ${e}`);
      return false;
    }
  }

  async function applyRoomDir(dir: string) {
    try {
      await invoke("apply_room", { roomDir: dir });
      setAppliedRoom(dir);
      localStorage.setItem("dext.appliedRoom", dir);
      setStatus(`已应用 ${dir.split("\\").pop()}`);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function applyCurrent() {
    if (!roomPath) {
      setStatus("先新建或选择一个房间");
      return;
    }
    setStatus("saving...");
    if (dirty && !(await saveRoom())) return;
    applyRoomDir(roomPath);
  }

  async function newRoom() {
    const name = prompt("房间名（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("create_room", { dir: libDir, name });
      await refreshRooms(libDir);
      await openRoom(path, false);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function saveAs() {
    const name = prompt("另存为（建议英文）");
    if (!name) return;
    try {
      const path = await invoke<string>("create_room", { dir: libDir, name });
      await invoke("write_room", {
        path: `${path}\\room.json`,
        roomJson: JSON.stringify({ desks }, null, 2),
      });
      await refreshRooms(libDir);
      await openRoom(path, false);
    } catch (e) {
      setStatus(`error: ${e}`);
    }
  }

  async function changeLib(dir: string) {
    const d = dir.trim();
    setLibDir(d);
    localStorage.setItem("dext.libDir", d);
    refreshRooms(d);
  }

  function postRoom() {
    previewRef.current?.contentWindow?.postMessage(
      { type: "dext:room", room: { desks }, deskIndex: activeDesk },
      "*"
    );
  }

  useEffect(() => {
    if (showPreview) postRoom();
  }, [desks, activeDesk, showPreview]);

  function toggle(app: AppInfo) {
    touch();
    setDesks((prev) =>
      prev.map((d, i) => {
        if (i !== activeDesk) return d;
        const has = d.icons.some((x) => x.launch.target === app.target);
        return {
          ...d,
          icons: has
            ? d.icons.filter((x) => x.launch.target !== app.target)
            : [...d.icons, { label: app.name, icon_png: app.icon_png, launch: { target: app.target, args: app.arguments, workdir: app.working_dir } }],
        };
      })
    );
  }

  function removeIcon(target: string) {
    touch();
    setDesks((prev) =>
      prev.map((d, i) =>
        i === activeDesk ? { ...d, icons: d.icons.filter((x) => x.launch.target !== target) } : d
      )
    );
  }

  function addDesk() {
    touch();
    setDesks((prev) => [...prev, newDesk(prev.length)]);
    setActiveDesk(desks.length);
  }

  function removeDesk(i: number) {
    if (desks.length === 1) return;
    touch();
    setDesks((prev) => prev.filter((_, x) => x !== i));
    setActiveDesk(0);
  }

  const desk = desks[activeDesk];
  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );
  const tabCls = (on: boolean) =>
    `rounded px-3 py-1 text-sm ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`;

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Dext</h1>
          <div className="flex rounded-md border border-border p-0.5">
            <button className={tabCls(mode === "use")} onClick={() => setMode("use")}>
              使用
            </button>
            <button className={tabCls(mode === "edit")} onClick={() => setMode("edit")}>
              编辑
            </button>
          </div>
        </div>

        {mode === "edit" && (
          <div className="flex items-center gap-2">
            <select
              value={roomPath ?? ""}
              onChange={(e) => openRoom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              title="当前房间"
            >
              {rooms.length === 0 && <option value="">（无房间）</option>}
              {rooms.map((r) => (
                <option key={r.path} value={r.path}>
                  {r.name}
                </option>
              ))}
            </select>
            {dirty && (
              <span className="text-xs font-medium text-amber-500" title="有未保存修改">
                ●
              </span>
            )}
            <Button variant="outline" size="sm" onClick={newRoom}>
              新建
            </Button>
            <Button variant="outline" size="sm" onClick={saveAs}>
              另存为
            </Button>
            <Input
              value={libDir}
              onChange={(e) => setLibDir(e.target.value)}
              onBlur={(e) => {
                if (e.target.value !== localStorage.getItem("dext.libDir"))
                  changeLib(e.target.value);
              }}
              className="h-8 w-56 text-xs"
              title="房间库路径"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{status}</span>
          {mode === "edit" && (
            <>
              <Button
                variant={showPreview ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
              >
                预览
              </Button>
              <Button variant="outline" size="sm" onClick={saveRoom}>
                保存
              </Button>
              <Button size="sm" onClick={applyCurrent}>
                应用
              </Button>
            </>
          )}
        </div>
      </header>

      {mode === "use" ? (
        /* ===== use mode: room cards ===== */
        <section className="flex min-h-0 flex-1 flex-col p-4">
          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto pr-1">
            {rooms.map((r) => {
              const on = r.path === appliedRoom;
              return (
                <div
                  key={r.path}
                  className={`rounded-lg border p-4 ${
                    on ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium">{r.name}</span>
                    {on && <span className="text-xs font-medium text-primary">应用中</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.desks} Desk · {r.icons} 图标
                  </div>
                  <Button
                    size="sm"
                    variant={on ? "secondary" : "default"}
                    className="mt-3 w-full"
                    onClick={() => applyRoomDir(r.path)}
                  >
                    {on ? "重新应用" : "应用"}
                  </Button>
                </div>
              );
            })}
            {rooms.length === 0 && (
              <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
                房间库为空——去编辑模式新建一个房间吧
              </div>
            )}
          </div>
        </section>
      ) : (
        /* ===== edit mode ===== */
        <div className="flex min-h-0 flex-1">
          {/* desk sidebar */}
          <aside className="flex w-64 flex-col border-r border-border">
            <div className="px-4 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Desks
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {desks.map((d, i) => (
                <div
                  key={i}
                  onClick={() => setActiveDesk(i)}
                  className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 ${
                    i === activeDesk ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent"
                  }`}
                >
                  {renaming === i ? (
                    <Input
                      autoFocus
                      defaultValue={d.name}
                      className="h-7 text-sm"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        touch();
                        setDesks((prev) =>
                          prev.map((x, xi) =>
                            xi === i ? { ...x, name: e.target.value || x.name } : x
                          )
                        );
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <div onDoubleClick={() => setRenaming(i)}>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.icons.length} 个图标</div>
                    </div>
                  )}
                  {desks.length > 1 && (
                    <button
                      className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDesk(i);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border p-2">
              <Button variant="outline" className="w-full" onClick={addDesk}>
                + 添加 Desk
              </Button>
            </div>

            {/* current desk icons */}
            <div className="border-t border-border p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                「{desk.name}」的图标
              </div>
              <div className="flex flex-wrap gap-1.5">
                {desk.icons.map((icon) => (
                  <button
                    key={icon.launch.target}
                    onClick={() => removeIcon(icon.launch.target)}
                    className="group relative rounded-md border border-border p-1.5 hover:border-destructive"
                    title={`移除 ${icon.label}`}
                  >
                    <img
                      src={`data:image/png;base64,${icon.icon_png}`}
                      alt=""
                      className="h-7 w-7"
                    />
                    <span className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white group-hover:flex">
                      ×
                    </span>
                  </button>
                ))}
                {desk.icons.length === 0 && (
                  <span className="text-xs text-muted-foreground">从右侧点选应用</span>
                )}
              </div>
            </div>
          </aside>

          {/* app library OR preview */}
          <section className="flex min-h-0 flex-1 flex-col p-4">
            {showPreview ? (
              <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
                <iframe
                  ref={previewRef}
                  src="http://dext.localhost/index.html"
                  onLoad={postRoom}
                  title="Room 预览"
                  className="aspect-video w-full max-w-4xl rounded-lg border border-border"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  实时预览 · 未保存的修改也会显示 · 双击图标不会真启动
                </p>
              </div>
            ) : (
              <>
                <Input
                  placeholder="搜索应用..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-6 gap-2 overflow-y-auto pr-1">
                  {filtered.map((app) => {
                    const on = desk.icons.some((x) => x.launch.target === app.target);
                    return (
                      <button
                        key={app.source}
                        onClick={() => toggle(app)}
                        className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                          on
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-accent"
                        }`}
                        title={app.target}
                      >
                        <AppIcon app={app} />
                        <span className="line-clamp-2 text-center text-xs leading-tight">
                          {app.name}
                        </span>
                        {on && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
