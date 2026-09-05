import { Copy, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverStack, RoomBackgroundPreview, roomCovers } from "@/features/room-library/previews";
import type { CoreIdentity, RoomInfo } from "@/features/runtime/types";
import { readOnlyRoomMessage, roomContractPolicy } from "@/lib/room-contract";

interface EditorRoomLibraryProps {
  rooms: RoomInfo[];
  selectedRoom: RoomInfo | null;
  appliedRoom: string | null;
  busy: string | null;
  coreIdentity: CoreIdentity | null;
  isTauri: boolean;
  onSelect: (room: RoomInfo) => void;
  onNew: () => void;
  onEdit: (room: RoomInfo) => void;
  onApply: (room: RoomInfo) => void;
  onDuplicate: (room: RoomInfo) => void;
  onRename: (room: RoomInfo) => void;
}

export function EditorRoomLibrary(props: EditorRoomLibraryProps) {
  const { rooms, selectedRoom, appliedRoom, busy, coreIdentity, isTauri } = props;
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="text-sm text-muted-foreground">选择房间查看详情；「编辑」进入 Desk 编辑</div>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 content-start gap-3 overflow-y-auto pr-1">
          {rooms.map((room) => (
            <button key={room.path} type="button" onClick={() => props.onSelect(room)} className={`overflow-hidden rounded-xl border text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-cyan-500 ${selectedRoom?.path === room.path ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-background shadow-sm" : "border-border bg-card hover:border-cyan-500/40 hover:bg-muted/30"}`}>
              <div className="relative aspect-video w-full">
                <CoverStack tiles={roomCovers(room)} />
                {selectedRoom?.path === room.path && <span className="absolute left-2 top-2 rounded-md border border-white/20 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950">已选中</span>}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{room.name}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{roomContractPolicy(room.version).versionLabel}</span></div>
                <div className="text-xs text-muted-foreground">{room.desks} Desk · {room.icons} 图标 · {room.widgets} Widget</div>
              </div>
            </button>
          ))}
          {rooms.length === 0 && <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">房间库为空——点下方「新增 Room」创建一个吧</div>}
        </div>
        <div className="flex justify-end border-t border-border pt-3"><Button variant="outline" onClick={props.onNew}><Plus className="h-4 w-4" /> 新增 Room</Button></div>
      </div>

      {selectedRoom && (
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border pl-4">
          <RoomBackgroundPreview room={selectedRoom} className="rounded-lg" label={`${selectedRoom.name} 背景预览`} />
          <div className="text-center">
            <div className="flex items-center justify-center gap-2"><span className="text-lg font-medium">{selectedRoom.name}</span>{selectedRoom.path === appliedRoom && <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-medium text-white">应用中</span>}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{selectedRoom.desks} Desk · {selectedRoom.icons} 图标 · {selectedRoom.widgets} Widget · {roomContractPolicy(selectedRoom.version).versionLabel}</div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => props.onEdit(selectedRoom)}>{roomContractPolicy(selectedRoom.version).edit ? "编辑" : "只读查看"}</Button>
            <Button className="flex-1" variant={selectedRoom.path === appliedRoom ? "secondary" : "outline"} disabled={Boolean(busy) || !roomContractPolicy(selectedRoom.version).apply || (isTauri && !coreIdentity)} title={!roomContractPolicy(selectedRoom.version).apply ? readOnlyRoomMessage(selectedRoom.version) : isTauri && !coreIdentity ? "Dext Core 未连接" : undefined} onClick={() => props.onApply(selectedRoom)}>{selectedRoom.path === appliedRoom ? "重新应用" : "应用"}</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={Boolean(busy) || !roomContractPolicy(selectedRoom.version).edit} onClick={() => props.onDuplicate(selectedRoom)}><Copy className="h-4 w-4" /> 复制</Button>
            <Button variant="outline" disabled={Boolean(busy) || !roomContractPolicy(selectedRoom.version).edit} onClick={() => props.onRename(selectedRoom)}><Pencil className="h-4 w-4" /> 重命名</Button>
          </div>
        </aside>
      )}
    </div>
  );
}
