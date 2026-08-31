import { describe, expect, it } from "vitest";
import { assertV1WritePayload, roomContractPolicy } from "./room-contract";

describe("room contract operation matrix", () => {
  it("keeps all existing v1 operations enabled", () => {
    expect(roomContractPolicy(1)).toMatchObject({
      recognized: true,
      edit: true,
      save: true,
      saveAsV1: true,
      apply: true,
      previewV1: true,
      zipV1: true,
    });
  });

  it("makes v2 recognized but read-only until WidgetHost", () => {
    expect(roomContractPolicy(2)).toEqual({
      versionLabel: "v2",
      recognized: true,
      edit: false,
      save: false,
      saveAsV1: false,
      apply: false,
      previewV1: false,
      zipV1: false,
    });
  });

  it("makes unknown versions read-only", () => {
    expect(roomContractPolicy(3)).toMatchObject({
      versionLabel: "v3",
      recognized: false,
      edit: false,
      apply: false,
    });
  });

  it("does not let a v1 write payload gain widgets or a newer version", () => {
    const v1 = { version: 1, desks: [{ name: "Desk", icons: [] }] };
    expect(assertV1WritePayload(v1)).toBe(v1);
    expect(() => assertV1WritePayload({ version: 2, desks: [] })).toThrow("version 1");
    expect(() => assertV1WritePayload({ version: 1, desks: [{ widgets: [] }] })).toThrow("widgets");
  });
});
