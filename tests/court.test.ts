import { describe, it, expect } from "vitest";
import { renderCourtSvg } from "../src/lib/court.js";
import { Match, type MatchState } from "../src/lib/match.js";
import type { CourtColors } from "../src/lib/themes.js";

const courtColors: CourtColors = {
  background: "#2e3440",
  blueFill: "#5e81ac",
  blueDark: "#4c6a91",
  redFill: "#bf616a",
  redDark: "#a3505a",
  serve: "#ebcb8b",
  serveReceive: "rgba(235,203,139,0.15)",
  netPost: "#d8dee9",
};

function createMatch(opts: Partial<MatchState> = {}): Match {
  return new Match({
    players: ["Alice", "Bob"],
    maxSets: 3,
    pointsPerSet: 21,
    serving: 0,
    ...opts,
  });
}

describe("renderCourtSvg", () => {
  it("returns empty string when no match", () => {
    expect(renderCourtSvg(null, courtColors)).toBe("");
  });

  it("returns SVG content for a valid match", () => {
    const m = createMatch();
    const svg = renderCourtSvg(m, courtColors);
    expect(svg).toContain("<rect");
    expect(svg).toContain("<line");
    expect(svg).toContain("court__score-btn");
  });

  it("renders current scores", () => {
    const m = createMatch();
    m.addPoint(0);
    m.addPoint(0);
    m.addPoint(1);
    const svg = renderCourtSvg(m, courtColors);
    expect(svg).toMatch(/>\s*2\s*</);
    expect(svg).toMatch(/>\s*1\s*</);
  });

  it("swaps colors when sides are swapped", () => {
    const m = createMatch();
    const normal = renderCourtSvg(m, courtColors);
    m.switchSides();
    const swapped = renderCourtSvg(m, courtColors);
    expect(normal).not.toBe(swapped);
  });

  it("renders serve indicator", () => {
    const m = createMatch();
    const svg = renderCourtSvg(m, courtColors);
    expect(svg).toContain("arrowhead");
    expect(svg).toContain("ellipse");
  });
});
