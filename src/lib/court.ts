/**
 * Badminton court SVG renderer.
 * Generates the full court visualization including surface zones,
 * serve indicators, shuttlecock animation, and clickable score areas.
 */
import type { Match } from "./match.js";
import type { CourtColors } from "./themes.js";

/** A rectangular region on the court. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Precomputed court layout measurements. */
interface Dimensions {
  cw: number;
  ch: number;
  cy: number;
  midX: number;
  sTop: number;
  sBot: number;
  sH: number;
  leftShort: number;
  leftLong: number;
  rightShort: number;
  rightLong: number;
  halfSH: number;
}

/** The serve origin/destination boxes with their zone keys. */
interface ServeBoxes {
  fromKey: string;
  toKey: string;
  from: Box;
  to: Box;
}

const COURT_WIDTH = 700;
const COURT_HEIGHT = 400;
const PADDING = 20;

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

/** Calculates all key positions from the fixed court dimensions. */
function computeDimensions(): Dimensions {
  const cw = COURT_WIDTH - PADDING * 2,
    ch = COURT_HEIGHT - PADDING * 2;
  const cy = COURT_HEIGHT / 2,
    midX = PADDING + cw / 2;
  const singlesInset = ch * 0.065;
  const sTop = PADDING + singlesInset,
    sBot = PADDING + ch - singlesInset,
    sH = sBot - sTop;
  const shortDist = cw * 0.13,
    longDist = cw * 0.42;
  return {
    cw,
    ch,
    cy,
    midX,
    sTop,
    sBot,
    sH,
    leftShort: midX - shortDist,
    leftLong: midX - longDist,
    rightShort: midX + shortDist,
    rightLong: midX + longDist,
    halfSH: sH / 2,
  };
}

/**
 * Determines which service box the shuttlecock is served from and to.
 * In badminton, even scores serve from the right box, odd from the left.
 */
function computeServeBoxes(match: Match, L: number, dim: Dimensions): ServeBoxes {
  const serving = match.serving,
    serverScore = match.scores[serving];
  const isEven = serverScore % 2 === 0,
    servingSide = serving === L ? "left" : "right";
  let fromKey: string, toKey: string;
  if (servingSide === "left") {
    fromKey = isEven ? "left-bot" : "left-top";
    toKey = isEven ? "right-top" : "right-bot";
  } else {
    fromKey = isEven ? "right-top" : "right-bot";
    toKey = isEven ? "left-bot" : "left-top";
  }
  const boxes: Record<string, Box> = {
    "left-top": { x: dim.leftLong, y: dim.sTop, w: dim.leftShort - dim.leftLong, h: dim.halfSH },
    "left-bot": {
      x: dim.leftLong,
      y: dim.sTop + dim.halfSH,
      w: dim.leftShort - dim.leftLong,
      h: dim.halfSH,
    },
    "right-top": {
      x: dim.rightShort,
      y: dim.sTop,
      w: dim.rightLong - dim.rightShort,
      h: dim.halfSH,
    },
    "right-bot": {
      x: dim.rightShort,
      y: dim.sTop + dim.halfSH,
      w: dim.rightLong - dim.rightShort,
      h: dim.halfSH,
    },
  };
  return { fromKey, toKey, from: boxes[fromKey], to: boxes[toKey] };
}

