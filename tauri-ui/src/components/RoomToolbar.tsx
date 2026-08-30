import { Download, FolderInput, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type RoomToolbarProps = {
  multiMode: boolean;
  selectedCount: number;
  totalCount: number;
  busy: string | null;
  onNew: () => void;
  onImport: () => void;
  onToggleMulti: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  onDelete: () => void;
};

export function RoomToolbar(props: RoomToolbarProps) {
  const disabled = Boolean(props.busy);
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2 border-b border-border pb-3">
      <Button size="sm" onClick={props.onNew} disabled={disabled}>
        <Plus className="h-4 w-4" /> 新增
      </Button>
      <Button size="sm" variant="outline" onClick={props.onImport} disabled={disabled}>
        <FolderInput className="h-4 w-4" /> 导入
      </Button>
      <Button
        size="sm"
        variant={props.multiMode ? "secondary" : "outline"}
        onClick={props.onToggleMulti}
        disabled={disabled || props.totalCount === 0}
      >
        {props.multiMode ? <X className="h-4 w-4" /> : null}
        {props.multiMode ? "退出多选" : "多选"}
      </Button>

      {props.multiMode && (
        <>
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            已选 {props.selectedCount} / {props.totalCount}
          </span>
          <Button size="sm" variant="ghost" onClick={props.onSelectAll} disabled={disabled}>
            全选
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onClear} disabled={disabled || !props.selectedCount}>
            取消选择
          </Button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {props.busy && <span className="text-xs text-muted-foreground">{props.busy}</span>}
        <Button
          size="sm"
          variant="outline"
          onClick={props.onExport}
          disabled={disabled || !props.selectedCount}
        >
          <Download className="h-4 w-4" /> 导出
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={props.onDelete}
          disabled={disabled || !props.selectedCount}
        >
          <Trash2 className="h-4 w-4" /> 删除
        </Button>
      </div>
    </div>
  );
}
