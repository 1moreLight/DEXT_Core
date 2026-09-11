import { describe, expect, it } from "vitest";
import type { Desk as RoomDesk } from "./room-v2";
import { deleteDeskGraph, moveDeskGraph, toggleDeskApplication, type RemappableEdge } from "./desk";

type Desk = { name: string };
type Transition = string;

function edges(count: number): RemappableEdge<Transition>[] {
  const result: RemappableEdge<Transition>[] = [
    { id: "start-in", from: "start", to: "d0", trans: null },
  ];
  for (let index = 1; index < count; index += 1) {
    result.push(
      { id: `s${index}f`, from: `d${index - 1}`, to: `d${index}`, trans: `${index - 1}>${index}` },
      { id: `s${index}b`, from: `d${index}`, to: `d${index - 1}`, trans: `${index}>${index - 1}` }
    );
  }
  if (count > 2) {
    result.push(
      { id: "s-wrap-f", from: `d${count - 1}`, to: "d0", trans: `${count - 1}>0` },
      { id: "s-wrap-b", from: "d0", to: `d${count - 1}`, trans: `0>${count - 1}` }
    );
  }
  return result;
}

const desks = (count: number): Desk[] =>
  Array.from({ length: count }, (_, index) => ({ name: `Desk ${index}` }));

describe("deleteDeskGraph", () => {
  it.each([0, 1, 3])("remaps first, middle and last Desk (%s)", (deleteIndex) => {
    const result = deleteDeskGraph({
      desks: desks(4),
      edges: edges(4),
      deleteIndex,
      startDesk: deleteIndex,
      activeDesk: deleteIndex,
      graphSelection: `d${deleteIndex}`,
      hasStart: true,
    });
    expect(result.desks).toHaveLength(3);
    expect(result.startDesk).toBeGreaterThanOrEqual(0);
    expect(result.startDesk).toBeLessThan(3);
    expect(result.activeDesk).toBe(result.startDesk);
    expect(result.graphSelection).toBe(`d${result.activeDesk}`);
  });

  it("keeps an old directional transition and leaves a newly adjacent route empty", () => {
    const result = deleteDeskGraph({
      desks: desks(4),
      edges: edges(4),
      deleteIndex: 1,
      startDesk: 0,
      activeDesk: 0,
      graphSelection: "d0|d1",
      hasStart: true,
    });
    const byRoute = new Map(result.edges.map((edge) => [`${edge.from}>${edge.to}`, edge.trans]));
    expect(byRoute.get("d1>d2")).toBe("2>3");
    expect(byRoute.get("d0>d1")).toBeNull();
    expect(byRoute.get("d1>d0")).toBeNull();
    expect(result.graphSelection).toBeNull();
  });

  it("remaps a start target after deleting it and supports undo snapshots externally", () => {
    const original = {
      desks: desks(3),
      edges: edges(3),
      startDesk: 2,
      activeDesk: 2,
      graphSelection: "d2",
      hasStart: true,
    };
    const result = deleteDeskGraph({ ...original, deleteIndex: 2 });
    expect(result.startDesk).toBe(1);
    expect(result.edges.find((edge) => edge.id === "start-in")?.to).toBe("d1");
    expect(original.desks).toHaveLength(3);
    expect(original.edges).toHaveLength(7);
  });

  it("refuses to delete the only Desk", () => {
    expect(() =>
      deleteDeskGraph({
        desks: desks(1),
        edges: edges(1),
        deleteIndex: 0,
        startDesk: 0,
        activeDesk: 0,
        graphSelection: "d0",
        hasStart: true,
      })
    ).toThrow("at least one Desk");
  });
});

describe("moveDeskGraph", () => {
  it("moves the complete Desk identity and remaps start, active and selection", () => {
    const result = moveDeskGraph({
      desks: desks(4),
      edges: edges(4),
      fromIndex: 3,
      toIndex: 1,
      startDesk: 3,
      activeDesk: 3,
      graphSelection: "d3",
      hasStart: true,
    });
    expect(result.desks.map((desk) => desk.name)).toEqual(["Desk 0", "Desk 3", "Desk 1", "Desk 2"]);
    expect(result.startDesk).toBe(1);
    expect(result.activeDesk).toBe(1);
    expect(result.graphSelection).toBe("d1");
    expect(result.edges.find((edge) => edge.id === "start-in")?.to).toBe("d1");
  });

  it("preserves transitions only when the same Desk identities remain adjacent", () => {
    const result = moveDeskGraph({
      desks: desks(4),
      edges: edges(4),
      fromIndex: 3,
      toIndex: 1,
      startDesk: 0,
      activeDesk: 0,
      graphSelection: "d0|d1",
      hasStart: true,
    });
    const byRoute = new Map(result.edges.map((edge) => [`${edge.from}>${edge.to}`, edge.trans]));
    expect(byRoute.get("d2>d3")).toBe("1>2");
    expect(byRoute.get("d0>d1")).toBe("0>3");
    expect(byRoute.get("d1>d2")).toBeNull();
    expect(result.graphSelection).toBeNull();
  });
});

describe("toggleDeskApplication", () => {
  const app = {
    name: "New App",
    target: "C:\\Apps\\new.exe",
    arguments: "--start",
    working_dir: "C:\\Apps",
    icon_png: "png",
  };

  it("adds an application at a free position without changing existing icons", () => {
    const desk: RoomDesk = {
      name: "Desk",
      background: null,
      iconSize: "medium",
      icons: [
        { label: "A", icon_png: "", launch: { target: "a.exe", args: "", workdir: "" }, x: 0, y: 0 },
        { label: "C", icon_png: "", launch: { target: "c.exe", args: "", workdir: "" }, x: 2, y: 0 },
      ],
      widgets: [],
      dock: { enabled: false },
    };
    const before = structuredClone(desk);

    const result = toggleDeskApplication(desk, app, { cellWidth: 100, cellHeight: 100, columns: 3, rows: 2 });

    expect(result.action).toBe("added");
    expect(result.desk.icons[2]).toMatchObject({
      label: "New App",
      x: 1,
      y: 0,
      launch: { target: "C:\\Apps\\new.exe", args: "--start", workdir: "C:\\Apps" },
    });
    expect(desk).toEqual(before);
  });

  it("removes an existing application and reports a full Desk without mutation", () => {
    const existing: RoomDesk = {
      name: "Desk",
      background: null,
      icons: [{ label: "New App", icon_png: "png", launch: { target: app.target, args: "", workdir: "" }, x: 0, y: 0 }],
      widgets: [],
      dock: { enabled: false },
    };
    expect(toggleDeskApplication(existing, app, { cellWidth: 100, cellHeight: 100, columns: 1, rows: 1 }))
      .toMatchObject({ action: "removed", desk: { icons: [] } });

    const full: RoomDesk = {
      ...existing,
      icons: [{ label: "Other", icon_png: "", launch: { target: "other.exe", args: "", workdir: "" }, x: 0, y: 0 }],
    };
    const before = structuredClone(full);
    const result = toggleDeskApplication(full, app, { cellWidth: 100, cellHeight: 100, columns: 1, rows: 1 });
    expect(result.action).toBe("full");
    expect(result.desk).toEqual(before);
    expect(full).toEqual(before);
  });
});
