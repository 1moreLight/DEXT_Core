import { describe, expect, it } from "vitest";
import type { Desk } from "@/lib/room-v2";
import { graphSwitchPosition, reconcileGraphEdges, routeGraphEdge, seedEdges, visualGraphEdges } from "./graph";

const desks: Desk[] = ["A", "B", "C"].map((name) => ({ name, background: null, icons: [], widgets: [] }));

describe("Room flow graph", () => {
  it("builds bidirectional adjacent routes plus a three-Desk wrap", () => {
    const edges = seedEdges(desks, true, 1, { "0>1": "fade" });
    expect(edges).toHaveLength(7);
    expect(edges).toContainEqual({ id: "start-in", from: "start", to: "d1", trans: null });
    expect(edges).toContainEqual({ id: "s1f", from: "d0", to: "d1", trans: "fade" });
    expect(visualGraphEdges(edges)).toHaveLength(4);
  });

  it("reconciles topology without losing transitions on surviving routes", () => {
    const current = seedEdges(desks, false, 0, { "0>1": "zoom", "2>0": "none" });
    const next = reconcileGraphEdges(current, desks.slice(0, 2), false, 0);
    expect(next).toEqual([
      { id: "s1f", from: "d0", to: "d1", trans: "zoom" },
      { id: "s1b", from: "d1", to: "d0", trans: null },
    ]);
  });

  it("routes wrap switches through the outer lane", () => {
    const nodes = {
      d0: { left: 0, right: 100, top: 0, bottom: 50, width: 100, height: 50, cx: 50, cy: 25 },
      d1: { left: 0, right: 100, top: 100, bottom: 150, width: 100, height: 50, cx: 50, cy: 125 },
      d2: { left: 0, right: 100, top: 200, bottom: 250, width: 100, height: 50, cx: 50, cy: 225 },
    };
    const wrap = { id: "wrap", from: "d2", to: "d0", trans: "slide" as const };
    expect(routeGraphEdge(wrap, nodes)[0]).toEqual({ x1: 100, y1: 225, x2: 148, y2: 225 });
    expect(graphSwitchPosition(wrap, nodes)).toEqual({ left: 148, top: 125 });
  });
});
