import { Bot, FolderOpen, Play, Plus, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorView } from "@/features/room-editor/EditorHierarchy";

interface RoomEditorHeaderProps {
  roomName: string;
  dirty: boolean;
  editorView: EditorView;
  canUndo: boolean;
  canRedo: boolean;
  canApply: boolean;
  canDeleteDesk: boolean;
  onBack: () => void;
  onView: (view: "canvas" | "flow") => void;
  onCreatorImport: () => void;
  onImportWidget: () => void;
  onAddDesk: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onApply: () => void;
  onDeleteDesk: () => void;
}

export function RoomEditorHeader({
  roomName,
  dirty,
  editorView,
  canUndo,
  canRedo,
  canApply,
  canDeleteDesk,
  onBack,
  onView,
  onCreatorImport,
  onImportWidget,
  onAddDesk,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onApply,
  onDeleteDesk,
}: RoomEditorHeaderProps) {
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-3 overflow-x-auto pb-1">
      <Button variant="outline" size="sm" onClick={onBack}>← 房间列表</Button>
      <span className="shrink-0 text-sm font-medium">{roomName}</span>
      {dirty && <span className="shrink-0 text-xs font-medium text-amber-500">● 未保存</span>}
      <div className="flex shrink-0 rounded-md border border-border bg-muted/35 p-0.5">
        <button type="button" onClick={() => onView("canvas")} className={`rounded px-2.5 py-1 text-xs ${editorView === "canvas" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>桌面画布</button>
        <button type="button" onClick={() => onView("flow")} className={`rounded px-2.5 py-1 text-xs ${editorView === "flow" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>Desk 流程</button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onCreatorImport}><Bot className="h-3.5 w-3.5" /> AI 创作</Button>
        <Button variant="outline" size="sm" onClick={onImportWidget}><FolderOpen className="h-3.5 w-3.5" /> 导入 Widget</Button>
        <Button size="sm" className="font-semibold shadow-sm" onClick={onAddDesk}><Plus className="h-3.5 w-3.5" /> 新增 Desk</Button>
        <Button variant="outline" size="sm" disabled={!canUndo} onClick={onUndo}><Undo2 className="h-3.5 w-3.5" /> 撤回</Button>
        <Button variant="outline" size="sm" disabled={!canRedo} onClick={onRedo}><Redo2 className="h-3.5 w-3.5" /> 重做</Button>
        <Button variant="outline" size="sm" onClick={onSave}><Save className="h-3.5 w-3.5" /> 保存</Button>
        <Button variant="outline" size="sm" onClick={onSaveAs}>另存为</Button>
        <Button variant="outline" size="sm" disabled={!canApply} title={!canApply ? "Dext Core 未连接" : undefined} onClick={onApply}><Play className="h-3.5 w-3.5" /> 应用</Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={!canDeleteDesk} onClick={onDeleteDesk}><Trash2 className="h-3.5 w-3.5" /> 删除 Desk</Button>
      </div>
    </div>
  );
}
