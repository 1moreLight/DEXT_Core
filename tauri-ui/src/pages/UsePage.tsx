import { ChevronLeft, ChevronRight, ChevronsLeft, Copy, Pencil, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomToolbar } from "@/components/RoomToolbar";
import { CoverStack, RoomBackgroundPreview, roomCovers } from "@/features/room-library/previews";
import type { CoreIdentity, RoomInfo } from "@/features/runtime/types";
import { readOnlyRoomMessage, roomContractPolicy } from "@/lib/room-contract";

export type RoomSort = "name-asc" | "name-desc" | "desks-desc";

interface UsePageProps {
  rooms: RoomInfo[];
  visibleRooms: RoomInfo[];
  filteredCount: number;
  heroRoom: RoomInfo | null;
  appliedRoom: string | null;
  query: string;
  sort: RoomSort;
  page: number;
  pageCount: number;
  multiMode: boolean;
  selectedRooms: Set<string>;
  selectedCount: number;
  busy: string | null;
  coreIdentity: CoreIdentity | null;
  isTauri: boolean;
  onQuery: (value: string) => void;
  onSort: (value: RoomSort) => void;
  onPage: (value: number) => void;
  onNew: () => void;
  onImport: () => void;
  onToggleMulti: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSelectRoom: (room: RoomInfo) => void;
  onApplyRoom: (room: RoomInfo) => void;
  onDuplicateRoom: (room: RoomInfo) => void;
  onRenameRoom: (room: RoomInfo) => void;
  onEditRoom: (room: RoomInfo) => void;
  onStopRoom: () => void;
}

