/**
 * Tests for src/lib/fsm.ts
 *
 * Tests are organized from the simplest primitives (constructors, shapes)
 * up to complete real-world machine scenarios.
 */
import { describe, it, expect, vi } from "vitest";
import {
  goto,
  exit,
  effect,
  createMachine,
  type Transition,
  type Goto,
  type Exit,
  type Effect,
} from "../src/lib/fsm.js";

// ── Shared test fixtures ──────────────────────────────────────────────────────

// Simple two-state machine reused across multiple tests.
type ToggleState = { type: "on" } | { type: "off" };
type ToggleEvent = { type: "TOGGLE" } | { type: "IGNORE" };

const toggleMachine = createMachine<ToggleState, ToggleEvent>({
  on: (_s, e) => (e.type === "TOGGLE" ? goto({ type: "off" }) : null),
  off: (_s, e) => (e.type === "TOGGLE" ? goto({ type: "on" }) : null),
});

// ── Transition constructors ───────────────────────────────────────────────────

describe("goto()", () => {
  it("returns kind: 'goto'", () => {
    expect(goto({ type: "off" }).kind).toBe("goto");
  });

  it("embeds the given state", () => {
    const result = goto({ type: "off" });
    expect(result.state).toEqual({ type: "off" });
  });

  it("preserves complex state objects unchanged", () => {
    const state = { type: "playing" as const, score: 5, label: "test" };
    expect(goto(state).state).toBe(state); // same reference
  });

  it("can target any state in the union", () => {
    const a = goto({ type: "on" } as ToggleState);
    const b = goto({ type: "off" } as ToggleState);
    expect(a.state.type).toBe("on");
    expect(b.state.type).toBe("off");
  });
});

describe("exit()", () => {
  it("returns kind: 'exit'", () => {
    expect(exit(true).kind).toBe("exit");
    expect(exit(false).kind).toBe("exit");
  });

  it("preserves confirm=true", () => {
    expect(exit(true).confirm).toBe(true);
  });

  it("preserves confirm=false", () => {
    expect(exit(false).confirm).toBe(false);
  });
});

describe("effect()", () => {
  it("returns kind: 'effect'", () => {
    expect(effect("save", null).kind).toBe("effect");
  });

  it("preserves the effect name", () => {
    expect(effect("saveHistory", {}).name).toBe("saveHistory");
  });

  it("preserves the effect data", () => {
    const data = { id: 1, value: "hello" };
    expect(effect("save", data).data).toBe(data); // same reference
  });

  it("works with primitive data types", () => {
    expect(effect("count", 42).data).toBe(42);
    expect(effect("label", "abc").data).toBe("abc");
    expect(effect("flag", true).data).toBe(true);
  });

  it("works with null data", () => {
    expect(effect("clear", null).data).toBeNull();
  });

  it("different names produce different effect names", () => {
    const a = effect("save", {});
    const b = effect("log", {});
    expect(a.name).not.toBe(b.name);
  });
});

// ── Transition type shapes ────────────────────────────────────────────────────

describe("Transition shape", () => {
  it("goto has exactly kind and state", () => {
    const t = goto({ type: "on" } as ToggleState);
    expect(Object.keys(t).sort()).toEqual(["kind", "state"]);
  });

  it("exit has exactly kind and confirm", () => {
    const t = exit(true);
    expect(Object.keys(t).sort()).toEqual(["confirm", "kind"]);
  });

  it("effect has exactly kind, name, and data", () => {
    const t = effect("save", 1);
    expect(Object.keys(t).sort()).toEqual(["data", "kind", "name"]);
  });
});

// ── createMachine — dispatch ──────────────────────────────────────────────────

