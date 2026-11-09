// @ts-check
// Every tap-to-explain number is a 44px target, like every other button (found by the lazy-v2
// overnight run: the pay line, "$X of $Y", the latest amounts and "left to spend" were 25-40px).
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

test('every tappable number on Home is at least 44 by 44 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-10-24', 20000)],
    purchases: [{ id: 'b1', date: '2026-10-24', cents: 500, note: 'Snack' }],
    goals: [{ id: 'g1', name: 'Phone', targetCents: 3000 }, { id: 'g2', name: 'Shoes', targetCents: 50000 }],
  }));
  const numbers = page.locator('#home [data-explain]');
  await expect(numbers).toHaveCount(8); // headline, pay line, Phone's amounts (its line is plain: funded), Shoes' amounts and line, left to spend, 2 latest
  const small = await numbers.evaluateAll((nodes) => nodes
    .map((n) => ({ text: n.textContent, box: n.getBoundingClientRect() }))
    .filter(({ box }) => box.width < 44 || box.height < 44)
    .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`));
  expect(small).toEqual([]);
});
