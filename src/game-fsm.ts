/**
 * In-game state machine.
 *
 * Manages transitions between the three in-game states using the shared
 * FSM library (src/lib/fsm.ts).
 *
 *   playing ──ADD_POINT──> playing | break(60s) | break(120s) | finished
 *   playing ──UNDO────────> playing
 *   playing ──SWITCH_SIDES> playing
 *   playing ──END_MATCH──> effect("saveHistory")
 *   playing ──NEW_MATCH──> exit(confirm=true)
 *   break   ──RESUME─────> playing
 *   finished──END_MATCH──> effect("saveHistory")
 *   finished──NEW_MATCH──> exit(confirm=false)
 */
import { createMachine, goto, exit, effect } from "./lib/fsm.js";
import type { Transition } from "./lib/fsm.js";
import { Match } from "./lib/match.js";
import { saveMatch } from "./lib/storage.js";
import type { GameEvent } from "./state.js";

// ── State types ───────────────────────────────────────────────────────────────

/** The three states the in-game machine can be in. */
export type GameState =
  | { type: "playing"; match: Match }
  | { type: "break"; match: Match; duration: number; breakStartedAt: number }
  | { type: "finished"; match: Match };

/** Data carried by the "saveHistory" effect. */
export type SaveData = Match;

/** The concrete transition type for the game machine. */
export type GameTransition = Transition<GameState, SaveData>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Persists the match to storage and returns a fresh immutable copy. */
function persist(m: Match): Match {
  const json = m.toJSON();
  saveMatch(json);
  return new Match(json);
}

/**
 * Returns true if the 11-point interval break should trigger.
 * The break fires the first time either player reaches exactly 11 points.
 */
function shouldBreak(m: Match): boolean {
  const s = m.scores;
  if (s[0] !== 11 && s[1] !== 11) return false;
  const prev = m.undoStack[m.undoStack.length - 1];
  return !!prev && prev.scores[0] < 11 && prev.scores[1] < 11;
}

// ── Machine ───────────────────────────────────────────────────────────────────

export const gameMachine = createMachine<GameState, GameEvent, SaveData>({
  playing({ match }, event) {
    switch (event.type) {
      case "ADD_POINT": {
        if (match.finished) return null;
        const setsBefore = match.completedSets.length;
        match.addPoint(event.player);
        const m = persist(match);
        if (m.finished) {
          // Match won — show winner screen; history saved when user confirms.
          return goto({ type: "finished", match: m });
        }
        if (m.completedSets.length > setsBefore) {
          // Set won — 2-minute inter-set break.
          return goto({ type: "break", match: m, duration: 120, breakStartedAt: 0 });
        }
        if (shouldBreak(m)) {
          // First player reached 11 — 1-minute interval break.
          return goto({ type: "break", match: m, duration: 60, breakStartedAt: 0 });
        }
        return goto({ type: "playing", match: m });
      }

      case "UNDO":
        match.undo();
        return goto({ type: "playing", match: persist(match) });

      case "SWITCH_SIDES":
        match.switchSides();
        return goto({ type: "playing", match: persist(match) });

      case "END_MATCH":
        match.finish();
        // The root FSM will save the match to history when it receives this effect.
        return effect("saveHistory", persist(match));

      case "NEW_MATCH":
        // Abandoning a live match — ask the user to confirm first.
        return exit(true);

      default:
        return null;
    }
  },

  break(state, event) {
    if (event.type !== "RESUME") return null;
    // Subtract the time spent in the break so set timers stay accurate.
    const pausedMs = Date.now() - state.breakStartedAt;
    state.match.setStartedAt += pausedMs;
    return goto({ type: "playing", match: persist(state.match) });
  },

  finished({ match }, event) {
    switch (event.type) {
      case "END_MATCH":
        // User confirmed — save the finished match to history.
        return effect("saveHistory", match);

      case "NEW_MATCH":
        // Start fresh without saving — no confirmation needed.
        return exit(false);

      default:
        return null;
    }
  },
});
