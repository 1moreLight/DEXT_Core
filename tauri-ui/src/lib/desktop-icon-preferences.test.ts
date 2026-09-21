import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_ICON_PREFERENCES,
  desktopPreferenceDeliveryMessage,
  normalizeDesktopIconPreferences,
} from "./desktop-icon-preferences";

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
    expect(desktopPreferenceDeliveryMessage("applied")).toBe("Dext 设置已保存，当前桌面已更新");
    expect(desktopPreferenceDeliveryMessage("deferred")).toBe("Dext 设置已保存，将在下次桌面加载时生效");
  });
});
