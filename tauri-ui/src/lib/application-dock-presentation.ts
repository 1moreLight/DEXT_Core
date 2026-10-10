export type DockPresentation = "native" | "theme";
export type DockPresentationState = {requested:DockPresentation; target:string; actual:string; mode:string; phase:string; reason:string|null};
export function dockPresentationLabel(state:DockPresentationState|null|undefined):string {
 if(!state)return "等待 Core 报告实际状态";
 const actual=state.actual==="theme"?"主题融合 Dock":state.actual==="native"?"原生应用 Dock":"暂无运行宿主";
 const phase:Record<string,string>={ready:"已就绪",fallback:"已回退",switching:"切换中",starting:"启动中",disabled:"已关闭",stopping:"正在退出"};
 return `${actual} · ${phase[state.phase]??state.phase}`;
}
export function dockPresentationReason(reason:string|null|undefined):string|null {
 if(!reason)return null;
 const reasons:Record<string,string>={noNativeRoom:"请先运行一个原生 Room。",noDock:"当前 Desk 没有主题 Dock。",missingTaskArea:"主题未声明应用任务区。",invalidTaskArea:"主题应用任务区配置无效。",themeUnavailable:"当前主题暂不可用。",themeHostFailed:"主题 Dock 进程已退出。",taskAreaUnavailable:"主题应用任务区无法显示。",themeReadyTimeout:"主题 Dock 启动超时。"};
 return reasons[reason]??`暂不可用：${reason}`;
}
