import { describe, expect, it } from "vitest";
import {
  roomIntegrityBlockReason,
  roomOpenStatus,
  type RoomEditAudit,
} from "./room-integrity";

const audit = (orphans: string[]): RoomEditAudit => ({
  permissionReviews: [],
  orphanWidgetResources: orphans,
});

describe("Room edit integrity", () => {
  it("allows a clean Room and blocks publication actions for orphan resources", () => {
    expect(roomIntegrityBlockReason(audit([]))).toBeNull();
    expect(roomIntegrityBlockReason(audit([
      "widgets/clock-hardware/index.html",
      "widgets/clock-hardware/main.js",
    ]))).toBe("检测到 2 个未声明 Widget 资源；移至恢复目录后才能保存、预览、应用或导出");
  });

  it("reports a recoverable warning instead of pretending the Room failed to open", () => {
    expect(roomOpenStatus("v2", audit([]), false)).toBe("已打开 v2");
    expect(roomOpenStatus("v2", audit([]), true)).toBe("已恢复 v2 的未保存草稿和撤销历史");
    expect(roomOpenStatus("v2", audit(["widgets/unused/a.js"]), false)).toBe(
      "已打开 v2；检测到 1 个未声明 Widget 资源，当前仅限编辑",
    );
  });
});
