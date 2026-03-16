import { test, expect, type Page } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Starts a default match (Alice vs Bob, best of 3, n points per set). */
async function startMatch(page: Page, pointsPerSet = "21") {
  await page.fill("#player1", "Alice");
  await page.fill("#player2", "Bob");
  if (pointsPerSet !== "21") {
    await page.selectOption("#points-per-set", pointsPerSet);
  }
  await page.click('button[type="submit"]');
  await expect(page.locator(".scoreboard")).toBeVisible();
}

/** Clicks the left scoreboard + button n times. */
async function scoreLeft(page: Page, n: number) {
  const btn = page.locator(".scoreboard__btn").first();
  for (let i = 0; i < n; i++) await btn.click();
}

/**
 * Clicks the fullscreen toggle button and waits until the body has the
 * `fullscreen-mode` class so subsequent assertions are reliable.
 */
async function enterFullscreen(page: Page) {
  await page.locator(".court__fullscreen-btn").click();
  await page.waitForFunction(() => document.body.classList.contains("fullscreen-mode"));
}

/**
 * Returns the height/width ratio of the court SVG element.
 * Used to verify that the official court aspect ratio (6.1 / 13.4) is preserved.
 */
async function courtAspectRatio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const svg = document.querySelector(".court__svg")!;
    const r = svg.getBoundingClientRect();
    return r.height / r.width;
  });
}

// ── Responsive behavior ───────────────────────────────────────────────────────

test.describe("court responsive behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await startMatch(page);
  });

  test("viewBox attribute is '0 0 700 319'", async ({ page }) => {
    // The viewBox must exactly match COURT_VB_W × COURT_VB_H so the browser
    // scales the SVG with the correct official court aspect ratio.
    const vb = await page.locator(".court__svg").getAttribute("viewBox");
    expect(vb).toBe("0 0 700 319");
  });

  test("aspect ratio is preserved on mobile (375px wide)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Wait for layout to settle after resize before measuring.
    await page.waitForFunction(
      () => document.querySelector(".court__svg")!.getBoundingClientRect().width > 0,
    );
    const ratio = await courtAspectRatio(page);
    const official = 6.1 / 13.4;
    // Tolerance: 2% to account for CSS sub-pixel rounding and scrollbar width.
    expect(Math.abs(ratio - official) / official).toBeLessThan(0.02);
  });

  test("aspect ratio is preserved on tablet (768px wide)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForFunction(
      () => document.querySelector(".court__svg")!.getBoundingClientRect().width > 0,
    );
    const ratio = await courtAspectRatio(page);
    const official = 6.1 / 13.4;
    expect(Math.abs(ratio - official) / official).toBeLessThan(0.02);
  });

  test("aspect ratio is preserved on desktop (1200px wide)", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForFunction(
      () => document.querySelector(".court__svg")!.getBoundingClientRect().width > 0,
    );
    const ratio = await courtAspectRatio(page);
    const official = 6.1 / 13.4;
    expect(Math.abs(ratio - official) / official).toBeLessThan(0.02);
  });

  test("court SVG fills its container width", async ({ page }) => {
    // The SVG uses width:100% so its rendered width should equal
    // the parent .court element's clientWidth (within 2px for rounding).
    const fills = await page.evaluate(() => {
      const svg = document.querySelector(".court__svg")!;
      const container = document.querySelector(".court")!;
      return Math.abs(svg.getBoundingClientRect().width - container.clientWidth) < 2;
    });
    expect(fills).toBe(true);
  });

  test("court SVG height scales automatically with width on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForFunction(
      () => document.querySelector(".court__svg")!.getBoundingClientRect().width > 0,
    );
    const rect = await page.evaluate(() => {
      const r = document.querySelector(".court__svg")!.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    // At width ≈375px, expected height ≈ 375 × (6.1/13.4) ≈ 171px.
    // Tolerance of 5px for sub-pixel layout rounding.
    const expectedH = rect.width * (6.1 / 13.4);
    expect(Math.abs(rect.height - expectedH)).toBeLessThan(5);
  });
});

// ── Fullscreen mode ───────────────────────────────────────────────────────────