export function UsePage(props: UsePageProps) {
  const {
    rooms, visibleRooms, filteredCount, heroRoom, appliedRoom, query, sort, page, pageCount,
    multiMode, selectedRooms, selectedCount, busy, coreIdentity, isTauri,
  } = props;
  return (
    <section className="flex min-h-0 flex-1 gap-5 p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <RoomToolbar
          multiMode={multiMode}
          selectedCount={selectedCount}
          totalCount={filteredCount}
          busy={busy}
          onNew={props.onNew}
          onImport={props.onImport}
          onToggleMulti={props.onToggleMulti}
          onSelectAll={props.onSelectAll}
          onClear={props.onClear}
          onExport={props.onExport}
          onDelete={props.onDelete}
        />
        <div className="flex gap-2">
          <Input placeholder="搜索 Room" value={query} onChange={(event) => props.onQuery(event.target.value)} />
          <select aria-label="Room 排序" value={sort} onChange={(event) => props.onSort(event.target.value as RoomSort)} className="h-8 shrink-0 rounded-lg border border-input bg-background px-2.5 text-sm">
            <option value="name-asc">名称 A–Z</option>
            <option value="name-desc">名称 Z–A</option>
            <option value="desks-desc">Desk 数量</option>
          </select>
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-x-4 gap-y-5 overflow-y-auto pr-2 xl:grid-cols-3">
          {visibleRooms.map((room) => {
            const focused = room.path === heroRoom?.path;
            const active = room.path === appliedRoom;
            const picked = selectedRooms.has(room.path);
            const selected = multiMode ? picked : focused;
            const policy = roomContractPolicy(room.version, room.compatibility);
            return (
              <button key={room.path} disabled={Boolean(busy)} onClick={() => props.onSelectRoom(room)} onDoubleClick={() => props.onApplyRoom(room)} title={multiMode ? "单击选择" : policy.apply ? "单击查看详情，双击应用" : readOnlyRoomMessage(room.version, room.compatibility)} aria-pressed={multiMode ? picked : focused} className={`group overflow-hidden rounded-xl p-1.5 text-left outline-none transition-[opacity,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-wait ${multiMode && !picked ? "opacity-60 hover:opacity-100" : "opacity-100"} ${selected ? "bg-cyan-500/10 ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-background" : "bg-transparent hover:bg-muted/40"}`}>
                <div className={`relative aspect-video overflow-hidden rounded-lg border-2 ${selected ? "border-cyan-500" : "border-transparent group-hover:border-border"}`}>
                  <CoverStack tiles={roomCovers(room)} />
                  {selected ? <span className="absolute left-2 top-2 rounded-md border border-white/20 bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950">{multiMode ? "✓ 已选择" : "已选中"}</span> : multiMode ? <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border border-white/70 bg-black/30 text-xs font-bold text-white" /> : null}
                  <span className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">{policy.versionLabel}{room.widgets ? ` · ${room.widgets} Widget` : ""}</span>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{room.name}</span>{active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="正在使用" />}</div><div className="mt-0.5 text-xs text-muted-foreground">{room.desks} Desk · {room.icons} 图标 · {room.widgets} Widget</div></div>
                  {active && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">使用中</span>}
                  {room.compatibility && !room.compatibility.supported && <span className="text-[10px] text-amber-600 dark:text-amber-300">{room.compatibility.needsUpdate ? "需要更新" : "暂不可用"}</span>}
                </div>
              </button>
            );
          })}
          {rooms.length === 0 && <div className="col-span-full py-20 text-center text-sm text-muted-foreground">Room 库为空。使用“新增”创建，或导入一个安全的 Room zip。</div>}
          {rooms.length > 0 && filteredCount === 0 && <div className="col-span-full py-20 text-center text-sm text-muted-foreground">没有匹配“{query}”的 Room</div>}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-1 border-t border-border pt-3">
            <Button variant="ghost" size="icon-sm" disabled={page === 1} title="第一页" onClick={() => props.onPage(1)}><ChevronsLeft /></Button>
            <Button variant="ghost" size="icon-sm" disabled={page === 1} title="上一页" onClick={() => props.onPage(page - 1)}><ChevronLeft /></Button>
            <span className="px-2 text-xs tabular-nums text-muted-foreground">{page} / {pageCount}</span>
            <Button variant="ghost" size="icon-sm" disabled={page === pageCount} title="下一页" onClick={() => props.onPage(page + 1)}><ChevronRight /></Button>
            <span className="ml-auto text-xs text-muted-foreground">共 {filteredCount} 个 Room</span>
          </div>
        )}
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-border pl-5">
        {heroRoom ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <RoomBackgroundPreview room={heroRoom} className="rounded-lg" label={`${heroRoom.name} 背景预览`} />
            <div className="mt-5 flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{heroRoom.name}</h2>{heroRoom.path === appliedRoom && <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">使用中</span>}</div>
            <dl className="mt-4 grid grid-cols-2 gap-y-3 border-y border-border py-4 text-xs">
              <div><dt className="text-muted-foreground">Desk</dt><dd className="mt-0.5 font-medium">{heroRoom.desks}</dd></div><div><dt className="text-muted-foreground">图标</dt><dd className="mt-0.5 font-medium">{heroRoom.icons}</dd></div>
              <div><dt className="text-muted-foreground">契约</dt><dd className="mt-0.5 font-medium">{roomContractPolicy(heroRoom.version, heroRoom.compatibility).versionLabel}</dd></div><div><dt className="text-muted-foreground">Widget</dt><dd className="mt-0.5 font-medium">{heroRoom.widgets}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">源目录</dt><dd className="mt-0.5 truncate font-mono" title={heroRoom.path}>{heroRoom.path}</dd></div>
            </dl>
            {!roomContractPolicy(heroRoom.version, heroRoom.compatibility).edit && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">{readOnlyRoomMessage(heroRoom.version, heroRoom.compatibility)}。不会读取为草稿、改写或丢弃 Widget 数据。</p>}
            <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
              <Button variant="outline" disabled={Boolean(busy) || !roomContractPolicy(heroRoom.version, heroRoom.compatibility).saveAs} onClick={() => props.onDuplicateRoom(heroRoom)}><Copy className="h-4 w-4" /> 复制</Button>
              <Button variant="outline" disabled={Boolean(busy) || !roomContractPolicy(heroRoom.version, heroRoom.compatibility).edit} onClick={() => props.onRenameRoom(heroRoom)}><Pencil className="h-4 w-4" /> 重命名</Button>
              <Button variant="outline" disabled={Boolean(busy)} onClick={() => props.onEditRoom(heroRoom)}><Pencil className="h-4 w-4" /> {roomContractPolicy(heroRoom.version, heroRoom.compatibility).edit ? "编辑" : "只读查看"}</Button>
              <Button variant={heroRoom.path === appliedRoom ? "outline" : "default"} disabled={Boolean(busy) || (heroRoom.path !== appliedRoom && !roomContractPolicy(heroRoom.version, heroRoom.compatibility).apply) || (isTauri && !coreIdentity)} title={!roomContractPolicy(heroRoom.version, heroRoom.compatibility).apply ? readOnlyRoomMessage(heroRoom.version, heroRoom.compatibility) : isTauri && !coreIdentity ? "Dext Core 未连接，仍可浏览本地 Room" : undefined} onClick={() => heroRoom.path === appliedRoom ? props.onStopRoom() : props.onApplyRoom(heroRoom)}>
                {heroRoom.path === appliedRoom ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}{heroRoom.path === appliedRoom ? "停止壁纸" : "应用此 Room"}
              </Button>
              {!coreIdentity && isTauri && <p className="col-span-2 mt-1 text-xs text-destructive">Dext Core 未连接；Room 浏览和文件管理仍可使用。</p>}
            </div>
          </div>
        ) : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">选择一个 Room 查看详情</div>}
      </aside>
    </section>
  );
}
