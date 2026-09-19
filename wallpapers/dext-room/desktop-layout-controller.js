(function (root, factory) {
  const motionApi = typeof module === "object" && module.exports
    ? require("./layout-motion.js")
    : root.DextLayoutMotionApi;
  const api = factory(motionApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DextDesktopLayoutController = api.DextDesktopLayoutController;
})(globalThis, function (motionApi) {
  "use strict";

  if (!motionApi) throw new Error("DextLayoutMotionApi is required");

  const EXTERNAL_STATES = new Set(["draggingWidget", "resizingWidget"]);

  function cloneIcons(icons) {
    return (Array.isArray(icons) ? icons : []).map((icon) => ({
      ...icon,
      launch: icon?.launch ? { ...icon.launch } : icon?.launch,
    }));
  }

  function clonePlacement(placement) {
    return placement && typeof placement === "object" ? { ...placement } : null;
  }

  class DextDesktopLayoutController {
    constructor(container, options = {}) {
      if (!container) throw new TypeError("desktop icon container is required");
      this.container = container;
      this.options = options;
      this.profile = options.profile ?? motionApi.DEFAULT_MOTION_PROFILE;
      this.state = "idle";
      this.editing = false;
      this.transaction = null;
      this.publishedIcons = [];
      this.itemsByKey = new Map();
      this._handlers = {
        pointerdown: (event) => this._onPointerDown(event),
        pointermove: (event) => this._onPointerMove(event),
        pointerup: (event) => this._onPointerEnd(event),
        pointercancel: (event) => this._onPointerEnd(event),
        lostpointercapture: (event) => this._onPointerEnd(event),
        dblclick: (event) => this._onDoubleClick(event),
      };
      this.motion = options.motion ?? new motionApi.DextLayoutMotion(container, {
        durations: this.profile.durations,
        easing: this.profile.easing,
        reducedMotion: options.reducedMotion,
        createNode: (item) => this._createNode(item),
        updateNode: (node, item) => this._updateNode(node, item),
      });
      for (const [type, handler] of Object.entries(this._handlers)) {
        this.container.addEventListener?.(type, handler);
      }
    }

    render(icons, { mode = "auto", highlightTarget = "" } = {}) {
      if (this.state !== "idle") this.abort({ restore: false });
      this.publishedIcons = cloneIcons(icons);
      const items = this._motionItems(this.publishedIcons);
      this.itemsByKey = new Map(items.map((item) => [item.key, item.data]));
      const result = this.motion.apply(items, { mode });
      this._highlight(items, highlightTarget);
      return result;
    }

    setEditing(active) {
      const next = Boolean(active);
      if (!next && this.state !== "idle") this.abort({ restore: true });
      this.editing = next;
      this.options.onEditingChange?.(next);
    }

    beginExternalGesture({ kind, baseIcons = this.publishedIcons, basePlacement = null }) {
      if (!EXTERNAL_STATES.has(kind)) throw new TypeError(`unsupported external gesture: ${kind}`);
      if (this.state !== "idle") this.abort({ restore: true });
      this.state = kind;
      this.transaction = {
        kind,
        baseIcons: cloneIcons(baseIcons),
        basePlacement: clonePlacement(basePlacement),
        previewIcons: null,
        previewPlacement: null,
      };
    }

    previewExternal({ icons, placement }) {
      if (!EXTERNAL_STATES.has(this.state) || !this.transaction) return null;
      this.transaction.previewIcons = cloneIcons(icons);
      this.transaction.previewPlacement = clonePlacement(placement);
      if (this.transaction.previewPlacement) {
        this.options.applyExternalPlacement?.(this.transaction.previewPlacement, { preview: true });
      }
      return this.motion.apply(this._motionItems(this.transaction.previewIcons), { mode: "preview" });
    }

    commitExternal({ icons, placement } = {}) {
      if (!EXTERNAL_STATES.has(this.state) || !this.transaction) return null;
      const nextIcons = cloneIcons(icons ?? this.transaction.previewIcons ?? this.transaction.baseIcons);
      const nextPlacement = clonePlacement(placement ?? this.transaction.previewPlacement ?? this.transaction.basePlacement);
      this.publishedIcons = nextIcons;
      this.itemsByKey = new Map(this._motionItems(nextIcons).map((item) => [item.key, item.data]));
      if (nextPlacement) this.options.applyExternalPlacement?.(nextPlacement, { preview: false });
      const result = this.motion.apply(this._motionItems(nextIcons), { mode: "auto" });
      const kind = this.state;
      this.state = "idle";
      this.transaction = null;
      this.options.onExternalCommit?.({ kind, icons: cloneIcons(nextIcons), placement: nextPlacement });
      return result;
    }

    cancelExternal() {
      if (!EXTERNAL_STATES.has(this.state)) return null;
      return this.abort({ restore: true });
    }

    abort({ restore = false } = {}) {
      const transaction = this.transaction;
      this.state = "idle";
      this.transaction = null;
      if (restore && transaction) {
        this.publishedIcons = cloneIcons(transaction.baseIcons);
        if (transaction.basePlacement) {
          this.options.applyExternalPlacement?.(transaction.basePlacement, { preview: false });
        }
      }
      return this.motion.cancel({ restore: Boolean(restore && transaction) });
    }

    dispose() {
      this.abort({ restore: false });
      for (const [type, handler] of Object.entries(this._handlers)) {
        this.container.removeEventListener?.(type, handler);
      }
      this.motion.dispose();
      this.itemsByKey.clear();
    }

    _motionItems(icons) {
      const positionOf = this.options.positionOf ?? ((icon) => ({ left: icon.left ?? icon.x, top: icon.top ?? icon.y }));
      return motionApi.createMotionItems(icons, positionOf);
    }

    _createNode(item) {
      const node = this.options.createIconNode?.(item, item.key)
        ?? this.container.ownerDocument.createElement("div");
      node.dataset.motionKey = item.key;
      return node;
    }

    _updateNode(node, item) {
      node.dataset.motionKey = item.key;
      this.options.updateIconNode?.(node, item, item.key);
    }

    _highlight(items, target) {
      const normalized = String(target ?? "").trim().toLowerCase();
      if (!normalized || !this.motion.nodes) return;
      for (const item of items) {
        const node = this.motion.nodes.get(item.key);
        if (!node) continue;
        const launchTarget = String(item.data?.launch?.target ?? "").trim().toLowerCase();
        node.classList?.toggle?.("icon-new", launchTarget === normalized);
      }
    }

    _iconNode(target) {
      let node = target;
      while (node && node !== this.container) {
        if (node.dataset?.motionKey) return node;
        node = node.parentNode;
      }
      return null;
    }

    _clearPress() {
      if (this.state !== "pressing" || !this.transaction) return;
      clearTimeout(this.transaction.timer);
      this.state = "idle";
      this.transaction = null;
    }

    _onPointerDown(event) {
      if (event.button !== 0 || this.state !== "idle") return;
      const node = this._iconNode(event.target);
      if (!node) return;
      if (this.editing) return;
      const transaction = {
        pointerId: event.pointerId,
        key: node.dataset.motionKey,
        startX: event.clientX,
        startY: event.clientY,
        timer: null,
      };
      transaction.timer = setTimeout(() => {
        if (this.state !== "pressing" || this.transaction !== transaction) return;
        this.state = "idle";
        this.transaction = null;
        this.options.onRequestEdit?.();
      }, 500);
      this.state = "pressing";
      this.transaction = transaction;
      try { node.setPointerCapture?.(event.pointerId); } catch (_error) { /* capture is best effort */ }
    }

    _onPointerMove(event) {
      if (this.state !== "pressing" || this.transaction?.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - this.transaction.startX, event.clientY - this.transaction.startY) > 8) {
        this._clearPress();
      }
    }

    _onPointerEnd(event) {
      if (this.state === "pressing" && this.transaction?.pointerId === event.pointerId) this._clearPress();
    }

    _onDoubleClick(event) {
      if (this.editing) return;
      const node = this._iconNode(event.target);
      const icon = node ? this.itemsByKey.get(node.dataset.motionKey) : null;
      if (icon) this.options.onActivate?.(icon);
    }
  }

  return { DextDesktopLayoutController };
});
