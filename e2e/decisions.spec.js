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
  await expect(page.getByText('Nice. Your $212.40 became $106.20 to spend, $63.72 saved, $42.48 for goals.')).toBeVisible();
  expect(await historyCount(page)).toBe(2);
});

test("decision 2 (today only for now): yesterday's amount, or a different amount, does not ask", async ({ page }) => {
  // The owner asked for "today or yesterday". Yesterday is not done yet: it would change the
  // review2 L1 test, which the overnight rules don't allow without the owner's OK.
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-06', 21240)] }));
  await tryToLog(page, '212.40');
  await expect(page.getByText(/^Nice\. Your \$212\.40/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
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
