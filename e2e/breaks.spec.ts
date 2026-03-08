import { test, expect, type Page } from "@playwright/test";

/** Starts a match with default settings (best of 3, 21 points). */
async function startMatch(page: Page, pointsPerSet = "21") {
  await page.fill("#player1", "Alice");
  await page.fill("#player2", "Bob");
  if (pointsPerSet !== "21") {
    await page.selectOption("#points-per-set", pointsPerSet);
  }
  await page.click('button[type="submit"]');
  await expect(page.locator(".scoreboard")).toBeVisible();
}

/** Clicks the left player's + button n times. */
async function scoreLeft(page: Page, n: number) {
  const btn = page.locator(".scoreboard__btn").first();
  for (let i = 0; i < n; i++) {
    await btn.click();
  }
}

/** Clicks the right player's + button n times. */
async function scoreRight(page: Page, n: number) {
  const btn = page.locator(".scoreboard__btn").last();
  for (let i = 0; i < n; i++) {
    await btn.click();
  }
}

/** Clicks the court score area for a specific player index (0 or 1). */
async function scorePlayer(page: Page, player: number, n: number) {
  const btn = page.locator(`.court__score-btn[data-player="${player}"]`);
  for (let i = 0; i < n; i++) {
    await btn.click();
  }
}

test.describe("Break at 11 points", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase("birdi");
    });
    await page.reload();
  });

  test("triggers a break when a player reaches 11 points", async ({ page }) => {
    await startMatch(page);
    await scoreLeft(page, 11);

    // Break overlay should appear
    await expect(page.locator(".court__break")).toBeVisible();
    // Timer should show 60
    await expect(page.locator(".court__break-timer")).toHaveText("60");
  });

  test("countdown decrements during break", async ({ page }) => {
    await startMatch(page);
    await scoreLeft(page, 11);

    await expect(page.locator(".court__break")).toBeVisible();
    await expect(page.locator(".court__break-timer")).toHaveText("60");

    // Wait 2 seconds and check it decremented
    await page.waitForTimeout(2100);
    const timerText = await page.locator(".court__break-timer").textContent();
    const seconds = parseInt(timerText!);
    expect(seconds).toBeLessThanOrEqual(58);
    expect(seconds).toBeGreaterThan(0);
  });

  test("all buttons are disabled during break", async ({ page }) => {
    await startMatch(page);
    await scoreLeft(page, 11);

    await expect(page.locator(".court__break")).toBeVisible();

    // Score + buttons should be disabled
    const scoreBtns = page.locator(".scoreboard__btn");
    await expect(scoreBtns.first()).toBeDisabled();
    await expect(scoreBtns.last()).toBeDisabled();

    // Action buttons should be disabled
    const actionBtns = page.locator(".actions__btn");
    const count = await actionBtns.count();
    for (let i = 0; i < count; i++) {
      await expect(actionBtns.nth(i)).toBeDisabled();
    }
  });

  test("resume button ends the break", async ({ page }) => {
    await startMatch(page);
    await scoreLeft(page, 11);

    await expect(page.locator(".court__break")).toBeVisible();

    // Click resume
    await page.locator(".court__break-btn").click();

    // Break overlay should be hidden
    await expect(page.locator(".court__break")).not.toBeVisible();

    // Buttons should be enabled again
    await expect(page.locator(".scoreboard__btn").first()).toBeEnabled();
    await expect(page.locator(".actions__btn").first()).toBeEnabled();
  });

  test("score is 11 after break resumes", async ({ page }) => {
    await startMatch(page);
    await scoreLeft(page, 11);

    await expect(page.locator(".court__break")).toBeVisible();
    await page.locator(".court__break-btn").click();

    // Score should still be 11-0
    const scores = page.locator(".scoreboard__score");
    await expect(scores.first()).toHaveText("11");
    await expect(scores.last()).toHaveText("0");
  });
});

