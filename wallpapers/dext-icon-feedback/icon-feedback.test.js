const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ICON_FEEDBACK_STYLES,
  ICON_HIT_TARGET_SIZES,
  ICON_VISUAL_SIZES,
  ICON_SPACING_PRESETS,
  DEFAULT_DESKTOP_ICON_PREFERENCES,
  normalizeDesktopIconPreferences,
  applyDesktopIconPreferences,
  resolveDesktopIconGeometry,
  isHiddenLabelTooltipEligible,
} = require("../dext-room/icon-feedback.js");

test("normalizes desktop icon preferences to the halo and visible-label defaults", () => {
  assert.deepEqual(ICON_FEEDBACK_STYLES, ["halo", "compact", "bare"]);
  assert.deepEqual(ICON_HIT_TARGET_SIZES, ["small", "standard", "large"]);
  assert.deepEqual(ICON_VISUAL_SIZES, ["small", "standard", "large"]);
  assert.deepEqual(ICON_SPACING_PRESETS, ["compact", "standard", "spacious"]);
  assert.deepEqual(DEFAULT_DESKTOP_ICON_PREFERENCES, {
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "standard",
    visualSize: "standard",
    spacing: "standard",
  });
  assert.deepEqual(normalizeDesktopIconPreferences(), DEFAULT_DESKTOP_ICON_PREFERENCES);
  assert.deepEqual(
    normalizeDesktopIconPreferences({ feedbackStyle: "unknown", showLabels: "false" }),
    DEFAULT_DESKTOP_ICON_PREFERENCES,
  );
  assert.deepEqual(normalizeDesktopIconPreferences({ feedbackStyle: "bare", showLabels: false }), {
    feedbackStyle: "bare",
    showLabels: false,
    hitTargetSize: "standard",
    visualSize: "standard",
    spacing: "standard",
  });
  assert.deepEqual(normalizeDesktopIconPreferences({ hitTargetSize: "large", visualSize: "large", spacing: "compact" }), {
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "large",
    visualSize: "large",
    spacing: "compact",
  });
  assert.equal(normalizeDesktopIconPreferences({ visualSize: "huge" }).visualSize, "standard");
  assert.equal(normalizeDesktopIconPreferences({ spacing: "dense" }).spacing, "standard");
});

test("applies preference datasets without replacing existing icon nodes", () => {
  const iconNode = { id: "stable-icon" };
  const root = {
    dataset: {},
    firstElementChild: iconNode,
  };

  const applied = applyDesktopIconPreferences(root, {
    feedbackStyle: "compact",
    showLabels: false,
    hitTargetSize: "small",
    visualSize: "large",
    spacing: "spacious",
  });

  assert.deepEqual(applied, {
    feedbackStyle: "compact",
    showLabels: false,
    hitTargetSize: "small",
    visualSize: "large",
    spacing: "spacious",
  });
  assert.equal(root.dataset.iconFeedback, "compact");
  assert.equal(root.dataset.iconLabels, "hidden");
  assert.equal(root.dataset.iconHitSize, "small");
  assert.equal(root.dataset.iconVisualSize, "large");
  assert.equal(root.dataset.iconSpacing, "spacious");
  assert.equal(root.firstElementChild, iconNode);
});

test("resolves one production grid geometry from independent visual footprint and spacing presets", () => {
  assert.deepEqual(resolveDesktopIconGeometry({}), {
    icon: 56,
    art: 48,
    footprintWidth: 80,
    footprintHeight: 84,
    gapX: 20,
    gapY: 28,
    cellW: 100,
    cellH: 112,
  });
  assert.deepEqual(resolveDesktopIconGeometry({
    showLabels: false,
    hitTargetSize: "small",
    visualSize: "large",
    spacing: "compact",
  }), {
    icon: 64,
    art: 56,
    footprintWidth: 64,
    footprintHeight: 64,
    gapX: 4,
    gapY: 12,
    cellW: 68,
    cellH: 76,
  });
});

test("hidden-label tooltip requires a stable hover outside editing and pointer gestures", () => {
  const eligible = {
    showLabels: false,
    hovered: true,
    editing: false,
    pressed: false,
    dragging: false,
  };

  assert.equal(isHiddenLabelTooltipEligible(eligible), true);
  assert.equal(isHiddenLabelTooltipEligible({ ...eligible, showLabels: true }), false);
  assert.equal(isHiddenLabelTooltipEligible({ ...eligible, hovered: false }), false);
  assert.equal(isHiddenLabelTooltipEligible({ ...eligible, editing: true }), false);
  assert.equal(isHiddenLabelTooltipEligible({ ...eligible, pressed: true }), false);
  assert.equal(isHiddenLabelTooltipEligible({ ...eligible, dragging: true }), false);
});
