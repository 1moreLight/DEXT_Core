export const ICON_FEEDBACK_STYLES = ["halo", "compact", "bare"] as const;
export const ICON_SIZE_PRESETS = ["small", "standard", "large"] as const;
export const ICON_SPACING_PRESETS = ["compact", "standard", "spacious"] as const;

export type IconFeedbackStyle = (typeof ICON_FEEDBACK_STYLES)[number];
export type IconSizePreset = (typeof ICON_SIZE_PRESETS)[number];
export type IconSpacingPreset = (typeof ICON_SPACING_PRESETS)[number];
export type DesktopPreferenceDeliveryStatus = "not_needed" | "applied" | "deferred";

export type DesktopIconPreferences = {
  feedbackStyle: IconFeedbackStyle;
  showLabels: boolean;
  hitTargetSize: IconSizePreset;
  visualSize: IconSizePreset;
  spacing: IconSpacingPreset;
};

export const DEFAULT_DESKTOP_ICON_PREFERENCES: DesktopIconPreferences = Object.freeze({
  feedbackStyle: "halo",
  showLabels: true,
  hitTargetSize: "standard",
  visualSize: "standard",
  spacing: "standard",
});

const VISUAL = { small: { icon: 48, art: 40 }, standard: { icon: 56, art: 48 }, large: { icon: 64, art: 56 } };
const SHOWN = { small: { width: 72, height: 80 }, standard: { width: 80, height: 84 }, large: { width: 84, height: 88 } };
const HIDDEN = { small: { width: 64, height: 64 }, standard: { width: 72, height: 72 }, large: { width: 80, height: 80 } };
const GAPS = { compact: { x: 4, y: 12 }, standard: { x: 20, y: 28 }, spacious: { x: 40, y: 40 } };

export function resolveDesktopIconGeometry(value: DesktopIconPreferences) {
  const preferences = normalizeDesktopIconPreferences(value);
  const visual = VISUAL[preferences.visualSize];
  const footprint = (preferences.showLabels ? SHOWN : HIDDEN)[preferences.hitTargetSize];
  const gap = GAPS[preferences.spacing];
  return {
    icon: visual.icon, art: visual.art,
    footprintWidth: footprint.width, footprintHeight: footprint.height,
    gapX: gap.x, gapY: gap.y,
    cellW: footprint.width + gap.x, cellH: footprint.height + gap.y,
  };
}

export function normalizeDesktopIconPreferences(value?: Record<string, unknown>): DesktopIconPreferences {
  const input = value ?? {};
  return {
    feedbackStyle: ICON_FEEDBACK_STYLES.includes(input.feedbackStyle as IconFeedbackStyle)
      ? input.feedbackStyle as IconFeedbackStyle
      : DEFAULT_DESKTOP_ICON_PREFERENCES.feedbackStyle,
    showLabels: typeof input.showLabels === "boolean"
      ? input.showLabels
      : DEFAULT_DESKTOP_ICON_PREFERENCES.showLabels,
    hitTargetSize: ICON_SIZE_PRESETS.includes(input.hitTargetSize as IconSizePreset)
      ? input.hitTargetSize as IconSizePreset
      : DEFAULT_DESKTOP_ICON_PREFERENCES.hitTargetSize,
    visualSize: ICON_SIZE_PRESETS.includes(input.visualSize as IconSizePreset)
      ? input.visualSize as IconSizePreset
      : DEFAULT_DESKTOP_ICON_PREFERENCES.visualSize,
    spacing: ICON_SPACING_PRESETS.includes(input.spacing as IconSpacingPreset)
      ? input.spacing as IconSpacingPreset
      : DEFAULT_DESKTOP_ICON_PREFERENCES.spacing,
  };
}

export function desktopPreferenceDeliveryMessage(status: DesktopPreferenceDeliveryStatus) {
  if (status === "applied") return "Dext 设置已保存，当前桌面已更新";
  if (status === "deferred") return "Dext 设置已保存，将在下次桌面加载时生效";
  return "Dext 设置已保存";
}
