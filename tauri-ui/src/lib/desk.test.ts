import { describe, expect, it } from "vitest";
import { deleteDeskGraph, moveDeskGraph, type RemappableEdge } from "./desk";

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
