// @ts-check
// Removing a History entry shows "Paycheck removed." with Undo for 5 seconds (lazy-v3).
import { test, expect } from '@playwright/test';
import { APP, TODAY, open, seed, v2, STORAGE_KEY } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const DATA = v2({
  trackSpending: true,
  paychecks: [P('p1', '2026-10-31', 15600), P('p2', '2026-11-07', 20000)],
  purchases: [{ id: 'b1', date: '2026-11-07', cents: 500, note: 'Snack' }],
});

/** @param {import('@playwright/test').Page} page */
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);

/** @param {import('@playwright/test').Page} page */
async function history(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  return page.locator('#settings-sheet');
}

test('removing a paycheck says "Paycheck removed." with Undo, and Undo puts it back exactly', async ({ page }) => {
  await open(page);
  await seed(page, DATA);
  const before = await saved(page);
  const sheet = await history(page);
  /** @type {string[]} */
  const asked = [];
  page.once('dialog', (dialog) => { asked.push(dialog.message()); dialog.accept(); });
  await sheet.getByRole('button', { name: 'Remove paycheck of $200.00 from Nov 7, 2026' }).click();
  expect(asked).toEqual(['Remove paycheck of $200.00 from Nov 7, 2026?']); // no "You can't undo this." any more
  await expect(sheet.locator('#history-result')).toHaveText('Paycheck removed.');
  expect((await saved(page)).paychecks).toHaveLength(1);
  const undo = sheet.getByRole('button', { name: 'Undo the removal' });
  await expect(undo).toHaveText('Undo');
  await undo.click();
  const after = await saved(page);
  expect([after.paychecks, after.purchases]).toEqual([before.paychecks, before.purchases]); // the same records, in the same order
  await expect(sheet.locator('#history-result')).toHaveText('Paycheck is back.');
  await expect(undo).toBeHidden();
});

test('removing a purchase offers the same Undo', async ({ page }) => {
  await open(page);
  await seed(page, DATA);
  const before = await saved(page);
  const sheet = await history(page);
  page.once('dialog', (dialog) => dialog.accept());
  await sheet.getByRole('button', { name: 'Remove purchase "Snack" of $5.00 from Nov 7, 2026' }).click();
  await expect(sheet.locator('#history-result')).toHaveText('Purchase removed. The money is back in Spend.');
  await sheet.getByRole('button', { name: 'Undo the removal' }).click();
  const after = await saved(page);
  expect([after.paychecks, after.purchases]).toEqual([before.paychecks, before.purchases]); // the same records, in the same order
});

test('the message and Undo go away after 5 seconds, and the removal stays', async ({ page }) => {
  await page.clock.install({ time: TODAY });
  await page.goto(APP);
  await seed(page, DATA);
  await page.clock.pauseAt(new Date('2026-11-07T10:00:05-06:00'));
  const sheet = await history(page);
  page.once('dialog', (dialog) => dialog.accept());
  await sheet.getByRole('button', { name: 'Remove paycheck of $200.00 from Nov 7, 2026' }).click();
  const undo = sheet.getByRole('button', { name: 'Undo the removal' });
  await page.clock.runFor(4900);
  await expect(undo).toBeVisible();
  await expect(sheet.locator('#history-result')).toHaveText('Paycheck removed.');
  await page.clock.runFor(200);
  await expect(undo).toBeHidden();
  await expect(sheet.locator('#history-result')).toHaveText('');
  expect((await saved(page)).paychecks).toHaveLength(1);
});
