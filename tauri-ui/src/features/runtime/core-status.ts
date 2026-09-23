import type { CoreIdentity } from "./types";

export function isCoreUnavailable(error: string | null | undefined): boolean {
  return Boolean(error && /pipe|connect|unavailable|not running|退出|断开|未运行/i.test(error));
}

export type CoreLifecycleBusy = "starting" | "exiting" | null;

export function coreControlState(
  identity: CoreIdentity | null,
  error: string | null,
  busy: CoreLifecycleBusy,
): { status: string; action: "start" | "exit" | null; label: string | null } {
  if (busy === "starting") return { status: "Dext Core 启动中", action: null, label: "启动中…" };
  if (busy === "exiting") return { status: "Dext Core 退出中", action: null, label: "退出中…" };
  if (identity) {
    return identity.is_core_initialized
      ? { status: "Dext Core 已连接", action: "exit", label: "退出 Core" }
      : { status: "Dext Core 桌面未就绪", action: "exit", label: "退出 Core" };
  }
  if (error && /refusing (?:Core|runtime|gRPC|app-data)|identity rejected/i.test(error)) {
    return { status: "Dext Core 身份冲突", action: null, label: null };
  }
  if (isCoreUnavailable(error)) return { status: "Dext Core 未运行", action: "start", label: "启动 Core" };
  if (error) return { status: "Dext Core 连接异常", action: null, label: null };
  return { status: "正在验证 Dext Core", action: null, label: null };
}
