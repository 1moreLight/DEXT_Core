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

export function roomContractPolicy(version: unknown): RoomContractPolicy {
  if (version === 3) {
    return {versionLabel:"v3",recognized:true,edit:true,save:true,saveAs:false,apply:true,preview:false,zip:true};
  }
  if (version === 2) {
    return {
      versionLabel: "v2",
      recognized: true,
      edit: true,
      save: true,
      saveAs: true,
      apply: true,
      preview: true,
      zip: true,
    };
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

export function readOnlyRoomMessage(version: unknown): string {
  const policy = roomContractPolicy(version);
  return `${policy.versionLabel} 不受支持；Dext 接受原生 Room v2 / v3`;
}
