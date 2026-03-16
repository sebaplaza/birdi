// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  initStorage,
  closeStorage,
  loadPlayers,
  savePlayer,
  loadHistory,
  saveHistory,
  loadMatch,
  saveMatch,
} from "../src/lib/storage.js";
import type { HistoryEntry, MatchState } from "../src/lib/match.js";

beforeEach(async () => {
  closeStorage();
  localStorage.clear();
  await initStorage();
});

describe("players", () => {
  it("returns empty array when no players saved", () => {
    expect(loadPlayers()).toEqual([]);
  });

  it("saves and loads a player", () => {
    savePlayer("Alice");
    expect(loadPlayers()).toEqual(["Alice"]);
  });

  it("does not duplicate players", () => {
    savePlayer("Alice");
    savePlayer("Alice");
    expect(loadPlayers()).toEqual(["Alice"]);
  });

  it("saves multiple players", () => {
    savePlayer("Alice");
    savePlayer("Bob");
    expect(loadPlayers()).toEqual(["Alice", "Bob"]);
  });
});

describe("history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads history", () => {
    const h = [{ date: "2024-01-01", players: ["A", "B"] }] as unknown as HistoryEntry[];
    saveHistory(h);
    expect(loadHistory()).toEqual(h);
  });
});

describe("match", () => {
  it("returns null when no match saved", () => {
    expect(loadMatch()).toBeNull();
  });

  it("saves and loads match state", () => {
    const state = { players: ["A", "B"], scores: [5, 3] } as unknown as MatchState;
    saveMatch(state);
    expect(loadMatch()).toEqual(state);
  });

  it("clears match when saving null", () => {
    saveMatch({ players: ["A", "B"] } as unknown as MatchState);
    saveMatch(null);
    expect(loadMatch()).toBeNull();
  });
});
