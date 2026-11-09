// @ts-check
// Home at 320px (lazy-v3 review 2 addendum): the last items scroll fully above the
// "I got paid" bar, and each goal's amount sits about 8px above its bar.
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const THREE = v2({
  paychecks: [P('p1', '2026-10-17', 15600), P('p2', '2026-10-24', 15600), P('p3', '2026-10-31', 15600)],
  goals: [{ id: 'g1', name: 'AirPods', targetCents: 24900 }, { id: 'g2', name: 'Concert tickets', targetCents: 12000 },
    { id: 'g3', name: 'New phone', targetCents: 60000 }],
});

/**
 * Scroll to the very bottom and check the spend line and "+ Add a goal" end above the bar.
 * @param {import('@playwright/test').Page} page
 */
async function lastItemsClearOfBar(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const bar = await page.locator('#paybar').boundingBox();
  for (const selector of ['#basis', '#add-goal']) {
    const box = await page.locator(selector).boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0), selector).toBeLessThanOrEqual(bar?.y ?? 0);
  }
}

for (const largeText of [false, true]) {
  test(`with three goals at 320px${largeText ? ' and 150% text' : ''}, the last items scroll fully above "I got paid"`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    await seed(page, THREE);
    if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
    await lastItemsClearOfBar(page);
  });
}

test('they still clear the bar while it also shows "Added $156.00. Undo"', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await seed(page, THREE);
  await page.getByRole('button', { name: 'Same as last time: add $156.00' }).click();
  await expect(page.getByRole('button', { name: 'Undo paycheck' })).toBeVisible();
  await lastItemsClearOfBar(page);
});

test('each goal\'s amount line sits about 8px above its bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await seed(page, THREE);
  const gaps = await page.locator('.goal-card').evaluateAll((cards) => cards.map((card) => {
    const range = document.createRange();
    range.selectNodeContents(/** @type {Element} */ (card.querySelector('.goal-amounts')));
    const text = range.getBoundingClientRect();
    return Math.round(/** @type {Element} */ (card.querySelector('progress')).getBoundingClientRect().top - text.bottom);
  }));
  expect(gaps).toHaveLength(3);
  for (const gap of gaps) {
    expect(gap).toBeGreaterThanOrEqual(6);
    expect(gap).toBeLessThanOrEqual(10);
  }
});
