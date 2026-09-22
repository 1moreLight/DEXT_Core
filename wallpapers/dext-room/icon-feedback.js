// Production-owned shared icon feedback runtime; the browser lab imports this same file.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DextIconFeedback = api;
})(globalThis, function () {
  const ICON_FEEDBACK_STYLES = Object.freeze(["halo", "compact", "bare"]);
  const ICON_HIT_TARGET_SIZES = Object.freeze(["small", "standard", "large"]);
  const ICON_VISUAL_SIZES = Object.freeze(["small", "standard", "large"]);
  const ICON_SPACING_PRESETS = Object.freeze(["compact", "standard", "spacious"]);
  const DEFAULT_DESKTOP_ICON_PREFERENCES = Object.freeze({
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "standard",
    visualSize: "standard",
    spacing: "standard",
  });

  const VISUAL_GEOMETRY = Object.freeze({
    small: Object.freeze({ icon: 48, art: 40 }),
    standard: Object.freeze({ icon: 56, art: 48 }),
    large: Object.freeze({ icon: 64, art: 56 }),
  });
  const SHOWN_FOOTPRINTS = Object.freeze({
    small: Object.freeze({ width: 72, height: 80 }),
    standard: Object.freeze({ width: 80, height: 84 }),
    large: Object.freeze({ width: 84, height: 88 }),
  });
  const HIDDEN_FOOTPRINTS = Object.freeze({
    small: Object.freeze({ width: 64, height: 64 }),
    standard: Object.freeze({ width: 72, height: 72 }),
    large: Object.freeze({ width: 80, height: 80 }),
  });
  const SPACING_GEOMETRY = Object.freeze({
    compact: Object.freeze({ x: 2, y: 4 }),
    standard: Object.freeze({ x: 8, y: 12 }),
    spacious: Object.freeze({ x: 20, y: 24 }),
  });

  function normalizeDesktopIconPreferences(value) {
    const input = value && typeof value === "object" ? value : {};
    return {
      feedbackStyle: ICON_FEEDBACK_STYLES.includes(input.feedbackStyle)
        ? input.feedbackStyle
        : DEFAULT_DESKTOP_ICON_PREFERENCES.feedbackStyle,
      showLabels: typeof input.showLabels === "boolean"
        ? input.showLabels
        : DEFAULT_DESKTOP_ICON_PREFERENCES.showLabels,
      hitTargetSize: ICON_HIT_TARGET_SIZES.includes(input.hitTargetSize)
        ? input.hitTargetSize
        : DEFAULT_DESKTOP_ICON_PREFERENCES.hitTargetSize,
      visualSize: ICON_VISUAL_SIZES.includes(input.visualSize)
        ? input.visualSize
        : DEFAULT_DESKTOP_ICON_PREFERENCES.visualSize,
      spacing: ICON_SPACING_PRESETS.includes(input.spacing)
        ? input.spacing
        : DEFAULT_DESKTOP_ICON_PREFERENCES.spacing,
    };
  }

  function resolveDesktopIconGeometry(value) {
    const preferences = normalizeDesktopIconPreferences(value);
    const visual = VISUAL_GEOMETRY[preferences.visualSize];
    const footprint = (preferences.showLabels ? SHOWN_FOOTPRINTS : HIDDEN_FOOTPRINTS)[preferences.hitTargetSize];
    const spacing = SPACING_GEOMETRY[preferences.spacing];
    return {
      icon: visual.icon,
      art: visual.art,
      footprintWidth: footprint.width,
      footprintHeight: footprint.height,
      gapX: spacing.x,
      gapY: spacing.y,
      cellW: footprint.width + spacing.x,
      cellH: footprint.height + spacing.y,
    };
  }

  function applyDesktopIconPreferences(rootElement, value) {
    if (!rootElement || !rootElement.dataset) {
      throw new TypeError("A root element with a dataset is required.");
    }
    const preferences = normalizeDesktopIconPreferences(value);
    rootElement.dataset.iconFeedback = preferences.feedbackStyle;
    rootElement.dataset.iconLabels = preferences.showLabels ? "shown" : "hidden";
    rootElement.dataset.iconHitSize = preferences.hitTargetSize;
    rootElement.dataset.iconVisualSize = preferences.visualSize;
    rootElement.dataset.iconSpacing = preferences.spacing;
    return preferences;
  }

  function isHiddenLabelTooltipEligible(state) {
    return state?.showLabels === false
      && state?.hovered === true
      && state?.editing !== true
      && state?.pressed !== true
      && state?.dragging !== true;
  }

  function createDesktopIconFeedbackController(rootElement, options = {}) {
    if (!rootElement || typeof rootElement.addEventListener !== "function") {
      throw new TypeError("A DOM root element is required.");
    }

    const tooltipDelay = Number.isFinite(options.tooltipDelay)
      ? Math.max(0, options.tooltipDelay)
      : 500;
    let preferences = applyDesktopIconPreferences(rootElement, options.preferences);
    let hoveredFace = null;
    let pressed = false;
    let editing = false;
    let dragging = false;
    let tooltipTimer = 0;
    let activePointerId = null;
    const ownerWindow = rootElement.ownerDocument?.defaultView ?? globalThis;

    function faceFromTarget(target) {
      const face = target?.closest?.("[data-dext-icon-face]");
      return face && rootElement.contains(face) ? face : null;
    }

    function tooltipFor(face) {
      return face?.querySelector?.(".icon-label-tooltip") ?? null;
    }

    function hideTooltip() {
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = 0;
      }
      const tooltip = tooltipFor(hoveredFace);
      if (tooltip) tooltip.dataset.visible = "false";
    }

    function tooltipState() {
      return {
        showLabels: preferences.showLabels,
        hovered: Boolean(hoveredFace),
        editing,
        pressed: pressed || rootElement.dataset.iconPreviewState === "pressed",
        dragging,
      };
    }

    function scheduleTooltip() {
      hideTooltip();
      if (!isHiddenLabelTooltipEligible(tooltipState())) return;
      const scheduledFace = hoveredFace;
      tooltipTimer = setTimeout(() => {
        tooltipTimer = 0;
        if (scheduledFace !== hoveredFace || !isHiddenLabelTooltipEligible(tooltipState())) return;
        const tooltip = tooltipFor(scheduledFace);
        if (tooltip) tooltip.dataset.visible = "true";
      }, tooltipDelay);
    }

    function onPointerOver(event) {
      const face = faceFromTarget(event.target);
      if (!face || face === hoveredFace) return;
      hideTooltip();
      hoveredFace = face;
      scheduleTooltip();
    }

    function onPointerOut(event) {
      const face = faceFromTarget(event.target);
      if (!face || face !== hoveredFace || face.contains(event.relatedTarget)) return;
      hideTooltip();
      hoveredFace = null;
    }

    function onPointerDown(event) {
      const face = faceFromTarget(event.target);
      if (!face) return;
      pressed = true;
      activePointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
      rootElement.dataset.iconPressed = "true";
      hideTooltip();
    }

    function onPointerEnd(event) {
      if (!pressed) return;
      if (Number.isFinite(event?.pointerId)
        && activePointerId !== null
        && event.pointerId !== activePointerId) return;
      pressed = false;
      activePointerId = null;
      rootElement.dataset.iconPressed = "false";
      scheduleTooltip();
    }

    rootElement.addEventListener("pointerover", onPointerOver);
    rootElement.addEventListener("pointerout", onPointerOut);
    rootElement.addEventListener("pointerdown", onPointerDown);
    ownerWindow.addEventListener("pointerup", onPointerEnd, true);
    ownerWindow.addEventListener("pointercancel", onPointerEnd, true);
    ownerWindow.addEventListener("blur", onPointerEnd);

    return {
      setPreferences(value) {
        preferences = applyDesktopIconPreferences(rootElement, value);
        scheduleTooltip();
        return preferences;
      },
      setEditing(active) {
        editing = Boolean(active);
        rootElement.dataset.iconEditing = String(editing);
        scheduleTooltip();
      },
      setDragging(active) {
        dragging = Boolean(active);
        rootElement.dataset.iconDragging = String(dragging);
        scheduleTooltip();
      },
      dispose() {
        hideTooltip();
        rootElement.removeEventListener("pointerover", onPointerOver);
        rootElement.removeEventListener("pointerout", onPointerOut);
        rootElement.removeEventListener("pointerdown", onPointerDown);
        ownerWindow.removeEventListener("pointerup", onPointerEnd, true);
        ownerWindow.removeEventListener("pointercancel", onPointerEnd, true);
        ownerWindow.removeEventListener("blur", onPointerEnd);
      },
    };
  }

  return {
    ICON_FEEDBACK_STYLES,
    ICON_HIT_TARGET_SIZES,
    ICON_VISUAL_SIZES,
    ICON_SPACING_PRESETS,
    DEFAULT_DESKTOP_ICON_PREFERENCES,
    normalizeDesktopIconPreferences,
    resolveDesktopIconGeometry,
    applyDesktopIconPreferences,
    isHiddenLabelTooltipEligible,
    createDesktopIconFeedbackController,
  };
});
