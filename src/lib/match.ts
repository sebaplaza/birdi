/**
 * Pure Match model.
 * Contains all scoring logic, set management, undo, and time tracking.
 * Has no side effects — does not touch the DOM or localStorage.
 */

/** Snapshot stored in the undo stack before each point. */
export interface UndoEntry {
  scores: [number, number];
  serving: number;
}

/** Full serializable match state (used for persistence and restoration). */
export interface MatchState {
  players: [string, string];
  maxSets: number;
  pointsPerSet: number;
  sets?: [number, number];
  currentSet?: { scores: [number, number] };
  completedSets?: [number, number][];
  serving?: number;
  undoStack?: UndoEntry[];
  finished?: boolean;
  winner?: number | null;
  swapped?: boolean;
  startedAt?: string;
  setStartedAt?: number;
  setTimes?: number[];
  matchTime?: number;
}

/** Compact match summary saved in history after a match ends. */
export interface HistoryEntry {
  date: string;
  players: [string, string];
  sets: [number, number];
  completedSets: [number, number][];
  winner: number | null;
  pointsPerSet: number;
  matchTime: number;
  setTimes: number[];
}

/**
 * Represents a badminton match.
 * Tracks scores, sets, serving, time, and supports undo.
 * Player indices are 0 and 1 throughout.
 */
export class Match {
  players: [string, string];
  maxSets: number;
  pointsPerSet: number;
  sets: [number, number];
  currentSet: { scores: [number, number] };
  completedSets: [number, number][];
  serving: number;
  undoStack: UndoEntry[];
  finished: boolean;
  winner: number | null;
  /** Whether sides have been manually swapped (affects left/right display). */
  swapped: boolean;
  startedAt: string;
  /** Timestamp (ms) when the current set started. */
  setStartedAt: number;
  /** Duration (ms) of each completed set. */
  setTimes: number[];
  /** Accumulated match time (ms) from completed sets. */
  matchTime: number;

  /**
   * Creates a Match from initial config or a restored state.
   * @param state - Either new match params or a full serialized MatchState.
   */
  constructor({ players, maxSets, pointsPerSet, ...restore }: MatchState) {
    this.players = players;
    this.maxSets = maxSets;
    this.pointsPerSet = pointsPerSet;
    this.sets = restore.sets || [0, 0];
    this.currentSet = restore.currentSet || { scores: [0, 0] };
    this.completedSets = restore.completedSets || [];
    this.serving = restore.serving ?? 0;
    this.undoStack = restore.undoStack || [];
    this.finished = restore.finished || false;
    this.winner = restore.winner ?? null;
    this.swapped = restore.swapped || false;
    this.startedAt = restore.startedAt || new Date().toISOString();
    this.setStartedAt = restore.setStartedAt || Date.now();
    this.setTimes = restore.setTimes || [];
    this.matchTime = restore.matchTime || 0;
  }

  /** Player index currently on the left side of the court. */
  get leftPlayer(): number {
    return this.swapped ? 1 : 0;
  }

  /** Player index currently on the right side of the court. */
  get rightPlayer(): number {
    return this.swapped ? 0 : 1;
  }

  /** Current set scores shorthand. */
  get scores(): [number, number] {
    return this.currentSet.scores;
  }

  /** Elapsed time (ms) in the current set. */
  get currentSetElapsed(): number {
    return Date.now() - this.setStartedAt;
  }

  /** Total elapsed time (ms) including all completed sets and the current one. */
  get totalElapsed(): number {
    return this.matchTime + this.currentSetElapsed;
  }

