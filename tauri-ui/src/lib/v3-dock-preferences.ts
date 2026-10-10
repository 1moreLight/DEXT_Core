export type V3DockPreferences = {schemaVersion:number; enabled:boolean; mode:"overlay"|"autohide"|"reserve"; heightDip:number};
export type V3DockRuntime = {phase:string; playerPid:number; roomId:string|null; deskId:string|null; hasDock:boolean; autoHideAvailable:boolean; overlayAvailable?:boolean; reserveAvailable:boolean; taskbarReplacementReady:boolean; reason:string|null; effectiveHeightDip?:number|null; displayDpi?:number|null; heightConstrained?:boolean; appBarOccupied?:boolean};
export type V3DockStatus = {status:string; preferences:V3DockPreferences|null; runtime:V3DockRuntime; message:string|null};

export function dockRuntimeLabel(runtime: V3DockRuntime): string {
  const labels: Record<string,string> = {disabled:"已关闭",applicationSelected:"由系统应用 Dock 显示",noNativeRoom:"当前未运行原生 Room",noDock:"当前 Desk 没有原生 Dock",hostPending:"Dock 宿主尚未就绪",settingsUnavailable:"偏好暂不可读",starting:"Dock 正在启动",awaitingRenderer:"Dock 视图正在初始化",awaitingInput:"Dock 输入正在接入",awaitingWorkArea:"正在等待 Windows 确认占位",stopping:"Dock 正在关闭",running:"Dock 正在运行",hidden:"Dock 已收起",fullscreen:"全屏期间隐藏",locked:"锁屏期间隐藏",faulted:"Dock 启动失败",unsupportedMode:"当前模式暂不可运行"};
  return labels[runtime.phase] || "Dock 状态未知";
}
