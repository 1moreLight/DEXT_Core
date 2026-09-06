import type { Desk, Transition } from "@/lib/room-v2";
import type { GraphEdgeDraft as GEdge } from "@/lib/editor-history";

export type { GEdge };
export interface GraphNodeRect { left: number; right: number; top: number; bottom: number; width: number; height: number; cx: number; cy: number; }
export interface GraphGeometry { width: number; height: number; nodes: Record<string, GraphNodeRect>; }
export interface GraphSegment { x1: number; y1: number; x2: number; y2: number; }

export const EMPTY_GRAPH_GEOMETRY: GraphGeometry = { width: 0, height: 0, nodes: {} };
export const GRAPH_ROW_GAP = 32;

export function seedEdges(ds: Desk[], hasStart: boolean, startDesk = 0, switches: Record<string, Transition> = {}): GEdge[] {
  const edges: GEdge[] = [];
  if (hasStart && ds.length > 0) {
    const target = Math.min(Math.max(startDesk, 0), ds.length - 1);
    edges.push({ id: "start-in", from: "start", to: `d${target}`, trans: null });
  }
  for (let index = 1; index < ds.length; index += 1) {
    edges.push(
      { id: `s${index}f`, from: `d${index - 1}`, to: `d${index}`, trans: switches[`${index - 1}>${index}`] ?? null },
      { id: `s${index}b`, from: `d${index}`, to: `d${index - 1}`, trans: switches[`${index}>${index - 1}`] ?? null },
    );
  }
  if (ds.length > 2) {
    const last = ds.length - 1;
    edges.push(
      { id: "s-wrap-f", from: `d${last}`, to: "d0", trans: switches[`${last}>0`] ?? null },
      { id: "s-wrap-b", from: "d0", to: `d${last}`, trans: switches[`0>${last}`] ?? null },
    );
  }
  return edges;
}

export function pairKey(edge: GEdge) { return [edge.from, edge.to].sort().join("|"); }

export function visualGraphEdges(edges: GEdge[]) {
  const pairs = new Set<string>();
  return edges.filter((edge) => {
    if (edge.from === "start" || edge.to === "start") return true;
    const key = pairKey(edge);
    if (pairs.has(key)) return false;
    pairs.add(key);
    return true;
  });
}

export function reconcileGraphEdges(current: GEdge[], desks: Desk[], hasStart: boolean, startDesk: number) {
  const byRoute = new Map(current.map((edge) => [`${edge.from}>${edge.to}`, edge.trans]));
  return seedEdges(desks, hasStart, startDesk).map((edge) => ({ ...edge, trans: byRoute.get(`${edge.from}>${edge.to}`) ?? null }));
}

export function relativeGraphRect(node: HTMLElement, canvas: DOMRect): GraphNodeRect {
  const rect = node.getBoundingClientRect();
  const left = rect.left - canvas.left;
  const top = rect.top - canvas.top;
  return { left, right: left + rect.width, top, bottom: top + rect.height, width: rect.width, height: rect.height, cx: left + rect.width / 2, cy: top + rect.height / 2 };
}

export function sameGraphGeometry(a: GraphGeometry, b: GraphGeometry) {
  const close = (x: number, y: number) => Math.abs(x - y) < 0.5;
  const aKeys = Object.keys(a.nodes);
  const bKeys = Object.keys(b.nodes);
  if (!close(a.width, b.width) || !close(a.height, b.height) || aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const x = a.nodes[key];
    const y = b.nodes[key];
    return !!y && close(x.left, y.left) && close(x.right, y.right) && close(x.top, y.top) && close(x.bottom, y.bottom);
  });
}

export function routeGraphEdge(edge: GEdge, nodes: Record<string, GraphNodeRect>, laneOffset = 0): GraphSegment[] {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (!from || !to) return [];
  if (edge.from === "start") {
    const elbowX = from.right + Math.max(18, (to.left - from.right) / 2);
    return [
      { x1: from.right, y1: from.cy, x2: elbowX, y2: from.cy },
      { x1: elbowX, y1: from.cy, x2: elbowX, y2: to.cy },
      { x1: elbowX, y1: to.cy, x2: to.left, y2: to.cy },
    ];
  }
  const fromIndex = parseInt(edge.from.slice(1), 10);
  const toIndex = parseInt(edge.to.slice(1), 10);
  const deskCount = Object.keys(nodes).filter((id) => /^d\d+$/.test(id)).length;
  const wraps = deskCount > 2 && Math.abs(fromIndex - toIndex) === deskCount - 1;
  if (!wraps) {
    const down = toIndex > fromIndex;
    const fromX = from.cx + laneOffset;
    const toX = to.cx + laneOffset;
    const fromY = down ? from.bottom : from.top;
    const toY = down ? to.top : to.bottom;
    const middleY = (fromY + toY) / 2;
    return [
      { x1: fromX, y1: fromY, x2: fromX, y2: middleY },
      { x1: fromX, y1: middleY, x2: toX, y2: middleY },
      { x1: toX, y1: middleY, x2: toX, y2: toY },
    ];
  }
  const laneX = Math.max(from.right, to.right) + 48 + laneOffset;
  const yFrom = from.cy + laneOffset;
  const yTo = to.cy + laneOffset;
  return [
    { x1: from.right, y1: yFrom, x2: laneX, y2: yFrom },
    { x1: laneX, y1: yFrom, x2: laneX, y2: yTo },
    { x1: laneX, y1: yTo, x2: to.right, y2: yTo },
  ];
}

export function graphSwitchPosition(edge: GEdge, nodes: Record<string, GraphNodeRect>) {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (!from || !to) return null;
  const fromIndex = parseInt(edge.from.slice(1), 10);
  const toIndex = parseInt(edge.to.slice(1), 10);
  const deskCount = Object.keys(nodes).filter((id) => /^d\d+$/.test(id)).length;
  const wraps = deskCount > 2 && Math.abs(fromIndex - toIndex) === deskCount - 1;
  if (!wraps) {
    const upper = fromIndex < toIndex ? from : to;
    const lower = fromIndex < toIndex ? to : from;
    return { left: (from.cx + to.cx) / 2, top: (upper.bottom + lower.top) / 2 };
  }
  return { left: Math.max(from.right, to.right) + 48, top: (from.cy + to.cy) / 2 };
}
