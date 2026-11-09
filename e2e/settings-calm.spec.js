// @ts-check
// Settings (lazy-v3 review 2): one body text size, and quiet text actions in History.
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

test('all text in Settings except headings and fields is one size', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 500, note: 'Snack' }], goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }] }));
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Every week' }).click(); // shows a "Saved." line too
  const sizes = await page.locator('#settings-sheet').evaluate((sheet) => {
    const found = new Set();
    for (const n of sheet.querySelectorAll('*')) {
      if (n.closest('h2, h3, input, [hidden]')) continue;
      const hasText = [...n.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim());
      if (hasText) found.add(getComputedStyle(n).fontSize);
    }
    return [...found];
  });
  expect(sizes).toEqual(['17px']);
});

test('History actions are quiet text, not bordered buttons, and still 44px', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const remove = page.getByRole('button', { name: 'Remove paycheck of $200.00 from Nov 7, 2026' });
  await expect(remove).toHaveText('Remove');
  const look = await remove.evaluate((n) => {
    const s = getComputedStyle(n);
    return { border: s.borderTopStyle, background: s.backgroundColor, height: n.getBoundingClientRect().height };
  });
  expect(look.border).toBe('none');
  expect(look.background).toBe('rgba(0, 0, 0, 0)');
  expect(look.height).toBeGreaterThanOrEqual(44);
});