/** SVG filter definitions (arrow marker, glow effect). */
function renderDefs(C: CourtColors): string {
  return `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${C.serve}"/></marker><filter id="serve-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
}

/** Court background rectangle. */
function renderBackground(C: CourtColors): string {
  return `<rect x="0" y="0" width="${COURT_WIDTH}" height="${COURT_HEIGHT}" rx="12" fill="${C.background}"/>`;
}

/** Colored court surface zones (blue left, red right, with serve-box shading). */
function renderCourtSurface(C: CourtColors, dim: Dimensions, serveBoxes: ServeBoxes): string {
  const { midX, sTop, sH, leftLong, leftShort, rightShort, rightLong, halfSH } = dim;
  const { fromKey } = serveBoxes;
  const bf = C.blueFill,
    bd = C.blueDark,
    rf = C.redFill,
    rd = C.redDark;
  return `
    <rect x="${PADDING}" y="${sTop}" width="${midX - PADDING}" height="${sH}" fill="${bf}" rx="4"/>
    <rect x="${PADDING}" y="${sTop}" width="${leftLong - PADDING}" height="${sH}" fill="${bd}" rx="4"/>
    <rect x="${leftLong}" y="${sTop}" width="${leftShort - leftLong}" height="${halfSH}" fill="${fromKey === "left-top" ? bf : bd}"/>
    <rect x="${leftLong}" y="${sTop + halfSH}" width="${leftShort - leftLong}" height="${halfSH}" fill="${fromKey === "left-bot" ? bf : bd}"/>
    <rect x="${leftShort}" y="${sTop}" width="${midX - leftShort}" height="${sH}" fill="${bf}"/>
    <rect x="${midX}" y="${sTop}" width="${PADDING + dim.cw - midX}" height="${sH}" fill="${rf}" rx="4"/>
    <rect x="${rightLong}" y="${sTop}" width="${PADDING + dim.cw - rightLong}" height="${sH}" fill="${rd}" rx="4"/>
    <rect x="${rightShort}" y="${sTop}" width="${rightLong - rightShort}" height="${halfSH}" fill="${fromKey === "right-top" ? rf : rd}"/>
    <rect x="${rightShort}" y="${sTop + halfSH}" width="${rightLong - rightShort}" height="${halfSH}" fill="${fromKey === "right-bot" ? rf : rd}"/>
    <rect x="${midX}" y="${sTop}" width="${rightShort - midX}" height="${sH}" fill="${rf}"/>`;
}

/** Highlighted borders around the serve origin and destination boxes. */
function renderServeHighlights(C: CourtColors, from: Box, to: Box): string {
  return `
    <rect x="${from.x + 3}" y="${from.y + 3}" width="${from.w - 6}" height="${from.h - 6}" fill="none" stroke="${C.serve}" stroke-width="3.5" rx="5" filter="url(#serve-glow)"/>
    <rect x="${to.x + 3}" y="${to.y + 3}" width="${to.w - 6}" height="${to.h - 6}" fill="${C.serveReceive}" stroke="${C.serve}" stroke-width="2.5" rx="5" stroke-dasharray="10 5" opacity="0.8"/>`;
}

/** White boundary and division lines. */
function renderCourtLines(dim: Dimensions): string {
  const { cw, cy, sTop, sBot, sH, leftLong, leftShort, rightShort, rightLong } = dim;
  return `
    <rect x="${PADDING}" y="${sTop}" width="${cw}" height="${sH}" fill="none" stroke="white" stroke-width="2.5" rx="3"/>
    <line x1="${PADDING}" y1="${cy}" x2="${leftShort}" y2="${cy}" stroke="white" stroke-width="2"/>
    <line x1="${rightShort}" y1="${cy}" x2="${PADDING + cw}" y2="${cy}" stroke="white" stroke-width="2"/>
    <line x1="${leftShort}" y1="${sTop}" x2="${leftShort}" y2="${sBot}" stroke="white" stroke-width="2"/>
    <line x1="${rightShort}" y1="${sTop}" x2="${rightShort}" y2="${sBot}" stroke="white" stroke-width="2"/>
    <line x1="${leftLong}" y1="${sTop}" x2="${leftLong}" y2="${sBot}" stroke="white" stroke-width="2"/>
    <line x1="${rightLong}" y1="${sTop}" x2="${rightLong}" y2="${sBot}" stroke="white" stroke-width="2"/>`;
}

/** Net line and post caps at center court. */
function renderNet(C: CourtColors, dim: Dimensions): string {
  const { midX, sTop, sBot } = dim;
  return `
    <line x1="${midX}" y1="${sTop - 5}" x2="${midX}" y2="${sBot + 5}" stroke="white" stroke-width="4"/>
    <line x1="${midX}" y1="${sTop - 5}" x2="${midX}" y2="${sBot + 5}" stroke="white" stroke-width="2" opacity="0.3"/>
    <rect x="${midX - 3}" y="${sTop - 10}" width="6" height="10" rx="2" fill="${C.netPost}"/>
    <rect x="${midX - 3}" y="${sBot}" width="6" height="10" rx="2" fill="${C.netPost}"/>`;
}

/** Dashed arrow from the serve box to the receive box. */
function renderServeArrow(C: CourtColors, from: Box, to: Box): string {
  const x1 = from.x + from.w / 2,
    y1 = from.y + from.h / 2,
    x2 = to.x + to.w / 2,
    y2 = to.y + to.h / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.serve}" stroke-width="2.5" stroke-dasharray="12 6" opacity="0.85" marker-end="url(#arrowhead)"/>`;
}

