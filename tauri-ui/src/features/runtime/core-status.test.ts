import { describe, expect, it } from "vitest";
import { isCoreUnavailable } from "./core-status";

describe("isCoreUnavailable", () => {
  it("recognizes transport and process failures", () => {
    expect(isCoreUnavailable("pipe connect failed")).toBe(true);
    expect(isCoreUnavailable("Core not running")).toBe(true);
    expect(isCoreUnavailable("管道已断开")).toBe(true);
  });

  it("does not classify identity or validation failures as offline", () => {
    expect(isCoreUnavailable("runtime identity rejected")).toBe(false);
    expect(isCoreUnavailable("invalid response payload")).toBe(false);
    expect(isCoreUnavailable(null)).toBe(false);
  });
});
