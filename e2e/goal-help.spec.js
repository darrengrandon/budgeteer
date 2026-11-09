// @ts-check
// One "?" per goal card, no dotted lines under numbers, and every card in the same order:
// amount, bar, then date (lazy-v3 review 1, items 2 and 5).
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const GOALS = [{ id: 'g1', name: 'Phone', targetCents: 30000 }, { id: 'g2', name: 'Shoes', targetCents: 5000 }];

test('each goal card has one "?" that explains its numbers in one sentence, and closes again', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: GOALS }));
  for (const card of await page.locator('.goal-card').all()) {
    await expect(card.getByRole('button', { name: /^What do the numbers for .+ mean\?$/ })).toHaveCount(1);
  }
  const help = page.getByRole('button', { name: 'What do the numbers for Phone mean?' });
  await expect(help).toHaveText('?');
  const box = await help.boundingBox();
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await help.click();
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  const sentence = page.locator(`#${await help.getAttribute('aria-controls')}`);
  await expect(sentence).toHaveText('You have $40 of the $300 for Phone, and about $40 of each paycheck goes to Goals, '
    + 'so the rest should be there by the payday around Feb 13, 2027.');
  await help.click();
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await expect(sentence).toHaveCount(0);
});

test('numbers on Home have no dotted line under them', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)], goals: GOALS }));
  const underlined = await page.evaluate(() => [...document.querySelectorAll('#home [data-explain], #home [data-explain] *')]
    .filter((n) => getComputedStyle(n).textDecorationLine !== 'none')
    .map((n) => n.textContent));
  expect(underlined).toEqual([]);
});

test('every goal card shows the amount, then the bar, then the date', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: GOALS }));
  for (const card of await page.locator('.goal-card').all()) {
    const tops = await Promise.all(['.goal-amounts', 'progress', '.goal-ready'].map(async (s) => (await card.locator(s).boundingBox())?.y ?? -1));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  }
});
