export const MINIMIZE_AFTER_DESK_APP_ADD_KEY = "dext.minimizeAfterDeskAppAdd.v1";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function loadMinimizeAfterDeskAppAdd(storage: Pick<PreferenceStorage, "getItem">): boolean {
  try {
    return storage.getItem(MINIMIZE_AFTER_DESK_APP_ADD_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveMinimizeAfterDeskAppAdd(
  storage: Pick<PreferenceStorage, "setItem">,
  value: boolean,
): void {
  try {
    storage.setItem(MINIMIZE_AFTER_DESK_APP_ADD_KEY, String(value));
  } catch {
    // Preferences are optional; an unavailable browser storage must not block editing.
  }
}