describe("createMachine — send() dispatch", () => {
  it("calls the handler matching the current state type", () => {
    const onHandler = vi.fn(() => null);
    const offHandler = vi.fn(() => null);
    const m = createMachine<ToggleState, ToggleEvent>({
      on: onHandler,
      off: offHandler,
    });

    m.send({ type: "on" }, { type: "TOGGLE" });

    expect(onHandler).toHaveBeenCalledOnce();
    expect(offHandler).not.toHaveBeenCalled();
  });

  it("does not call handlers for other states", () => {
    const onHandler = vi.fn(() => null);
    const offHandler = vi.fn(() => null);
    const m = createMachine<ToggleState, ToggleEvent>({
      on: onHandler,
      off: offHandler,
    });

    m.send({ type: "off" }, { type: "TOGGLE" });

    expect(offHandler).toHaveBeenCalledOnce();
    expect(onHandler).not.toHaveBeenCalled();
  });

  it("passes the full state object to the handler", () => {
    type S = { type: "active"; count: number };
    type E = { type: "INC" };
    let received: S | null = null;
    const m = createMachine<S, E>({
      active: (s) => {
        received = s;
        return null;
      },
    });

    const state: S = { type: "active", count: 42 };
    m.send(state, { type: "INC" });

    expect(received).toBe(state); // same reference
    expect(received!.count).toBe(42);
  });

  it("passes the event to the handler", () => {
    type S = { type: "idle" };
    type E = { type: "START"; payload: string };
    let receivedEvent: E | null = null;
    const m = createMachine<S, E>({
      idle: (_s, e) => {
        receivedEvent = e;
        return null;
      },
    });

    const event: E = { type: "START", payload: "hello" };
    m.send({ type: "idle" }, event);

    expect(receivedEvent).toBe(event);
    expect(receivedEvent!.payload).toBe("hello");
  });

  it("returns the handler's return value", () => {
    const expected = goto({ type: "off" } as ToggleState);
    const m = createMachine<ToggleState, ToggleEvent>({
      on: () => expected,
      off: () => null,
    });

    const result = m.send({ type: "on" }, { type: "TOGGLE" });

    expect(result).toBe(expected);
  });

  it("returns null when the handler returns null", () => {
    const result = toggleMachine.send({ type: "on" }, { type: "IGNORE" });
    expect(result).toBeNull();
  });

  it("returns null for an unrecognized state type (defensive)", () => {
    // Casting to bypass TS to test runtime safety.
    const result = toggleMachine.send({ type: "unknown" } as unknown as ToggleState, {
      type: "TOGGLE",
    });
    expect(result).toBeNull();
  });
});

// ── goto transitions ──────────────────────────────────────────────────────────

describe("createMachine — goto transitions", () => {
  it("on → TOGGLE → off", () => {
    const result = toggleMachine.send({ type: "on" }, { type: "TOGGLE" });
    expect(result).toEqual({ kind: "goto", state: { type: "off" } });
  });

  it("off → TOGGLE → on", () => {
    const result = toggleMachine.send({ type: "off" }, { type: "TOGGLE" });
    expect(result).toEqual({ kind: "goto", state: { type: "on" } });
  });

  it("full toggle cycle returns to the original state", () => {
    let s: ToggleState = { type: "on" };
    for (let i = 0; i < 6; i++) {
      const r = toggleMachine.send(s, { type: "TOGGLE" });
      s = (r as Goto<ToggleState>).state;
    }
    expect(s.type).toBe("on"); // 6 toggles = even = back to "on"
  });

  it("carries state context (extra fields) through the transition", () => {
    type S = { type: "a"; value: number } | { type: "b"; value: number };
    type E = { type: "NEXT" };
    const m = createMachine<S, E>({
      a: (s) => goto({ type: "b", value: s.value + 1 }),
      b: (s) => goto({ type: "a", value: s.value + 1 }),
    });

    const r = m.send({ type: "a", value: 10 }, { type: "NEXT" }) as Goto<S>;
    expect(r.state).toEqual({ type: "b", value: 11 });
  });

  it("self-loop: can transition to the same state type with updated data", () => {
    type S = { type: "counting"; n: number };
    type E = { type: "INC" };
    const m = createMachine<S, E>({
      counting: (s) => goto({ type: "counting", n: s.n + 1 }),
    });

    const r = m.send({ type: "counting", n: 0 }, { type: "INC" }) as Goto<S>;
    expect(r.state).toEqual({ type: "counting", n: 1 });
  });
});

// ── exit transitions ──────────────────────────────────────────────────────────

