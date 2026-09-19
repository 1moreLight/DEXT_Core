import type { RoomEditorSnapshot } from "./editor-history";
import type { Desk, RoomIcon } from "./room-v2";

export interface DeskLayoutSyncRequest {
  roomDir: string;
  deskIndex: number;
  icons: RoomIcon[];
  enterEdit: boolean;
  highlightTarget: string | null;
}

export interface DeskLayoutSyncResult {
  active: boolean;
  saved: boolean;
  liveUpdated: boolean;
  roomJson: string | null;
  liveError: string | null;
}

export interface DeskLayoutSyncCompletion {
  latest: boolean;
  result: DeskLayoutSyncResult | null;
}

export function deskAppSyncOutcome(input: {
  action: "added" | "removed";
  preference: boolean;
  isActiveRoom: boolean;
  coreConnected: boolean;
  result?: DeskLayoutSyncResult;
}): { minimize: boolean; closePicker: boolean; message: string } {
  if (!input.isActiveRoom) {
    return { minimize: false, closePicker: false, message: "应用 Room 后可在桌面编辑" };
  }
  if (!input.coreConnected) {
    return { minimize: false, closePicker: false, message: "Dext Core 未连接，已保留草稿" };
  }
  if (input.result && !input.result.active) {
    return { minimize: false, closePicker: false, message: "应用 Room 后可在桌面编辑" };
  }
  if (!input.result?.saved || !input.result.liveUpdated) {
    return { minimize: false, closePicker: false, message: "已保存，桌面同步失败" };
  }
  const shouldEnterEdit = input.action === "added" && input.preference;
  return {
    minimize: shouldEnterEdit,
    closePicker: shouldEnterEdit,
    message: shouldEnterEdit ? "已同步到桌面编辑" : "已实时同步到真实桌面",
  };
}

function cloneIcons(icons: RoomIcon[]): RoomIcon[] {
  return icons.map((icon) => ({ ...icon, launch: { ...icon.launch } }));
}

export function mergeLiveLayoutFields(
  draft: RoomEditorSnapshot,
  persistedDesks: Desk[],
): RoomEditorSnapshot {
  return {
    ...draft,
    desks: draft.desks.map((desk, index) => {
      const persisted = persistedDesks[index];
      if (!persisted) return {
        ...desk,
        icons: cloneIcons(desk.icons),
        widgets: desk.widgets.map((widget) => ({ ...widget, placement: { ...widget.placement } })),
      };
      const persistedWidgets = new Map(persisted.widgets.map((widget) => [widget.id, widget]));
      return {
        ...desk,
        icons: cloneIcons(persisted.icons),
        widgets: desk.widgets.map((widget) => {
          const liveWidget = persistedWidgets.get(widget.id);
          return liveWidget
            ? { ...widget, placement: { ...liveWidget.placement } }
            : { ...widget, placement: { ...widget.placement } };
        }),
      };
    }),
  };
}

type Waiter = {
  resolve: (completion: DeskLayoutSyncCompletion) => void;
  reject: (reason: unknown) => void;
};

export function createDeskLayoutSyncQueue(
  send: (request: DeskLayoutSyncRequest) => Promise<DeskLayoutSyncResult>,
  onSettled: (request: DeskLayoutSyncRequest, result: DeskLayoutSyncResult) => void,
): { submit(request: DeskLayoutSyncRequest): Promise<DeskLayoutSyncCompletion> } {
  let sending = false;
  let pending: DeskLayoutSyncRequest | null = null;
  let activeWaiters: Waiter[] = [];
  let pendingWaiters: Waiter[] = [];

  const settle = (waiters: Waiter[], latest: boolean, result: DeskLayoutSyncResult | null) => {
    waiters.forEach(({ resolve }) => resolve({ latest, result }));
  };

  const reject = (waiters: Waiter[], error: unknown) => {
    waiters.forEach(({ reject: rejectWaiter }) => rejectWaiter(error));
  };

  const run = (request: DeskLayoutSyncRequest) => {
    void send(request).then(
      (result) => {
        if (pending) {
          const next = pending;
          const nextWaiters = pendingWaiters;
          pending = null;
          pendingWaiters = [];
          settle(activeWaiters, false, result);
          activeWaiters = nextWaiters;
          run(next);
          return;
        }
        sending = false;
        try {
          onSettled(request, result);
        } finally {
          settle(activeWaiters, true, result);
          activeWaiters = [];
        }
      },
      (error) => {
        if (pending) {
          const next = pending;
          const nextWaiters = pendingWaiters;
          pending = null;
          pendingWaiters = [];
          settle(activeWaiters, false, null);
          activeWaiters = nextWaiters;
          run(next);
          return;
        }
        sending = false;
        reject(activeWaiters, error);
        activeWaiters = [];
      },
    );
  };

  return {
    submit(request) {
      const waiter = new Promise<DeskLayoutSyncCompletion>((resolve, reject) => {
        const nextWaiter = { resolve, reject };
        if (sending) {
          if (pending) settle(pendingWaiters, false, null);
          pending = request;
          pendingWaiters = [nextWaiter];
          return;
        }
        sending = true;
        activeWaiters = [nextWaiter];
        run(request);
      });
      return waiter;
    },
  };
}
