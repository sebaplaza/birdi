/**
 * Root application component.
 * Assembles the header, setup form, match view, and history panel,
 * toggling visibility based on the current FSM state.
 */
import { h, show } from "./lib/dom.js";
import { state } from "./state.js";
import { createHeader } from "./ui/header.js";
import { createSetup } from "./ui/setup.js";
import { createMatchView } from "./ui/match-view.js";
import { createHistory } from "./ui/history.js";

/**
 * Builds the full app DOM and appends it to the given target element.
 * @param target - The container element (typically `#app`).
 */
export function createApp(target: HTMLElement): void {
  const setup = createSetup();
  const matchView = createMatchView();

  // Show setup only in "setup" state; show match view in all other states
  show(setup, () => state.value.type === "setup");
  show(matchView, () => state.value.type !== "setup");

  target.append(
    h("main", { class: "container" }, createHeader(), setup, matchView, createHistory()),
  );
}
