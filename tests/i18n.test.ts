// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { t, getLang, setLang, LANGUAGES, type Language } from "../src/lib/i18n.js";

beforeEach(() => {
  localStorage.clear();
  setLang("en");
});

describe("t", () => {
  it("resolves a nested key", () => {
    expect(t("setup.start")).toBeTruthy();
    expect(typeof t("setup.start")).toBe("string");
  });

  it("returns the path when key is missing", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("substitutes parameters", () => {
    const result = t("match.wins", { player: "Alice" });
    expect(result).toContain("Alice");
  });
});

describe("getLang / setLang", () => {
  it("defaults to en", () => {
    expect(getLang()).toBe("en");
  });

  it("switches language", () => {
    setLang("fr");
    expect(getLang()).toBe("fr");
  });

  it("ignores invalid language", () => {
    setLang("xx");
    expect(getLang()).toBe("en");
  });

  it("changes translations when switching lang", () => {
    const enStart = t("setup.start");
    setLang("fr");
    const frStart = t("setup.start");
    expect(enStart).not.toBe(frStart);
  });
});

describe("LANGUAGES", () => {
  it("has 10 languages", () => {
    expect(LANGUAGES).toHaveLength(10);
  });

  it("each has code, flag, and label", () => {
    for (const l of LANGUAGES) {
      expect(l).toHaveProperty("code");
      expect(l).toHaveProperty("flag");
      expect(l).toHaveProperty("label");
    }
  });
});
