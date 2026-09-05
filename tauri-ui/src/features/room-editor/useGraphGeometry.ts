import { useLayoutEffect, useRef, useState } from "react";
import {
  EMPTY_GRAPH_GEOMETRY,
  GRAPH_ROW_GAP,
  relativeGraphRect,
  sameGraphGeometry,
  type GraphGeometry,
  type GraphNodeRect,
} from "@/features/room-editor/graph";
import type { Desk } from "@/lib/room-v2";

export function useGraphGeometry(active: boolean, desks: Desk[], edgeCount: number) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const startNodeRef = useRef<HTMLButtonElement>(null);
  const deskNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [geometry, setGeometry] = useState<GraphGeometry>(EMPTY_GRAPH_GEOMETRY);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentCanvas = canvasRef.current;
        if (!currentCanvas) return;
        const canvasRect = currentCanvas.getBoundingClientRect();
        const nodes: Record<string, GraphNodeRect> = {};
        if (startNodeRef.current) nodes.start = relativeGraphRect(startNodeRef.current, canvasRect);
        desks.forEach((_, index) => {
          const id = `d${index}`;
          const node = deskNodeRefs.current.get(id);
          if (node) nodes[id] = relativeGraphRect(node, canvasRect);
        });
        const next = { width: canvasRect.width, height: canvasRect.height, nodes };
        setGeometry((current) => sameGraphGeometry(current, next) ? current : next);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    if (startNodeRef.current) observer.observe(startNodeRef.current);
    desks.forEach((_, index) => {
      const node = deskNodeRefs.current.get(`d${index}`);
      if (node) observer.observe(node);
    });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [active, desks.length, edgeCount]);

  const measuredDeskHeights = Object.entries(geometry.nodes)
    .filter(([id]) => id.startsWith("d"))
    .map(([, rect]) => rect.height);
  const graphRowHeight = Math.max(56, ...measuredDeskHeights) + GRAPH_ROW_GAP;
  const minHeight = Math.max(240, (desks.length + 1) * graphRowHeight);

  return { canvasRef, startNodeRef, deskNodeRefs, geometry, minHeight };
}