test.describe("Break between sets (2 minutes)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase("birdi");
    });
    await page.reload();
  });

  test("triggers a 120s break when a set is won", async ({ page }) => {
    // Use 11-point sets for faster testing
    await startMatch(page, "11");

    // Score 11 points to win the first set
    // First, score to 10 to pass the 11-point break check (which won't trigger for 11-point sets)
    // Actually with pointsPerSet=11, winning at 11-0 means the set is won
    await scoreLeft(page, 11);

    // After the 11-point break (if any), resume, then check for set break
    // With pointsPerSet=11, reaching 11 wins the set immediately
    // The set break should trigger with 120s
    await expect(page.locator(".court__break")).toBeVisible();
    // Check it's the set break (120 seconds, not 60)
    await expect(page.locator(".court__break-timer")).toHaveText("120");
  });

  test("all buttons disabled during set break", async ({ page }) => {
    await startMatch(page, "11");
    await scoreLeft(page, 11);

    await expect(page.locator(".court__break")).toBeVisible();

    // Score buttons disabled
    await expect(page.locator(".scoreboard__btn").first()).toBeDisabled();
    await expect(page.locator(".scoreboard__btn").last()).toBeDisabled();

    // Action buttons disabled
    const actionBtns = page.locator(".actions__btn");
    const count = await actionBtns.count();
    for (let i = 0; i < count; i++) {
      await expect(actionBtns.nth(i)).toBeDisabled();
    }
  });

  test("resume after set break returns to playing state", async ({ page }) => {
    await startMatch(page, "11");
    // Use court score buttons (player index) to avoid side-swap confusion
    await scorePlayer(page, 0, 11);

    await expect(page.locator(".court__break")).toBeVisible();
    await page.locator(".court__break-btn").click();

    // Break dismissed
    await expect(page.locator(".court__break")).not.toBeVisible();

    // Should be in a new set: scores reset to 0-0
    const scores = page.locator(".scoreboard__score");
    await expect(scores.first()).toHaveText("0");
    await expect(scores.last()).toHaveText("0");

    // Buttons re-enabled
    await expect(page.locator(".scoreboard__btn").first()).toBeEnabled();
    await expect(page.locator(".actions__btn").first()).toBeEnabled();
  });

  test("set break after a close set (deuce)", async ({ page }) => {
    await startMatch(page, "21");

    // Get to 20-20 quickly: alternate 10 blocks of 2 points each
    for (let i = 0; i < 10; i++) {
      await scoreLeft(page, 1);
      await scoreRight(page, 1);
    }
    // 10-10. Scoring to 11 triggers 11-point break — dismiss it
    await scoreLeft(page, 1); // 11-10 → 60s break
    await expect(page.locator(".court__break")).toBeVisible();
    await expect(page.locator(".court__break-timer")).toHaveText("60");
    await page.locator(".court__break-btn").click();

    // Continue alternating to 20-20
    await scoreRight(page, 1); // 11-11
    for (let i = 0; i < 9; i++) {
      await scoreLeft(page, 1);
      await scoreRight(page, 1);
    }
    // 20-20. Now win with 2-point lead
    await scoreLeft(page, 1); // 21-20 — no win yet
    await scoreLeft(page, 1); // 22-20 — set won!

    await expect(page.locator(".court__break")).toBeVisible();
    await expect(page.locator(".court__break-timer")).toHaveText("120");
  });

  test("no break after winning the match", async ({ page }) => {
    await startMatch(page, "11");

    // Win first set (player 0)
    await scorePlayer(page, 0, 11);
    await expect(page.locator(".court__break")).toBeVisible();
    await page.locator(".court__break-btn").click();

    // Win second set (player 0) → match won (best of 3 = need 2 sets)
    await scorePlayer(page, 0, 11);

    // Should show winner banner, not a break
    await expect(page.locator(".winner")).toBeVisible();
    await expect(page.locator(".court__break")).not.toBeVisible();
  });
});
