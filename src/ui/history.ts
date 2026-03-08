/**
 * Match history component.
 * Displays a collapsible table of past matches with scores, durations,
 * and the ability to delete individual entries or clear all history.
 */
import { effect } from "@preact/signals-core";
import { h, bindText } from "../lib/dom.js";
import { t } from "../lib/i18n.js";
import { formatMs } from "../lib/utils.js";
import { history, send } from "../state.js";

/** Creates the history section with a reactive table of past matches. */
export function createHistory(): HTMLElement {
  const summary = h("summary");
  effect(() => {
    summary.innerHTML = `<strong>${t("history.title")}</strong>`;
  });

  const tbody = h("tbody");
  const thead = h("thead");
  const emptyMsg = h("p");
  const clearBtn = h("button", {
    class: "secondary outline",
    type: "button",
    onclick: () => send({ type: "CLEAR_HISTORY" }),
  });
  bindText(clearBtn, () => t("history.clear"));

  const table = h("table", { class: "history__table" }, thead, tbody);

  // Rebuild header row when language changes
  effect(() => {
    thead.innerHTML = "";
    const tr = h(
      "tr",
      null,
      h("th", null, t("history.date")),
      h("th", null, t("history.players")),
      h("th", null, t("history.score")),
      h("th", null, t("history.winner")),
      h("th", null, t("history.duration")),
      h("th"),
    );
    thead.append(tr);
  });

  // Rebuild table body when history entries change
  effect(() => {
    const entries = history.value;
    tbody.innerHTML = "";

    if (entries.length === 0) {
      emptyMsg.textContent = t("history.empty");
      emptyMsg.style.display = "";
      table.style.display = "none";
      clearBtn.style.display = "none";
      return;
    }

    emptyMsg.style.display = "none";
    table.style.display = "";
    clearBtn.style.display = "";

    for (let i = 0; i < entries.length; i++) {
      const m = entries[i];
      const winnerName = m.winner !== null ? m.players[m.winner] : "-";
      const winnerClass = m.winner === 0 ? "history__winner--blue" : "history__winner--red";
      const sets = m.completedSets.map((s) => `${s[0]}-${s[1]}`).join(", ");
      const duration = m.matchTime ? formatMs(m.matchTime) : "-";

      const playersCell = h("td");
      playersCell.innerHTML = `<span class="history__player--blue">${m.players[0]}</span> ${t("history.vs")} <span class="history__player--red">${m.players[1]}</span>`;

      const deleteBtn = h("button", {
        class: "history__delete",
        onclick: () => send({ type: "DELETE_HISTORY", index: i }),
      });
      deleteBtn.textContent = "x";

      const row = h(
        "tr",
        null,
        h("td", null, new Date(m.date).toLocaleDateString()),
        playersCell,
        h("td", null, `${sets} (${m.sets[0]}-${m.sets[1]})`),
        h("td", { class: winnerClass }, winnerName),
        h("td", null, duration),
        h("td", null, deleteBtn),
      );
      tbody.append(row);
    }
  });

  const details = h("details", { open: "" }, summary, emptyMsg, table, clearBtn);
  return h("section", { class: "history" }, details);
}
