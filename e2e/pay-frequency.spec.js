// @ts-check
// "How often do you get paid?" (lazy-v2 step 2, docs/adr/0007).
import { test, expect } from '@playwright/test';
import { open, seed, v2, welcome, logPaycheck, STORAGE_KEY } from './helpers.js';

const LABELS = ['Every week', 'Every 2 weeks', 'Twice a month', 'Once a month', "It's different every time"];

/** @param {import('@playwright/test').Page} page */
async function savedFrequency(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.payFrequency, STORAGE_KEY);
}

/** @param {import('@playwright/test').Page} page */
async function firstPaycheck(page) {
  await open(page);
  await welcome(page, { goal: 'Phone', price: '300' });
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('200');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText(/^From your \$200\.00/)).toBeVisible();
  return sheet;
}

test('after the first paycheck, the five answers show in order', async ({ page }) => {
  const sheet = await firstPaycheck(page);
  const group = sheet.getByRole('radiogroup', { name: 'How often do you get paid?' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('radio')).toHaveText(LABELS);
  for (const chip of await group.getByRole('radio').all()) await expect(chip).toHaveAttribute('aria-checked', 'false');
});

test('tapping "Every week" saves it at once and updates the goal line and Home', async ({ page }) => {
  const sheet = await firstPaycheck(page);
  await expect(sheet.locator('#pay-timeline')).toHaveText('Phone: ready around Feb 13, 2027 (in about 14 weeks)');
  const weekly = sheet.getByRole('radio', { name: 'Every week' });
  await weekly.click();
  await expect(weekly).toHaveAttribute('aria-checked', 'true');
  await expect(sheet.getByRole('status')).toHaveText('Saved. You can change it in Settings.');
  expect(await savedFrequency(page)).toBe('weekly');
  await expect(sheet.locator('#pay-timeline')).toHaveText('Phone: ready around Dec 26 (in about 7 weeks)');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $100 a week');
});

test('a second tap moves the answer: only one is pressed', async ({ page }) => {
  const sheet = await firstPaycheck(page);
  await sheet.getByRole('radio', { name: 'Every week' }).click();
  await sheet.getByRole('radio', { name: 'Once a month' }).click();
  await expect(sheet.getByRole('radio', { name: 'Every week' })).toHaveAttribute('aria-checked', 'false');
  await expect(sheet.getByRole('radio', { name: 'Once a month' })).toHaveAttribute('aria-checked', 'true');
  expect(await savedFrequency(page)).toBe('monthly');
});

test('Done without an answer counts as "It\'s different every time"', async ({ page }) => {
  const sheet = await firstPaycheck(page);
  await sheet.getByRole('button', { name: 'Done' }).click();
  expect(await savedFrequency(page)).toBe('varies');
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
});

test('the question does not come back after the first paycheck', async ({ page }) => {
  await firstPaycheck(page);
  await page.locator('#pay-sheet').getByRole('button', { name: 'Done' }).click();
  await page.clock.setFixedTime(new Date('2026-11-21T10:00:00-06:00'));
  await page.reload();
  await page.getByRole('button', { name: 'I got paid' }).click();
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('180');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText(/^From your \$180\.00/)).toBeVisible();
  await expect(sheet.getByRole('radiogroup', { name: 'How often do you get paid?' })).toBeHidden();
});

test('people who already use the app are not asked', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [{ id: 'p1', date: '2026-10-24', cents: 15000, spend: 50, save: 30, goals: 20 }] }));
  await page.getByRole('button', { name: 'I got paid' }).click();
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('150');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText(/^From your \$150\.00/)).toBeVisible();
  await expect(sheet.getByRole('radiogroup', { name: 'How often do you get paid?' })).toBeHidden();
  await sheet.getByRole('button', { name: 'Done' }).click();
  expect(await savedFrequency(page)).toBe('varies');
});

test('logPaycheck still works for a first paycheck (the chips do not get in the way)', async ({ page }) => {
  await open(page);
  await welcome(page);
  await logPaycheck(page, '200');
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
});
