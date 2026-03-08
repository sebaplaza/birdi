/**
 * Match view component.
 * Renders the live scoreboard, court visualization, break overlay,
 * set history, winner banner, and action buttons.
 * All interactions dispatch events through the FSM.
 */
import { effect } from "@preact/signals-core";
import { h, text, bindText, show } from "../lib/dom.js";
import { renderCourtSvg } from "../lib/court.js";
import { currentTheme } from "../lib/themes.js";
import { t } from "../lib/i18n.js";
import { formatMs } from "../lib/utils.js";
import { state, currentMatch, setTime, totalTime, breakSeconds, send } from "../state.js";

// ── Inline SVG icons ──

const SHUTTLECOCK = `<svg class="shuttlecock-icon" viewBox="0 0 100 120"><ellipse cx="50" cy="105" rx="18" ry="14" fill="currentColor" opacity=".7"/><ellipse cx="50" cy="98" rx="16" ry="11" fill="currentColor" opacity=".5"/><path d="M50 90Q50 55 50 25Q56 55 56 90Z" fill="currentColor" opacity=".9"/><path d="M50 90Q50 55 50 25Q44 55 44 90Z" fill="currentColor" opacity=".7"/><path d="M44 91Q30 58 20 32Q32 60 40 91Z" fill="currentColor" opacity=".9"/><path d="M44 91Q28 60 20 32Q26 63 38 91Z" fill="currentColor" opacity=".7"/><path d="M56 91Q70 58 80 32Q68 60 60 91Z" fill="currentColor" opacity=".9"/><path d="M56 91Q72 60 80 32Q74 63 62 91Z" fill="currentColor" opacity=".7"/><path d="M38 93Q18 65 5 48Q15 68 34 93Z" fill="currentColor" opacity=".9"/><path d="M62 93Q82 65 95 48Q85 68 66 93Z" fill="currentColor" opacity=".7"/></svg>`;

