import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/birdi/" : "/",
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // Exclude the app entry point — it only wires up storage, state, and DOM,
      // and has no logic that can be meaningfully unit-tested in isolation.
      exclude: ["src/main.ts"],
    },
  },
});
