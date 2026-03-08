import { test, expect } from "@playwright/test";

test.describe("Score tracking", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase("birdi");
    });
    await page.reload();
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

    // Wait for the fire-and-forget IndexedDB write to be readable
    await page.waitForFunction(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open("birdi", 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("kv", "readonly");
            const get = tx.objectStore("kv").get("current_match");
            get.onsuccess = () => {
              db.close();
              resolve(!!get.result);
            };
          };
        }),
    );
    await page.reload();

    await expect(page.locator(".scoreboard")).toBeVisible();
    await expect(page.locator(".scoreboard__score").first()).toHaveText("2");
  });
});
