/**
 * Match setup form component.
 * Lets the user enter player names (with autocomplete from history),
 * choose match format, and start a new match.
 */
import { signal, effect, type Signal } from "@preact/signals-core";
import { h, show, bindText } from "../lib/dom.js";
import { t } from "../lib/i18n.js";
import { loadPlayers } from "../lib/storage.js";
import { send } from "../state.js";

/**
 * Creates a text input with dropdown autocomplete for player names.
 * Suggestions exclude the name currently chosen by the other player,
 * and update reactively when that other name changes.
 *
 * @param inputId - HTML id for the input element.
 * @param required - Whether the input is required for form submission.
 * @param exclude - Signal holding the other player's current name to exclude from suggestions.
 * @returns The wrapper element and a signal holding the current name value.
 */
function createAutocomplete(
  inputId: string,
  required: boolean,
  exclude: Signal<string>,
): { el: HTMLElement; name: Signal<string> } {
  const name = signal("");
  // Lowercased current input value, updated by event listeners and read by the reactive effect below.
  const query = signal("");
  const items = signal<string[]>([]);
  const showList = signal(false);
  const selectedIdx = signal(-1);

  const input = h("input", {
    type: "text",
    id: inputId,
    autocomplete: "off",
  });
  if (required) input.required = true;
  effect(() => {
    input.placeholder = t("setup.namePlaceholder");
  });

  // Recompute the suggestion list whenever the query or the excluded name changes.
  // Reading exclude.value here means the list updates immediately when the other
  // player's name is set, without any additional event wiring.
  effect(() => {
    const q = query.value;
    const ex = exclude.value.trim().toLowerCase();
    const filtered = loadPlayers().filter((p) => {
      const pl = p.toLowerCase();
      return pl.includes(q) && pl !== ex;
    });
    items.value = filtered;
    // Collapse the dropdown if it becomes empty after exclusion
    if (showList.value && filtered.length === 0) showList.value = false;
  });

  // Update query on keystroke; visibility and index managed separately
  input.addEventListener("input", () => {
    name.value = input.value;
    query.value = input.value.toLowerCase().trim();
    showList.value = items.value.length > 0;
    selectedIdx.value = -1;
  });

  // Show suggestions on focus
  input.addEventListener("focus", () => {
    query.value = input.value.toLowerCase().trim();
    showList.value = items.value.length > 0;
  });

  // Hide suggestions on blur (with delay to allow click events to fire first)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      showList.value = false;
    }, 150);
  });

  /** Picks an autocomplete suggestion and closes the dropdown. */
  function select(item: string) {
    name.value = item;
    input.value = item;
    showList.value = false;
  }

  // Keyboard navigation for the dropdown
  input.addEventListener("keydown", (e) => {
    if (!items.value.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx.value = Math.min(selectedIdx.value + 1, items.value.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx.value = Math.max(selectedIdx.value - 1, 0);
    } else if (e.key === "Enter" && selectedIdx.value >= 0) {
      e.preventDefault();
      select(items.value[selectedIdx.value]);
    }
  });

  // Render the dropdown list reactively
  const list = h("div", { class: "autocomplete__list" });
  show(list, () => showList.value);

  effect(() => {
    const entries = items.value;
    const idx = selectedIdx.value;
    list.innerHTML = "";
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const div = h(
        "div",
        {
          class: `autocomplete__item${i === idx ? " autocomplete__item--selected" : ""}`,
          role: "option",
          tabindex: "-1",
          "aria-selected": String(i === idx),
        },
        item,
      );
      div.addEventListener("mousedown", (e) => {
        e.preventDefault();
        select(item);
      });
      list.append(div);
    }
  });

  const el = h("div", { class: "autocomplete" }, input, list);
  return { el, name };
}

