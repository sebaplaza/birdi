/**
 * IndexedDB persistence layer with synchronous in-memory cache.
 *
 * On startup, `initStorage()` loads all data from IndexedDB into a cache.
 * After that, reads are synchronous (from cache) and writes update both
 * the cache and IndexedDB (fire-and-forget).
 *
 * The database has a single "kv" object store used as a key-value map.
 */
import type { MatchState, HistoryEntry } from "./match.js";

const DB_NAME = "birdi";
const DB_VERSION = 1;
const STORE_NAME = "kv";

/** Keys used in the key-value store. */
const KEYS = {
  players: "players",
  history: "history",
  match: "current_match",
} as const;

/** In-memory cache, populated by `initStorage()`. */
const cache = {
  players: [] as string[],
  history: [] as HistoryEntry[],
  match: null as MatchState | null,
};

/** Shared database connection (opened once). */
let db: IDBDatabase | null = null;

/**
 * Opens (or creates) the IndexedDB database.
 * @returns A promise resolving to the database connection.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Reads a value from the "kv" store.
 * @param key - The key to look up.
 * @returns The stored value, or null if not found.
 */
function idbGet<T>(key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Writes a value to the "kv" store (or deletes the key if value is null).
 * Fire-and-forget — errors are logged but don't propagate.
 * @param key - The key to write.
 * @param value - The value to store, or null to delete.
 */
function idbPut(key: string, value: unknown): void {
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  if (value === null) {
    store.delete(key);
  } else {
    store.put(value, key);
  }
  tx.onerror = () => console.error("IndexedDB write failed:", tx.error);
}

/**
 * Closes the current database connection (if any).
 * Exposed for test cleanup.
 */
export function closeStorage(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Initializes the storage layer. Must be called (and awaited) before
 * any other storage function.
 */
export async function initStorage(): Promise<void> {
  closeStorage();
  db = await openDB();

  const [players, history, match] = await Promise.all([
    idbGet<string[]>(KEYS.players),
    idbGet<HistoryEntry[]>(KEYS.history),
    idbGet<MatchState>(KEYS.match),
  ]);

  cache.players = players ?? [];
  cache.history = history ?? [];
  cache.match = match ?? null;
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
  idbPut(KEYS.players, cache.players);
}

/** Returns all saved match history entries. */
export function loadHistory(): HistoryEntry[] {
  return cache.history;
}

/** Overwrites the entire history array. */
export function saveHistory(history: HistoryEntry[]): void {
  cache.history = history;
  idbPut(KEYS.history, history);
}

/** Returns the in-progress match state, or null if none. */
export function loadMatch(): MatchState | null {
  return cache.match;
}

/** Saves the current match state. Pass null to clear. */
export function saveMatch(match: MatchState | null): void {
  cache.match = match;
  idbPut(KEYS.match, match);
}
