// @ts-check
// Shared steps for the phone tests.
import { expect } from '@playwright/test';

export const APP = '/index.html';
/** Saturday Nov 7, 2026, morning in America/Chicago. */
export const TODAY = new Date('2026-11-07T10:00:00-06:00');
export const STORAGE_KEY = 'budgeteer.v1';

/**
 * Open the app on a fixed day.
 * @param {import('@playwright/test').Page} page
 * @param {Date} [when]
 */
export async function open(page, when = TODAY) {
  await page.clock.setFixedTime(when);
  await page.goto(APP);
}

/**
 * Put saved data on the device, then reload so the app reads it.
 * @param {import('@playwright/test').Page} page
 * @param {object | string} data
 */
export async function seed(page, data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, text]);
  await page.reload();
}

/**
 * A version 2 state for seeding.
 * @param {{ paychecks?: object[], purchases?: object[], goals?: object[], goalPurchases?: object[],
 *   trackSpending?: boolean, split?: object }} parts
 */
export function v2(parts = {}) {
  return {
    version: 2,
    split: parts.split ?? { spend: 50, save: 30, goals: 20 },
    settings: { trackSpending: parts.trackSpending ?? false },
    paychecks: parts.paychecks ?? [],
    purchases: parts.purchases ?? [],
    goals: parts.goals ?? [],
    goalPurchases: parts.goalPurchases ?? [],
  };
}

/**
 * First run: name a goal (or skip), then the paycheck sheet opens.
 * @param {import('@playwright/test').Page} page
 * @param {{ goal?: string, price?: string }} [first]
 */
export async function welcome(page, first = {}) {
  await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible();
  if (first.goal) {
    await page.getByLabel('What is it?').fill(first.goal);
    await page.getByLabel('How much does it cost?').fill(first.price ?? '');
    await page.getByRole('button', { name: 'Next' }).click();
  } else {
    await page.getByRole('button', { name: 'Skip for now' }).click();
  }
  await expect(page.getByRole('dialog', { name: 'How much was your paycheck?' })).toBeVisible();
}

/**
 * Log a paycheck through the sheet and close the result with "Done".
 * Opens the sheet with "I got paid" unless it is already open.
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 */
export async function logPaycheck(page, amount) {
  const sheet = page.locator('#pay-sheet');
  if (!(await sheet.isVisible())) await page.getByRole('button', { name: 'I got paid' }).click();
  await sheet.getByLabel('Take-home amount').fill(amount);
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText(/^Nice\. Your /)).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
}

/**
 * Elements a thumb has to hit that are smaller than 44 x 44 px.
 * @param {import('@playwright/test').Page} page
 */
export async function smallTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, input, a[href], [role="switch"], select')]
    .filter((el) => {
      const box = el.getBoundingClientRect();
      const visible = box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      return visible && (box.width < 44 || box.height < 44);
    })
    .map((el) => `${el.tagName.toLowerCase()}#${el.id || ''} "${(el.textContent ?? '').trim()}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
}

/** @param {import('@playwright/test').Page} page */
export async function noSideScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}
