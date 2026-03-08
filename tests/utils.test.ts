import { describe, it, expect } from "vitest";
import { formatMs } from "../src/lib/utils.js";

describe("formatMs", () => {
  it("formats 0 ms", () => {
    expect(formatMs(0)).toBe("00:00");
  });

  it("formats seconds", () => {
    expect(formatMs(5000)).toBe("00:05");
    expect(formatMs(59000)).toBe("00:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatMs(60000)).toBe("01:00");
    expect(formatMs(90000)).toBe("01:30");
    expect(formatMs(3661000)).toBe("61:01");
  });

  it("truncates sub-second precision", () => {
    expect(formatMs(1500)).toBe("00:01");
    expect(formatMs(999)).toBe("00:00");
  });

  it("pads single digits", () => {
    expect(formatMs(61000)).toBe("01:01");
  });
});
