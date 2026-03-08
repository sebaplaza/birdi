/**
 * App header component.
 * Contains the Birdi logo, theme selector, and language selector.
 */
import { effect } from "@preact/signals-core";
import { h } from "../lib/dom.js";
import { THEMES, themeId, setTheme } from "../lib/themes.js";
import { LANGUAGES, lang, setLang } from "../lib/i18n.js";

/** Inline SVG shuttlecock used as the dot on the "i" in "Birdi". */
const BIRDI_DOT = `<svg class="header__birdi-dot" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="105" rx="18" ry="14" fill="#d08770"/><ellipse cx="50" cy="98" rx="16" ry="11" fill="#ebcb8b"/><path d="M50 90Q50 55 50 25Q56 55 56 90Z" fill="#eceff4" stroke="#d8dee9" stroke-width=".5"/><path d="M50 90Q50 55 50 25Q44 55 44 90Z" fill="#e5e9f0" stroke="#d8dee9" stroke-width=".5"/><path d="M44 91Q30 58 20 32Q32 60 40 91Z" fill="#eceff4" stroke="#d8dee9" stroke-width=".5"/><path d="M44 91Q28 60 20 32Q26 63 38 91Z" fill="#e5e9f0" stroke="#d8dee9" stroke-width=".5"/><path d="M56 91Q70 58 80 32Q68 60 60 91Z" fill="#eceff4" stroke="#d8dee9" stroke-width=".5"/><path d="M56 91Q72 60 80 32Q74 63 62 91Z" fill="#e5e9f0" stroke="#d8dee9" stroke-width=".5"/><path d="M38 93Q18 65 5 48Q15 68 34 93Z" fill="#eceff4" stroke="#d8dee9" stroke-width=".5"/><path d="M62 93Q82 65 95 48Q85 68 66 93Z" fill="#e5e9f0" stroke="#d8dee9" stroke-width=".5"/><ellipse cx="50" cy="92" rx="17" ry="3" fill="none" stroke="#bf616a" stroke-width="1.2" opacity=".6"/></svg>`;

/** Creates the header bar with logo and selectors. */
export function createHeader(): HTMLElement {
  // Theme dropdown
  const themeSelect = h("select", {
    class: "header__select",
    onchange: (e: Event) => setTheme((e.target as HTMLSelectElement).value),
  });
  for (const theme of THEMES) themeSelect.append(h("option", { value: theme.id }, theme.name));
  effect(() => {
    themeSelect.value = themeId.value;
  });

  // Language dropdown
  const langSelect = h("select", {
    class: "header__select",
    onchange: (e: Event) => setLang((e.target as HTMLSelectElement).value),
  });
  for (const l of LANGUAGES)
    langSelect.append(h("option", { value: l.code }, `${l.flag} ${l.label}`));
  effect(() => {
    langSelect.value = lang.value;
  });

  // Logo with shuttlecock dot
  const title = h("h1", { class: "header__title" });
  title.innerHTML = `Bird<span class="header__dotless">i</span>${BIRDI_DOT}`;

  return h(
    "div",
    { class: "header" },
    h("div", { class: "header__left" }, themeSelect),
    title,
    h("div", { class: "header__right" }, langSelect),
  );
}
