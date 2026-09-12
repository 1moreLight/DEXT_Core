import { describe, expect, it, vi } from "vitest";
import type { RoomEditorSnapshot } from "./editor-history";
import {
  createDeskLayoutSyncQueue,
  mergeLiveLayoutFields,
  type DeskLayoutSyncRequest,
  type DeskLayoutSyncResult,
} from "./live-layout";

function snapshot(): RoomEditorSnapshot {
  return {
    desks: [{
      name: "Desk",
      background: { name: "Draft background", type: "image", src: "background/draft.png" },
      icons: [{ label: "Old", icon_png: "", launch: { target: "old.exe", args: "", workdir: "" }, x: 0, y: 0 }],
      widgets: [{
        id: "clock",
        name: "Clock",
        src: "widgets/clock/index.html",
        resources: ["widgets/clock/index.html"],
        placement: { x: 20, y: 30, width: 300, height: 160, z: 1 },
        config: { timezone: "Asia/Shanghai" },
        permissions: ["time.read"],
        hotspots: [],
      }],
      dock: { enabled: false },
    }],
    dock: { enabled: false },
    transition: "fade",
    edges: [{ id: "start-in", from: "start", to: "d0", trans: null }],
    startName: "Start",
    startContent: null,
    idleName: "Idle",
    idleContent: null,
    hasStart: true,
    startDesk: 0,
  };
}

function request(target: string): DeskLayoutSyncRequest {
  return {
    roomDir: "D:\\rooms\\demo",
    deskIndex: 0,
    icons: [{ label: target, icon_png: "", launch: { target, args: "", workdir: "" }, x: 1, y: 1 }],
    enterEdit: false,
    highlightTarget: null,
  };
}

function result(): DeskLayoutSyncResult {
  return { active: true, saved: true, liveUpdated: true, roomJson: "{}", liveError: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("live Desk layout helpers", () => {
  it("merges only desktop-authored icon positions and Widget placement into a dirty draft", () => {
    const draft = snapshot();
    const persisted = snapshot().desks;
    persisted[0] = {
      ...persisted[0],
      background: { name: "Saved background", type: "image", src: "background/saved.png" },
      icons: [{ label: "New", icon_png: "", launch: { target: "new.exe", args: "", workdir: "" }, x: 4, y: 2 }],
      widgets: [{
        ...persisted[0].widgets[0],
        placement: { x: 480, y: 240, width: 400, height: 200, z: 3 },
        config: { timezone: "UTC" },
        permissions: [],
      }],
    };

    const merged = mergeLiveLayoutFields(draft, persisted);

    expect(merged.desks[0].icons).toMatchObject([{ label: "New", x: 4, y: 2 }]);
    expect(merged.desks[0].widgets[0]).toMatchObject({
      placement: { x: 480, y: 240, width: 400, height: 200, z: 3 },
      config: { timezone: "Asia/Shanghai" },
      permissions: ["time.read"],
    });
    expect(merged.desks[0].background).toEqual(draft.desks[0].background);
    expect(merged.transition).toBe("fade");
    expect(draft.desks[0].icons[0]).toMatchObject({ label: "Old", x: 0, y: 0 });
  });

  it("serializes requests and settles coalesced callers from the latest snapshot only", async () => {
    const first = deferred<DeskLayoutSyncResult>();
    const latest = deferred<DeskLayoutSyncResult>();
    const sent: string[] = [];
    const settled: string[] = [];
    const sends = [first, latest];
    const queue = createDeskLayoutSyncQueue(
      async (next) => {
        sent.push(next.icons[0].launch.target);
        return sends.shift()!.promise;
      },
      (next) => settled.push(next.icons[0].launch.target),
    );

    const firstCaller = queue.submit(request("first.exe"));
    const middleCaller = queue.submit(request("middle.exe"));
    const latestCaller = queue.submit(request("latest.exe"));
    expect(sent).toEqual(["first.exe"]);

    first.resolve(result());
    await vi.waitFor(() => expect(sent).toEqual(["first.exe", "latest.exe"]));
    expect(settled).toEqual([]);

    latest.resolve(result());

    await expect(Promise.all([firstCaller, middleCaller, latestCaller])).resolves.toEqual([result(), result(), result()]);
    expect(settled).toEqual(["latest.exe"]);
  });
});
