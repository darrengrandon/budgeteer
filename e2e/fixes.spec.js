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

test('P2: on the smallest phone, "Buy it" is fully above the "I got paid" bar after the paycheck that funds it', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, new Date('2026-11-21T10:00:00-06:00'));
  const days = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'];
  await seed(page, v2({
    paychecks: days.map((d, i) => P(`p${i + 1}`, d, 15000)),
    goals: [{ id: 'g1', name: 'Bike', targetCents: 24000 }],
  }));
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.getByRole('button', { name: /^Same as last time/ }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Paycheck added.')).toBeVisible();
  const buy = await page.getByRole('button', { name: 'Buy it: Bike' }).boundingBox();
  const bar = await page.getByRole('button', { name: 'I got paid' }).boundingBox();
  expect((buy?.y ?? 0) + (buy?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
});

test('P2b: on the smallest phone, "Buy it" is clear of the bar\'s fade too, and the message is one line', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, new Date('2026-11-21T10:00:00-06:00'));
  const days = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'];
  await seed(page, v2({
    paychecks: days.map((d, i) => P(`p${i + 1}`, d, 15000)),
    goals: [{ id: 'g1', name: 'Bike', targetCents: 24000 }],
  }));
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.getByRole('button', { name: /^Same as last time/ }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const undo = page.getByRole('button', { name: 'Undo paycheck' });
  await expect(undo).toBeVisible();
  const message = await page.getByText('Paycheck added.').boundingBox();
  const undoBox = await undo.boundingBox();
  expect(Math.abs((message?.y ?? 0) + (message?.height ?? 0) / 2 - ((undoBox?.y ?? 0) + (undoBox?.height ?? 0) / 2))).toBeLessThan(8);
  const buy = await page.getByRole('button', { name: 'Buy it: Bike' }).boundingBox();
  const bar = await page.locator('#paybar').boundingBox();
  expect((buy?.y ?? 0) + (buy?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
});
