import {describe, expect, it} from "vitest";
import {dockPinSource, effectiveDockPins, legacyDockAdditions} from "./dock-pin-append";

const notes = {name: "Notes", target: "C:\\Windows\\notepad.exe"};
const calc = {name: "Calc", target: "C:/Windows/calc.exe"};

describe("dock pin append", () => {
  it("treats an empty desk list as no additions", () => {
    expect(effectiveDockPins([notes], []).map(pin => pin.name)).toEqual(["Notes"]);
    expect(effectiveDockPins([notes], null).map(pin => pin.name)).toEqual(["Notes"]);
  });

  it("appends only pins that are not already global", () => {
    expect(effectiveDockPins([notes], [notes, calc]).map(pin => pin.name)).toEqual(["Notes", "Calc"]);
    expect(dockPinSource(calc.target, [calc])).toBe("desk");
    expect(dockPinSource(notes.target, [calc])).toBe("global");
  });

  it("migrates a legacy override without dropping desk-only pins", () => {
    expect(legacyDockAdditions([notes, calc], [notes]).map(pin => pin.name)).toEqual(["Calc"]);
    expect(effectiveDockPins([notes], legacyDockAdditions([notes, calc], [notes])).map(pin => pin.name)).toEqual(["Notes", "Calc"]);
  });
});
