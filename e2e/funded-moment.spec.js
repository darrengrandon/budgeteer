// @ts-check
// One calm moment when a goal becomes funded (lazy-v3, docs/DESIGN.md "Motion").
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const WEEKS = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'];
// Seven $150 paychecks put $210 into Goals; the eighth makes the $240 bike fully saved.
const ALMOST = v2({ paychecks: WEEKS.map((d, i) => P(`p${i + 1}`, d, 15000)), goals: [{ id: 'g1', name: 'Bike', targetCents: 24000 }] });
const NOV_21 = new Date('2026-11-21T10:00:00-06:00');

/** @param {import('@playwright/test').Page} page */
const bike = (page) => page.locator('.goal-card').first();

test('the moment plays on Home once the paycheck sheet closes, not behind it', async ({ page }) => {
  await open(page, NOV_21);
  await seed(page, ALMOST);
  await expect(bike(page)).not.toHaveClass(/just-funded/);
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.getByRole('button', { name: /^Same as last time/ }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.locator('#pay-sentence')).toBeVisible();
  await expect(bike(page)).not.toHaveClass(/just-funded/);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(bike(page)).toHaveClass(/just-funded/);
  await expect(bike(page)).toContainText('You can buy it!');
  expect(await bike(page).locator('.goal-ready').evaluate((n) => getComputedStyle(n).animationName)).toBe('funded-in');
});

test('it plays at once after the one-tap "Same as last time", and never again after a reload', async ({ page }) => {
  await open(page, NOV_21);
  await seed(page, ALMOST);
  await page.getByRole('button', { name: 'Same as last time: add $150.00' }).click();
  await expect(bike(page)).toHaveClass(/just-funded/);
  await page.reload();
  await expect(bike(page)).toContainText('You can buy it!');
  await expect(bike(page)).not.toHaveClass(/just-funded/);
});

test('a goal that was already funded when the app opened gets no moment', async ({ page }) => {
  await open(page, NOV_21);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-14', 200000)], goals: [{ id: 'g1', name: 'Bike', targetCents: 24000 }] }));
  await expect(bike(page)).toContainText('You can buy it!');
  await expect(bike(page)).not.toHaveClass(/just-funded/);
});

test('with reduced motion nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, NOV_21);
  await seed(page, ALMOST);
  await page.getByRole('button', { name: 'Same as last time: add $150.00' }).click();
  await expect(bike(page)).toHaveClass(/just-funded/);
  const names = await bike(page).evaluate((card) => [card, ...card.querySelectorAll('*')].map((n) => getComputedStyle(n).animationName));
  expect(names.every((name) => name === 'none')).toBe(true);
});