/** Animated shuttlecock bobbing above the serve box. */
function renderShuttlecock(C: CourtColors, from: Box): string {
  const cx = from.x + from.w / 2,
    cy = from.y + from.h / 2 - 30;
  const size = 30;
  return `
    <g transform="translate(${cx - size / 2}, ${cy - size / 2})">
      <animateTransform attributeName="transform" type="translate"
        values="${cx - size / 2},${cy - size / 2}; ${cx - size / 2},${cy - size / 2 - 12}; ${cx - size / 2},${cy - size / 2}"
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

  // Dead zone on each side of the net — clicks here score for nobody.
  // 60px each side gives a 120px total gap: wide enough that 2-digit scores
  // (e.g. 29-29 at deuce) never trespass into the opposite half.
  const netGap = 60;

  // Center scores in the full outer half (PADDING↔midX-netGap and midX+netGap↔PADDING+cw)
  // so they sit well away from the net regardless of how many digits are showing.
  const scoreLx = (PADDING + midX - netGap) / 2;
  const scoreRx = (midX + netGap + PADDING + cw) / 2;

  // Shared text attributes to avoid repetition across the two score groups.
  const scoreTextAttrs = `text-anchor="middle" font-size="72" font-weight="900" font-family="system-ui, sans-serif" style="pointer-events:none"`;

  return `
    <g class="court__score-btn" data-player="${L}" style="cursor:pointer">
      <rect x="${PADDING}" y="${sTop}" width="${midX - PADDING - netGap}" height="${sH}" fill="transparent"/>
      <text ${scoreTextAttrs} x="${scoreLx}" y="${cy + 20}" stroke="rgba(0,0,0,0.45)" stroke-width="10" stroke-linejoin="round" fill="none" paint-order="stroke">
        ${match.scores[L]}
        <animate attributeName="font-size" values="72;90;72" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
      <text ${scoreTextAttrs} x="${scoreLx}" y="${cy + 20}" fill="${C.scoreText}" stroke="rgba(0,0,0,0.3)" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill">
        ${match.scores[L]}
        <animate attributeName="font-size" values="72;90;72" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
        <animate attributeName="opacity" values="1;0.7;1" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
    </g>
    <g class="court__score-btn" data-player="${R}" style="cursor:pointer">
      <rect x="${midX + netGap}" y="${sTop}" width="${PADDING + cw - midX - netGap}" height="${sH}" fill="transparent"/>
      <text ${scoreTextAttrs} x="${scoreRx}" y="${cy + 20}" stroke="rgba(0,0,0,0.45)" stroke-width="10" stroke-linejoin="round" fill="none" paint-order="stroke">
        ${match.scores[R]}
        <animate attributeName="font-size" values="72;90;72" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
      <text ${scoreTextAttrs} x="${scoreRx}" y="${cy + 20}" fill="${C.scoreText}" stroke="rgba(0,0,0,0.3)" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill">
        ${match.scores[R]}
        <animate attributeName="font-size" values="72;90;72" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
        <animate attributeName="opacity" values="1;0.7;1" dur="0.35s" begin="indefinite" restart="always" class="court__score-anim"/>
      </text>
    </g>`;
}
