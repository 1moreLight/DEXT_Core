import type { PermissionReview } from "@/features/runtime/types";

export interface RoomEditAudit {
  permissionReviews: PermissionReview[];
  orphanWidgetResources: string[];
}

export interface RoomOrphanRecovery {
  recoveryDir: string;
  moved: string[];
}

export function roomIntegrityBlockReason(audit: RoomEditAudit): string | null {
  const count = audit.orphanWidgetResources.length;
  if (!count) return null;
  return `检测到 ${count} 个未声明 Widget 资源；移至恢复目录后才能保存、预览、应用或导出`;
}

export function roomOpenStatus(
  roomName: string,
  audit: RoomEditAudit,
  restoredDirty: boolean,
): string {
  if (audit.orphanWidgetResources.length) {
    return `已打开 ${roomName}；检测到 ${audit.orphanWidgetResources.length} 个未声明 Widget 资源，当前仅限编辑`;
  }
  return restoredDirty
    ? `已恢复 ${roomName} 的未保存草稿和撤销历史`
    : `已打开 ${roomName}`;
}