describe("createMachine — exit transitions", () => {
  type S = { type: "active" } | { type: "paused" };
  type E = { type: "QUIT" } | { type: "ABANDON" };
  const m = createMachine<S, E>({
    active: (_s, e) => (e.type === "QUIT" ? exit(true) : null),
    paused: (_s, e) => (e.type === "ABANDON" ? exit(false) : null),
  });

  it("exit(true) — confirm required", () => {
    const r = m.send({ type: "active" }, { type: "QUIT" }) as Exit;
    expect(r.kind).toBe("exit");
    expect(r.confirm).toBe(true);
  });

  it("exit(false) — no confirm needed", () => {
    const r = m.send({ type: "paused" }, { type: "ABANDON" }) as Exit;
    expect(r.kind).toBe("exit");
    expect(r.confirm).toBe(false);
  });

  it("exit from any state works", () => {
    type S2 = { type: "a" } | { type: "b" } | { type: "c" };
    type E2 = { type: "QUIT" };
    const m2 = createMachine<S2, E2>({
      a: () => exit(false),
      b: () => exit(true),
      c: () => exit(false),
    });
    expect((m2.send({ type: "a" }, { type: "QUIT" }) as Exit).kind).toBe("exit");
    expect((m2.send({ type: "b" }, { type: "QUIT" }) as Exit).kind).toBe("exit");
    expect((m2.send({ type: "c" }, { type: "QUIT" }) as Exit).kind).toBe("exit");
  });
});

// ── effect transitions ────────────────────────────────────────────────────────

describe("createMachine — effect transitions", () => {
  type S = { type: "ready" } | { type: "done" };
  type E = { type: "SAVE"; payload: string };

  const m = createMachine<S, E, string>({
    ready: (_s, e) => effect("persist", e.payload),
    done: () => null,
  });

  it("returns kind: 'effect'", () => {
    const r = m.send({ type: "ready" }, { type: "SAVE", payload: "hello" });
    expect(r?.kind).toBe("effect");
  });

  it("preserves the effect name", () => {
    const r = m.send({ type: "ready" }, { type: "SAVE", payload: "x" }) as Effect<string>;
    expect(r.name).toBe("persist");
  });

  it("preserves the effect data from the event", () => {
    const r = m.send({ type: "ready" }, { type: "SAVE", payload: "world" }) as Effect<string>;
    expect(r.data).toBe("world");
  });

  it("multiple effects with different names are distinguishable", () => {
    type S2 = { type: "s" };
    type E2 = { type: "A" } | { type: "B" };
    const m2 = createMachine<S2, E2, null>({
      s: (_s, e) => (e.type === "A" ? effect("save", null) : effect("log", null)),
    });
    const a = m2.send({ type: "s" }, { type: "A" }) as Effect<null>;
    const b = m2.send({ type: "s" }, { type: "B" }) as Effect<null>;
    expect(a.name).toBe("save");
    expect(b.name).toBe("log");
  });
});

// ── null (unhandled event) ────────────────────────────────────────────────────

describe("createMachine — unhandled events return null", () => {
  it("returns null when the event is not handled in the current state", () => {
    expect(toggleMachine.send({ type: "on" }, { type: "IGNORE" })).toBeNull();
    expect(toggleMachine.send({ type: "off" }, { type: "IGNORE" })).toBeNull();
  });

  it("returning null does not imply any state change (caller responsibility)", () => {
    // The machine just returns null — it makes no side effects.
    const initial: ToggleState = { type: "on" };
    const result = toggleMachine.send(initial, { type: "IGNORE" });
    expect(result).toBeNull();
    // The original state object is untouched.
    expect(initial.type).toBe("on");
  });
});

// ── Real-world scenario: traffic light ───────────────────────────────────────

