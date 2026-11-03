export type RoomCompatibility = { supported: boolean; needsUpdate: boolean; message: string };

export type RoomContractPolicy = {
  versionLabel: string;
  recognized: boolean;
  edit: boolean;
  save: boolean;
  saveAs: boolean;
  apply: boolean;
  preview: boolean;
  zip: boolean;
};

const READ_ONLY = {
  edit: false,
  save: false,
  saveAs: false,
  apply: false,
  preview: false,
  zip: false,
};

export function roomContractPolicy(version: unknown, compatibility?: RoomCompatibility | null): RoomContractPolicy {
  if (compatibility && !compatibility.supported) {
    return {versionLabel: compatibility.needsUpdate ? "需要更新" : "暂不可用", recognized:false, ...READ_ONLY};
  }
  if (version === 3) {
    return {versionLabel:"v3",recognized:true,edit:true,save:true,saveAs:true,apply:true,preview:false,zip:true};
  }
  if (version === 2) {
    return {versionLabel: "v2 已停止", recognized: false, ...READ_ONLY};
  }
  return {
    versionLabel: typeof version === "number" ? `v${version}` : "未知版本",
    recognized: false,
    ...READ_ONLY,
  };
}

export function assertRoomV2WritePayload(room: Record<string, unknown>): Record<string, unknown> {
  if (room.version !== 2) throw new Error("Room write payload must keep version 2");
  const desks = Array.isArray(room.desks) ? room.desks : [];
  if (
    desks.length === 0 ||
    desks.some(
      (desk) =>
        !desk ||
        typeof desk !== "object" ||
        !("widgets" in desk) ||
        !Array.isArray((desk as { widgets?: unknown }).widgets)
    )
  ) {
    throw new Error("Room v2 write payload requires a widgets array on every Desk");
  }
  return room;
}

export function readOnlyRoomMessage(version: unknown, compatibility?: RoomCompatibility | null): string {
  if (compatibility && !compatibility.supported) return compatibility.message;
  const policy = roomContractPolicy(version);
  if (version === 2) return "此 Room 是 v2，已不受支持。旧画布、流程和 Dock 编辑器已删除，不能再用旧编辑器打开。请使用 Room v3。";
  return `${policy.versionLabel} 不受支持；Dext 只编辑原生 Room v3`;
}
