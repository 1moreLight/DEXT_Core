export type RoomContractPolicy = {
  versionLabel: string;
  recognized: boolean;
  edit: boolean;
  save: boolean;
  saveAsV1: boolean;
  apply: boolean;
  previewV1: boolean;
  zipV1: boolean;
};

const READ_ONLY = {
  edit: false,
  save: false,
  saveAsV1: false,
  apply: false,
  previewV1: false,
  zipV1: false,
};

export function roomContractPolicy(version: unknown): RoomContractPolicy {
  if (version === 1) {
    return {
      versionLabel: "v1",
      recognized: true,
      edit: true,
      save: true,
      saveAsV1: true,
      apply: true,
      previewV1: true,
      zipV1: true,
    };
  }
  if (version === 2) {
    return { versionLabel: "v2", recognized: true, ...READ_ONLY };
  }
  return {
    versionLabel: typeof version === "number" ? `v${version}` : "未知版本",
    recognized: false,
    ...READ_ONLY,
  };
}

export function assertV1WritePayload(room: Record<string, unknown>): Record<string, unknown> {
  if (room.version !== 1) throw new Error("v1 write payload must keep version 1");
  const desks = Array.isArray(room.desks) ? room.desks : [];
  if (desks.some((desk) => Boolean(desk && typeof desk === "object" && "widgets" in desk))) {
    throw new Error("v1 write payload must not contain widgets");
  }
  return room;
}

export function readOnlyRoomMessage(version: unknown): string {
  const policy = roomContractPolicy(version);
  return version === 2
    ? "Room v2 契约已识别；WidgetHost 尚未实现，当前只能查看和校验"
    : `${policy.versionLabel} 暂不支持；当前只能查看，不能保存或应用`;
}