describe("traffic light machine", () => {
  type Light = { type: "red" } | { type: "green" } | { type: "yellow" };
  type LightEvent = { type: "NEXT" } | { type: "EMERGENCY_STOP" };

  const light = createMachine<Light, LightEvent>({
    red: (_s, e) => (e.type === "NEXT" ? goto({ type: "green" }) : null),
    green: (_s, e) => (e.type === "NEXT" ? goto({ type: "yellow" }) : null),
    yellow: (_s, e) => (e.type === "NEXT" ? goto({ type: "red" }) : null),
  });

  it("red → NEXT → green", () => {
    const r = light.send({ type: "red" }, { type: "NEXT" }) as Goto<Light>;
    expect(r.state.type).toBe("green");
  });

  it("green → NEXT → yellow", () => {
    const r = light.send({ type: "green" }, { type: "NEXT" }) as Goto<Light>;
    expect(r.state.type).toBe("yellow");
  });

  it("yellow → NEXT → red", () => {
    const r = light.send({ type: "yellow" }, { type: "NEXT" }) as Goto<Light>;
    expect(r.state.type).toBe("red");
  });

  it("full cycle of 3 transitions returns to red", () => {
    let s: Light = { type: "red" };
    for (let i = 0; i < 3; i++) {
      s = (light.send(s, { type: "NEXT" }) as Goto<Light>).state;
    }
    expect(s.type).toBe("red");
  });

  it("unrelated event returns null in any state", () => {
    // EMERGENCY_STOP is not handled — every state returns null.
    expect(light.send({ type: "red" }, { type: "EMERGENCY_STOP" })).toBeNull();
    expect(light.send({ type: "green" }, { type: "EMERGENCY_STOP" })).toBeNull();
    expect(light.send({ type: "yellow" }, { type: "EMERGENCY_STOP" })).toBeNull();
  });
});

// ── Real-world scenario: confirm dialog ──────────────────────────────────────

describe("confirm dialog machine", () => {
  type DialogState = { type: "idle" } | { type: "confirming"; message: string } | { type: "done" };

  type DialogEvent =
    | { type: "REQUEST"; message: string }
    | { type: "CONFIRM" }
    | { type: "CANCEL" };

  const dialog = createMachine<DialogState, DialogEvent>({
    idle: (_s, e) =>
      e.type === "REQUEST" ? goto({ type: "confirming", message: e.message }) : null,

    confirming: (_s, e) => {
      if (e.type === "CONFIRM") return exit(false); // confirmed, no further prompt
      if (e.type === "CANCEL") return goto({ type: "idle" });
      return null;
    },

    done: () => null, // terminal state — ignores all events
  });

  it("idle → REQUEST → confirming with the message", () => {
    const r = dialog.send(
      { type: "idle" },
      { type: "REQUEST", message: "Are you sure?" },
    ) as Goto<DialogState>;
    expect(r.kind).toBe("goto");
    expect(r.state).toEqual({ type: "confirming", message: "Are you sure?" });
  });

  it("confirming carries the message in state", () => {
    const r = dialog.send(
      { type: "idle" },
      { type: "REQUEST", message: "Delete item?" },
    ) as Goto<DialogState>;
    const confirming = r.state as { type: "confirming"; message: string };
    expect(confirming.message).toBe("Delete item?");
  });

  it("confirming → CONFIRM → exit(false)", () => {
    const r = dialog.send({ type: "confirming", message: "Sure?" }, { type: "CONFIRM" }) as Exit;
    expect(r.kind).toBe("exit");
    expect(r.confirm).toBe(false);
  });

  it("confirming → CANCEL → idle", () => {
    const r = dialog.send(
      { type: "confirming", message: "Sure?" },
      { type: "CANCEL" },
    ) as Goto<DialogState>;
    expect(r.kind).toBe("goto");
    expect(r.state.type).toBe("idle");
  });

  it("idle → CONFIRM → null (not in the right state)", () => {
    expect(dialog.send({ type: "idle" }, { type: "CONFIRM" })).toBeNull();
  });

  it("idle → CANCEL → null", () => {
    expect(dialog.send({ type: "idle" }, { type: "CANCEL" })).toBeNull();
  });

  it("done state ignores all events", () => {
    expect(dialog.send({ type: "done" }, { type: "REQUEST", message: "x" })).toBeNull();
    expect(dialog.send({ type: "done" }, { type: "CONFIRM" })).toBeNull();
    expect(dialog.send({ type: "done" }, { type: "CANCEL" })).toBeNull();
  });
});

// ── Real-world scenario: multi-step wizard with effects ───────────────────────