const ICON_UNDO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
const ICON_SWITCH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
const ICON_END = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`;
const ICON_NEW = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

/**
 * Creates a button with an SVG icon and a reactive text label.
 * @param cls - CSS class string.
 * @param icon - SVG markup for the icon.
 * @param labelFn - Function returning the translated label text.
 * @param onclick - Click handler.
 */
function createActionBtn(
  cls: string,
  icon: string,
  labelFn: () => string,
  onclick: () => void,
): HTMLElement {
  const btn = h("button", { class: cls, type: "button", onclick });
  const span = h("span");
  bindText(span, labelFn);
  btn.innerHTML = icon;
  btn.append(span);
  return btn;
}

/** Creates the full match view with all sub-sections. */
export function createMatchView(): HTMLElement {
  // ── Winner banner ──
  const winnerText = h("h2", { class: "winner__text" });
  const winner = h("div", { class: "winner" }, winnerText);
  effect(() => {
    const m = currentMatch.value;
    if (!m || !m.finished || m.winner === null) {
      winner.style.display = "none";
      return;
    }
    winner.style.display = "";
    winner.className = `winner winner--${m.winner === 0 ? "blue" : "red"}`;
    winnerText.textContent = t("match.wins", {
      player: m.players[m.winner],
    });
  });

  // ── Timer (set time | total time) ──
  const timerSetLabel = h("span", { class: "timer__label" });
  bindText(timerSetLabel, () => t("match.timerSet"));
  const timerTotalLabel = h("span", { class: "timer__label" });
  bindText(timerTotalLabel, () => t("match.timerTotal"));

  const timer = h(
    "div",
    { class: "timer" },
    timerSetLabel,
    h(
      "span",
      { class: "timer__value" },
      text(() => setTime.value),
    ),
    h("span", { class: "timer__sep" }, "|"),
    timerTotalLabel,
    h(
      "span",
      { class: "timer__value" },
      text(() => totalTime.value),
    ),
  );

  // ── Scoreboard (left player vs right player) ──
  const leftServe = h("span", { class: "scoreboard__serve" });
  leftServe.innerHTML = SHUTTLECOCK;
  const leftName = h("span", { class: "scoreboard__name" });
  const leftSets = h("span", { class: "scoreboard__sets" });
  const leftScore = h("span", { class: "scoreboard__score" });
  const leftBtn = h("button", {
    class: "scoreboard__btn",
    type: "button",
    onclick: () => {
      const m = currentMatch.value;
      if (m) send({ type: "ADD_POINT", player: m.leftPlayer });
    },
  });
  leftBtn.textContent = "+";
  const leftPlayer = h(
    "div",
    { class: "scoreboard__player" },
    leftServe,
    leftName,
    leftSets,
    leftScore,
    leftBtn,
  );

  const vsLabel = h("span", { class: "scoreboard__vs" });
  bindText(vsLabel, () => t("match.vs"));

  const rightServe = h("span", { class: "scoreboard__serve" });
  rightServe.innerHTML = SHUTTLECOCK;
  const rightName = h("span", { class: "scoreboard__name" });
  const rightSets = h("span", { class: "scoreboard__sets" });
  const rightScore = h("span", { class: "scoreboard__score" });
  const rightBtn = h("button", {
    class: "scoreboard__btn",
    type: "button",
    onclick: () => {
      const m = currentMatch.value;
      if (m) send({ type: "ADD_POINT", player: m.rightPlayer });
    },
  });
  rightBtn.textContent = "+";
  const rightPlayer = h(
    "div",
    { class: "scoreboard__player" },
    rightBtn,
    rightScore,
    rightSets,
    rightName,
    rightServe,
  );

  const scoreboard = h(
    "div",
    { class: "scoreboard" },
    leftPlayer,
    h("div", { class: "scoreboard__middle" }, vsLabel),
    rightPlayer,
  );

  // ── Score pop animation + scoreboard data sync ──
  let prevLeftScore = -1;
  let prevRightScore = -1;
  effect(() => {
    const m = currentMatch.value;
    if (!m) return;
    const L = m.leftPlayer;
    const R = m.rightPlayer;
    const ls = m.scores[L];
    const rs = m.scores[R];
    const swapped = m.swapped;
    const leftColor = swapped ? "red" : "blue";
    const rightColor = swapped ? "blue" : "red";

    // Update player colors, names, sets, scores, and serve indicators
    leftPlayer.className = `scoreboard__player scoreboard__player--${leftColor}`;
    rightPlayer.className = `scoreboard__player scoreboard__player--${rightColor}`;
    leftName.textContent = m.players[L];
    rightName.textContent = m.players[R];
    leftSets.textContent = `(${m.sets[L]})`;
    rightSets.textContent = `(${m.sets[R]})`;
    leftScore.textContent = String(ls);
    rightScore.textContent = String(rs);
    leftServe.className = `scoreboard__serve${m.serving === L ? " scoreboard__serve--active" : ""}`;
    rightServe.className = `scoreboard__serve${m.serving === R ? " scoreboard__serve--active" : ""}`;

    // Trigger pop animation on score change
    if (prevLeftScore >= 0 && ls !== prevLeftScore) {
      leftScore.classList.add("scoreboard__score--pop");
      setTimeout(() => leftScore.classList.remove("scoreboard__score--pop"), 400);
    }
    if (prevRightScore >= 0 && rs !== prevRightScore) {
      rightScore.classList.add("scoreboard__score--pop");
      setTimeout(() => rightScore.classList.remove("scoreboard__score--pop"), 400);
    }
    prevLeftScore = ls;
    prevRightScore = rs;
  });

  // ── Completed sets history ──
  const setsHistory = h("div", { class: "sets-history" });
  effect(() => {
    const m = currentMatch.value;
    setsHistory.innerHTML = "";
    if (!m || m.completedSets.length === 0) {
      setsHistory.style.display = "none";
      return;
    }
    setsHistory.style.display = "";
    const L = m.leftPlayer;
    const R = m.rightPlayer;
    const leftColor = m.swapped ? "red" : "blue";
    const rightColor = m.swapped ? "blue" : "red";

    for (let i = 0; i < m.completedSets.length; i++) {
      const set = m.completedSets[i];
      const setWinner = set[L] > set[R] ? leftColor : rightColor;
      const time = m.setTimes[i] ? formatMs(m.setTimes[i]) : "";
      const row = h(
        "div",
        { class: "sets-history__row" },
        h("span", { class: "sets-history__label" }, `${t("match.timerSet")} ${i + 1}`),
        h(
          "span",
          {
            class: `sets-history__score sets-history__score--${leftColor}`,
          },
          String(set[L]),
        ),
        h("span", { class: "sets-history__dash" }, "-"),
        h(
          "span",
          {
            class: `sets-history__score sets-history__score--${rightColor}`,
          },
          String(set[R]),
        ),
        h(
          "span",
          {
            class: `sets-history__winner sets-history__winner--${setWinner}`,
          },
          "\u25CF",
        ),
      );
      if (time) {
        row.append(h("span", { class: "sets-history__time" }, time));
      }
      setsHistory.append(row);
    }
  });

  // ── Court SVG (re-renders on match or theme change) ──
  const courtSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  courtSvg.setAttribute("class", "court__svg");
  courtSvg.setAttribute("viewBox", "0 0 700 400");
  effect(() => {
    const m = currentMatch.value;
    void currentTheme.value;
    courtSvg.innerHTML = renderCourtSvg(m, currentTheme.value.court);
  });

  // Handle tap-to-score on the court SVG
  courtSvg.addEventListener("click", (e) => {
    const target = e.target as Element;
    const btn = target.closest(".court__score-btn");
    if (!btn || !currentMatch.value) return;
    btn.querySelectorAll("animate").forEach((a) => (a as SVGAnimateElement).beginElement());
    send({ type: "ADD_POINT", player: parseInt(btn.getAttribute("data-player")!) });
  });

  // ── Break overlay (60s at 11 points, 120s between sets) ──
  const breakTimerNum = h("div", { class: "court__break-timer" });
  bindText(breakTimerNum, () => String(breakSeconds.value));
  effect(() => {
    breakTimerNum.className =
      breakSeconds.value <= 10 && breakSeconds.value > 0
        ? "court__break-timer court__break-timer--warning"
        : "court__break-timer";
  });

  const breakTitle = h("div", { class: "court__break-title" });
  bindText(breakTitle, () => t("match.interval"));

  const breakWarning = h("div", { class: "court__break-warning" });
  bindText(breakWarning, () => t("match.timesUp"));
  show(breakWarning, () => breakSeconds.value <= 0);

  const breakBtn = h("button", {
    class: "court__break-btn",
    type: "button",
    onclick: () => send({ type: "RESUME" }),
  });
  bindText(breakBtn, () => t("match.resume"));

  const breakOverlay = h(
    "div",
    { class: "court__break" },
    h("div", { class: "court__break-content" }, breakTitle, breakTimerNum, breakWarning, breakBtn),
  );
  show(breakOverlay, () => state.value.type === "break");

  const court = h("div", { class: "court" }, courtSvg, breakOverlay);

  // ── Action buttons (undo, switch sides, end match, new match) ──
  const actions = h(
    "div",
    { class: "actions" },
    createActionBtn(
      "secondary outline actions__btn",
      ICON_UNDO,
      () => t("match.undo"),
      () => send({ type: "UNDO" }),
    ),
    createActionBtn(
      "secondary outline actions__btn",
      ICON_SWITCH,
      () => t("match.switchSides"),
      () => send({ type: "SWITCH_SIDES" }),
    ),
    createActionBtn(
      "contrast outline actions__btn",
      ICON_END,
      () => t("match.endMatch"),
      () => send({ type: "END_MATCH" }),
    ),
    createActionBtn(
      "secondary outline actions__btn",
      ICON_NEW,
      () => t("match.newMatch"),
      () => send({ type: "NEW_MATCH" }),
    ),
  );

  // ── Disable all interactive buttons during break ──
  const allButtons = [leftBtn, rightBtn, ...Array.from(actions.children)] as HTMLButtonElement[];
  effect(() => {
    const inBreak = state.value.type === "break";
    for (const btn of allButtons) {
      btn.disabled = inBreak;
    }
  });

  return h("div", null, winner, timer, scoreboard, setsHistory, court, actions);
}
