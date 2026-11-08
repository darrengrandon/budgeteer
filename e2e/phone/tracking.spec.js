// @ts-check
// Ticket 018: "Track my spending" (SPEC.md, docs/adr/0005). Off by default; on for data with purchases.
import { test, expect } from '@playwright/test';
import { open, seed, v2, smallTargets, noSideScroll } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
/** $200 today: $100 in Spend. */
const paid = v2({ paychecks: [P('p1', '2026-11-07', 20000)] });

/** @param {import('@playwright/test').Page} page */
async function setTracking(page, on) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  const toggle = sheet.getByRole('switch', { name: 'Track my spending' });
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on));
  await sheet.getByRole('button', { name: 'Done' }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 * @param {string} [note]
 */
async function logPurchase(page, amount, note = '') {
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  const sheet = page.getByRole('dialog', { name: 'What did you buy?' });
  await sheet.getByLabel('Amount spent').fill(amount);
  await sheet.getByLabel('What was it for? (optional)').fill(note);
  await sheet.getByRole('button', { name: 'Log purchase' }).click();
  return sheet;
}

test('a new teen does not track spending: no purchases anywhere', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  await expect(page.getByRole('button', { name: 'Log a purchase' })).toHaveCount(0);
  await expect(page.locator('#spending')).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Track my spending' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText("Spend isn't tracked, so this is everything that went into it. Turn on Track my spending to see what's left.")).toBeVisible();
});

test('turning tracking on shows what is left, and purchases come out of Spend', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  await setTracking(page, true);
  await expect(page.locator('#left-to-spend')).toHaveText('$100.00 left to spend');
  const sheet = await logPurchase(page, '40', 'Movie');
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Logged. $40.00 came out of Spend. You have $60.00 left to spend.')).toBeVisible();
  await expect(page.locator('#left-to-spend')).toHaveText('$60.00 left to spend');
  await expect(page.locator('#recent li').first()).toContainText('Movie');
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week'); // the weekly guide doesn't change
  await page.reload();
  await expect(page.locator('#left-to-spend')).toHaveText('$60.00 left to spend');
});

test('spending exactly what is left is fine; one cent over is blocked', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)] }));
  let sheet = await logPurchase(page, '100.01');
  await expect(sheet.getByRole('alert')).toHaveText("That's more than you have. You have $100.00 left to spend.");
  await expect(sheet.getByLabel('Amount spent')).toBeFocused();
  await sheet.getByLabel('Amount spent').fill('100');
  await sheet.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.getByText('Logged. $100.00 came out of Spend. Your Spend bucket is now empty.')).toBeVisible();
  await expect(page.locator('#left-to-spend')).toHaveText('$0.00 left to spend');
  sheet = await logPurchase(page, '0.01');
  await expect(sheet.getByRole('alert')).toHaveText('Your Spend bucket is empty right now. Log a paycheck to fill it up.');
});

test('the purchase sheet explains bad amounts, and a pasted note with a tab still logs', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)] }));
  const sheet = await logPurchase(page, 'abc');
  await expect(sheet.getByRole('alert')).toHaveText("That doesn't look like an amount. Type it like 42.50.");
  await sheet.getByLabel('Amount spent').fill('5');
  await sheet.getByLabel('What was it for? (optional)').fill('Tab\there');
  await sheet.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.locator('#recent li').first()).toContainText('Tab here');
});

test('turning tracking off hides purchases but deletes nothing', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 4000, note: 'Movie' }],
  }));
  await expect(page.locator('#left-to-spend')).toHaveText('$60.00 left to spend');
  await setTracking(page, false);
  await expect(page.locator('#spending')).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#history')).toContainText('Movie'); // still in History
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await setTracking(page, true);
  await expect(page.locator('#left-to-spend')).toHaveText('$60.00 left to spend');
});

test('someone who already logged purchases starts with tracking on', async ({ page }) => {
  await open(page);
  await seed(page, {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 4000, note: 'Movie' }],
    goals: [],
  });
  await expect(page.locator('#left-to-spend')).toHaveText('$60.00 left to spend');
  await expect(page.locator('#recent li').first()).toContainText('Movie');
});

test('the Spending card and purchase sheet fit the phone', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)] }));
  expect(await smallTargets(page)).toEqual([]);
  expect(await noSideScroll(page)).toBe(true);
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  expect(await smallTargets(page)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  expect(await smallTargets(page)).toEqual([]);
});
