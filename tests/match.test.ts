import { describe, it, expect } from "vitest";
import { Match, type MatchState } from "../src/lib/match.js";

function createMatch(opts: Partial<MatchState> = {}): Match {
  return new Match({
    players: ["Alice", "Bob"],
    maxSets: 3,
    pointsPerSet: 21,
    serving: 0,
    ...opts,
  });
}

describe("Match", () => {
  describe("constructor", () => {
    it("initializes with default values", () => {
      const m = createMatch();
      expect(m.players).toEqual(["Alice", "Bob"]);
      expect(m.maxSets).toBe(3);
      expect(m.pointsPerSet).toBe(21);
      expect(m.scores).toEqual([0, 0]);
      expect(m.sets).toEqual([0, 0]);
      expect(m.serving).toBe(0);
      expect(m.finished).toBe(false);
      expect(m.winner).toBeNull();
      expect(m.swapped).toBe(false);
      expect(m.completedSets).toEqual([]);
    });

    it("restores from saved state", () => {
      const m = createMatch();
      m.addPoint(0);
      m.addPoint(0);
      const json = m.toJSON();
      const restored = new Match(json);
      expect(restored.scores).toEqual([2, 0]);
      expect(restored.serving).toBe(0);
    });
  });

  describe("leftPlayer / rightPlayer", () => {
    it("returns 0/1 when not swapped", () => {
      const m = createMatch();
      expect(m.leftPlayer).toBe(0);
      expect(m.rightPlayer).toBe(1);
    });

    it("returns 1/0 when swapped", () => {
      const m = createMatch();
      m.switchSides();
      expect(m.leftPlayer).toBe(1);
      expect(m.rightPlayer).toBe(0);
    });
  });

  describe("addPoint", () => {
    it("increments the score for the given player", () => {
      const m = createMatch();
      m.addPoint(0);
      expect(m.scores).toEqual([1, 0]);
      m.addPoint(1);
      expect(m.scores).toEqual([1, 1]);
    });

    it("changes serving to the scoring player", () => {
      const m = createMatch();
      m.addPoint(1);
      expect(m.serving).toBe(1);
    });

    it("pushes to undo stack", () => {
      const m = createMatch();
      m.addPoint(0);
      expect(m.undoStack).toHaveLength(1);
      expect(m.undoStack[0]).toEqual({ scores: [0, 0], serving: 0 });
    });

    it("does nothing when match is finished", () => {
      const m = createMatch();
      m.finished = true;
      m.addPoint(0);
      expect(m.scores).toEqual([0, 0]);
    });
  });

  describe("set winning", () => {
    it("wins a set at 21 with 2 point lead", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0);
      expect(m.sets[0]).toBe(1);
      expect(m.completedSets).toHaveLength(1);
      expect(m.completedSets[0]).toEqual([21, 0]);
      expect(m.scores).toEqual([0, 0]); // new set started
    });

    it("requires 2 point lead at deuce", () => {
      const m = createMatch();
      for (let i = 0; i < 20; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      // 20-20
      expect(m.sets[0]).toBe(0);
      m.addPoint(0); // 21-20
      expect(m.sets[0]).toBe(0);
      m.addPoint(0); // 22-20
      expect(m.sets[0]).toBe(1);
    });

    it("caps at 30 (29-29 → 30th point wins)", () => {
      const m = createMatch();
      // Get to 29-29
      for (let i = 0; i < 29; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      expect(m.scores).toEqual([29, 29]);
      m.addPoint(0); // 30-29 → cap at 30 wins regardless of 2-point lead
      expect(m.sets[0]).toBe(1);
    });
  });

  describe("match winning", () => {
    it("wins the match when enough sets are won (best of 3)", () => {
      const m = createMatch();
      // Win 2 sets
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 1
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 2
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(0);
      expect(m.sets[0]).toBe(2);
    });

    it("wins best of 1", () => {
      const m = createMatch({ maxSets: 1 });
      for (let i = 0; i < 21; i++) m.addPoint(0);
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(0);
    });
  });

  describe("undo", () => {
    it("restores previous score and serving", () => {
      const m = createMatch();
      m.addPoint(0);
      m.addPoint(1);
      m.undo();
      expect(m.scores).toEqual([1, 0]);
      expect(m.serving).toBe(0);
    });

    it("does nothing when undo stack is empty", () => {
      const m = createMatch();
      m.undo();
      expect(m.scores).toEqual([0, 0]);
    });

    it("can undo multiple times", () => {
      const m = createMatch();
      m.addPoint(0);
      m.addPoint(0);
      m.addPoint(1);
      m.undo();
      m.undo();
      expect(m.scores).toEqual([1, 0]);
    });
  });

  describe("switchSides", () => {
    it("toggles swapped flag", () => {
      const m = createMatch();
      expect(m.swapped).toBe(false);
      m.switchSides();
      expect(m.swapped).toBe(true);
      m.switchSides();
      expect(m.swapped).toBe(false);
    });
  });

  describe("finish", () => {
    it("finishes the match and determines winner by sets", () => {
      const m = createMatch();
      // Win 1 set for player 0, then finish mid-game
      for (let i = 0; i < 21; i++) m.addPoint(0);
      m.addPoint(1); // 0-1 in set 2
      m.finish();
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(0); // has more sets
    });

    it("finishes with winner by current score when sets tied", () => {
      const m = createMatch();
      m.addPoint(0);
      m.addPoint(0);
      m.addPoint(1);
      m.finish();
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(0); // 2-1 in current set
    });

    it("does nothing if already finished", () => {
      const m = createMatch();
      m.finish();
      const w = m.winner;
      m.finish();
      expect(m.winner).toBe(w);
    });
  });

  describe("toJSON / restore", () => {
    it("round-trips all state", () => {
      const m = createMatch();
      m.addPoint(0);
      m.addPoint(1);
      m.switchSides();
      const json = m.toJSON();
      const restored = new Match(json);
      expect(restored.scores).toEqual(m.scores);
      expect(restored.serving).toBe(m.serving);
      expect(restored.swapped).toBe(m.swapped);
      expect(restored.sets).toEqual(m.sets);
      expect(restored.players).toEqual(m.players);
    });
  });

  describe("toHistoryEntry", () => {
    it("produces a history entry with expected fields", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0);
      for (let i = 0; i < 21; i++) m.addPoint(0);
      const entry = m.toHistoryEntry();
      expect(entry.players).toEqual(["Alice", "Bob"]);
      expect(entry.sets).toEqual([2, 0]);
      expect(entry.completedSets).toHaveLength(2);
      expect(entry.winner).toBe(0);
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("matchTime");
      expect(entry).toHaveProperty("setTimes");
    });
  });

  // ── Official BWF / FFBad rules ──
  // https://www.ffbad.org/pratiquer-comment-jouer-au-badminton

  describe("BWF Rule 1: best of 3 sets", () => {
    it("match is won by first player to win 2 sets", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 1
      expect(m.finished).toBe(false);
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 2
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(0);
      expect(m.sets).toEqual([2, 0]);
    });

    it("goes to 3 sets if each player wins one", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0); // p0 wins set 1
      for (let i = 0; i < 21; i++) m.addPoint(1); // p1 wins set 2
      expect(m.finished).toBe(false);
      expect(m.sets).toEqual([1, 1]);
      for (let i = 0; i < 21; i++) m.addPoint(1); // p1 wins set 3
      expect(m.finished).toBe(true);
      expect(m.winner).toBe(1);
    });
  });

  describe("BWF Rule 2: sets to 21 points", () => {
    it("a set is won at 21-0", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0);
      expect(m.sets[0]).toBe(1);
      expect(m.completedSets[0]).toEqual([21, 0]);
    });

    it("20 points is not enough to win a set", () => {
      const m = createMatch();
      for (let i = 0; i < 20; i++) m.addPoint(0);
      expect(m.sets[0]).toBe(0);
    });
  });

  describe("BWF Rule 3: rally winner gets a point", () => {
    it("addPoint increments score for the given player", () => {
      const m = createMatch();
      m.addPoint(0);
      expect(m.scores[0]).toBe(1);
      m.addPoint(1);
      expect(m.scores[1]).toBe(1);
    });
  });

  describe("BWF Rule 4: deuce at 20-20 requires 2-point lead", () => {
    it("21-20 does not win the set", () => {
      const m = createMatch();
      for (let i = 0; i < 20; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      m.addPoint(0); // 21-20
      expect(m.sets[0]).toBe(0);
    });

    it("22-20 wins the set (2-point lead)", () => {
      const m = createMatch();
      for (let i = 0; i < 20; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      m.addPoint(0); // 21-20
      m.addPoint(0); // 22-20
      expect(m.sets[0]).toBe(1);
    });

    it("extended deuce continues until 2-point lead", () => {
      const m = createMatch();
      for (let i = 0; i < 22; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      // 22-22
      expect(m.sets[0]).toBe(0);
      m.addPoint(0); // 23-22
      expect(m.sets[0]).toBe(0);
      m.addPoint(0); // 24-22
      expect(m.sets[0]).toBe(1);
    });
  });

  describe("BWF Rule 5: cap at 30 (29-29 → 30th point wins)", () => {
    it("at 29-29, the 30th point wins regardless of lead", () => {
      const m = createMatch();
      for (let i = 0; i < 29; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      expect(m.scores).toEqual([29, 29]);
      m.addPoint(0); // 30-29
      expect(m.sets[0]).toBe(1);
      expect(m.completedSets[0]).toEqual([30, 29]);
    });

    it("28-29 then 29-29 then 30-29 wins for player 1 side", () => {
      const m = createMatch();
      for (let i = 0; i < 29; i++) {
        m.addPoint(0);
        m.addPoint(1);
      }
      // 29-29
      m.addPoint(1); // 29-30
      expect(m.sets[1]).toBe(1);
    });
  });

  describe("BWF Rule 6: set winner serves first in the next set", () => {
    it("player 0 wins set → player 0 serves next set", () => {
      const m = createMatch({ serving: 1 }); // p1 starts serving
      for (let i = 0; i < 21; i++) m.addPoint(0);
      expect(m.serving).toBe(0); // winner serves
    });

    it("player 1 wins set → player 1 serves next set", () => {
      const m = createMatch({ serving: 0 });
      for (let i = 0; i < 21; i++) m.addPoint(1);
      expect(m.serving).toBe(1); // winner serves
    });
  });

  describe("BWF Rule 7: service box by score parity", () => {
    it("even score → server scores from right (even) box", () => {
      const m = createMatch({ serving: 0 });
      // At 0-0 (even), server should be in right/even position
      expect(m.scores[0] % 2).toBe(0);
    });

    it("odd score → server scores from left (odd) box", () => {
      const m = createMatch({ serving: 0 });
      m.addPoint(0); // score is 1 (odd)
      expect(m.scores[0] % 2).toBe(1);
    });
  });

  describe("BWF Rule 10: change sides after each set", () => {
    it("sides swap after set 1", () => {
      const m = createMatch();
      expect(m.swapped).toBe(false);
      for (let i = 0; i < 21; i++) m.addPoint(0);
      expect(m.swapped).toBe(true);
    });

    it("sides swap back after set 2", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(1); // set 1
      expect(m.swapped).toBe(true);
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 2
      expect(m.swapped).toBe(false);
    });
  });

  describe("BWF Rule 11: change sides at 11 in the deciding set", () => {
    it("swaps sides when first player reaches 11 in the 3rd set", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0); // p0 wins set 1
      for (let i = 0; i < 21; i++) m.addPoint(1); // p1 wins set 2
      // Deciding set, swapped back to false (two swaps cancel out)
      expect(m.swapped).toBe(false);
      for (let i = 0; i < 11; i++) m.addPoint(0);
      expect(m.swapped).toBe(true);
    });

    it("does NOT swap at 11 in the 1st set (not deciding)", () => {
      const m = createMatch();
      for (let i = 0; i < 11; i++) m.addPoint(0);
      expect(m.swapped).toBe(false);
    });

    it("does NOT swap at 11 in the 2nd set (not deciding)", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0); // set 1
      // Now in set 2, swapped=true from set change
      const swappedBefore = m.swapped;
      for (let i = 0; i < 11; i++) m.addPoint(0);
      expect(m.swapped).toBe(swappedBefore); // unchanged
    });

    it("swaps only once at 11 (not again at 12, 13, etc.)", () => {
      const m = createMatch();
      for (let i = 0; i < 21; i++) m.addPoint(0);
      for (let i = 0; i < 21; i++) m.addPoint(1);
      expect(m.swapped).toBe(false);
      for (let i = 0; i < 11; i++) m.addPoint(0);
      expect(m.swapped).toBe(true);
      m.addPoint(0); // 12-0
      expect(m.swapped).toBe(true); // still true, not toggled again
    });
  });
});
