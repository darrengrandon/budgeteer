// @ts-check
// "How often do you get paid?" in Settings (lazy-v2 step 2, docs/adr/0007).
import { test, expect } from '@playwright/test';
import { open, seed, v2, STORAGE_KEY } from './helpers.js';

const LABELS = ['Every week', 'Every 2 weeks', 'Twice a month', 'Once a month', "It's different every time"];
const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const PHONE = { id: 'g1', name: 'Phone', targetCents: 30000 };

/** @param {import('@playwright/test').Page} page */
async function savedFrequency(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.payFrequency, STORAGE_KEY);
}

/** @param {import('@playwright/test').Page} page */
async function openSettings(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('#settings-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

test('Settings lists the five answers in order, with the saved one chosen', async ({ page }) => {
  await open(page);
  await seed(page, { ...v2({ paychecks: [P('p1', '2026-11-07', 20000)] }), version: 3,
    settings: { trackSpending: false, payFrequency: 'twice-monthly' } });
  const sheet = await openSettings(page);
  const group = sheet.getByRole('radiogroup', { name: 'How often do you get paid?' });
  await expect(group.getByRole('radio')).toHaveCount(5);
  for (const [i, label] of LABELS.entries()) {
    await expect(group.getByRole('radio').nth(i)).toHaveAccessibleName(label);
  }
  await expect(group.getByRole('radio', { name: 'Twice a month' })).toBeChecked();
});

test('old data shows "It\'s different every time" chosen', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  const sheet = await openSettings(page);
  await expect(sheet.getByRole('radio', { name: "It's different every time" })).toBeChecked();
});

test('(b) changing the answer in Settings changes the numbers at once', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: [PHONE] }));
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  const sheet = await openSettings(page);

  await sheet.getByRole('radio', { name: 'Every week' }).check();
  await expect(sheet.locator('#often-result')).toHaveText('Saved. Spend about $100 a week.');
  expect(await savedFrequency(page)).toBe('weekly');
  await expect(page.locator('#headline')).toHaveText('Spend about $100 a week');
  await expect(page.locator('.goal-card').first()).toContainText('Ready around Dec 26 (in about 7 weeks)');

  await sheet.getByRole('radio', { name: 'Once a month' }).check();
  await expect(sheet.locator('#often-result')).toHaveText('Saved. Spend about $23 a week.');
  expect(await savedFrequency(page)).toBe('monthly');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $23 a week');
  await expect(page.locator('.goal-card').first()).toContainText('Ready around Jun 8, 2027 (in about 31 weeks)');
});

test('(c) "It\'s different every time" still learns from the logged dates', async ({ page }) => {
  await open(page);
  // Four $100 paydays a week apart.
  const weekly = [P('p1', '2026-10-17', 10000), P('p2', '2026-10-24', 10000), P('p3', '2026-10-31', 10000), P('p4', '2026-11-07', 10000)];
  await seed(page, v2({ paychecks: weekly }));
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  const sheet = await openSettings(page);
  await sheet.getByRole('radio', { name: 'Every 2 weeks' }).check();
  await expect(page.locator('#headline')).toHaveText('Spend about $25 a week');
  await sheet.getByRole('radio', { name: "It's different every time" }).check();
  await expect(sheet.locator('#often-result')).toHaveText('Saved. Spend about $50 a week.');
  expect(await savedFrequency(page)).toBe('varies');
});

test('the answer from the first paycheck shows in Settings', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  const pay = page.locator('#pay-sheet');
  await pay.getByLabel('Take-home amount').fill('200');
  await pay.getByRole('button', { name: 'Add paycheck' }).click();
  await pay.getByRole('radio', { name: 'Every 2 weeks' }).click();
  await pay.getByRole('button', { name: 'Done' }).click();
  const sheet = await openSettings(page);
  await expect(sheet.getByRole('radio', { name: 'Every 2 weeks' })).toBeChecked();
});
