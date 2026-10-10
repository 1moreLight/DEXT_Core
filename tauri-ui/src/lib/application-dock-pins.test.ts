import {describe,expect,it} from "vitest";
import {dockPinSelection} from "./application-dock-pins";
describe("application Dock pin selection", () => {
  it("captures the selected Desk before asynchronous app selection", () => {
    const context={sessionId:"session",roomId:"room",deskId:"one",name:"One",inherits:true,changing:false};
    const captured=dockPinSelection("desk",context);
    context.deskId="two";
    expect(captured).toEqual({scope:"desk",sessionId:"session",roomId:"room",deskId:"one"});
    expect(dockPinSelection("global",null)).toEqual({scope:"global"});
  });
  it("refuses missing or transitioning Desk instead of silently editing global pins", () => {
    expect(()=>dockPinSelection("desk",null)).toThrow();
    expect(()=>dockPinSelection("desk",{sessionId:"s",roomId:"r",deskId:"d",name:"D",inherits:false,changing:true})).toThrow();
  });
});