describe("multi-step wizard machine", () => {
  type FormData = { name: string; age: number };

  type WizardState =
    | { type: "step1"; name: string }
    | { type: "step2"; name: string; age: number }
    | { type: "complete" };

  type WizardEvent =
    | { type: "NEXT"; value: string | number }
    | { type: "BACK" }
    | { type: "SUBMIT" };

  const wizard = createMachine<WizardState, WizardEvent, FormData>({
    step1: (s, e) => {
      if (e.type === "NEXT") return goto({ type: "step2", name: String(e.value), age: 0 });
      if (e.type === "BACK") return exit(false); // leave wizard, no confirm
      return null;
    },

    step2: (s, e) => {
      if (e.type === "NEXT") return goto({ type: "step2", name: s.name, age: Number(e.value) });
      if (e.type === "BACK") return goto({ type: "step1", name: s.name });
      if (e.type === "SUBMIT") return effect("submit", { name: s.name, age: s.age });
      return null;
    },

    complete: () => null, // terminal — no transitions
  });

  it("step1 → NEXT → step2 carrying the name", () => {
    const r = wizard.send(
      { type: "step1", name: "" },
      { type: "NEXT", value: "Alice" },
    ) as Goto<WizardState>;
    expect(r.kind).toBe("goto");
    expect(r.state).toMatchObject({ type: "step2", name: "Alice" });
  });

  it("step2 → BACK → step1 preserving the name", () => {
    const r = wizard.send(
      { type: "step2", name: "Alice", age: 0 },
      { type: "BACK" },
    ) as Goto<WizardState>;
    expect(r.state).toEqual({ type: "step1", name: "Alice" });
  });

  it("step2 → NEXT → updates age in place", () => {
    const r = wizard.send(
      { type: "step2", name: "Alice", age: 0 },
      { type: "NEXT", value: 30 },
    ) as Goto<WizardState>;
    const s = r.state as { type: "step2"; name: string; age: number };
    expect(s.age).toBe(30);
    expect(s.name).toBe("Alice"); // name preserved
  });

  it("step2 → SUBMIT → effect('submit') with correct form data", () => {
    const r = wizard.send(
      { type: "step2", name: "Alice", age: 30 },
      { type: "SUBMIT" },
    ) as Effect<FormData>;
    expect(r.kind).toBe("effect");
    expect(r.name).toBe("submit");
    expect(r.data).toEqual({ name: "Alice", age: 30 });
  });

  it("effect data has the correct shape", () => {
    const r = wizard.send(
      { type: "step2", name: "Bob", age: 25 },
      { type: "SUBMIT" },
    ) as Effect<FormData>;
    expect(r.data.name).toBe("Bob");
    expect(r.data.age).toBe(25);
  });

  it("step1 → BACK → exit(false)", () => {
    const r = wizard.send({ type: "step1", name: "" }, { type: "BACK" }) as Exit;
    expect(r.kind).toBe("exit");
    expect(r.confirm).toBe(false);
  });

  it("complete state ignores all events", () => {
    expect(wizard.send({ type: "complete" }, { type: "NEXT", value: "x" })).toBeNull();
    expect(wizard.send({ type: "complete" }, { type: "BACK" })).toBeNull();
    expect(wizard.send({ type: "complete" }, { type: "SUBMIT" })).toBeNull();
  });

  it("full happy path: step1 → step2 → submit", () => {
    let s: WizardState = { type: "step1", name: "" };

    // Step 1: enter name
    s = (wizard.send(s, { type: "NEXT", value: "Charlie" }) as Goto<WizardState>).state;
    expect(s.type).toBe("step2");

    // Step 2: enter age
    s = (wizard.send(s, { type: "NEXT", value: 40 }) as Goto<WizardState>).state;
    expect(s.type).toBe("step2");

    // Submit
    const r = wizard.send(s, { type: "SUBMIT" }) as Effect<FormData>;
    expect(r.kind).toBe("effect");
    expect(r.data).toEqual({ name: "Charlie", age: 40 });
  });

  it("back-and-forth navigation works correctly", () => {
    let s: WizardState = { type: "step1", name: "" };

    s = (wizard.send(s, { type: "NEXT", value: "Dana" }) as Goto<WizardState>).state;
    expect(s.type).toBe("step2");
    s = (wizard.send(s, { type: "BACK" }) as Goto<WizardState>).state;
    expect(s.type).toBe("step1");
    s = (wizard.send(s, { type: "NEXT", value: "Dana" }) as Goto<WizardState>).state;
    s = (wizard.send(s, { type: "NEXT", value: 22 }) as Goto<WizardState>).state;
    const r = wizard.send(s, { type: "SUBMIT" }) as Effect<FormData>;
    expect(r.data.name).toBe("Dana");
    expect(r.data.age).toBe(22);
  });
});
