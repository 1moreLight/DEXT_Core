export type PinLike = {name:string; target:string};

export function pinIdentity(target: string) {
  return target.trim().replace(/\//g, "\\").toUpperCase();
}

/** Effective pins = global pins + desk additions. Empty or missing additions mean global only. */
export function effectiveDockPins<T extends PinLike>(globalPins: readonly T[], additions: readonly T[] | null | undefined): T[] {
  if (!additions || additions.length === 0) return [...globalPins];
  const seen = new Set(globalPins.map(pin => pinIdentity(pin.target)));
  const result = [...globalPins];
  for (const pin of additions) {
    const id = pinIdentity(pin.target);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(pin);
  }
  return result;
}

/** Legacy whole-list overrides become additions that are not already global. */
export function legacyDockAdditions<T extends PinLike>(legacy: readonly T[], globalPins: readonly T[]): T[] {
  const globalIds = new Set(globalPins.map(pin => pinIdentity(pin.target)));
  return legacy.filter(pin => !globalIds.has(pinIdentity(pin.target)));
}

export function dockPinSource(target: string, additions: readonly PinLike[] | null | undefined): "global" | "desk" {
  const id = pinIdentity(target);
  return (additions ?? []).some(pin => pinIdentity(pin.target) === id) ? "desk" : "global";
}
