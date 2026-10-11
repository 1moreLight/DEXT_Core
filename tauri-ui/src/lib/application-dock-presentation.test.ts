import {describe,expect,it} from "vitest";
import {dockPresentationLabel,dockPresentationReason} from "./application-dock-presentation";
describe("Dock presentation status",()=>{
 it("does not report saved theme intent as running during native fallback",()=>{
  const status={requested:"theme" as const,target:"native",actual:"native",mode:"overlay",phase:"fallback",reason:"missingTaskArea"};
  expect(dockPresentationLabel(status)).toContain("原生");
  expect(dockPresentationLabel(status)).toContain("回退");
  expect(dockPresentationReason(status.reason)).toContain("应用任务区");
 });
 it("keeps missing status and unknown failure visible",()=>{
  expect(dockPresentationLabel(null)).toContain("等待");
  expect(dockPresentationReason("futureReason")).toContain("futureReason");
  expect(dockPresentationReason(null)).toBeNull();
 });
});
