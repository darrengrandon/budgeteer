// @ts-check
// Overnight Phase 1: the owner's decisions 2 and 3 (SPEC.md decision 13).
import { test, expect } from '@playwright/test';
import { open, seed, v2, welcome } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

/** @param {import('@playwright/test').Page} page */
async function historyCount(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('budgeteer.v1') ?? '{"paychecks":[]}').paychecks.length);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 */
async function tryToLog(page, amount) {
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill(amount);
  await page.getByRole('button', { name: 'Add paycheck' }).click();
}

test('decision 2: the same amount again today asks "Log another paycheck?", and "No" saves nothing', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 21240)] }));
  await tryToLog(page, '212.40');
  const sheet = page.locator('#pay-sheet');
  await expect(sheet.getByRole('alert')).toHaveText('You already logged $212.40 today. Log another paycheck?');
  await sheet.getByRole('button', { name: "No, it's already logged" }).click();
  await expect(sheet).toBeHidden();
  expect(await historyCount(page)).toBe(1);
});

test('decision 2: "Yes, log another" saves the second paycheck', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 21240)] }));
  await tryToLog(page, '212.40');
  await page.getByRole('button', { name: 'Yes, log another' }).click();
  await expect(page.getByText('Nice. Your $212.40 became $106.20 to spend (about $106 a week), $63.72 saved, $42.48 for goals.')).toBeVisible();
  expect(await historyCount(page)).toBe(2);
});

test("decision 2: yesterday's amount asks \"Log another paycheck?\", and a different amount does not", async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-06', 21240)] }));
  await tryToLog(page, '212.40');
  await expect(page.locator('#pay-sheet').getByRole('alert')).toHaveText('You already logged $212.40 yesterday. Log another paycheck?');
  await page.getByRole('button', { name: "No, it's already logged" }).click();
  expect(await historyCount(page)).toBe(1);
  await tryToLog(page, '150');
  await expect(page.getByText(/^Nice\. Your \$150\.00/)).toBeVisible();
});

test('decision 2: a double tap on "Add paycheck" logs one paycheck', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).dblclick();
  await page.waitForTimeout(300);
  expect(await historyCount(page)).toBe(1);
});

test('decision 2: a double tap with a repeat amount still logs nothing extra', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).dblclick();
  await page.waitForTimeout(300);
  expect(await historyCount(page)).toBe(1);
});

test('decision 3: a paycheck over $3,000 asks "Is that right?" before saving, even the first one', async ({ page }) => {
  await open(page);
  await welcome(page);
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('3500');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByRole('alert')).toHaveText("That's over $3,000. Is $3,500.00 right?");
  expect(await historyCount(page)).toBe(0);
  await sheet.getByRole('button', { name: 'Yes, add $3,500.00' }).click();
  await expect(sheet.getByText(/^Nice\. Your \$3,500\.00/)).toBeVisible();
  expect(await historyCount(page)).toBe(1);
});

test('decision 3: exactly $3,000 does not ask', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('3000');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText(/^Nice\. Your \$3,000\.00/)).toBeVisible();
});
