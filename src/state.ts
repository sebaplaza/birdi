/**
 * Root Finite State Machine (FSM) for the application.
 *
 * All state transitions flow through a single `send()` dispatcher.
 * The root FSM manages two concerns:
 *
 *   1. Top-level routing: setup vs in-game
 *   2. Global events (DELETE_HISTORY, CLEAR_HISTORY)
 *
 * In-game states (playing, break, finished) are delegated to the game sub-FSM.
 *
 *   setup ──START_MATCH──> playing
 *   playing / break / finished ──> game-fsm.send()
 */
import { signal, computed, effect } from "@preact/signals-core";
import { Match } from "./lib/match.js";
import type { HistoryEntry } from "./lib/match.js";
import { loadMatch, saveMatch, loadHistory, saveHistory, savePlayer } from "./lib/storage.js";
import { formatMs } from "./lib/utils.js";
import { t } from "./lib/i18n.js";
import { send as gameSend, type GameInput } from "./game-fsm.js";

// ── State types ──

/** In-game states returned by the game sub-FSM (break has no timestamp yet). */
export type GameState =
  | { type: "playing"; match: Match }
  | { type: "break"; match: Match; duration: number }
  | { type: "finished"; match: Match };

/** Full break state with timestamp, used only in the root FSM. */
type BreakState = { type: "break"; match: Match; duration: number; breakStartedAt: number };

/** Events accepted by the game sub-FSM. */
export type GameEvent =
  | { type: "ADD_POINT"; player: number }
  | { type: "UNDO" }
  | { type: "SWITCH_SIDES" }
  | { type: "END_MATCH" }
  | { type: "NEW_MATCH" }
  | { type: "RESUME" };

/** Discriminated union of all possible app states. */
export type AppState =
  | { type: "setup" }
  | { type: "playing"; match: Match }
  | BreakState
  | { type: "finished"; match: Match };

/** Discriminated union of all events the root FSM can process. */
export type AppEvent =
  | {
      type: "START_MATCH";
      players: [string, string];
      maxSets: number;
      pointsPerSet: number;
      serving: number;
    }
  | GameEvent
  | { type: "DELETE_HISTORY"; index: number }
  | { type: "CLEAR_HISTORY" };

// ── State ──

/** Restores the app state from storage on startup. */
function initState(): AppState {
  const saved = loadMatch();
  if (saved) {
    const m = new Match(saved);
    return m.finished ? { type: "finished", match: m } : { type: "playing", match: m };
  }
  return { type: "setup" };
}

/** The single source of truth for the entire app. */
export const state = signal<AppState>({ type: "setup" });

/** Past match results. */
export const history = signal<HistoryEntry[]>([]);

/** Re-initializes state and history from storage. Call after `initStorage()` completes. */
export function restoreState(): void {
  state.value = initState();
  history.value = loadHistory();
}

/** Incremented every second during play for timer reactivity. */
export const tick = signal(0);

/** Countdown seconds remaining during a break. */
export const breakSeconds = signal(60);

// ── Derived signals ──

/** The current Match object, or null when in setup. */
export const currentMatch = computed((): Match | null => {
  const s = state.value;
  return s.type === "setup" ? null : s.match;
});

/** Formatted current set elapsed time (e.g. "02:35"). */
export const setTime = computed(() => {
  void tick.value;
  const m = currentMatch.value;
  if (!m) return "00:00";
  if (m.finished) return formatMs(m.setTimes[m.setTimes.length - 1] || 0);
  return formatMs(m.currentSetElapsed);
});

/** Formatted total match elapsed time. */
export const totalTime = computed(() => {
  void tick.value;
  const m = currentMatch.value;
  if (!m) return "00:00";
  if (m.finished) return formatMs(m.matchTime);
  return formatMs(m.totalElapsed);
});

// ── Timer effects ──

let timerInterval: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    tick.value++;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Auto-start/stop the tick timer (paused during breaks)
effect(() => {
  const s = state.value;
  if (s.type === "playing") startTimer();
  else stopTimer();
});

// Manage the break countdown timer
let breakInterval: ReturnType<typeof setInterval> | null = null;

effect(() => {
  const s = state.value;
  if (s.type === "break") {
    breakSeconds.value = s.duration;
    if (breakInterval) clearInterval(breakInterval);
    breakInterval = setInterval(() => {
      if (breakSeconds.value > 0) breakSeconds.value--;
      else if (breakInterval) {
        clearInterval(breakInterval);
        breakInterval = null;
      }
    }, 1000);
  } else {
    if (breakInterval) {
      clearInterval(breakInterval);
      breakInterval = null;
    }
  }
});

// ── Helpers ──

/** Saves the finished match to history and clears the active match. */
function doSaveHistory(m: Match): void {
  const h = loadHistory();
  h.unshift(m.toHistoryEntry());
  saveHistory(h);
  saveMatch(null);
  history.value = loadHistory();
}

// ── Event dispatcher ──

/**
 * Dispatches an event to the FSM. This is the only way to change app state.
 * @param event - The event to process.
 */
export function send(event: AppEvent): void {
  // Global events — valid in any state
  if (event.type === "DELETE_HISTORY") {
    const h = loadHistory();
    h.splice(event.index, 1);
    saveHistory(h);
    history.value = loadHistory();
    return;
  }
  if (event.type === "CLEAR_HISTORY") {
    if (!confirm(t("history.clearConfirm"))) return;
    saveHistory([]);
    history.value = [];
    return;
  }

  const stateValue = state.value;

  // Setup state — handled directly by root FSM
  if (stateValue.type === "setup") {
    if (event.type === "START_MATCH") {
      savePlayer(event.players[0]);
      savePlayer(event.players[1]);
      const json = new Match(event).toJSON();
      saveMatch(json);
      state.value = { type: "playing", match: new Match(json) };
    }
    return;
  }

  // In-game states — delegate to game sub-FSM
  const result = gameSend(stateValue as GameInput, event as GameEvent);
  if (!result) return;

  if ("exit" in result) {
    if (result.confirm && !confirm(t("match.abandonConfirm"))) return;
    saveMatch(null);
    state.value = { type: "setup" };
  } else if ("save" in result) {
    stopTimer();
    doSaveHistory(result.save);
    state.value = { type: "finished", match: result.save };
  } else {
    const next = result.transition;
    if (next.type === "finished") {
      stopTimer();
    }
    if (next.type === "break") {
      state.value = { ...next, breakStartedAt: Date.now() };
    } else {
      state.value = next;
    }
  }
}