/** Creates the full setup form with player names, match format, and start button. */
export function createSetup(): HTMLElement {
  // Placeholder signals hold the other player's name for cross-exclusion.
  // They are synced to p1.name / p2.name via effects after both autocompletes are created.
  const excludeForP1 = signal("");
  const excludeForP2 = signal("");

  const p1 = createAutocomplete("player1", true, excludeForP1);
  const p2 = createAutocomplete("player2", true, excludeForP2);

  // Keep each exclude signal in sync with the opposite player's chosen name.
  effect(() => {
    excludeForP1.value = p2.name.value;
  });
  effect(() => {
    excludeForP2.value = p1.name.value;
  });

  // Labels (reactive for language changes)
  const label1 = h("label", { for: "player1", class: "setup__label--blue" });
  bindText(label1, () => t("setup.player1"));

  const label2 = h("label", { for: "player2", class: "setup__label--red" });
  bindText(label2, () => t("setup.player2"));

  const bestOfLabel = h("label", { for: "max-sets" });
  bindText(bestOfLabel, () => t("setup.bestOf"));

  const ppsLabel = h("label", { for: "points-per-set" });
  bindText(ppsLabel, () => t("setup.pointsPerSet"));

  const fsLabel = h("label", { for: "first-server" });
  bindText(fsLabel, () => t("setup.firstServer"));

  // Best-of selector (1, 3, or 5 sets)
  const opt1 = h("option", { value: "1" });
  const opt3 = h("option", { value: "3" });
  const opt5 = h("option", { value: "5" });
  bindText(opt1, () => t("setup.sets1"));
  bindText(opt3, () => t("setup.sets3"));
  bindText(opt5, () => t("setup.sets5"));
  const maxSetsSelect = h("select", { id: "max-sets" }, opt1, opt3, opt5);
  maxSetsSelect.value = "3";

  // Points per set selector
  const ppsSelect = h(
    "select",
    { id: "points-per-set" },
    h("option", { value: "11" }, "11"),
    h("option", { value: "15" }, "15"),
    h("option", { value: "21" }, "21"),
  );
  ppsSelect.value = "21";

  // First server selector (shows player names dynamically)
  const fsOpt0 = h("option", { value: "0" });
  const fsOpt1 = h("option", { value: "1" });
  effect(() => {
    fsOpt0.textContent = p1.name.value.trim() || t("setup.player1");
    fsOpt1.textContent = p2.name.value.trim() || t("setup.player2");
  });
  const fsSelect = h("select", { id: "first-server" }, fsOpt0, fsOpt1);

  // Error shown when both players share the same name (case-insensitive)
  const sameNameError = h("p", { class: "setup__error" });
  bindText(sameNameError, () => t("setup.sameName"));
  effect(() => {
    const n1 = p1.name.value.trim().toLowerCase();
    const n2 = p2.name.value.trim().toLowerCase();
    sameNameError.style.display = n1 && n2 && n1 === n2 ? "" : "none";
  });

  const submitBtn = h("button", { type: "submit" });
  bindText(submitBtn, () => `🏸 ${t("setup.start")}`);

  const form = h(
    "form",
    null,
    h(
      "fieldset",
      { class: "setup__fieldset" },
      h("div", null, label1, p1.el),
      h("div", null, label2, p2.el),
    ),
    sameNameError,
    h(
      "fieldset",
      { class: "setup__fieldset" },
      h("div", null, bestOfLabel, maxSetsSelect),
      h("div", null, ppsLabel, ppsSelect),
    ),
    h("fieldset", { class: "setup__fieldset" }, h("div", null, fsLabel, fsSelect)),
    submitBtn,
  );

  // Dispatch START_MATCH event on form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name1 = p1.name.value.trim();
    const name2 = p2.name.value.trim();
    if (!name1 || !name2) return;
    if (name1.toLowerCase() === name2.toLowerCase()) return;
    send({
      type: "START_MATCH",
      players: [name1, name2],
      maxSets: Number(maxSetsSelect.value),
      pointsPerSet: Number(ppsSelect.value),
      serving: Number(fsSelect.value),
    });
  });

  return h("section", { class: "setup" }, form);
}
