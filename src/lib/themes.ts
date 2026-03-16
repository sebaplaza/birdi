/**
 * Theme system.
 * Manages 10 color themes with CSS custom properties and court-specific palettes.
 * Theme selection is persisted in localStorage and applied to the document root.
 */
import { signal, computed } from "@preact/signals-core";

/** Color palette used by the court SVG renderer. */
export interface CourtColors {
  blueFill: string;
  blueDark: string;
  redFill: string;
  redDark: string;
  serve: string;
  serveReceive: string;
  background: string;
  netPost: string;
  /** Maximum-contrast color for score text on the court surface. */
  scoreText: string;
}

/** A complete theme definition with CSS variables and court colors. */
export interface Theme {
  id: string;
  name: string;
  /** CSS custom properties set on `:root` (without the `--` prefix). */
  vars: Record<string, string>;
  court: CourtColors;
}

const STORAGE_KEY = "birdi_theme";

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

/** All available themes. */
export const THEMES: Theme[] = [
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    vars: {
      blue: "#1e66f5",
      "blue-light": "#7287fd",
      red: "#e8788a",
      "red-light": "#f0a0ad",
      base: "#eff1f5",
      mantle: "#e6e9ef",
      crust: "#dce0e8",
      surface0: "#ccd0da",
      surface1: "#bcc0cc",
      text: "#4c4f69",
      subtext: "#6c6f85",
      overlay: "#8c8fa1",
    },
    court: {
      blueFill: "#7287fd",
      blueDark: "#5c6bc0",
      redFill: "#e88896",
      redDark: "#c9687a",
      serve: "#df8e1d",
      serveReceive: "rgba(223,142,29,0.35)",
      background: "#dce0e8",
      netPost: "#9ca0b0",
      scoreText: "#4c4f69",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    vars: {
      blue: "#89b4fa",
      "blue-light": "#74c7ec",
      red: "#f38ba8",
      "red-light": "#f5c2e7",
      base: "#1e1e2e",
      mantle: "#181825",
      crust: "#11111b",
      surface0: "#313244",
      surface1: "#45475a",
      text: "#cdd6f4",
      subtext: "#a6adc8",
      overlay: "#6c7086",
    },
    court: {
      blueFill: "#5b7ec9",
      blueDark: "#3e5a9e",
      redFill: "#c97088",
      redDark: "#a3526b",
      serve: "#f9e2af",
      serveReceive: "rgba(249,226,175,0.35)",
      background: "#181825",
      netPost: "#585b70",
      scoreText: "#cdd6f4",
    },
  },
  {
    id: "monokai",
    name: "Monokai",
    vars: {
      blue: "#66d9ef",
      "blue-light": "#89e3f4",
      red: "#f9728e",
      "red-light": "#fb9cb0",
      base: "#272822",
      mantle: "#1e1f1a",
      crust: "#1a1b16",
      surface0: "#3e3d32",
      surface1: "#4e4d42",
      text: "#f8f8f2",
      subtext: "#c0c0b0",
      overlay: "#75715e",
    },
    court: {
      blueFill: "#4a9fb5",
      blueDark: "#357a8c",
      redFill: "#c45e72",
      redDark: "#9e4458",
      serve: "#e6db74",
      serveReceive: "rgba(230,219,116,0.35)",
      background: "#1e1f1a",
      netPost: "#75715e",
      scoreText: "#f8f8f2",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    vars: {
      blue: "#268bd2",
      "blue-light": "#6caed6",
      red: "#dc8f8f",
      "red-light": "#e5b0b0",
      base: "#fdf6e3",
      mantle: "#eee8d5",
      crust: "#e0dbc8",
      surface0: "#d6d0bd",
      surface1: "#c9c3b0",
      text: "#586e75",
      subtext: "#657b83",
      overlay: "#93a1a1",
    },
    court: {
      blueFill: "#6caed6",
      blueDark: "#4a8ab5",
      redFill: "#d69999",
      redDark: "#b87a7a",
      serve: "#b58900",
      serveReceive: "rgba(181,137,0,0.3)",
      background: "#eee8d5",
      netPost: "#93a1a1",
      scoreText: "#073642",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    vars: {
      blue: "#268bd2",
      "blue-light": "#6caed6",
      red: "#e8919e",
      "red-light": "#f0b0ba",
      base: "#002b36",
      mantle: "#001f27",
      crust: "#00161d",
      surface0: "#073642",
      surface1: "#0a4050",
      text: "#839496",
      subtext: "#657b83",
      overlay: "#586e75",
    },
    court: {
      blueFill: "#2874a6",
      blueDark: "#1c5a80",
      redFill: "#b87080",
      redDark: "#965a68",
      serve: "#b58900",
      serveReceive: "rgba(181,137,0,0.35)",
      background: "#001f27",
      netPost: "#586e75",
      scoreText: "#fdf6e3",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    vars: {
      blue: "#8be9fd",
      "blue-light": "#a4eefe",
      red: "#ff9eb5",
      "red-light": "#ffb8ca",
      base: "#282a36",
      mantle: "#21222c",
      crust: "#1a1b26",
      surface0: "#383a4a",
      surface1: "#44475a",
      text: "#f8f8f2",
      subtext: "#c0c0d0",
      overlay: "#6272a4",
    },
    court: {
      blueFill: "#6bc0d4",
      blueDark: "#4e97ab",
      redFill: "#d48099",
      redDark: "#b06680",
      serve: "#f1fa8c",
      serveReceive: "rgba(241,250,140,0.3)",
      background: "#21222c",
      netPost: "#6272a4",
      scoreText: "#f8f8f2",
    },
  },
  {
    id: "gruvbox-light",
    name: "Gruvbox Light",
    vars: {
      blue: "#458588",
      "blue-light": "#689d6a",
      red: "#d0888e",
      "red-light": "#e0a5a9",
      base: "#fbf1c7",
      mantle: "#f2e5bc",
      crust: "#e8d8a8",
      surface0: "#d5c4a1",
      surface1: "#bdae93",
      text: "#3c3836",
      subtext: "#504945",
      overlay: "#928374",
    },
    court: {
      blueFill: "#6d9da0",
      blueDark: "#507d80",
      redFill: "#c08088",
      redDark: "#a06068",
      serve: "#d79921",
      serveReceive: "rgba(215,153,33,0.3)",
      background: "#ebdbb2",
      netPost: "#928374",
      scoreText: "#3c3836",
    },
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    vars: {
      blue: "#83a598",
      "blue-light": "#8ec07c",
      red: "#e8a0a8",
      "red-light": "#f0b8be",
      base: "#282828",
      mantle: "#1d2021",
      crust: "#171a1a",
      surface0: "#3c3836",
      surface1: "#504945",
      text: "#ebdbb2",
      subtext: "#d5c4a1",
      overlay: "#928374",
    },
    court: {
      blueFill: "#6a8e82",
      blueDark: "#4e7068",
      redFill: "#c08890",
      redDark: "#a06870",
      serve: "#fabd2f",
      serveReceive: "rgba(250,189,47,0.35)",
      background: "#1d2021",
      netPost: "#665c54",
      scoreText: "#ebdbb2",
    },
  },
  {
    id: "nord",
    name: "Nord",
    vars: {
      blue: "#88c0d0",
      "blue-light": "#81a1c1",
      red: "#d0899a",
      "red-light": "#e0a5b0",
      base: "#2e3440",
      mantle: "#272c36",
      crust: "#20242d",
      surface0: "#3b4252",
      surface1: "#434c5e",
      text: "#eceff4",
      subtext: "#d8dee9",
      overlay: "#616e88",
    },
    court: {
      blueFill: "#6b9aaa",
      blueDark: "#507888",
      redFill: "#b07888",
      redDark: "#905868",
      serve: "#ebcb8b",
      serveReceive: "rgba(235,203,139,0.35)",
      background: "#272c36",
      netPost: "#4c566a",
      scoreText: "#eceff4",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    vars: {
      blue: "#7aa2f7",
      "blue-light": "#89ddff",
      red: "#f0a0b0",
      "red-light": "#f5b8c5",
      base: "#1a1b26",
      mantle: "#16161e",
      crust: "#12121a",
      surface0: "#24283b",
      surface1: "#2f3346",
      text: "#c0caf5",
      subtext: "#a9b1d6",
      overlay: "#565f89",
    },
    court: {
      blueFill: "#5a82c7",
      blueDark: "#4060a0",
      redFill: "#c88898",
      redDark: "#a06878",
      serve: "#e0af68",
      serveReceive: "rgba(224,175,104,0.35)",
      background: "#16161e",
      netPost: "#565f89",
      scoreText: "#c0caf5",
    },
  },
];

/** Reactive current theme ID. */
export const themeId = signal(safeGet(STORAGE_KEY) || "nord");

/** Computed current theme object (falls back to the first theme). */
export const currentTheme = computed(() => THEMES.find((t) => t.id === themeId.value) || THEMES[0]);

/** Returns the current theme object. */
export function getTheme(): Theme {
  return currentTheme.value;
}

/** Returns the current theme ID string. */
export function getThemeId(): string {
  return themeId.value;
}

/**
 * Switches the active theme and persists the choice.
 * @param id - Theme ID (e.g. "nord", "dracula").
 */
export function setTheme(id: string): void {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) return;
  themeId.value = id;
  safeSet(STORAGE_KEY, id);
  applyTheme();
}

/**
 * Applies the current theme's CSS custom properties to the document root.
 * Also sets `data-theme="light|dark"` for CSS selectors.
 */
export function applyTheme(): void {
  const theme = currentTheme.value;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(`--${key}`, value);
  root.setAttribute("data-theme", isLightTheme(theme) ? "light" : "dark");
}

/** Determines if a theme is light or dark using perceived brightness of the base color. */
function isLightTheme(theme: Theme): boolean {
  const hex = theme.vars.base;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // ITU-R BT.601 luma formula
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
