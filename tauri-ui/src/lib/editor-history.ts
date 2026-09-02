import type { DockConfig } from "@/lib/dock";
import type { Content, Desk, Transition } from "@/lib/room-v2";

export interface GraphEdgeDraft {
  id: string;
  from: string;
  to: string;
  trans: Transition | null;
}

export interface RoomEditorSnapshot {
  edges: GraphEdgeDraft[];
  desks: Desk[];
  dock: DockConfig;
  transition: Transition;
  startName: string;
  startContent: Content | null;
  idleName: string;
  idleContent: Content | null;
  hasStart: boolean;
  startDesk: number;
}

export interface RoomEditorHistoryRecord {
  version: 1;
  roomPath: string;
  baseRoomJson: string;
  current: RoomEditorSnapshot;
  past: RoomEditorSnapshot[];
  future: RoomEditorSnapshot[];
  dirty: boolean;
  updatedAt: number;
}

const DATABASE = "dext-configurator-v2";
const STORE = "room-editor-history";

export function normalizeRoomJson(text: string) {
  return JSON.stringify(JSON.parse(text));
}

export function cloneEditorSnapshot(snapshot: RoomEditorSnapshot): RoomEditorSnapshot {
  return structuredClone(snapshot);
}

export function compatibleHistoryRecord(
  value: unknown,
  roomPath: string,
  baseRoomJson: string,
): RoomEditorHistoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RoomEditorHistoryRecord>;
  if (record.version !== 1 || record.roomPath !== roomPath || record.baseRoomJson !== baseRoomJson) return null;
  if (!record.current || !Array.isArray(record.current.desks) || !record.current.desks.length ||
      !Array.isArray(record.current.edges) || !Array.isArray(record.past) || !Array.isArray(record.future)) return null;
  return record as RoomEditorHistoryRecord;
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("open editor history database failed"));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openHistoryDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("editor history operation failed"));
      tx.onabort = () => reject(tx.error ?? new Error("editor history transaction aborted"));
    });
  } finally {
    database.close();
  }
}

export async function loadEditorHistory(roomPath: string, baseRoomJson: string) {
  const value = await transaction("readonly", (store) => store.get(roomPath));
  return compatibleHistoryRecord(value, roomPath, baseRoomJson);
}

export async function saveEditorHistory(record: RoomEditorHistoryRecord) {
  await transaction("readwrite", (store) => store.put(record, record.roomPath));
}

export async function deleteEditorHistory(roomPath: string) {
  await transaction("readwrite", (store) => store.delete(roomPath));
}
