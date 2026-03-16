// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderCourtSvg, COURT_VB_W, COURT_VB_H } from "../src/lib/court.js";
import { Match, type MatchState } from "../src/lib/match.js";
import type { CourtColors } from "../src/lib/themes.js";

// ── Official BWF constants (mirrored here so tests are self-documenting) ──────

const COURT_LENGTH = 13.4;
const COURT_WIDTH_DBL = 6.1;
const COURT_WIDTH_SGL = 5.18;
const NET_TO_SHORT_SVC = 1.98;
const LONG_SVC_INSET = 0.76;
const LINE_THICKNESS = 0.04;

// Derived values (same formulas as court.ts)
const VB_W = 700;
const VB_H = Math.round((VB_W * COURT_WIDTH_DBL) / COURT_LENGTH); // 319
const PADDING = Math.round(VB_W * 0.03); // 21
const SCALE_X = (VB_W - PADDING * 2) / COURT_LENGTH;
const SCALE_Y = (VB_H - PADDING * 2) / COURT_WIDTH_DBL;
const LINE_W = Math.max(1.5, LINE_THICKNESS * SCALE_X);

// Key positions
const midX = VB_W / 2; // 350
const courtH = VB_H - PADDING * 2;
const courtW = VB_W - PADDING * 2;
const dblTop = PADDING;
const dblBot = PADDING + courtH;
const sglInset = ((COURT_WIDTH_DBL - COURT_WIDTH_SGL) / 2) * SCALE_Y;
const sTop = PADDING + sglInset;
const sBot = PADDING + courtH - sglInset;
const shortDist = NET_TO_SHORT_SVC * SCALE_X;
const longInset = LONG_SVC_INSET * SCALE_X;
const leftShort = midX - shortDist;
const leftLong = PADDING + longInset;
const rightLong = VB_W - PADDING - longInset;
const netGap = Math.round(shortDist * 0.6);
const scoreFontSize = Math.round(VB_H * 0.22); // 70

/** Tolerance in SVG units for all coordinate assertions (accounts for Math.round). */
const TOL = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

const courtColors: CourtColors = {
  background: "#2e3440",
  blueFill: "#5e81ac",
  blueDark: "#4c6a91",
  redFill: "#bf616a",
  redDark: "#a3505a",
  serve: "#ebcb8b",
  serveReceive: "rgba(235,203,139,0.15)",
  netPost: "#d8dee9",
  scoreText: "#eceff4",
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

/**
 * Parses an SVG string into a DOM document using jsdom's DOMParser.
 * Used for structural queries (element selectors, data attributes).
 */
function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,
    "image/svg+xml",
  );
}

/**
 * Extracts a numeric attribute from the first element in the SVG string
 * that matches the given selector. Returns NaN if not found.
 * Used for proportional coordinate checks where DOMParser would be verbose.
 */
function getAttrNum(doc: Document, selector: string, attr: string): number {
  const el = doc.querySelector(selector);
  return el ? parseFloat(el.getAttribute(attr) ?? "NaN") : NaN;
}

// ── Existing tests ─────────────────────────────────────────────────────────────

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

// ── ViewBox / canvas ─────────────────────────────────────────────────────────

describe("court canvas constants", () => {
  it("COURT_VB_W is 700", () => {
    expect(COURT_VB_W).toBe(700);
  });

  it("COURT_VB_H is derived from the official aspect ratio (≈319)", () => {
    expect(COURT_VB_H).toBe(VB_H);
    expect(COURT_VB_H).toBe(319);
  });

  it("aspect ratio is within 0.5% of the official 13.4 / 6.1", () => {
    const official = COURT_LENGTH / COURT_WIDTH_DBL;
    const rendered = COURT_VB_W / COURT_VB_H;
    // The rendered ratio will be very slightly off due to Math.round on VB_H
    expect(Math.abs(rendered - official) / official).toBeLessThan(0.005);
  });
});

// ── BWF proportions ───────────────────────────────────────────────────────────

