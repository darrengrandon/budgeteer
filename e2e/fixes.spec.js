// @ts-check
// Overnight Phase 3: regression tests for problems found on video (overnight-review/OVERNIGHT-REPORT.md).
import { test, expect } from '@playwright/test';
import { open, seed, v2 } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

test('P1: with large text the three split boxes stay in one row, even when a label wraps', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  await page.getByRole('button', { name: 'Settings' }).click();
  const tops = await Promise.all(['Spend %', 'Save %', 'Goals %'].map(async (label) =>
    Math.round((await page.getByLabel(label).boundingBox())?.y ?? -1)));
  expect(tops[0]).toBe(tops[1]);
  expect(tops[1]).toBe(tops[2]);
});

test('P3: irregular hours: a normal $175 after a $40 week is saved without a question', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-10-24', 21000), P('p2', '2026-10-31', 4000)] }));
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('175');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText(/^Nice\. Your \$175\.00/)).toBeVisible();
});