test.describe("fullscreen mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await startMatch(page);
  });

  // ── Toggle button ─────────────────────────────────────────────────────────

  test("toggle button is visible before entering fullscreen", async ({ page }) => {
    await expect(page.locator(".court__fullscreen-btn")).toBeVisible();
  });

  test("toggle button shows ⛶ before entering fullscreen", async ({ page }) => {
    const text = await page.locator(".court__fullscreen-btn").textContent();
    expect(text?.trim()).toBe("⛶");
  });

  test("toggle button shows ✕ in fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    const text = await page.locator(".court__fullscreen-btn").textContent();
    expect(text?.trim()).toBe("✕");
  });

  // ── Enter fullscreen ──────────────────────────────────────────────────────

  test("entering fullscreen adds match--fullscreen to the root element", async ({ page }) => {
    await enterFullscreen(page);
    const has = await page.evaluate(() => document.querySelector(".match--fullscreen") !== null);
    expect(has).toBe(true);
  });

  test("entering fullscreen adds fullscreen-mode to body", async ({ page }) => {
    await enterFullscreen(page);
    const has = await page.evaluate(() => document.body.classList.contains("fullscreen-mode"));
    expect(has).toBe(true);
  });

  test("header is hidden in fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await expect(page.locator(".header")).not.toBeVisible();
  });

  test("action buttons are hidden in fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await expect(page.locator(".actions")).not.toBeVisible();
  });

  test("court has position: fixed in fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    const pos = await page.evaluate(
      () => getComputedStyle(document.querySelector(".court")!).position,
    );
    expect(pos).toBe("fixed");
  });

  test("overlay is visible in fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await expect(page.locator(".court__overlay")).toBeVisible();
  });

  test("overlay shows correct player names", async ({ page }) => {
    await enterFullscreen(page);
    const names = await page.locator(".court__overlay-name").allTextContents();
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  test("overlay shows current score after scoring a point", async ({ page }) => {
    // Score before entering fullscreen so there is a non-zero score to check.
    await scoreLeft(page, 1);
    await enterFullscreen(page);
    const score = await page.locator(".court__overlay-score").first().textContent();
    expect(score?.trim()).toBe("1");
  });

  test("overlay undo button decrements the score", async ({ page }) => {
    await scoreLeft(page, 1);
    await enterFullscreen(page);
    await expect(page.locator(".court__overlay-score").first()).toHaveText("1");

    await page.locator(".court__overlay-undo").click();

    // Score should revert to 0 in both the overlay and the main scoreboard.
    await expect(page.locator(".court__overlay-score").first()).toHaveText("0");
  });

  // ── Exit fullscreen ───────────────────────────────────────────────────────

  test("clicking ✕ removes match--fullscreen from root element", async ({ page }) => {
    await enterFullscreen(page);
    await page.locator(".court__fullscreen-btn").click();
    const has = await page.evaluate(() => document.querySelector(".match--fullscreen") !== null);
    expect(has).toBe(false);
  });

  test("clicking ✕ removes fullscreen-mode from body", async ({ page }) => {
    await enterFullscreen(page);
    await page.locator(".court__fullscreen-btn").click();
    const has = await page.evaluate(() => document.body.classList.contains("fullscreen-mode"));
    expect(has).toBe(false);
  });

  test("header is visible again after exiting fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await page.locator(".court__fullscreen-btn").click();
    await expect(page.locator(".header")).toBeVisible();
  });

  test("action buttons are visible again after exiting fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await page.locator(".court__fullscreen-btn").click();
    await expect(page.locator(".actions")).toBeVisible();
  });

  test("court position reverts to non-fixed after exiting fullscreen", async ({ page }) => {
    await enterFullscreen(page);
    await page.locator(".court__fullscreen-btn").click();
    const pos = await page.evaluate(
      () => getComputedStyle(document.querySelector(".court")!).position,
    );
    expect(pos).not.toBe("fixed");
  });

  // ── Auto-exit ─────────────────────────────────────────────────────────────

  test("auto-exits when match finishes naturally (set won)", async ({ page }) => {
    // Use 11 pts per set so the match can be won quickly.
    // Navigate fresh because beforeEach already started a 21-pt match.
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await startMatch(page, "11");

    const breakBtn = page.locator(".court__break-btn");

    /**
     * Resumes any visible break overlay. Tries up to 3 times with a short
     * wait between attempts to handle cascading breaks (60s → 120s inter-set).
     */
    async function resumeBreaks() {
      for (let i = 0; i < 3; i++) {
        try {
          await breakBtn.waitFor({ state: "visible", timeout: 400 });
          await breakBtn.click();
        } catch {
          break;
        }
      }
    }

    // Win set 1 using scoreboard buttons (not in fullscreen yet).
    await scoreLeft(page, 11);
    await resumeBreaks();

    // Now enter fullscreen — the match is in set 2.
    await enterFullscreen(page);
    expect(await page.evaluate(() => document.body.classList.contains("fullscreen-mode"))).toBe(
      true,
    );

    // Win set 2 using the court SVG buttons (scoreboard + is hidden in fullscreen).
    // pointer-events:none on the overlay means clicks pass through to the SVG.
    const courtBtn = page.locator('.court__score-btn[data-player="0"]');
    for (let i = 0; i < 11; i++) {
      await courtBtn.click();
      await resumeBreaks();
    }

    // Match finished → fullscreen should auto-exit.
    await page.waitForFunction(() => !document.body.classList.contains("fullscreen-mode"), {
      timeout: 5000,
    });
    expect(await page.evaluate(() => document.body.classList.contains("fullscreen-mode"))).toBe(
      false,
    );
  });

  test("auto-exits when END_MATCH is triggered manually", async ({ page }) => {
    await enterFullscreen(page);

    // Exit fullscreen first so we can reach the hidden action buttons.
    await page.locator(".court__fullscreen-btn").click();

    // END_MATCH may show a confirm dialog when triggered during a match —
    // accept it automatically.
    page.on("dialog", (d) => d.accept());

    await page.locator(".actions__btn").filter({ hasText: "🏁" }).click();

    // State transitions to setup → both fullscreen classes must be absent.
    expect(await page.evaluate(() => document.body.classList.contains("fullscreen-mode"))).toBe(
      false,
    );
    expect(await page.evaluate(() => document.querySelector(".match--fullscreen") !== null)).toBe(
      false,
    );
  });
});
