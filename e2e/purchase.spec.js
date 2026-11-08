// @ts-check
// Ticket 004 in a real browser: purchases come out of Spend, and overspending is blocked.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00-06:00'));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByLabel('Take-home amount').fill('20');
  await page.getByRole('button', { name: 'Add paycheck' }).click(); // $10.00 to spend
});

test('purchases come out of Spend, down to exactly zero, and one cent over is blocked', async ({ page }) => {
  const spend = page.locator('#balance-spend');
  const amount = page.getByLabel('Amount spent');
  const logIt = page.getByRole('button', { name: 'Log purchase' });
  await expect(page.getByText('You have $10.00 to spend.')).toBeVisible();

  await amount.fill('4');
  await page.getByLabel('What was it for?').fill('Snacks');
  await logIt.click();
  await expect(page.getByRole('status').filter({ hasText: 'Logged.' }))
    .toHaveText('Logged. $4.00 came out of Spend. You have $6.00 left to spend.');
  await expect(spend).toHaveText('$6.00');
  await expect(amount).toHaveValue('');

  await amount.fill('6.01');
  await logIt.click();
  await expect(page.getByRole('alert')).toHaveText("That's more than you have. You have $6.00 left to spend.");
  await expect(spend).toHaveText('$6.00');

  await amount.fill('6.00');
  await logIt.click();
  await expect(page.getByText('Logged. $6.00 came out of Spend. Your Spend bucket is now empty.')).toBeVisible();
  await expect(spend).toHaveText('$0.00');
  // A paycheck was logged, so don't tell them to log one "first" (review U12, changed with the owner's OK).
  await expect(page.getByText('Your Spend bucket is empty. Log your next paycheck to add more.')).toBeVisible();

  await amount.fill('0.01');
  await logIt.click();
  await expect(page.getByRole('alert')).toHaveText('Your Spend bucket is empty right now. Log a paycheck to fill it up.');

  // Save and Goals were never touched.
  await expect(page.locator('#balance-save')).toHaveText('$6.00');
  await expect(page.locator('#balance-goals')).toHaveText('$4.00');

  await page.reload();
  await expect(spend).toHaveText('$0.00');
});

test('recent activity lists entries and Remove fixes mistakes', async ({ page }) => {
  await page.getByLabel('Amount spent').fill('7');
  await page.getByLabel('What was it for?').fill('<b>Pizza</b>');
  await page.getByRole('button', { name: 'Log purchase' }).click();

  const items = page.locator('#history li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('<b>Pizza</b>'); // shown as plain text, not HTML
  await expect(items.nth(0)).toContainText('Nov 7, 2026');
  await expect(items.nth(0)).toContainText('−$7.00');
  await expect(items.nth(1)).toContainText('Paycheck');
  await expect(items.nth(1)).toContainText('+$20.00');
  await expect(page.locator('#history b')).toHaveCount(0);

  // The paycheck was partly spent, so it can't be removed yet. The page says so straight away,
  // without first asking "You can't undo this" (fresh-eyes review U9, changed with the owner's OK).
  /** @type {string[]} */
  const dialogs = [];
  /** @param {import('@playwright/test').Dialog} dialog */
  const recordDialog = (dialog) => { dialogs.push(dialog.message()); dialog.dismiss(); };
  page.on('dialog', recordDialog);
  await page.getByRole('button', { name: 'Remove paycheck of $20.00 from Nov 7, 2026' }).click();
  await expect(page.getByRole('alert')).toContainText("You can't remove this paycheck because you've already spent part of it.");
  expect(dialogs).toEqual([]);
  page.off('dialog', recordDialog);
  await expect(items).toHaveCount(2);

  // Saying "no" to the question changes nothing.
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /Remove purchase "<b>Pizza<\/b>"/ }).click();
  await expect(items).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Remove purchase "<b>Pizza<\/b>"/ }).click();
  await expect(page.getByText('Purchase removed. The money is back in Spend.')).toBeVisible();
  await expect(page.locator('#balance-spend')).toHaveText('$10.00');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove paycheck of $20.00 from Nov 7, 2026' }).click();
  await expect(page.locator('#balance-spend')).toHaveText('$0.00');
  await expect(page.getByText('Nothing yet.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Nothing yet.')).toBeVisible();
});
