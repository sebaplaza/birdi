/**
 * Minimal finite state machine library.
 *
 * Three concepts:
 *
 *   1. Transition  — what a handler returns to describe what should happen next.
 *   2. Handler     — a function (currentState, event) → Transition | null.
 *   3. createMachine — assembles handlers into a type-safe send() function.
 *
 * Quick example:
 *
 *   type State = { type: "idle" } | { type: "running"; count: number };
 *   type Event = { type: "START" } | { type: "TICK" } | { type: "STOP" };
 *
 *   const machine = createMachine<State, Event>({
 *     idle:    (_s, e) => e.type === "START" ? goto({ type: "running", count: 0 }) : null,
 *     running: (_s, e) => e.type === "STOP"  ? goto({ type: "idle" })              : null,
 *   });
 *
 *   machine.send({ type: "idle" }, { type: "START" });
 *   // → { kind: "goto", state: { type: "running", count: 0 } }
 *
 *   machine.send({ type: "idle" }, { type: "TICK" });
 *   // → null  (event not handled in this state)
 */

// ── Transition types ──────────────────────────────────────────────────────────

/**
 * Move to a new state.
 * The most common transition — use it when an event causes a state change.
 */
export interface Goto<TState> {
  kind: "goto";
  state: TState;
}

/**
 * Leave this machine entirely.
 * Use when an event should escape a sub-machine (e.g. "back to main menu").
 *
 * `confirm: true`  — the caller should ask the user before proceeding.
 * `confirm: false` — exit immediately, no prompt needed.
 */
export interface Exit {
  kind: "exit";
  confirm: boolean;
}

/**
 * Request a named side effect with associated data.
 * Use when the transition needs to trigger something outside the machine
 * (e.g. saving to storage) without coupling the handler to that concern.
 *
 * The caller inspects `name` to decide what to do with `data`.
 */
export interface Effect<TData = never> {
  kind: "effect";
  name: string;
  data: TData;
}

/** Union of all transition types a handler can return. */
export type Transition<TState, TData = never> = Goto<TState> | Exit | Effect<TData>;

// ── Transition constructors ───────────────────────────────────────────────────
// Short helpers so handler code reads like plain English.

/** Move to a new state. */
export const goto = <TState>(state: TState): Goto<TState> => ({
  kind: "goto",
  state,
});

/**
 * Exit the machine.
 * @param confirm - Whether the caller should prompt the user first.
 */
export const exit = (confirm: boolean): Exit => ({
  kind: "exit",
  confirm,
});

/**
 * Request a named side effect.
 * @param name - Identifier the caller uses to decide what to do.
 * @param data - Payload passed to the caller alongside the name.
 */
export const effect = <TData>(name: string, data: TData): Effect<TData> => ({
  kind: "effect",
  name,
  data,
});

// ── Machine definition ────────────────────────────────────────────────────────

/**
 * A handler for one state.
 *
 * - `TStateCtx` — the specific state variant this handler receives (narrowed).
 * - `TState`    — the full state union, so the handler can return any state via goto().
 * - `TEvent`    — the event union.
 * - `TData`     — optional data type carried by effect() transitions.
 *
 * Returns a Transition or null (= event not handled / no change needed).
 */
export type Handler<TStateCtx, TState, TEvent, TData = never> = (
  state: TStateCtx,
  event: TEvent,
) => Transition<TState, TData> | null;

/**
 * Creates a state machine from a map of handlers — one per state type.
 *
 * TypeScript enforces that every state type in TState has exactly one handler,
 * and that each handler receives the correctly-narrowed state context while
 * being allowed to transition to any state in the full union.
 *
 * The returned object exposes a single `send()` method:
 *   - finds the handler for the current state's `type`
 *   - calls it with (state, event)
 *   - returns the Transition, or null if the event was ignored
 *
 * @example
 *   const machine = createMachine<State, Event, SaveData>({
 *     playing:  (s, e) => ...,
 *     break:    (s, e) => ...,
 *     finished: (s, e) => ...,
 *   });
 *   const result = machine.send(currentState, event);
 */
export function createMachine<TState extends { type: string }, TEvent, TData = never>(handlers: {
  [K in TState["type"]]: Handler<Extract<TState, { type: K }>, TState, TEvent, TData>;
}) {
  return {
    /**
     * Dispatch an event to the machine.
     * @param state - The current state (must have a `type` field).
     * @param event - The event to process.
     * @returns A Transition describing what should happen, or null if
     *          the event is not handled in the current state.
     */
    send(state: TState, event: TEvent): Transition<TState, TData> | null {
      const handler = handlers[state.type as TState["type"]];
      // Double-cast needed: TypeScript can't correlate the generic lookup of
      // handlers[state.type] with the specific TState variant at call time.
      return handler
        ? (handler as unknown as Handler<TState, TState, TEvent, TData>)(state, event)
        : null;
    },
  };
}
