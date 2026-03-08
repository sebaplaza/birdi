/**
 * Application entry point.
 * Initializes IndexedDB storage, applies the saved theme, and mounts the app.
 */
import "./style.css";
import { initStorage } from "./lib/storage.js";
import { applyTheme } from "./lib/themes.js";
import { restoreState } from "./state.js";
import { createApp } from "./app.js";

async function main() {
  await initStorage();
  restoreState();
  applyTheme();
  createApp(document.getElementById("app")!);
}

main();
