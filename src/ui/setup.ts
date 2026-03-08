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
 * @param inputId - HTML id for the input element.
 * @param required - Whether the input is required for form submission.
 * @returns The wrapper element and a signal holding the current name value.
 */
function createAutocomplete(
  inputId: string,
  required: boolean,
): { el: HTMLElement; name: Signal<string> } {
  const name = signal("");
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

  // Filter saved players as user types
  input.addEventListener("input", () => {
    name.value = input.value;
    const val = input.value.toLowerCase().trim();
    items.value = loadPlayers().filter((p) => p.toLowerCase().includes(val));
    showList.value = items.value.length > 0;
    selectedIdx.value = -1;
  });

  // Show suggestions on focus
  input.addEventListener("focus", () => {
    const val = input.value.toLowerCase().trim();
    items.value = loadPlayers().filter((p) => p.toLowerCase().includes(val));
    showList.value = items.value.length > 0;
  });

  // Hide suggestions on blur (with delay for click events)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      showList.value = false;
    }, 150);
  });

  /** Picks an autocomplete suggestion. */
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
  const p1 = createAutocomplete("player1", true);
  const p2 = createAutocomplete("player2", true);

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

  const submitBtn = h("button", { type: "submit" });
  bindText(submitBtn, () => t("setup.start"));

  const form = h(
    "form",
    null,
    h(
      "fieldset",
      { class: "setup__fieldset" },
      h("div", null, label1, p1.el),
      h("div", null, label2, p2.el),
    ),
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
