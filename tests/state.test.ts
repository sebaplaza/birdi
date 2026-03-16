// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { state, history, send, restoreState } from "../src/state.js";
import { initStorage, closeStorage, loadMatch, loadHistory } from "../src/lib/storage.js";

// ── Helpers ──

/** Resets all module-level state between tests. */
async function reset() {
  closeStorage();
  localStorage.clear();
  await initStorage();
  restoreState();
}

/** Dispatches START_MATCH and transitions to "playing". */
function startMatch() {
  send({
    type: "START_MATCH",
    players: ["Alice", "Bob"],
    maxSets: 3,
    pointsPerSet: 21,
    serving: 0,
  });
}

/**
 * Scores enough points for player 0 to win two sets (best of 3, 21 pts).
 * Automatically resumes through any breaks (60s interval or 120s inter-set)
 * that arise during scoring.
 */
function winMatch() {
  let points = 0;
  // Score up to 50 points, auto-resuming any breaks along the way
  while (state.value.type !== "finished" && points < 50) {
    if (state.value.type === "break") {
      send({ type: "RESUME" });
    } else {
      send({ type: "ADD_POINT", player: 0 });
      points++;
    }
  }
}

// ── Tests ──

beforeEach(async () => {
  await reset();
  vi.restoreAllMocks();
});

describe("END_MATCH from playing state", () => {
  it("transitions state to setup", () => {
    startMatch();
    expect(state.value.type).toBe("playing");

    send({ type: "END_MATCH" });

    expect(state.value.type).toBe("setup");
  });

  it("saves the match to history", () => {
    startMatch();
    send({ type: "ADD_POINT", player: 0 });
    send({ type: "ADD_POINT", player: 0 });

    send({ type: "END_MATCH" });

    expect(history.value).toHaveLength(1);
    expect(history.value[0].players).toEqual(["Alice", "Bob"]);
  });

  it("saves exactly one history entry", () => {
    startMatch();
    send({ type: "END_MATCH" });

    expect(history.value).toHaveLength(1);
    expect(loadHistory()).toHaveLength(1);
  });

  it("clears the active match from storage", () => {
    startMatch();
    expect(loadMatch()).not.toBeNull();

    send({ type: "END_MATCH" });

    expect(loadMatch()).toBeNull();
  });

  it("updates the history signal", () => {
    startMatch();
    expect(history.value).toHaveLength(0);

    send({ type: "END_MATCH" });

    expect(history.value).toHaveLength(1);
  });
});

describe("END_MATCH from finished state (natural win)", () => {
  it("transitions state to setup", () => {
    startMatch();
    winMatch();
    expect(state.value.type).toBe("finished");

    send({ type: "END_MATCH" });

    expect(state.value.type).toBe("setup");
  });

  it("saves the match to history exactly once", () => {
    startMatch();
    winMatch();
    expect(history.value).toHaveLength(0); // not yet saved

    send({ type: "END_MATCH" });

    expect(history.value).toHaveLength(1);
    expect(loadHistory()).toHaveLength(1);
  });

  it("clears the active match from storage", () => {
    startMatch();
    winMatch();

    send({ type: "END_MATCH" });

    expect(loadMatch()).toBeNull();
  });

  it("records the correct winner in history", () => {
    startMatch();
    winMatch();
    send({ type: "END_MATCH" });

    expect(history.value[0].winner).toBe(0);
    expect(history.value[0].sets).toEqual([2, 0]);
  });
});

describe("NEW_MATCH from finished state", () => {
  it("transitions state to setup", () => {
    startMatch();
    winMatch();
    expect(state.value.type).toBe("finished");

    send({ type: "NEW_MATCH" });

    expect(state.value.type).toBe("setup");
  });

  it("does NOT save anything to history", () => {
    startMatch();
    winMatch();

    send({ type: "NEW_MATCH" });

    expect(history.value).toHaveLength(0);
    expect(loadHistory()).toHaveLength(0);
  });

  it("clears the active match from storage", () => {
    startMatch();
    winMatch();

    send({ type: "NEW_MATCH" });

    expect(loadMatch()).toBeNull();
  });
});

describe("history signal reactivity", () => {
  it("updates the history signal after a second match", () => {
    // First match
    startMatch();
    send({ type: "END_MATCH" });
    expect(history.value).toHaveLength(1);
    const refAfterFirst = history.value;

    // Second match
    startMatch();
    send({ type: "END_MATCH" });

    expect(history.value).toHaveLength(2);
    // Signal must be a new array reference so effects re-run
    expect(history.value).not.toBe(refAfterFirst);
  });

  it("updates the history signal after DELETE_HISTORY", () => {
    startMatch();
    send({ type: "END_MATCH" });
    expect(history.value).toHaveLength(1);
    const refBefore = history.value;

    send({ type: "DELETE_HISTORY", index: 0 });

    expect(history.value).toHaveLength(0);
    expect(history.value).not.toBe(refBefore);
  });
});

describe("NEW_MATCH from playing state (abandon mid-match)", () => {
  it("calls window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    startMatch();
    send({ type: "ADD_POINT", player: 0 });

    send({ type: "NEW_MATCH" });

    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it("transitions to setup when confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(state.value.type).toBe("setup");
  });

  it("stays on playing when cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(state.value.type).toBe("playing");
  });

  it("does not save to history when confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(history.value).toHaveLength(0);
    expect(loadHistory()).toHaveLength(0);
  });

  it("does not save to history when cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(history.value).toHaveLength(0);
  });

  it("clears the active match from storage when confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(loadMatch()).toBeNull();
  });

  it("preserves the active match in storage when cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    startMatch();

    send({ type: "NEW_MATCH" });

    expect(loadMatch()).not.toBeNull();
  });
});
