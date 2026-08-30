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
