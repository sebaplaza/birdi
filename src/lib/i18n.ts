/**
 * Internationalization (i18n) module.
 * Provides reactive language switching with `t()` for translated strings.
 * Supports 10 languages; falls back to English for unknown locales.
 */
import { signal, computed } from "@preact/signals-core";
import en from "../i18n/en.json";
import fr from "../i18n/fr.json";
import es from "../i18n/es.json";
import da from "../i18n/da.json";
import zh from "../i18n/zh.json";
import id from "../i18n/id.json";
import th from "../i18n/th.json";
import ja from "../i18n/ja.json";
import ms from "../i18n/ms.json";
import hi from "../i18n/hi.json";

type LocaleStrings = Record<string, unknown>;

/** Metadata for a supported language. */
export interface Language {
  code: string;
  flag: string;
  label: string;
}

const STORAGE_KEY = "birdi_lang";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Unavailable (e.g. Private Browsing) — preference not persisted.
  }
}

/** All loaded locale dictionaries, keyed by language code. */
const locales: Record<string, LocaleStrings> = {
  en,
  fr,
  es,
  da,
  zh,
  id,
  th,
  ja,
  ms,
  hi,
};

/** Detects the user's browser language, falling back to English. */
function detectLocale(): string {
  const browserLang = navigator.language?.split("-")[0];
  return locales[browserLang] ? browserLang : "en";
}

/** Reactive current language code (e.g. "en", "fr"). */
export const lang = signal(safeGet(STORAGE_KEY) || detectLocale());

/** Computed locale dictionary for the current language. */
const strings = computed(() => locales[lang.value] || locales.en);

/**
 * Returns a translated string for the given dot-separated path.
 * Supports `{placeholder}` interpolation.
 * @param path - Dot-separated key (e.g. "match.wins").
 * @param params - Key-value pairs for placeholder replacement.
 * @returns The translated string, or the raw path if not found.
 */
export function t(path: string, params: Record<string, string> = {}): string {
  const keys = path.split(".");
  let value: unknown = strings.value;
  for (const key of keys) value = (value as Record<string, unknown>)?.[key];
  if (typeof value !== "string") return path;
  return value.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "");
}

/** Returns the current language code. */
export function getLang(): string {
  return lang.value;
}

/**
 * Switches the active language and persists the choice.
 * @param code - Language code (e.g. "fr").
 */
export function setLang(code: string): void {
  if (!locales[code]) return;
  lang.value = code;
  safeSet(STORAGE_KEY, code);
}

/** All supported languages with display metadata. */
export const LANGUAGES: Language[] = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "da", flag: "🇩🇰", label: "Dansk" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia" },
  { code: "th", flag: "🇹🇭", label: "ไทย" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "ms", flag: "🇲🇾", label: "Bahasa Melayu" },
  {
    code: "hi",
    flag: "🇮🇳",
    label: "हिन्दी",
  },
];
