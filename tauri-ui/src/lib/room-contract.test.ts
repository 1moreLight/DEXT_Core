import { describe, expect, it } from "vitest";
import { assertRoomV2WritePayload, roomContractPolicy } from "./room-contract";

describe("room contract operation matrix", () => {
  it("rejects leftover v2 rooms instead of opening the old editor", () => {
    expect(roomContractPolicy(2)).toMatchObject({
      versionLabel: "v2 已停止",
      recognized: false,
      edit: false,
      save: false,
      apply: false,
      preview: false,
    });
  });

  it("rejects v1 and unknown versions", () => {
    expect(roomContractPolicy(1)).toMatchObject({
      versionLabel: "v1",
      recognized: false,
      edit: false,
      apply: false,
    });
    expect(roomContractPolicy(99)).toMatchObject({ recognized: false, edit: false, apply: false });
  });

  it("enables the native v3 editor/save/apply and independent copies/sharing without the v2 preview", () => {
    expect(roomContractPolicy(3)).toMatchObject({recognized:true, edit:true, save:true, apply:true, preview:false, saveAs:true, zip:true});
  });

  it("keeps a recognized Room read-only when its author API or requirements need an update", () => {
    const incompatible = {supported:false, needsUpdate:true, message:"需要更新 Dext"};
    expect(roomContractPolicy(3, incompatible)).toMatchObject({recognized:false,edit:false,save:false,saveAs:false,apply:false,preview:false,zip:false});
    expect(roomContractPolicy(3, {supported:true,needsUpdate:false,message:"API1"}).apply).toBe(true);
  });
  it("requires native v2 payloads with a widgets array on every Desk", () => {
    const v2 = { version: 2, desks: [{ name: "Desk", icons: [], widgets: [] }] };
    expect(assertRoomV2WritePayload(v2)).toBe(v2);
    expect(() => assertRoomV2WritePayload({ version: 1, desks: [] })).toThrow("version 2");
    expect(() => assertRoomV2WritePayload({ version: 2, desks: [{ icons: [] }] })).toThrow("widgets");
  });
});
