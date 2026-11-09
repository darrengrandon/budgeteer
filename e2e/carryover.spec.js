// @ts-check
// Ticket 019: behaviors the old page's browser tests checked that still exist in the phone app.
// Written before the old tests are removed (SPEC.md decision 10).
import { test, expect } from '@playwright/test';
import { TODAY, open, seed, v2, logPaycheck, welcome } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

test('text typed into notes and goal names is shown as text, never as HTML', async ({ page }) => {
  await open(page);
  await seed(page, v2({ trackSpending: true, paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.getByRole('button', { name: '+ Add a goal' }).click();
  await page.getByLabel('Goal name').fill('<img src=x onerror=alert(1)>');
  await page.getByLabel('Price').fill('300');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  await page.getByLabel('Amount spent').fill('7');
  await page.getByLabel('What was it for? (optional)').fill('<b>Pizza</b>');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.locator('.goal-card').first()).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#recent li').first()).toContainText('<b>Pizza</b>');
  await expect(page.locator('main img, main b')).toHaveCount(0);
});

test('every input has a label, on every screen and sheet', async ({ page }) => {
  await open(page);
  const unlabeled = () => page.evaluate(() => [...document.querySelectorAll('input')]
    .filter((input) => !input.labels?.length && !input.getAttribute('aria-label'))
    .map((input) => input.id));
  expect(await unlabeled()).toEqual([]);
  await welcome(page);
  expect(await unlabeled()).toEqual([]);
});

test('keyboard focus is clearly visible', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const style = getComputedStyle(/** @type {Element} */ (document.activeElement));
    return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(focus.outline).toBe('solid');
  expect(focus.width).toBeGreaterThanOrEqual(2);
});

test('money amounts never break across lines', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 100000000), P('p2', '2026-11-07', 4115)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 49999999, note: 'x'.repeat(80) }], // Spend has 50,002,058
    goals: [{ id: 'g1', name: 'Car', targetCents: 99999999 }],
  }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const broken = await page.evaluate(() => [...document.querySelectorAll('.history-amount, .money-list li span:last-child')]
    .filter((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size !== 1;
    })
    .map((node) => node.textContent));
  expect(broken).toEqual([]);
});

test('on a wide screen the app is the same narrow column, centered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const box = await page.locator('.app').boundingBox();
  expect(box?.width).toBeLessThanOrEqual(430);
  expect(Math.abs((box?.x ?? 0) * 2 + (box?.width ?? 0) - 1280)).toBeLessThan(2);
});

test('History can show every entry, so old mistakes can be removed', async ({ page }) => {
  await open(page);
  const paychecks = Array.from({ length: 25 }, (_, i) => P(`p${i + 1}`, `2026-10-${String(i + 1).padStart(2, '0')}`, 1000));
  await seed(page, v2({ paychecks }));
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#history li')).toHaveCount(20);
  await page.getByRole('button', { name: 'Show all 25' }).click();
  await expect(page.locator('#history li')).toHaveCount(25);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove paycheck of $10.00 from Oct 1, 2026' }).click();
  await expect(page.locator('#history li')).toHaveCount(24);
});

test('a backup with very high ids keeps working after more paychecks', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p999999999', '2026-11-01', 10000)] }));
  await logPaycheck(page, '20');
  await page.reload();
  await expect(page.locator('#notice')).toBeHidden();
  // Paydays Nov 1 and Nov 7: gap 6 days. ($100 + $20) / 2 x 7 / 6 = $70 a week; 50% = $35.
  await expect(page.locator('#headline')).toHaveText('Spend about $35 a week');
});

test('Home is in the promised order: goals, then the spend line, then "I got paid" at the bottom', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }] }));
  const y = async (/** @type {string} */ selector) => (await page.locator(selector).first().boundingBox())?.y ?? -1;
  expect(await y('.goal-card')).toBeLessThan(await y('#headline'));
  expect(await y('#headline')).toBeLessThan(await y('#got-paid'));
});

test('a direct visit to the app address works without the file name', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible();
});
