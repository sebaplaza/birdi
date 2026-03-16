/**
 * localStorage persistence layer with synchronous in-memory cache.
 *
 * On startup, `initStorage()` loads all data from localStorage into a cache.
 * After that, reads and writes are synchronous (from/to cache and localStorage).
 *
 * Falls back to in-memory-only storage if localStorage is unavailable
 * (e.g. Private Browsing on some browsers).
 */
import type { MatchState, HistoryEntry } from "./match.js";

/** Keys used in localStorage. */
const KEYS = {
  players: "birdi_players",
  history: "birdi_history",
  match: "birdi_match",
} as const;

/** In-memory cache, populated by `initStorage()`. */
const cache = {
  players: [] as string[],
  history: [] as HistoryEntry[],
  match: null as MatchState | null,
};

/**
 * Safely reads a value from localStorage.
 * Returns null if localStorage is unavailable or the key does not exist.
 */
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Safely writes a value to localStorage.
 * Silently does nothing if localStorage is unavailable.
 * Pass null to remove the key.
 */
function lsSet(key: string, value: unknown): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Quota exceeded or storage unavailable — in-memory cache remains valid.
  }
}

/**
 * Closes the current storage connection (no-op for localStorage).
 * Kept for test compatibility.
 */
export function closeStorage(): void {
  // No-op: localStorage has no connection to close.
}

/**
 * Initializes the storage layer. Must be called (and awaited) before
 * any other storage function. Returns immediately — kept async for
 * call-site compatibility.
 */
export async function initStorage(): Promise<void> {
  cache.players = lsGet<string[]>(KEYS.players) ?? [];
  cache.history = lsGet<HistoryEntry[]>(KEYS.history) ?? [];
  cache.match = lsGet<MatchState>(KEYS.match) ?? null;
}

// ── Public API (synchronous, reads from cache) ──

/** Returns the list of previously used player names. */
export function loadPlayers(): string[] {
  return cache.players;
}

/** Adds a player name to the saved list (no duplicates). */
export function savePlayer(name: string): void {
  if (cache.players.includes(name)) return;
  cache.players = [...new Set([...cache.players, name])];
  lsSet(KEYS.players, cache.players);
}

/** Returns all saved match history entries. */
export function loadHistory(): HistoryEntry[] {
  return cache.history;
}

/** Overwrites the entire history array. */
export function saveHistory(history: HistoryEntry[]): void {
  cache.history = history;
  lsSet(KEYS.history, history);
}

/** Returns the in-progress match state, or null if none. */
export function loadMatch(): MatchState | null {
  return cache.match;
}

/** Saves the current match state. Pass null to clear. */
export function saveMatch(match: MatchState | null): void {
  cache.match = match;
  lsSet(KEYS.match, match);
}
