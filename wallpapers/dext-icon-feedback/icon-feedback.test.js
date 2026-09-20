const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ICON_FEEDBACK_STYLES,
  ICON_HIT_TARGET_SIZES,
  ICON_VISUAL_SIZES,
  DEFAULT_DESKTOP_ICON_PREFERENCES,
  normalizeDesktopIconPreferences,
  applyDesktopIconPreferences,
  isHiddenLabelTooltipEligible,
} = require("./icon-feedback.js");

test("normalizes desktop icon preferences to the halo and visible-label defaults", () => {
  assert.deepEqual(ICON_FEEDBACK_STYLES, ["halo", "compact", "bare"]);
  assert.deepEqual(ICON_HIT_TARGET_SIZES, ["small", "standard", "large"]);
  assert.deepEqual(ICON_VISUAL_SIZES, ["small", "standard", "large"]);
  assert.deepEqual(DEFAULT_DESKTOP_ICON_PREFERENCES, {
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "standard",
    visualSize: "standard",
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
  });
  assert.deepEqual(normalizeDesktopIconPreferences({ hitTargetSize: "large", visualSize: "large" }), {
    feedbackStyle: "halo",
    showLabels: true,
    hitTargetSize: "large",
    visualSize: "large",
  });
  assert.equal(normalizeDesktopIconPreferences({ visualSize: "huge" }).visualSize, "standard");
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
  });

  assert.deepEqual(applied, {
    feedbackStyle: "compact",
    showLabels: false,
    hitTargetSize: "small",
    visualSize: "large",
  });
  assert.equal(root.dataset.iconFeedback, "compact");
  assert.equal(root.dataset.iconLabels, "hidden");
  assert.equal(root.dataset.iconHitSize, "small");
  assert.equal(root.dataset.iconVisualSize, "large");
  assert.equal(root.firstElementChild, iconNode);
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
