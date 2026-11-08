// @ts-check
// One-tap "Same as last time" on Home (lazy-v2 step 3b).
import { test, expect } from '@playwright/test';
import { APP, TODAY, open, seed, v2, STORAGE_KEY } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

/** @param {import('@playwright/test').Page} page */
async function saved(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"paychecks":[]}').paychecks, STORAGE_KEY);
}

const button = (/** @type {import('@playwright/test').Page} */ page) =>
  page.getByRole('button', { name: 'Same as last time: add $150.00' });

test('one tap saves the last amount today and offers Undo', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-10-24', 9000), P('p2', '2026-11-01', 15000)] }));
  await button(page).click();
  const paychecks = await saved(page);
  expect(paychecks).toHaveLength(3);
  expect(paychecks[2]).toMatchObject({ date: '2026-11-07', cents: 15000, spend: 50, save: 30, goals: 20 });
  await expect(page.locator('#home-status')).toHaveText('Added $150.00.');
  await expect(page.getByRole('button', { name: 'Undo paycheck' })).toBeVisible();
  await expect(button(page)).toBeHidden(); // the same amount is now logged today
});

test('Undo takes it back', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-01', 15000)] }));
  await button(page).click();
  await page.getByRole('button', { name: 'Undo paycheck' }).click();
  expect(await saved(page)).toHaveLength(1);
  await expect(page.locator('#home-status')).toHaveText('Paycheck removed.');
  await expect(button(page)).toBeVisible();
});

test('the Undo message goes away after 5 seconds', async ({ page }) => {
  await page.clock.install({ time: TODAY });
  await page.goto(APP);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-01', 15000)] }));
  await page.clock.pauseAt(new Date('2026-11-07T10:00:05-06:00')); // only runFor moves time from here
  await button(page).click();
  const undo = page.getByRole('button', { name: 'Undo paycheck' });
  await page.clock.runFor(4900);
  await expect(undo).toBeVisible();
  await page.clock.runFor(200);
  await expect(undo).toBeHidden();
  await expect(page.locator('#home-status')).toHaveText('');
  expect(await saved(page)).toHaveLength(2);
});

test('a double tap logs one paycheck and does not undo it', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-01', 15000)] }));
  await button(page).dblclick();
  await page.waitForTimeout(300);
  expect(await saved(page)).toHaveLength(2);
});

test('it is not offered when that amount was logged today or yesterday, or before any paycheck', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-06', 15000)] }));
  await expect(page.locator('#headline')).toHaveText(/^Spend about/);
  await expect(page.getByRole('button', { name: /^Same as last time/ })).toHaveCount(0);
  await seed(page, v2({ goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }] }));
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
  await expect(page.getByRole('button', { name: /^Same as last time/ })).toHaveCount(0);
});
