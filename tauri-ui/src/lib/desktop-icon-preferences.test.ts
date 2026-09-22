import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  DEFAULT_DESKTOP_ICON_PREFERENCES,
  desktopPreferenceDeliveryMessage,
  normalizeDesktopIconPreferences,
  resolveDesktopIconGeometry,
} from "./desktop-icon-preferences";

const rendererGeometry = createRequire(import.meta.url)("../../../wallpapers/dext-room/icon-feedback.js").resolveDesktopIconGeometry;

describe("desktop icon preferences", () => {
  it("uses the production defaults for missing or invalid Core values", () => {
    expect(normalizeDesktopIconPreferences()).toEqual(DEFAULT_DESKTOP_ICON_PREFERENCES);
    expect(normalizeDesktopIconPreferences({
      feedbackStyle: "invalid",
      showLabels: "no",
      hitTargetSize: "huge",
      visualSize: "tiny",
      spacing: "dense",
    })).toEqual(DEFAULT_DESKTOP_ICON_PREFERENCES);
  });

  it("distinguishes an applied update from a deferred next-load update", () => {
    expect(desktopPreferenceDeliveryMessage("not_needed")).toBe("Dext 设置已保存");
    expect(desktopPreferenceDeliveryMessage("applied")).toBe("Dext 设置已保存，已发送至当前桌面");
    expect(desktopPreferenceDeliveryMessage("deferred")).toBe("Dext 设置已保存，将在下次桌面加载时生效");
  });

  it("keeps the three grid gaps compact while preserving independent hit footprints", () => {
    const base = { ...DEFAULT_DESKTOP_ICON_PREFERENCES, hitTargetSize: "standard" as const };
    expect(resolveDesktopIconGeometry({ ...base, spacing: "compact" })).toMatchObject({
      footprintWidth: 80, footprintHeight: 84, gapX: 2, gapY: 4, cellW: 82, cellH: 88,
    });
    expect(resolveDesktopIconGeometry({ ...base, spacing: "standard" })).toMatchObject({
      footprintWidth: 80, footprintHeight: 84, gapX: 8, gapY: 12, cellW: 88, cellH: 96,
    });
    expect(resolveDesktopIconGeometry({ ...base, spacing: "spacious" })).toMatchObject({
      footprintWidth: 80, footprintHeight: 84, gapX: 20, gapY: 24, cellW: 100, cellH: 108,
    });
  });

  it("matches the shared renderer geometry for all 54 preference combinations", () => {
    for (const showLabels of [true, false]) {
      for (const hitTargetSize of ["small", "standard", "large"] as const) {
        for (const visualSize of ["small", "standard", "large"] as const) {
          for (const spacing of ["compact", "standard", "spacious"] as const) {
            const input = { feedbackStyle: "halo" as const, showLabels, hitTargetSize, visualSize, spacing };
            const geometry = resolveDesktopIconGeometry(input);
            expect(geometry).toEqual(rendererGeometry(input));
            expect(geometry.cellW).toBe(geometry.footprintWidth + geometry.gapX);
            expect(geometry.cellH).toBe(geometry.footprintHeight + geometry.gapY);
            expect(geometry.icon).toBe({ small: 48, standard: 56, large: 64 }[visualSize]);
          }
        }
      }
    }
  });
});
