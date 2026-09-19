(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DextLayoutMotion = api.DextLayoutMotion;
  root.DextLayoutMotionApi = api;
})(globalThis, function () {
  const DEFAULT_DURATIONS = Object.freeze({ move: 280, enter: 180, exit: 140, rollback: 300 });
  const DEFAULT_EASING = "cubic-bezier(.22,1,.36,1)";
  const IMMEDIATE_MODES = new Set(["immediate", "initial", "staging", "resize"]);

  function compactWhitespace(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normalizePath(value) {
    return compactWhitespace(value)
      .replace(/\\/g, "/")
      .replace(/\/{2,}/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();
  }

  function canonicalValue(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
    if (typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function iconIdentitySignature(icon) {
    const launch = icon?.launch && typeof icon.launch === "object" ? icon.launch : {};
    const target = normalizePath(launch.target);
    if (target) {
      return `launch:${target}|${compactWhitespace(launch.args)}|${normalizePath(launch.workdir)}`;
    }
    const action = canonicalValue(icon?.action);
    const label = compactWhitespace(icon?.label).toLowerCase();
    const glyph = compactWhitespace(icon?.glyph).toLowerCase();
    return `legacy:${action}|${label}|${glyph}`;
  }

  function finiteCoordinate(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
    return number;
  }

  function createMotionItems(icons, positionOf = (icon) => ({ left: icon.left ?? icon.x, top: icon.top ?? icon.y })) {
    const occurrences = new Map();
    return icons.map((icon, index) => {
      const signature = iconIdentitySignature(icon);
      const occurrence = (occurrences.get(signature) ?? 0) + 1;
      occurrences.set(signature, occurrence);
      const position = positionOf(icon, index);
      return {
        key: `${signature}#${occurrence}`,
        left: finiteCoordinate(position.left, "left"),
        top: finiteCoordinate(position.top, "top"),
        data: icon,
      };
    });
  }

  function motionMap(items) {
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item.key !== "string" || !item.key) throw new TypeError("motion item key must be a non-empty string");
      if (map.has(item.key)) throw new Error(`duplicate motion key: ${item.key}`);
      map.set(item.key, {
        ...item,
        left: finiteCoordinate(item.left, "left"),
        top: finiteCoordinate(item.top, "top"),
      });
    }
    return map;
  }

  function diffMotionItems(previousItems, nextItems, excludeKeys = []) {
    const previous = motionMap(previousItems);
    const next = motionMap(nextItems);
    const excluded = new Set(excludeKeys);
    const result = { move: [], enter: [], exit: [], stay: [] };

    for (const [key, nextItem] of next) {
      const previousItem = previous.get(key);
      if (!previousItem) {
        result.enter.push({ key, next: nextItem });
      } else if (!excluded.has(key) && (previousItem.left !== nextItem.left || previousItem.top !== nextItem.top)) {
        result.move.push({ key, previous: previousItem, next: nextItem });
      } else {
        result.stay.push({ key, previous: previousItem, next: nextItem });
      }
    }
    for (const [key, previousItem] of previous) {
      if (!next.has(key)) result.exit.push({ key, previous: previousItem });
    }
    return result;
  }

  function cloneItems(items) {
    return items.map((item) => ({ ...item }));
  }

  class DextLayoutMotion {
    constructor(container, options = {}) {
      if (!container || typeof container.appendChild !== "function") {
        throw new TypeError("DextLayoutMotion requires a DOM container");
      }
      this.container = container;
      this.options = options;
      this.durations = { ...DEFAULT_DURATIONS, ...(options.durations ?? {}) };
      this.easing = options.easing ?? DEFAULT_EASING;
      this.nodes = new Map();
      this.items = new Map();
      this.animations = new Map();
      this.previewBase = null;
      this.revision = 0;
      this.disposed = false;
    }

    apply(items, { mode = "auto", excludeKeys = [] } = {}) {
      if (this.disposed) throw new Error("DextLayoutMotion has been disposed");
      const next = motionMap(items);
      const previousItems = [...this.items.values()];
      const nextItems = [...next.values()];
      const diff = diffMotionItems(previousItems, nextItems, excludeKeys);
      const revision = ++this.revision;
      const excluded = new Set(excludeKeys);
      const firstRects = new Map();
      for (const [key, node] of this.nodes) firstRects.set(key, node.getBoundingClientRect());

      this._cancelAnimations();
      if (mode === "preview" && !this.previewBase) this.previewBase = cloneItems(previousItems);
      if (mode !== "preview" && mode !== "rollback") this.previewBase = null;

      const createdKeys = new Set();
      for (const [key, item] of next) {
        let node = this.nodes.get(key);
        if (!node) {
          node = this._createNode(item);
          this.nodes.set(key, node);
          createdKeys.add(key);
        }
        this._updateNode(node, item);
        node.dataset.motionKey = key;
        node.style.position = "absolute";
        node.style.left = `${item.left}px`;
        node.style.top = `${item.top}px`;
        if (node.parentNode !== this.container) this.container.appendChild(node);
      }

      const exitingKeys = [...this.nodes.keys()].filter((key) => !next.has(key));
      this.items = next;
      const immediate = IMMEDIATE_MODES.has(mode) || this._prefersReducedMotion();
      if (immediate) {
        for (const key of exitingKeys) this._removeNode(key);
        for (const node of this.nodes.values()) this._clearTransientStyles(node);
        return this._result(revision, diff, true, []);
      }

      const lastRects = new Map();
      for (const [key, node] of this.nodes) lastRects.set(key, node.getBoundingClientRect());
      const finished = [];
      const movingKeys = new Set(diff.move.map(({ key }) => key));
      for (const [key, item] of next) {
        const node = this.nodes.get(key);
        const first = firstRects.get(key);
        const last = lastRects.get(key);
        const reentered = first && !previousItems.some((entry) => entry.key === key);
        if (createdKeys.has(key) || reentered) {
          const dx = first ? first.left - last.left : 0;
          const dy = first ? first.top - last.top : 0;
          finished.push(this._animate(
            key,
            node,
            [
              { transform: `translate3d(${dx}px, ${dy}px, 0) scale(.92)`, opacity: 0 },
              { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
            ],
            this.durations.enter,
            revision,
          ));
        } else if (!excluded.has(key) && first && last) {
          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if ((movingKeys.has(key) || dx || dy) && (dx || dy)) {
            finished.push(this._animate(
              key,
              node,
              [
                { transform: `translate3d(${dx}px, ${dy}px, 0)`, opacity: 1 },
                { transform: "translate3d(0, 0, 0)", opacity: 1 },
              ],
              mode === "rollback" ? this.durations.rollback : this.durations.move,
              revision,
            ));
          }
        }
      }

      for (const key of exitingKeys) {
        const node = this.nodes.get(key);
        const first = firstRects.get(key);
        const last = lastRects.get(key);
        const dx = first && last ? first.left - last.left : 0;
        const dy = first && last ? first.top - last.top : 0;
        finished.push(this._animate(
          key,
          node,
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(1)`, opacity: 1 },
            { transform: `translate3d(${dx}px, ${dy}px, 0) scale(.92)`, opacity: 0 },
          ],
          this.durations.exit,
          revision,
          () => {
            if (this.revision === revision && !this.items.has(key) && this.nodes.get(key) === node) this._removeNode(key);
          },
        ));
      }

      return this._result(revision, diff, false, finished);
    }

    cancel({ restore = false } = {}) {
      if (this.disposed) return null;
      const baseline = restore && this.previewBase ? cloneItems(this.previewBase) : null;
      ++this.revision;
      this._cancelAnimations();
      for (const [key, node] of this.nodes) {
        this._clearTransientStyles(node);
        if (!this.items.has(key)) this._removeNode(key);
      }
      this.previewBase = null;
      return baseline ? this.apply(baseline, { mode: "rollback" }) : null;
    }

    dispose() {
      if (this.disposed) return;
      ++this.revision;
      this._cancelAnimations();
      for (const key of [...this.nodes.keys()]) this._removeNode(key);
      this.items.clear();
      this.previewBase = null;
      this.disposed = true;
    }

    _createNode(item) {
      if (typeof this.options.createNode === "function") return this.options.createNode(item);
      const node = this.container.ownerDocument.createElement("div");
      node.textContent = item.data?.label ?? item.key;
      return node;
    }

    _updateNode(node, item) {
      if (typeof this.options.updateNode === "function") this.options.updateNode(node, item);
    }

    _prefersReducedMotion() {
      if (typeof this.options.reducedMotion === "function") return Boolean(this.options.reducedMotion());
      if (typeof this.options.reducedMotion === "boolean") return this.options.reducedMotion;
      return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    _animate(key, node, keyframes, duration, revision, onFinish) {
      try {
        const animation = node.animate(keyframes, { duration, easing: this.easing, fill: "both" });
        this.animations.set(key, animation);
        return Promise.resolve(animation.finished).then(() => {
          if (this.revision !== revision || this.animations.get(key) !== animation) return { canceled: true };
          this.animations.delete(key);
          this._clearTransientStyles(node);
          try { animation.cancel(); } catch (_error) { /* finished effect is already at its final state */ }
          if (onFinish) onFinish();
          return { canceled: false };
        }).catch(() => ({ canceled: true }));
      } catch (_error) {
        this._clearTransientStyles(node);
        if (onFinish && this.revision === revision) onFinish();
        return Promise.resolve({ canceled: false, degraded: true });
      }
    }

    _cancelAnimations() {
      for (const animation of this.animations.values()) {
        try { animation.cancel(); } catch (_error) { /* final layout is already written */ }
      }
      this.animations.clear();
    }

    _clearTransientStyles(node) {
      node.style.transform = "";
      node.style.opacity = "";
    }

    _removeNode(key) {
      const node = this.nodes.get(key);
      if (node?.parentNode === this.container) node.remove();
      this.nodes.delete(key);
    }

    _result(revision, diff, immediate, finished) {
      return {
        revision,
        diff,
        immediate,
        finished: Promise.all(finished),
      };
    }
  }

  return {
    DEFAULT_DURATIONS,
    DEFAULT_EASING,
    DextLayoutMotion,
    createMotionItems,
    diffMotionItems,
    iconIdentitySignature,
  };
});
