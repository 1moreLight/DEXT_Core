import { describe, expect, it } from "vitest";
import {
  MINIMIZE_AFTER_DESK_APP_ADD_KEY,
  loadMinimizeAfterDeskAppAdd,
  saveMinimizeAfterDeskAppAdd,
} from "./config-preferences";

function storageWith(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("desk app placement preference", () => {
  it("defaults to entering desktop edit mode unless the user explicitly disables it", () => {
    expect(loadMinimizeAfterDeskAppAdd(storageWith())).toBe(true);
    expect(loadMinimizeAfterDeskAppAdd(storageWith({ [MINIMIZE_AFTER_DESK_APP_ADD_KEY]: "true" }))).toBe(true);
    expect(loadMinimizeAfterDeskAppAdd(storageWith({ [MINIMIZE_AFTER_DESK_APP_ADD_KEY]: "false" }))).toBe(false);
  });

  it("falls back to the safe default when local storage is unavailable", () => {
    const broken = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
    };

    expect(loadMinimizeAfterDeskAppAdd(broken)).toBe(true);
    expect(() => saveMinimizeAfterDeskAppAdd(broken, false)).not.toThrow();
  });

  it("persists the explicit preference value", () => {
    const storage = storageWith();

    saveMinimizeAfterDeskAppAdd(storage, false);

    expect(storage.values.get(MINIMIZE_AFTER_DESK_APP_ADD_KEY)).toBe("false");
  });
});
