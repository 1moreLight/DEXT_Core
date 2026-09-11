import type { Desk } from "@/lib/room-v2";
import type { DockConfig } from "@/lib/dock";
import { findOpenDeskIconCell, type IconGrid } from "@/lib/widget-layout";

export type RemappableEdge<T> = {
  id: string;
  from: string;
  to: string;
  trans: T | null;
};

export type DeleteDeskInput<D, T> = {
  desks: D[];
  edges: RemappableEdge<T>[];
  deleteIndex: number;
  startDesk: number;
  activeDesk: number;
  graphSelection: string | null;
  hasStart: boolean;
};

export type DeleteDeskResult<D, T> = {
  desks: D[];
  edges: RemappableEdge<T>[];
  startDesk: number;
  activeDesk: number;
  graphSelection: string | null;
};

export type MoveDeskInput<D, T> = Omit<DeleteDeskInput<D, T>, "deleteIndex"> & {
  fromIndex: number;
  toIndex: number;
};

export interface DeskApplication {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
}

export type ToggleDeskApplicationResult = {
  desk: Desk;
  action: "added" | "removed" | "full";
};

export function toggleDeskApplication(
  desk: Desk,
  app: DeskApplication,
  grid?: IconGrid,
  roomDock?: DockConfig,
): ToggleDeskApplicationResult {
  if (desk.icons.some((icon) => icon.launch.target === app.target)) {
    return {
      desk: { ...desk, icons: desk.icons.filter((icon) => icon.launch.target !== app.target) },
      action: "removed",
    };
  }

  const position = findOpenDeskIconCell(desk, grid, roomDock);
  if (!position) return { desk, action: "full" };
  return {
    desk: {
      ...desk,
      icons: [
        ...desk.icons,
        {
          label: app.name,
          icon_png: app.icon_png,
          launch: { target: app.target, args: app.arguments, workdir: app.working_dir },
          ...position,
        },
      ],
    },
    action: "added",
  };
}

function oldIndexForNew(newIndex: number, deleted: number): number {
  return newIndex < deleted ? newIndex : newIndex + 1;
}

function remapIndex(oldIndex: number, deleted: number): number | null {
  if (oldIndex === deleted) return null;
  return oldIndex < deleted ? oldIndex : oldIndex - 1;
}

export function deleteDeskGraph<D, T>(input: DeleteDeskInput<D, T>): DeleteDeskResult<D, T> {
  const { desks, edges, deleteIndex, hasStart } = input;
  if (desks.length <= 1) throw new Error("at least one Desk must remain");
  if (!Number.isInteger(deleteIndex) || deleteIndex < 0 || deleteIndex >= desks.length) {
    throw new Error("deleteIndex is outside the Desk list");
  }

  const nextDesks = desks.filter((_, index) => index !== deleteIndex);
  const routeTransitions = new Map(
    edges
      .filter((edge) => edge.from !== "start" && edge.to !== "start")
      .map((edge) => [`${edge.from}>${edge.to}`, edge.trans] as const)
  );
  const nextEdges: RemappableEdge<T>[] = [];

  const nextStart = (() => {
    const remapped = remapIndex(input.startDesk, deleteIndex);
    return remapped ?? Math.min(deleteIndex, nextDesks.length - 1);
  })();
  if (hasStart) {
    nextEdges.push({ id: "start-in", from: "start", to: `d${nextStart}`, trans: null });
  }

  const addRoute = (id: string, from: number, to: number) => {
    const oldFrom = oldIndexForNew(from, deleteIndex);
    const oldTo = oldIndexForNew(to, deleteIndex);
    nextEdges.push({
      id,
      from: `d${from}`,
      to: `d${to}`,
      trans: routeTransitions.get(`d${oldFrom}>d${oldTo}`) ?? null,
    });
  };
  for (let index = 1; index < nextDesks.length; index += 1) {
    addRoute(`s${index}f`, index - 1, index);
    addRoute(`s${index}b`, index, index - 1);
  }
  if (nextDesks.length > 2) {
    const last = nextDesks.length - 1;
    addRoute("s-wrap-f", last, 0);
    addRoute("s-wrap-b", 0, last);
  }

  const remappedActive = remapIndex(input.activeDesk, deleteIndex);
  const activeDesk = remappedActive ?? Math.min(deleteIndex, nextDesks.length - 1);
  let graphSelection = input.graphSelection;
  if (graphSelection && /^d\d+$/.test(graphSelection)) {
    const selected = Number(graphSelection.slice(1));
    const remapped = remapIndex(selected, deleteIndex);
    graphSelection = `d${remapped ?? activeDesk}`;
  } else if (graphSelection && graphSelection !== "start") {
    graphSelection = null;
  }

  return {
    desks: nextDesks,
    edges: nextEdges,
    startDesk: nextStart,
    activeDesk,
    graphSelection,
  };
}

export function moveDeskGraph<D, T>(input: MoveDeskInput<D, T>): DeleteDeskResult<D, T> {
  const { desks, edges, fromIndex, toIndex, hasStart } = input;
  if (![fromIndex, toIndex].every(Number.isInteger) ||
      fromIndex < 0 || fromIndex >= desks.length || toIndex < 0 || toIndex >= desks.length) {
    throw new Error("Desk move index is outside the Desk list");
  }
  if (fromIndex === toIndex) {
    return {
      desks: [...desks],
      edges: edges.map((edge) => ({ ...edge })),
      startDesk: input.startDesk,
      activeDesk: input.activeDesk,
      graphSelection: input.graphSelection,
    };
  }

  const order = desks.map((_, index) => index);
  const [movedOldIndex] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, movedOldIndex);
  const oldToNew = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const nextDesks = order.map((oldIndex) => desks[oldIndex]);
  const routeTransitions = new Map(
    edges
      .filter((edge) => /^d\d+$/.test(edge.from) && /^d\d+$/.test(edge.to))
      .map((edge) => [`${edge.from}>${edge.to}`, edge.trans] as const)
  );
  const nextStart = oldToNew.get(input.startDesk) ?? 0;
  const nextEdges: RemappableEdge<T>[] = hasStart
    ? [{ id: "start-in", from: "start", to: `d${nextStart}`, trans: null }]
    : [];
  const addRoute = (id: string, from: number, to: number) => {
    const oldFrom = order[from];
    const oldTo = order[to];
    nextEdges.push({
      id,
      from: `d${from}`,
      to: `d${to}`,
      trans: routeTransitions.get(`d${oldFrom}>d${oldTo}`) ?? null,
    });
  };
  for (let index = 1; index < nextDesks.length; index += 1) {
    addRoute(`s${index}f`, index - 1, index);
    addRoute(`s${index}b`, index, index - 1);
  }
  if (nextDesks.length > 2) {
    const last = nextDesks.length - 1;
    addRoute("s-wrap-f", last, 0);
    addRoute("s-wrap-b", 0, last);
  }

  const nextActive = oldToNew.get(input.activeDesk) ?? 0;
  let graphSelection = input.graphSelection;
  if (graphSelection && /^d\d+$/.test(graphSelection)) {
    graphSelection = `d${oldToNew.get(Number(graphSelection.slice(1))) ?? nextActive}`;
  } else if (graphSelection && graphSelection !== "start" && graphSelection !== "idle") {
    graphSelection = null;
  }
  return {
    desks: nextDesks,
    edges: nextEdges,
    startDesk: nextStart,
    activeDesk: nextActive,
    graphSelection,
  };
}
