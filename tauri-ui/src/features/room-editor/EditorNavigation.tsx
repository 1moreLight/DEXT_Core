import { FolderOpen, LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export type EditNav = "library" | "room";

interface EditorNavigationProps {
  navOpen: boolean;
  editNav: EditNav;
  onToggle: () => void;
  onNavigate: (value: EditNav) => void;
}

export function EditorNavigation({ navOpen, editNav, onToggle, onNavigate }: EditorNavigationProps) {
  return (
    <aside className={`flex shrink-0 flex-col border-r border-border py-2 transition-all ${navOpen ? "w-44 px-2" : "w-12 items-center px-1"}`}>
      <button type="button" onClick={onToggle} className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title={navOpen ? "折叠侧栏" : "展开侧栏"}>
        {navOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>
      <nav className="flex flex-col gap-1">
        {([
          ["room", "Room", FolderOpen],
          ["library", "应用库", LayoutGrid],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => onNavigate(key)} title={label} className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${editNav === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"} ${navOpen ? "" : "justify-center"}`}>
            <Icon className="h-4 w-4 shrink-0" />
            {navOpen && <span className="whitespace-nowrap">{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
