/**
 * Minimal reactive DOM helpers built on @preact/signals-core.
 * Provides a lightweight alternative to a full framework.
 */
import { effect } from "@preact/signals-core";

/**
 * Creates an HTML element with optional props and children.
 * Props starting with "on" are registered as event listeners.
 * @param tag - HTML tag name.
 * @param props - Attributes and event handlers (e.g. `{ class: "btn", onclick: fn }`).
 * @param children - Child nodes or strings to append.
 * @returns The created element.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, unknown> | null,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2), v as EventListener);
      } else if (k === "class") {
        el.className = String(v);
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  for (const c of children) {
    if (c != null && c !== false) el.append(c);
  }
  return el;
}

/**
 * Creates a reactive Text node whose content updates when signals change.
 * @param fn - A function returning the text string (read signals inside).
 * @returns A live Text node.
 */
export function text(fn: () => string): Text {
  const node = document.createTextNode("");
  effect(() => {
    node.data = fn();
  });
  return node;
}

/**
 * Reactively binds an element's `textContent` to a signal-derived value.
 * @param el - The target element.
 * @param fn - A function returning the text string.
 */
export function bindText(el: HTMLElement, fn: () => string): void {
  effect(() => {
    el.textContent = fn();
  });
}

/**
 * Reactively binds an element's `innerHTML` to a signal-derived value.
 * Use with caution — only for trusted content.
 * @param el - The target element.
 * @param fn - A function returning the HTML string.
 */
export function bindHtml(el: HTMLElement, fn: () => string): void {
  effect(() => {
    el.innerHTML = fn();
  });
}

/**
 * Reactively toggles an element's visibility via `display: none`.
 * @param el - The target element.
 * @param fn - A function returning `true` to show, `false` to hide.
 */
export function show(el: HTMLElement, fn: () => boolean): void {
  effect(() => {
    el.style.display = fn() ? "" : "none";
  });
}