  /**
   * Awards a point to the given player.
   * Automatically handles set wins and match completion.
   * @param player - Player index (0 or 1).
   */
  addPoint(player: number): void {
    if (this.finished) return;
    // Save current state for undo
    this.undoStack.push({ scores: [...this.scores] as [number, number], serving: this.serving });
    this.scores[player]++;
    this.serving = player;
    if (this.#isSetWon(player)) this.#winSet(player);
    else if (this.#shouldSwapInDecidingSet()) this.swapped = !this.swapped;
  }

  /** Reverts the last point (or set win if at set boundary). */
  undo(): void {
    if (!this.undoStack.length) return;
    const prev = this.undoStack.pop()!;
    // If the match was finished, reopen it
    if (this.finished) {
      this.finished = false;
      this.winner = null;
      const lastCompleted = this.completedSets.pop()!;
      const setWinner = lastCompleted[0] > lastCompleted[1] ? 0 : 1;
      this.sets[setWinner]--;
      this.currentSet.scores = lastCompleted;
    }
    // If we're at 0-0 but prev wasn't, a set boundary was crossed — undo it
    if (
      this.scores[0] === 0 &&
      this.scores[1] === 0 &&
      (prev.scores[0] > 0 || prev.scores[1] > 0)
    ) {
      const lastCompleted = this.completedSets.pop();
      if (lastCompleted) {
        const setWinner = lastCompleted[0] > lastCompleted[1] ? 0 : 1;
        this.sets[setWinner]--;
        this.currentSet.scores = lastCompleted;
      }
    }
    this.currentSet.scores = [...prev.scores] as [number, number];
    this.serving = prev.serving;
  }

  /** Toggles left/right court sides for display. */
  switchSides(): void {
    this.swapped = !this.swapped;
  }

  /** Manually ends the match early, determining the winner by sets then points. */
  finish(): void {
    if (this.finished) return;
    const setTime = this.currentSetElapsed;
    this.matchTime += setTime;
    this.setTimes.push(setTime);
    // Determine winner: by sets, then by current score, then default to player 0
    let winner: number;
    if (this.sets[0] !== this.sets[1]) winner = this.sets[0] > this.sets[1] ? 0 : 1;
    else if (this.scores[0] !== this.scores[1]) winner = this.scores[0] > this.scores[1] ? 0 : 1;
    else winner = 0;
    if (this.scores[0] > 0 || this.scores[1] > 0) {
      this.completedSets.push([...this.scores] as [number, number]);
      this.sets[winner]++;
    }
    this.finished = true;
    this.winner = winner;
  }

  /** Converts the match to a compact history entry for long-term storage. */
  toHistoryEntry(): HistoryEntry {
    return {
      date: this.startedAt,
      players: [...this.players] as [string, string],
      sets: [...this.sets] as [number, number],
      completedSets: this.completedSets.map((s) => [...s] as [number, number]),
      winner: this.winner,
      pointsPerSet: this.pointsPerSet,
      matchTime: this.matchTime,
      setTimes: [...this.setTimes],
    };
  }

  /** Serializes the full match state for localStorage persistence. */
  toJSON(): MatchState {
    return {
      players: this.players,
      maxSets: this.maxSets,
      pointsPerSet: this.pointsPerSet,
      sets: this.sets,
      currentSet: this.currentSet,
      completedSets: this.completedSets,
      serving: this.serving,
      undoStack: this.undoStack,
      finished: this.finished,
      winner: this.winner,
      swapped: this.swapped,
      startedAt: this.startedAt,
      setStartedAt: this.setStartedAt,
      setTimes: this.setTimes,
      matchTime: this.matchTime,
    };
  }

  /** In the deciding set, players swap sides when the leading score first reaches 11. */
  #shouldSwapInDecidingSet(): boolean {
    const setsToWin = Math.ceil(this.maxSets / 2);
    const isDecidingSet = this.sets[0] === setsToWin - 1 && this.sets[1] === setsToWin - 1;
    if (!isDecidingSet) return false;
    const s = this.scores;
    // Swap when either player first reaches exactly 11
    if (s[0] !== 11 && s[1] !== 11) return false;
    const prev = this.undoStack[this.undoStack.length - 1];
    return !!prev && prev.scores[0] < 11 && prev.scores[1] < 11;
  }

  /** Checks if a player has won the current set (requires 2-point lead, cap at 30). */
  #isSetWon(player: number): boolean {
    const pp = this.pointsPerSet;
    const s = this.scores;
    // Normal win: reach pointsPerSet with 2-point lead
    // Cap: at 29-29, whoever scores the 30th point wins (pp + 9 = 30)
    return (s[player] >= pp && s[player] - s[1 - player] >= 2) || s[player] >= pp + 9;
  }

  /** Records a set win and either starts a new set or finishes the match. */
  #winSet(player: number): void {
    const setTime = this.currentSetElapsed;
    this.matchTime += setTime;
    this.setTimes.push(setTime);
    this.sets[player]++;
    this.completedSets.push([...this.scores] as [number, number]);
    const setsToWin = Math.ceil(this.maxSets / 2);
    if (this.sets[player] >= setsToWin) {
      this.finished = true;
      this.winner = player;
    } else {
      // Start a new set: reset scores, set winner serves first
      this.currentSet = { scores: [0, 0] };
      this.serving = player;
      this.swapped = !this.swapped;
      this.setStartedAt = Date.now();
    }
  }
}