describe("court dimensions (BWF official proportions)", () => {
  let svg: string;
  let doc: Document;

  beforeEach(() => {
    svg = renderCourtSvg(createMatch(), courtColors);
    doc = parseSvg(svg);
  });

  // ── Net ──────────────────────────────────────────────────────────────────

  it("net is at horizontal center (x = VB_W / 2 = 350)", () => {
    // The net is a vertical <line> at x = midX on both x1 and x2.
    // We find it by looking for a line where x1 equals midX.
    const lines = Array.from(doc.querySelectorAll("line"));
    const netLine = lines.find(
      (l) =>
        Math.abs(parseFloat(l.getAttribute("x1") ?? "0") - midX) < TOL &&
        Math.abs(parseFloat(l.getAttribute("x2") ?? "0") - midX) < TOL,
    );
    expect(netLine).toBeDefined();
  });

  it("net extends from dblTop to dblBot (covers full doubles court height)", () => {
    const lines = Array.from(doc.querySelectorAll("line"));
    // The net line has x1 = x2 = midX and spans the full court height
    const netLine = lines.find(
      (l) => Math.abs(parseFloat(l.getAttribute("x1") ?? "0") - midX) < TOL,
    );
    expect(netLine).toBeDefined();
    // y1 should be near dblTop (allowing for the post overhang offset)
    const y1 = parseFloat(netLine!.getAttribute("y1") ?? "NaN");
    const y2 = parseFloat(netLine!.getAttribute("y2") ?? "NaN");
    expect(y1).toBeLessThanOrEqual(dblTop + 1);
    expect(y2).toBeGreaterThanOrEqual(dblBot - 1);
  });

  // ── Doubles bands ────────────────────────────────────────────────────────

  it("doubles band height matches (COURT_WIDTH_DBL - COURT_WIDTH_SGL) / 2", () => {
    // The band height in meters is 0.460 m (each side).
    // In SVG units: sglInset ≈ 20.89 px.
    // We verify this by checking that sTop - dblTop ≈ sglInset.
    const expectedBandH = ((COURT_WIDTH_DBL - COURT_WIDTH_SGL) / 2) * SCALE_Y;
    expect(Math.abs(sTop - dblTop - expectedBandH)).toBeLessThan(TOL);
  });

  it("doubles bands are rendered (opacity=0.7 rects at top and bottom)", () => {
    // The doubles band rects have opacity="0.7" — they distinguish the bands
    // visually from the main singles surface.
    const bandRects = Array.from(doc.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("opacity") === "0.7",
    );
    // 4 band rects: top-left, top-right, bottom-left, bottom-right
    expect(bandRects.length).toBe(4);
  });

  it("top doubles band rect y equals PADDING (dblTop)", () => {
    const bandRects = Array.from(doc.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("opacity") === "0.7",
    );
    const topBands = bandRects.filter(
      (r) => Math.abs(parseFloat(r.getAttribute("y") ?? "NaN") - dblTop) < TOL,
    );
    // Two top bands: one blue (left half), one red (right half)
    expect(topBands.length).toBe(2);
  });

  it("bottom doubles band rect y equals dblBot - bandH", () => {
    const bandRects = Array.from(doc.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("opacity") === "0.7",
    );
    const expectedY = dblBot - sglInset;
    const botBands = bandRects.filter(
      (r) => Math.abs(parseFloat(r.getAttribute("y") ?? "NaN") - expectedY) < TOL,
    );
    expect(botBands.length).toBe(2);
  });

  it("doubles outer boundary rect starts at PADDING and covers full court height", () => {
    const rects = Array.from(doc.querySelectorAll("rect"));
    // The outer boundary is a rect with x=PADDING, y=dblTop, width=courtW, height=courtH
    // rendered with fill="none" stroke="white". We find it by y ≈ dblTop and width ≈ courtW.
    const outerBoundary = rects.find(
      (r) =>
        Math.abs(parseFloat(r.getAttribute("y") ?? "NaN") - dblTop) < TOL &&
        Math.abs(parseFloat(r.getAttribute("width") ?? "NaN") - courtW) < TOL &&
        r.getAttribute("fill") === "none",
    );
    expect(outerBoundary).toBeDefined();
  });

  // ── Singles court ────────────────────────────────────────────────────────

  it("singles sideline inset is (6.1 - 5.18) / 2 / 6.1 ≈ 7.54% of court height", () => {
    // This ratio locks the singles width to the official 5.18 m inside the 6.1 m doubles court.
    const expectedRatio = (COURT_WIDTH_DBL - COURT_WIDTH_SGL) / 2 / COURT_WIDTH_DBL;
    const actualRatio = sglInset / courtH;
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.001);
  });

  it("singles inner boundary rect starts at sTop", () => {
    const rects = Array.from(doc.querySelectorAll("rect"));
    // The singles boundary rect: x=PADDING, y=sTop, width=courtW, fill="none" stroke="white"
    // It's the second stroke-only rect (the first being the doubles outer boundary).
    const singlesBoundary = rects.find(
      (r) =>
        Math.abs(parseFloat(r.getAttribute("y") ?? "NaN") - sTop) < TOL &&
        Math.abs(parseFloat(r.getAttribute("width") ?? "NaN") - courtW) < TOL &&
        r.getAttribute("fill") === "none",
    );
    expect(singlesBoundary).toBeDefined();
  });

  // ── Short service line ───────────────────────────────────────────────────

  it("short service line is 1.98m from the net (29.55% of each half's length)", () => {
    // shortDist / (courtW / 2) should equal NET_TO_SHORT_SVC / (COURT_LENGTH / 2)
    const expectedRatio = NET_TO_SHORT_SVC / (COURT_LENGTH / 2);
    const actualRatio = shortDist / (courtW / 2);
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.001);
  });

  it("left short service line is at x ≈ midX - NET_TO_SHORT_SVC * SCALE_X", () => {
    // Short service lines are vertical <line> elements between sTop and sBot
    // with x1 = x2 = leftShort (or rightShort).
    const lines = Array.from(doc.querySelectorAll("line"));
    const leftSvcLine = lines.find(
      (l) =>
        Math.abs(parseFloat(l.getAttribute("x1") ?? "NaN") - leftShort) < TOL &&
        Math.abs(parseFloat(l.getAttribute("x2") ?? "NaN") - leftShort) < TOL,
    );
    expect(leftSvcLine).toBeDefined();
  });

  it("right short service line is at x ≈ midX + NET_TO_SHORT_SVC * SCALE_X", () => {
    const lines = Array.from(doc.querySelectorAll("line"));
    const rightSvcLine = lines.find(
      (l) =>
        Math.abs(parseFloat(l.getAttribute("x1") ?? "NaN") - (midX + shortDist)) < TOL &&
        Math.abs(parseFloat(l.getAttribute("x2") ?? "NaN") - (midX + shortDist)) < TOL,
    );
    expect(rightSvcLine).toBeDefined();
  });

  // ── Long service line ────────────────────────────────────────────────────

  it("long service line is 0.76m from each baseline (5.67% of court length)", () => {
    // longInset / courtW should equal LONG_SVC_INSET / COURT_LENGTH
    const expectedRatio = LONG_SVC_INSET / COURT_LENGTH;
    const actualRatio = longInset / courtW;
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.001);
  });

  it("left long service line is at x ≈ PADDING + LONG_SVC_INSET * SCALE_X", () => {
    const lines = Array.from(doc.querySelectorAll("line"));
    const leftLongLine = lines.find(
      (l) =>
        Math.abs(parseFloat(l.getAttribute("x1") ?? "NaN") - leftLong) < TOL &&
        Math.abs(parseFloat(l.getAttribute("x2") ?? "NaN") - leftLong) < TOL,
    );
    expect(leftLongLine).toBeDefined();
  });

  it("right long service line is at x ≈ VB_W - PADDING - LONG_SVC_INSET * SCALE_X", () => {
    const lines = Array.from(doc.querySelectorAll("line"));
    const rightLongLine = lines.find(
      (l) =>
        Math.abs(parseFloat(l.getAttribute("x1") ?? "NaN") - rightLong) < TOL &&
        Math.abs(parseFloat(l.getAttribute("x2") ?? "NaN") - rightLong) < TOL,
    );
    expect(rightLongLine).toBeDefined();
  });

  // ── Line thickness ───────────────────────────────────────────────────────

  it("court boundary stroke-width is based on official 40mm line thickness", () => {
    // LINE_W = max(1.5, 0.04 * SCALE_X) ≈ 1.96
    // The outer boundary uses stroke-width = LINE_W * 1.2 ≈ 2.36
    // We just verify it's ≥ the official scaled LINE_W (≥ 1.96).
    const rects = Array.from(doc.querySelectorAll("rect"));
    const boundary = rects.find(
      (r) => r.getAttribute("fill") === "none" && r.getAttribute("stroke") === "white",
    );
    expect(boundary).toBeDefined();
    const strokeW = parseFloat(boundary!.getAttribute("stroke-width") ?? "0");
    expect(strokeW).toBeGreaterThanOrEqual(LINE_W);
  });

  // ── Score buttons ────────────────────────────────────────────────────────

  it("two score buttons exist with data-player=0 and data-player=1", () => {
    // DOMParser query: the score buttons are <g class="court__score-btn" data-player="...">
    const btn0 = doc.querySelector('.court__score-btn[data-player="0"]');
    const btn1 = doc.querySelector('.court__score-btn[data-player="1"]');
    expect(btn0).not.toBeNull();
    expect(btn1).not.toBeNull();
  });

  it("left score button transparent rect starts at PADDING (full left half)", () => {
    // The clickable rect inside the left score group starts at x=PADDING
    // (it covers the full left half from the outer baseline to the dead zone).
    const btn0 = doc.querySelector('.court__score-btn[data-player="0"]');
    const rect = btn0?.querySelector("rect");
    const x = parseFloat(rect?.getAttribute("x") ?? "NaN");
    expect(Math.abs(x - PADDING)).toBeLessThan(TOL);
  });

  it("right score button transparent rect starts at midX + netGap (dead zone respected)", () => {
    const btn1 = doc.querySelector('.court__score-btn[data-player="1"]');
    const rect = btn1?.querySelector("rect");
    const x = parseFloat(rect?.getAttribute("x") ?? "NaN");
    // netGap = Math.round(shortDist * 0.6) ≈ 58
    expect(Math.abs(x - (midX + netGap))).toBeLessThan(TOL);
  });

  it("left score button does not extend past midX - netGap (dead zone respected)", () => {
    const btn0 = doc.querySelector('.court__score-btn[data-player="0"]');
    const rect = btn0?.querySelector("rect");
    const x = parseFloat(rect?.getAttribute("x") ?? "NaN");
    const w = parseFloat(rect?.getAttribute("width") ?? "NaN");
    // Right edge of left rect = x + width should be ≈ midX - netGap
    expect(Math.abs(x + w - (midX - netGap))).toBeLessThan(TOL);
  });

  // ── Score text ───────────────────────────────────────────────────────────

  it("score font-size scales with VB_H (= Math.round(319 * 0.22) = 70)", () => {
    // Font size is embedded in the SVG text element as font-size="70".
    // We look for it via regex since DOMParser may not preserve SVG presentation attrs.
    expect(svg).toContain(`font-size="${scoreFontSize}"`);
  });

  it("left score text is centered in the outer left quarter", () => {
    // scoreLx = (PADDING + midX - netGap) / 2 ≈ 156.5
    // We check the x attribute on the score text element.
    const expectedLx = (PADDING + midX - netGap) / 2;
    const btn0 = doc.querySelector('.court__score-btn[data-player="0"]');
    const text = btn0?.querySelector("text");
    const x = parseFloat(text?.getAttribute("x") ?? "NaN");
    expect(Math.abs(x - expectedLx)).toBeLessThan(TOL);
  });

  it("right score text is centered in the outer right quarter", () => {
    const expectedRx = (midX + netGap + PADDING + courtW) / 2;
    const btn1 = doc.querySelector('.court__score-btn[data-player="1"]');
    const text = btn1?.querySelector("text");
    const x = parseFloat(text?.getAttribute("x") ?? "NaN");
    expect(Math.abs(x - expectedRx)).toBeLessThan(TOL);
  });
});
