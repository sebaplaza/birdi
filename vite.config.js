import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/birdi/" : "/",
  test: {
    exclude: ["e2e/**", "node_modules/**"],
  },
});
