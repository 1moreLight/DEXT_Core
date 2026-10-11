export type DockPinContext = {sessionId:string;roomId:string;deskId:string;name:string;inherits:boolean;changing:boolean};
export function dockPinSelection(scope:"global"|"desk", context:DockPinContext|null|undefined) {
  if (scope === "global") return {scope} as const;
  if (!context || context.changing) throw new Error("当前 Desk 正在变化，请稍后重新选择。");
  // Capture identities before an asynchronous file picker; never retarget its result.
  return {scope,sessionId:context.sessionId,roomId:context.roomId,deskId:context.deskId} as const;
}
