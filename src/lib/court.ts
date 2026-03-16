/**
 * Badminton court SVG renderer.
 * All court dimensions are derived from official BWF measurements so the
 * rendered proportions exactly match a real court.
 */
import type { Match } from "./match.js";
import type { CourtColors } from "./themes.js";

// ── Official BWF court dimensions (meters) ────────────────────────────────────

/** Baseline to baseline — runs left ↔ right in the SVG. */
const COURT_LENGTH = 13.4;
/** Doubles sideline to sideline — runs top ↔ bottom in the SVG. */
const COURT_WIDTH_DBL = 6.1;
/** Singles sideline to sideline (inset from doubles lines). */
const COURT_WIDTH_SGL = 5.18;
/** Distance from the net to the short service line (each half). */
const NET_TO_SHORT_SVC = 1.98;
/** Distance from each baseline to the doubles long service line. */
const LONG_SVC_INSET = 0.76;
/** Standard line thickness. */
const LINE_THICKNESS = 0.04;

// ── SVG canvas ────────────────────────────────────────────────────────────────

/** Fixed viewBox width. */
const VB_W = 700;

/**
 * ViewBox height derived from the official court aspect ratio (13.4 : 6.1 ≈ 2.197).
 * CSS `height: auto` on the SVG element will then render the correct proportions.
 */
const VB_H = Math.round((VB_W * COURT_WIDTH_DBL) / COURT_LENGTH); // ≈ 319

/** Visual padding around the court surface. */
const PADDING = Math.round(VB_W * 0.03); // ≈ 21

// ── Scale factors: meters → SVG units ────────────────────────────────────────

const SCALE_X = (VB_W - PADDING * 2) / COURT_LENGTH;
const SCALE_Y = (VB_H - PADDING * 2) / COURT_WIDTH_DBL;

/**
 * Official line width in SVG units (40 mm scaled).
 * Clamped to ≥ 1.5 so lines stay legible at small screen sizes.
 */
const LINE_W = Math.max(1.5, LINE_THICKNESS * SCALE_X);

// ── Exported viewBox constants ────────────────────────────────────────────────

/** ViewBox width — import this in match-view.ts to keep the SVG in sync. */
export const COURT_VB_W = VB_W;

/** ViewBox height — import this in match-view.ts to keep the SVG in sync. */
export const COURT_VB_H = VB_H;

// ── Internal types ────────────────────────────────────────────────────────────

/** A rectangular region on the court. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Precomputed court layout measurements. */
interface Dimensions {
  /** Total court width in SVG units (= COURT_LENGTH * SCALE_X). */
  cw: number;
  /** Total court height in SVG units (= COURT_WIDTH_DBL * SCALE_Y). */
  ch: number;
  /** Vertical center of the court. */
  cy: number;
  /** Horizontal center (net position). */
  midX: number;
  /** Top doubles sideline (outer edge). */
  dblTop: number;
  /** Bottom doubles sideline (outer edge). */
  dblBot: number;
  /** Height of each doubles side band (singles inset distance). */
  bandH: number;
  /** Top edge of the singles court (inset from doubles sideline). */
  sTop: number;
  /** Bottom edge of the singles court. */
  sBot: number;
  /** Height of the singles court. */
  sH: number;
  /** Short service line, left half (= midX − NET_TO_SHORT_SVC * SCALE_X). */
  leftShort: number;
  /** Doubles long service line, left half (= PADDING + LONG_SVC_INSET * SCALE_X). */
  leftLong: number;
  /** Short service line, right half. */
  rightShort: number;
  /** Doubles long service line, right half. */
  rightLong: number;
  /** Half the singles court height (used to split service boxes). */
  halfSH: number;
}

