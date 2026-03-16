import { test, expect } from "@playwright/test";

test.describe("Score tracking", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test("cannot start a match with the same name for both players", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Alice");

    // Error message should be visible
    await expect(page.locator(".setup__error")).toBeVisible();

    // Submit should not start the match
    await page.click('button[type="submit"]');
    await expect(page.locator(".setup")).toBeVisible();
    await expect(page.locator(".scoreboard")).not.toBeVisible();
  });

  test("same-name check is case-insensitive", async ({ page }) => {
    await page.fill("#player1", "alice");
    await page.fill("#player2", "ALICE");

    await expect(page.locator(".setup__error")).toBeVisible();

    await page.click('button[type="submit"]');
    await expect(page.locator(".scoreboard")).not.toBeVisible();
  });

  test("error disappears when names become different", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Alice");
    await expect(page.locator(".setup__error")).toBeVisible();

    await page.fill("#player2", "Bob");
    await expect(page.locator(".setup__error")).not.toBeVisible();
  });

  test("setup form is visible on load", async ({ page }) => {
    await expect(page.locator(".setup")).toBeVisible();
    await expect(page.locator("#player1")).toBeVisible();
    await expect(page.locator("#player2")).toBeVisible();
  });

  test("can start a match", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Bob");
    await page.click('button[type="submit"]');

    // Match view should be visible
    await expect(page.locator(".scoreboard")).toBeVisible();
    await expect(page.locator(".court__svg")).toBeVisible();
  });

  test("score buttons increment the score", async ({ page }) => {
    // Start match
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Bob");
    await page.click('button[type="submit"]');

    // Get initial scores
    const scores = page.locator(".scoreboard__score");
    await expect(scores).toHaveCount(2);

    const leftScore = scores.first();
    const rightScore = scores.last();

    await expect(leftScore).toHaveText("0");
    await expect(rightScore).toHaveText("0");

    // Click left player's + button
    const buttons = page.locator(".scoreboard__btn");
    await buttons.first().click();

    // Debug: log the DOM state after click
    const leftText = await leftScore.textContent();
    const rightText = await rightScore.textContent();
    console.log(`After left +: left=${leftText}, right=${rightText}`);

    await expect(leftScore).toHaveText("1");
    await expect(rightScore).toHaveText("0");

    // Click right player's + button
    await buttons.last().click();
    await expect(leftScore).toHaveText("1");
    await expect(rightScore).toHaveText("1");
  });

  test("court score buttons increment the score", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Bob");
    await page.click('button[type="submit"]');

    const scores = page.locator(".scoreboard__score");
    await expect(scores.first()).toHaveText("0");

    // Click left court score button
    await page.locator(".court__score-btn").first().click();

    const leftText = await scores.first().textContent();
    console.log(`After court click: left=${leftText}`);

    await expect(scores.first()).toHaveText("1");
  });

  test("undo reverts the last point", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Bob");
    await page.click('button[type="submit"]');

    const scores = page.locator(".scoreboard__score");
    const leftBtn = page.locator(".scoreboard__btn").first();

    await leftBtn.click();
    await expect(scores.first()).toHaveText("1");

    // Click undo
    await page.locator(".actions__btn").first().click();
    await expect(scores.first()).toHaveText("0");
  });

  test("score persists after page reload", async ({ page }) => {
    await page.fill("#player1", "Alice");
    await page.fill("#player2", "Bob");
    await page.click('button[type="submit"]');

    const leftBtn = page.locator(".scoreboard__btn").first();
    await leftBtn.click();
    await leftBtn.click();

    await expect(page.locator(".scoreboard__score").first()).toHaveText("2");

    // localStorage writes are synchronous, so we can reload immediately
    await page.reload();

    await expect(page.locator(".scoreboard")).toBeVisible();
    await expect(page.locator(".scoreboard__score").first()).toHaveText("2");
  });
});

test.describe("Autocomplete exclusion", () => {
  // Seed two saved player names before each test so the autocomplete has entries to show.
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("birdi_players", JSON.stringify(["John", "Jane"]));
    });
    await page.reload();
  });

  test("player 1's name is excluded from player 2 suggestions", async ({ page }) => {
    // Select John as player 1
    await page.fill("#player1", "John");
    await page.dispatchEvent("#player1", "input");

    // Focus player 2 — John should not appear in suggestions
    await page.focus("#player2");
    await page.dispatchEvent("#player2", "focus");

    const list = page
      .locator("#player2 ~ .autocomplete__list, #player2 + * .autocomplete__list")
      .first();
    // Use a broader selector: find the autocomplete list near player2
    const p2List = page.locator(".autocomplete").nth(1).locator(".autocomplete__list");
    await expect(p2List.locator(".autocomplete__item", { hasText: "John" })).not.toBeVisible();
    await expect(p2List.locator(".autocomplete__item", { hasText: "Jane" })).toBeVisible();
  });

  test("player 2's name is excluded from player 1 suggestions", async ({ page }) => {
    // Select Jane as player 2
    await page.fill("#player2", "Jane");
    await page.dispatchEvent("#player2", "input");

    // Focus player 1 — Jane should not appear in suggestions
    await page.focus("#player1");
    await page.dispatchEvent("#player1", "focus");

    const p1List = page.locator(".autocomplete").nth(0).locator(".autocomplete__list");
    await expect(p1List.locator(".autocomplete__item", { hasText: "Jane" })).not.toBeVisible();
    await expect(p1List.locator(".autocomplete__item", { hasText: "John" })).toBeVisible();
  });

  test("exclusion is case-insensitive", async ({ page }) => {
    await page.fill("#player1", "john");
    await page.dispatchEvent("#player1", "input");

    await page.focus("#player2");
    await page.dispatchEvent("#player2", "focus");

    const p2List = page.locator(".autocomplete").nth(1).locator(".autocomplete__list");
    await expect(p2List.locator(".autocomplete__item", { hasText: "John" })).not.toBeVisible();
  });

  test("excluded name reappears when player 1 is cleared", async ({ page }) => {
    await page.fill("#player1", "John");
    await page.dispatchEvent("#player1", "input");

    // John is excluded from player 2
    await page.focus("#player2");
    await page.dispatchEvent("#player2", "focus");
    const p2List = page.locator(".autocomplete").nth(1).locator(".autocomplete__list");
    await expect(p2List.locator(".autocomplete__item", { hasText: "John" })).not.toBeVisible();

    // Clear player 1 — John should reappear in player 2's list
    await page.fill("#player1", "");
    await page.dispatchEvent("#player1", "input");
    await page.focus("#player2");
    await page.dispatchEvent("#player2", "focus");
    await expect(p2List.locator(".autocomplete__item", { hasText: "John" })).toBeVisible();
  });
});
