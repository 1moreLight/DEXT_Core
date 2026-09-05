import { describe, expect, it } from "vitest";
import { cloneEditorSnapshot, compatibleHistoryRecord, normalizeRoomJson, type RoomEditorHistoryRecord } from "./editor-history";

const snapshot = {
  edges: [],
  desks: [{ name: "Desk", background: null, iconSize: "medium" as const, icons: [], widgets: [] }],
  dock: { enabled: true, position: "bottom" as const, autoHide: false, indicator: "text" as const, style: {}, icons: [] },
  transition: "slide" as const,
  startName: "Start",
  startContent: null,
  idleName: "Idle",
  idleContent: null,
  hasStart: true,
  startDesk: 0,
};

describe("persistent editor history", () => {
  it("normalizes formatting before comparing the disk baseline", () => {
    expect(normalizeRoomJson('{ "version": 2, "desks": [] }')).toBe('{"version":2,"desks":[]}');
  });

  it("accepts only the same Room and unchanged disk baseline", () => {
    const record: RoomEditorHistoryRecord = {
      version: 1, roomPath: "C:/rooms/test", baseRoomJson: "base", current: snapshot,
      past: [], future: [], dirty: true, updatedAt: 1,
    };
    expect(compatibleHistoryRecord(record, "C:/rooms/test", "base")).toEqual(record);
    expect(compatibleHistoryRecord(record, "C:/rooms/other", "base")).toBeNull();
    expect(compatibleHistoryRecord(record, "C:/rooms/test", "changed")).toBeNull();
  });

  it("deep-clones nested Widget and icon state", () => {
    const source = cloneEditorSnapshot(snapshot);
    source.desks[0].name = "Changed";
    expect(snapshot.desks[0].name).toBe("Desk");
  });
});
