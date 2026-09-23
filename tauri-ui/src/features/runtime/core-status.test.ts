import { describe, expect, it } from "vitest";
import { coreControlState, isCoreUnavailable } from "./core-status";
import type { CoreIdentity } from "./types";

const connected: CoreIdentity = {
  product_name: "Dext",
  runtime_identity: "DEXT:DESKTOPSHELL",
  process_id: 101,
  base_directory: "C:\\Dext\\",
  app_data_directory: "C:\\Users\\Jan\\AppData\\Local\\Dext",
  grpc_pipe_name: "Grpc_DEXT:DESKTOPSHELLJAN",
  assembly_version: "2.2.1.5",
  is_core_initialized: true,
};

describe("isCoreUnavailable", () => {
  it("recognizes transport and process failures", () => {
    expect(isCoreUnavailable("pipe connect failed")).toBe(true);
    expect(isCoreUnavailable("Core not running")).toBe(true);
    expect(isCoreUnavailable("管道已断开")).toBe(true);
  });

  it("does not classify identity or validation failures as offline", () => {
    expect(isCoreUnavailable("runtime identity rejected")).toBe(false);
    expect(isCoreUnavailable("invalid response payload")).toBe(false);
    expect(isCoreUnavailable(null)).toBe(false);
  });
});

describe("coreControlState", () => {
  it("offers Start only when Core is absent", () => {
    expect(coreControlState(null, "pipe connect failed", null)).toEqual({
      status: "Dext Core 未运行",
      action: "start",
      label: "启动 Core",
    });
  });

  it("offers Exit for a verified ready Core", () => {
    expect(coreControlState(connected, null, null)).toEqual({
      status: "Dext Core 已连接",
      action: "exit",
      label: "退出 Core",
    });
  });

  it("shows the desktop initialization failure without claiming connection", () => {
    expect(coreControlState({ ...connected, is_core_initialized: false }, null, null)).toEqual({
      status: "Dext Core 桌面未就绪",
      action: "exit",
      label: "退出 Core",
    });
  });

  it("does not offer process control for a rejected identity", () => {
    expect(coreControlState(null, "refusing Core outside this worktree", null)).toEqual({
      status: "Dext Core 身份冲突",
      action: null,
      label: null,
    });
  });

  it("blocks repeat clicks while a lifecycle action is running", () => {
    expect(coreControlState(null, "pipe connect failed", "starting")).toEqual({
      status: "Dext Core 启动中",
      action: null,
      label: "启动中…",
    });
    expect(coreControlState(connected, null, "exiting")).toEqual({
      status: "Dext Core 退出中",
      action: null,
      label: "退出中…",
    });
  });
});
