/**
 * In-game sub-FSM.
 *
 * Manages transitions between the three in-game states (playing, break, finished).
 * Exposes a single `send()` that receives the current in-game state and an event,
 * and returns a transition result for the root FSM to interpret.
 *
 *   playing ──ADD_POINT──> playing | break(60s) | break(120s) | finished
 *   playing ──UNDO/SWITCH_SIDES──> playing
 *   playing ──END_MATCH──> finished
 *   playing ──NEW_MATCH──> exit(setup)
 *   break ──RESUME──> playing
 *   finished ──END_MATCH──> save
 *   finished ──NEW_MATCH──> exit(setup)
 */
import { Match } from "./lib/match.js";
import { saveMatch } from "./lib/storage.js";
import type { GameState, GameEvent } from "./state.js";

/** Possible outcomes of sending an event to the game sub-FSM. */
export type GameResult =
  | { transition: GameState }
  | { exit: "setup"; confirm: boolean }
  | { save: Match }
  | null;

/** Input state for the sub-FSM. Break carries a timestamp from the root. */
export type GameInput =
  | { type: "playing"; match: Match }
  | { type: "break"; match: Match; duration: number; breakStartedAt: number }
  | { type: "finished"; match: Match };

/** Saves the match to IndexedDB and returns a fresh immutable copy. */
function persist(m: Match): Match {
  const json = m.toJSON();
  saveMatch(json);
  return new Match(json);
}

/** Checks if the 11-point interval break should trigger (first time reaching 11). */
function shouldBreak(m: Match): boolean {
  const s = m.scores;
  if (s[0] !== 11 && s[1] !== 11) return false;
  const prev = m.undoStack[m.undoStack.length - 1];
  return !!prev && prev.scores[0] < 11 && prev.scores[1] < 11;
}

/**
 * Dispatches an event to the in-game sub-FSM.
 * @param gameState - The current in-game state (playing, break, or finished).
 * @param event - The game event to process.
 * @returns A result for the root FSM, or null if the event is not handled.
 */
export function send(gameState: GameInput, event: GameEvent): GameResult {
  switch (gameState.type) {
    case "playing":
      return handlePlaying(gameState.match, event);
    case "break":
      return handleBreak(gameState, event);
    case "finished":
      return handleFinished(gameState.match, event);
  }
}

// ── Playing ──

function handlePlaying(match: Match, event: GameEvent): GameResult {
  switch (event.type) {
    case "ADD_POINT": {
      if (match.finished) return null;
      const setsBefore = match.completedSets.length;
      match.addPoint(event.player);
      const m = persist(match);
      if (m.finished) {
        return { transition: { type: "finished", match: m } };
      }
      if (m.completedSets.length > setsBefore) {
        return { transition: { type: "break", match: m, duration: 120 } };
      }
      if (shouldBreak(m)) {
        return { transition: { type: "break", match: m, duration: 60 } };
      }
      return { transition: { type: "playing", match: m } };
    }
    case "UNDO": {
      match.undo();
      return { transition: { type: "playing", match: persist(match) } };
    }
    case "SWITCH_SIDES": {
      match.switchSides();
      return { transition: { type: "playing", match: persist(match) } };
    }
    case "END_MATCH": {
      match.finish();
      const m = persist(match);
      return { save: m };
    }
    case "NEW_MATCH":
      return { exit: "setup", confirm: true };
    default:
      return null;
  }
}

// ── Break ──

function handleBreak(
  gameState: Extract<GameInput, { type: "break" }>,
  event: GameEvent,
): GameResult {
  if (event.type !== "RESUME") return null;
  const pausedMs = Date.now() - gameState.breakStartedAt;
  gameState.match.setStartedAt += pausedMs;
  return { transition: { type: "playing", match: persist(gameState.match) } };
}

// ── Finished ──

function handleFinished(match: Match, event: GameEvent): GameResult {
  switch (event.type) {
    case "END_MATCH":
      return { save: match };
    case "NEW_MATCH":
      return { exit: "setup", confirm: false };
    default:
      return null;
  }
}
