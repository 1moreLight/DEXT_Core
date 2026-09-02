import {
  AppWindow,
  ChevronDown,
  ChevronUp,
  Dock,
  Image,
  Layers3,
  LayoutGrid,
  Moon,
  MonitorPlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Desk } from "@/lib/room-v2";

export type EditorView = "canvas" | "flow" | "dock";

interface EditorHierarchyProps {
  desks: Desk[];
  activeDesk: number;
  selectedWidgetId: string | null;
  editorView: EditorView;
  graphSelection: string | null;
  startName: string;
  idleName: string;
  onSelectDesk: (index: number) => void;
  onSelectScene: (index: number) => void;
  onSelectIcons: (index: number) => void;
  onSelectWidget: (deskIndex: number, widgetId: string) => void;
  onSelectDock: (index: number) => void;
  onSelectFlowNode: (nodeId: "start" | "idle") => void;
  onMoveDesk: (fromIndex: number, toIndex: number) => void;
}

function rowClass(active: boolean, nested = false) {
  return `flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
    nested ? "ml-4" : ""
  } ${
    active
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  }`;
}

export function EditorHierarchy({
  desks,
  activeDesk,
  selectedWidgetId,
  editorView,
  graphSelection,
  startName,
  idleName,
  onSelectDesk,
  onSelectScene,
  onSelectIcons,
  onSelectWidget,
  onSelectDock,
  onSelectFlowNode,
  onMoveDesk,
}: EditorHierarchyProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <div className="text-xs font-semibold">Room 层级</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">按 Desk 管理 Scene、图标、Widget 与 Dock</div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        <button
          type="button"
          className={rowClass(editorView === "flow" && graphSelection === "start")}
          onClick={() => onSelectFlowNode("start")}
        >
          <MonitorPlay className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{startName}</span>
        </button>
        <button
          type="button"
          className={rowClass(editorView === "flow" && graphSelection === "idle")}
          onClick={() => onSelectFlowNode("idle")}
        >
          <Moon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{idleName}</span>
        </button>

        {desks.map((desk, index) => {
          const deskActive = index === activeDesk;
          return (
            <section key={`desk-${index}-${desk.name}`} className="rounded-md border border-transparent data-[active=true]:border-border" data-active={deskActive}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={`${rowClass(deskActive && editorView !== "flow")} min-w-0 flex-1`}
                  onClick={() => onSelectDesk(index)}
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{desk.name || `Desk ${index + 1}`}</span>
                  <span className="shrink-0 text-[10px] opacity-70">{desk.widgets.length}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6"
                  disabled={index === 0}
                  title="上移 Desk"
                  onClick={() => onMoveDesk(index, index - 1)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6"
                  disabled={index === desks.length - 1}
                  title="下移 Desk"
                  onClick={() => onMoveDesk(index, index + 1)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              {deskActive && (
                <div className="space-y-0.5 pb-1">
                  <button type="button" className={rowClass(editorView === "canvas" && !selectedWidgetId, true)} onClick={() => onSelectScene(index)}>
                    <Image className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Scene · {desk.background?.name ?? "纯色背景"}</span>
                  </button>
                  <button type="button" className={rowClass(false, true)} onClick={() => onSelectIcons(index)}>
                    <AppWindow className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Icons</span>
                    <span className="ml-auto text-[10px]">{desk.icons.length}</span>
                  </button>
                  <div className={rowClass(false, true)}>
                    <Layers3 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Widgets</span>
                    <span className="ml-auto text-[10px]">{desk.widgets.length}</span>
                  </div>
                  {desk.widgets.map((widget) => (
                    <button
                      key={widget.id}
                      type="button"
                      className={`${rowClass(editorView === "canvas" && selectedWidgetId === widget.id, true)} pl-7`}
                      title={widget.name}
                      onClick={() => onSelectWidget(index, widget.id)}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                      <span className="truncate">{widget.name}</span>
                    </button>
                  ))}
                  <button type="button" className={rowClass(editorView === "dock", true)} onClick={() => onSelectDock(index)}>
                    <Dock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Dock</span>
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
