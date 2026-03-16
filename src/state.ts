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

/**
 * Full break state stored in the root FSM.
 * Extends GameState's break with a wall-clock timestamp so elapsed pause
 * time can be subtracted from `setStartedAt` when play resumes.
 */
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

/**
 * Derives the initial app state from persisted storage on startup.
 * If an in-progress match exists, resumes it in the appropriate state.
 * Otherwise returns the setup state.
 */
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

/** Past match results, shown in the history panel. */
export const history = signal<HistoryEntry[]>([]);

/** Re-initializes state and history from storage. Call after `initStorage()` completes. */
export function restoreState(): void {
  state.value = initState();
  history.value = loadHistory();
}

/** Incremented every second while a match is in progress, driving timer reactivity. */
export const tick = signal(0);

/** Countdown seconds remaining during a break (interval or inter-set). */
export const breakSeconds = signal(60);

// ── Derived signals ──

/** The current Match object, or null when in setup. */
export const currentMatch = computed((): Match | null => {
  const s = state.value;
  return s.type === "setup" ? null : s.match;
});

/** Formatted elapsed time for the current set (e.g. "02:35"). Frozen when finished. */
export const setTime = computed(() => {
  void tick.value; // subscribe to tick so this recomputes every second
  const m = currentMatch.value;
  if (!m) return "00:00";
  if (m.finished) return formatMs(m.setTimes[m.setTimes.length - 1] || 0);
  return formatMs(m.currentSetElapsed);
});

/** Formatted total match elapsed time. Frozen when finished. */
export const totalTime = computed(() => {
  void tick.value; // subscribe to tick so this recomputes every second
  const m = currentMatch.value;
  if (!m) return "00:00";
  if (m.finished) return formatMs(m.matchTime);
  return formatMs(m.totalElapsed);
});

// ── Timer effects ──

let timerInterval: ReturnType<typeof setInterval> | null = null;

/** Starts the per-second tick timer. Stops any existing timer first. */
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    tick.value++;
  }, 1000);
}

/** Clears the per-second tick timer. */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Tick timer runs only while actively playing (paused during breaks and after finish).
effect(() => {
  const s = state.value;
  if (s.type === "playing") startTimer();
  else stopTimer();
});

// ── Break countdown ──

let breakInterval: ReturnType<typeof setInterval> | null = null;

// Starts a countdown timer whenever the state enters a break,
// and clears it when leaving (resumed or abandoned).
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

/**
 * Appends the finished match to history, clears the active match from storage,
 * and updates the history signal with a new array reference.
 *
 * A new array reference is required because @preact/signals-core uses strict
 * equality (===) to detect signal changes — mutating the existing array in place
 * would be a no-op and effects reading `history.value` would not re-run.
 */
function doSaveHistory(m: Match): void {
  const h = loadHistory();
  h.unshift(m.toHistoryEntry());
  saveHistory(h);
  saveMatch(null);
  history.value = h.slice(); // new reference so signal triggers its subscribers
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
    history.value = h.slice(); // new reference so signal triggers its subscribers
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
    // NEW_MATCH from playing: confirm before discarding the active match
    if (result.confirm && !confirm(t("match.abandonConfirm"))) return;
    saveMatch(null);
    state.value = { type: "setup" };
  } else if ("save" in result) {
    // END_MATCH: save to history then return to setup
    stopTimer();
    doSaveHistory(result.save);
    state.value = { type: "setup" };
  } else {
    const next = result.transition;
    if (next.type === "finished") {
      // Match ended naturally (set won) — stop timer, stay on finished screen
      // until the user explicitly clicks "End Match" to save to history.
      stopTimer();
    }
    if (next.type === "break") {
      // Record wall-clock time so pause duration can be excluded from set timers.
      state.value = { ...next, breakStartedAt: Date.now() };
    } else {
      state.value = next;
    }
  }
}