/** The serve origin/destination boxes with their zone keys. */
interface ServeBoxes {
  fromKey: string;
  toKey: string;
  from: Box;
  to: Box;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders the complete court SVG inner content.
 * @param match - Current match state (null renders nothing).
 * @param courtColors - Theme-specific color palette.
 * @returns SVG markup string to set as innerHTML of an `<svg>` element.
 */
export function renderCourtSvg(match: Match | null, courtColors: CourtColors): string {
  if (!match) return "";

  // Swap blue/red colors when sides are swapped
  const C: CourtColors = match.swapped
    ? {
        ...courtColors,
        blueFill: courtColors.redFill,
        blueDark: courtColors.redDark,
        redFill: courtColors.blueFill,
        redDark: courtColors.blueDark,
      }
    : courtColors;

  const L = match.leftPlayer;
  const R = match.rightPlayer;

  const dim = computeDimensions();
  const serveBoxes = computeServeBoxes(match, L, dim);
  const from = serveBoxes.from;
  const to = serveBoxes.to;

  return [
    renderDefs(C),
    renderBackground(C),
    renderCourtSurface(C, dim, serveBoxes),
    renderServeHighlights(C, from, to),
    renderCourtLines(dim),
    renderNet(C, dim),
    renderServeArrow(C, from, to),
    renderShuttlecock(C, from),
    renderScores(C, match, L, R, dim),
  ].join("");
}

// ── Dimension helpers ─────────────────────────────────────────────────────────

/** Calculates all key positions from the official court measurements. */
function computeDimensions(): Dimensions {
  const cw = VB_W - PADDING * 2;
  const ch = VB_H - PADDING * 2;
  const midX = VB_W / 2;
  const cy = VB_H / 2;

  // Singles sideline inset from the doubles sideline on each side
  const sglInset = ((COURT_WIDTH_DBL - COURT_WIDTH_SGL) / 2) * SCALE_Y;
  const dblTop = PADDING;
  const dblBot = PADDING + ch;
  const sTop = PADDING + sglInset;
  const sBot = PADDING + ch - sglInset;
  const sH = sBot - sTop;

  // Short service line: 1.98 m from the net on each side
  const shortDist = NET_TO_SHORT_SVC * SCALE_X;

  // Doubles long service line: 0.76 m inset from each baseline
  const longInset = LONG_SVC_INSET * SCALE_X;

  return {
    cw,
    ch,
    cy,
    midX,
    dblTop,
    dblBot,
    bandH: sglInset,
    sTop,
    sBot,
    sH,
    leftShort: midX - shortDist,
    leftLong: PADDING + longInset,
    rightShort: midX + shortDist,
    rightLong: VB_W - PADDING - longInset,
    halfSH: sH / 2,
  };
}

/**
 * Determines which service box the shuttlecock is served from and to.
 * In badminton, even scores serve from the right box, odd from the left.
 */
function computeServeBoxes(match: Match, L: number, dim: Dimensions): ServeBoxes {
  const { serving } = match;
  const serverScore = match.scores[serving];
  const isEven = serverScore % 2 === 0;
  const servingSide = serving === L ? "left" : "right";

  let fromKey: string, toKey: string;
  if (servingSide === "left") {
    fromKey = isEven ? "left-bot" : "left-top";
    toKey = isEven ? "right-top" : "right-bot";
  } else {
    fromKey = isEven ? "right-top" : "right-bot";
    toKey = isEven ? "left-bot" : "left-top";
  }

  const { leftLong, leftShort, rightShort, rightLong, sTop, halfSH } = dim;
  const boxes: Record<string, Box> = {
    "left-top": { x: leftLong, y: sTop, w: leftShort - leftLong, h: halfSH },
    "left-bot": { x: leftLong, y: sTop + halfSH, w: leftShort - leftLong, h: halfSH },
    "right-top": { x: rightShort, y: sTop, w: rightLong - rightShort, h: halfSH },
    "right-bot": { x: rightShort, y: sTop + halfSH, w: rightLong - rightShort, h: halfSH },
  };

  return { fromKey, toKey, from: boxes[fromKey], to: boxes[toKey] };
}

// ── SVG render helpers ────────────────────────────────────────────────────────

/** SVG filter definitions (arrow marker, glow effect). */
function renderDefs(C: CourtColors): string {
  return `<defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${C.serve}"/>
    </marker>
    <filter id="serve-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

/** Court background rectangle. */
function renderBackground(C: CourtColors): string {
  return `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" rx="12" fill="${C.background}"/>`;
}

/** Colored court surface zones (blue left, red right, with serve-box shading). */
function renderCourtSurface(C: CourtColors, dim: Dimensions, serveBoxes: ServeBoxes): string {
  const {
    cw,
    midX,
    dblTop,
    dblBot,
    bandH,
    sTop,
    sH,
    leftLong,
    leftShort,
    rightShort,
    rightLong,
    halfSH,
  } = dim;
  const { fromKey } = serveBoxes;
  const { blueFill: bf, blueDark: bd, redFill: rf, redDark: rd } = C;

  // Full court width for the doubles bands
  const fullW = PADDING + cw - PADDING; // = cw

  return `
    <!-- Singles court surface (blue left, red right) -->
    <rect x="${PADDING}" y="${sTop}" width="${midX - PADDING}" height="${sH}" fill="${bf}" rx="4"/>
    <rect x="${PADDING}" y="${sTop}" width="${leftLong - PADDING}" height="${sH}" fill="${bd}" rx="4"/>
    <rect x="${leftLong}" y="${sTop}" width="${leftShort - leftLong}" height="${halfSH}" fill="${fromKey === "left-top" ? bf : bd}"/>
    <rect x="${leftLong}" y="${sTop + halfSH}" width="${leftShort - leftLong}" height="${halfSH}" fill="${fromKey === "left-bot" ? bf : bd}"/>
    <rect x="${leftShort}" y="${sTop}" width="${midX - leftShort}" height="${sH}" fill="${bf}"/>
    <rect x="${midX}" y="${sTop}" width="${PADDING + cw - midX}" height="${sH}" fill="${rf}" rx="4"/>
    <rect x="${rightLong}" y="${sTop}" width="${PADDING + cw - rightLong}" height="${sH}" fill="${rd}" rx="4"/>
    <rect x="${rightShort}" y="${sTop}" width="${rightLong - rightShort}" height="${halfSH}" fill="${fromKey === "right-top" ? rf : rd}"/>
    <rect x="${rightShort}" y="${sTop + halfSH}" width="${rightLong - rightShort}" height="${halfSH}" fill="${fromKey === "right-bot" ? rf : rd}"/>
    <rect x="${midX}" y="${sTop}" width="${rightShort - midX}" height="${sH}" fill="${rf}"/>
    <!-- Doubles side bands (top and bottom strips between singles and doubles lines) -->
    <rect x="${PADDING}" y="${dblTop}" width="${midX - PADDING}" height="${bandH}" fill="${bd}" rx="4" opacity="0.7"/>
    <rect x="${PADDING}" y="${dblBot - bandH}" width="${midX - PADDING}" height="${bandH}" fill="${bd}" rx="4" opacity="0.7"/>
    <rect x="${midX}" y="${dblTop}" width="${fullW - midX + PADDING}" height="${bandH}" fill="${rd}" rx="4" opacity="0.7"/>
    <rect x="${midX}" y="${dblBot - bandH}" width="${fullW - midX + PADDING}" height="${bandH}" fill="${rd}" rx="4" opacity="0.7"/>`;
}

/** Highlighted borders around the serve origin and destination boxes. */
function renderServeHighlights(C: CourtColors, from: Box, to: Box): string {
  const inset = LINE_W * 1.5;
  return `
    <rect x="${from.x + inset}" y="${from.y + inset}" width="${from.w - inset * 2}" height="${from.h - inset * 2}"
      fill="none" stroke="${C.serve}" stroke-width="${LINE_W * 1.5}" rx="5" filter="url(#serve-glow)"/>
    <rect x="${to.x + inset}" y="${to.y + inset}" width="${to.w - inset * 2}" height="${to.h - inset * 2}"
      fill="${C.serveReceive}" stroke="${C.serve}" stroke-width="${LINE_W}" rx="5"
      stroke-dasharray="${LINE_W * 5} ${LINE_W * 2.5}" opacity="0.8"/>`;
}

/** White boundary and division lines at official 40 mm thickness. */
function renderCourtLines(dim: Dimensions): string {
  const { cw, cy, dblTop, dblBot, sTop, sBot, sH, leftLong, leftShort, rightShort, rightLong } =
    dim;
  return `
    <!-- Doubles outer boundary -->
    <rect x="${PADDING}" y="${dblTop}" width="${cw}" height="${dblBot - dblTop}"
      fill="none" stroke="white" stroke-width="${LINE_W * 1.2}" rx="4"/>
    <!-- Singles inner boundary -->
    <rect x="${PADDING}" y="${sTop}" width="${cw}" height="${sH}"
      fill="none" stroke="white" stroke-width="${LINE_W * 1.2}" rx="3"/>
    <!-- Center service lines (left and right halves) -->
    <line x1="${PADDING}"    y1="${cy}" x2="${leftShort}"    y2="${cy}" stroke="white" stroke-width="${LINE_W}"/>
    <line x1="${rightShort}" y1="${cy}" x2="${PADDING + cw}" y2="${cy}" stroke="white" stroke-width="${LINE_W}"/>
    <!-- Short service lines -->
    <line x1="${leftShort}"  y1="${sTop}" x2="${leftShort}"  y2="${sBot}" stroke="white" stroke-width="${LINE_W}"/>
    <line x1="${rightShort}" y1="${sTop}" x2="${rightShort}" y2="${sBot}" stroke="white" stroke-width="${LINE_W}"/>
    <!-- Doubles long service lines -->
    <line x1="${leftLong}"   y1="${dblTop}" x2="${leftLong}"   y2="${dblBot}" stroke="white" stroke-width="${LINE_W}"/>
    <line x1="${rightLong}"  y1="${dblTop}" x2="${rightLong}"  y2="${dblBot}" stroke="white" stroke-width="${LINE_W}"/>`;
}

/** Net line and post caps at center court. */
function renderNet(C: CourtColors, dim: Dimensions): string {
  const { midX, dblTop, dblBot } = dim;
  const postW = LINE_W * 3;
  const postH = LINE_W * 5;
  return `
    <line x1="${midX}" y1="${dblTop - postH / 2}" x2="${midX}" y2="${dblBot + postH / 2}"
      stroke="white" stroke-width="${LINE_W * 2}"/>
    <line x1="${midX}" y1="${dblTop - postH / 2}" x2="${midX}" y2="${dblBot + postH / 2}"
      stroke="white" stroke-width="${LINE_W}" opacity="0.3"/>
    <rect x="${midX - postW / 2}" y="${dblTop - postH}" width="${postW}" height="${postH}" rx="2" fill="${C.netPost}"/>
    <rect x="${midX - postW / 2}" y="${dblBot}"          width="${postW}" height="${postH}" rx="2" fill="${C.netPost}"/>`;
}

/** Dashed arrow from the serve box to the receive box. */
function renderServeArrow(C: CourtColors, from: Box, to: Box): string {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
    stroke="${C.serve}" stroke-width="${LINE_W * 1.2}"
    stroke-dasharray="${LINE_W * 6} ${LINE_W * 3}"
    opacity="0.85" marker-end="url(#arrowhead)"/>`;
}

/** Animated shuttlecock bobbing above the serve box. */
function renderShuttlecock(C: CourtColors, from: Box): string {
  const size = Math.round(VB_H * 0.09);
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2 - size;
  const bobAmp = Math.round(size * 0.4);
  return `
    <g transform="translate(${cx - size / 2}, ${cy - size / 2})">
      <animateTransform attributeName="transform" type="translate"
        values="${cx - size / 2},${cy - size / 2}; ${cx - size / 2},${cy - size / 2 - bobAmp}; ${cx - size / 2},${cy - size / 2}"
        dur="1.2s" repeatCount="indefinite" calcMode="spline"
        keySplines="0.33 0 0.66 1; 0.33 0 0.66 1"/>
      <g transform="scale(${size / 120})">
        <!-- Cork base -->
        <ellipse cx="50" cy="108" rx="14" ry="11" fill="${C.serve}"/>
        <ellipse cx="50" cy="103" rx="12" ry="8" fill="white" opacity=".8"/>
        <!-- Band -->
        <ellipse cx="50" cy="95" rx="15" ry="4" fill="none" stroke="${C.serve}" stroke-width="1.5" opacity=".7"/>
        <!-- Center feathers -->
        <path d="M50 93Q50 60 50 20Q55 60 55 93Z" fill="white" opacity=".95"/>
        <path d="M50 93Q50 60 50 20Q45 60 45 93Z" fill="#e8e8e8" opacity=".9"/>
        <!-- Inner feathers -->
        <path d="M45 94Q38 62 32 28Q40 62 44 94Z" fill="white" opacity=".9"/>
        <path d="M45 94Q36 64 30 28Q38 65 42 94Z" fill="#e8e8e8" opacity=".85"/>
        <path d="M55 94Q62 62 68 28Q60 62 56 94Z" fill="white" opacity=".9"/>
        <path d="M55 94Q64 64 70 28Q62 65 58 94Z" fill="#e8e8e8" opacity=".85"/>
        <!-- Mid feathers -->
        <path d="M42 95Q28 68 18 38Q30 68 39 95Z" fill="white" opacity=".85"/>
        <path d="M42 95Q26 70 16 38Q28 72 37 95Z" fill="#e8e8e8" opacity=".8"/>
        <path d="M58 95Q72 68 82 38Q70 68 61 95Z" fill="white" opacity=".85"/>
        <path d="M58 95Q74 70 84 38Q72 72 63 95Z" fill="#e8e8e8" opacity=".8"/>
        <!-- Outer feathers -->
        <path d="M38 96Q20 72 8 48Q18 74 34 96Z" fill="white" opacity=".8"/>
        <path d="M38 96Q17 74 5 48Q16 77 32 96Z" fill="#e8e8e8" opacity=".75"/>
        <path d="M62 96Q80 72 92 48Q82 74 66 96Z" fill="white" opacity=".8"/>
        <path d="M62 96Q83 74 95 48Q84 77 68 96Z" fill="#e8e8e8" opacity=".75"/>
      </g>
    </g>`;
}

/** Clickable score display areas (left and right) with tap-to-score animation. */
function renderScores(C: CourtColors, match: Match, L: number, R: number, dim: Dimensions): string {
  const { cw, midX, cy, sTop, sH } = dim;

  // Short service line distance from net — used to set the dead zone proportionally
  const shortDist = NET_TO_SHORT_SVC * SCALE_X;

  // Dead zone on each side of the net: 60% of the short service distance.
  // Prevents 2-digit scores (e.g. 29-29 at deuce) from trespassing the net zone.
  const netGap = Math.round(shortDist * 0.6);

  // Center scores in the full outer half so they stay far from the net
  // regardless of how many digits are displayed.
  const scoreLx = (PADDING + midX - netGap) / 2;
  const scoreRx = (midX + netGap + PADDING + cw) / 2;

  // Font size and animation peak scale with the canvas height
  const fs = Math.round(VB_H * 0.22);
  const fsPk = Math.round(VB_H * 0.28);

  const attrs = `text-anchor="middle" font-size="${fs}" font-weight="900" font-family="system-ui, sans-serif" style="pointer-events:none"`;

  const scoreY = cy + fs * 0.28; // vertically center the text on the court midline

  return `
    <g class="court__score-btn" data-player="${L}" style="cursor:pointer">
      <rect x="${PADDING}" y="${sTop}" width="${midX - PADDING - netGap}" height="${sH}" fill="transparent"/>
      <text ${attrs} x="${scoreLx}" y="${scoreY}"
          stroke="rgba(0,0,0,0.45)" stroke-width="${LINE_W * 5}" stroke-linejoin="round"
          fill="none" paint-order="stroke">
        ${match.scores[L]}
        <animate attributeName="font-size" values="${fs};${fsPk};${fs}" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
      <text ${attrs} x="${scoreLx}" y="${scoreY}"
          fill="${C.scoreText}" stroke="rgba(0,0,0,0.3)" stroke-width="${LINE_W * 2}" stroke-linejoin="round"
          paint-order="stroke fill">
        ${match.scores[L]}
        <animate attributeName="font-size" values="${fs};${fsPk};${fs}" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
        <animate attributeName="opacity" values="1;0.7;1" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
    </g>
    <g class="court__score-btn" data-player="${R}" style="cursor:pointer">
      <rect x="${midX + netGap}" y="${sTop}" width="${PADDING + cw - midX - netGap}" height="${sH}" fill="transparent"/>
      <text ${attrs} x="${scoreRx}" y="${scoreY}"
          stroke="rgba(0,0,0,0.45)" stroke-width="${LINE_W * 5}" stroke-linejoin="round"
          fill="none" paint-order="stroke">
        ${match.scores[R]}
        <animate attributeName="font-size" values="${fs};${fsPk};${fs}" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
      <text ${attrs} x="${scoreRx}" y="${scoreY}"
          fill="${C.scoreText}" stroke="rgba(0,0,0,0.3)" stroke-width="${LINE_W * 2}" stroke-linejoin="round"
          paint-order="stroke fill">
        ${match.scores[R]}
        <animate attributeName="font-size" values="${fs};${fsPk};${fs}" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
        <animate attributeName="opacity" values="1;0.7;1" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
    </g>`;
}
