// @ts-check
// One chip control for "How often do you get paid?" on the paycheck result and in Settings
// (lazy-v3 review 1, item 3). It is a radio group: arrow keys move and choose, like the radio
// buttons it replaces in Settings, and only the chosen chip is in the Tab order.
import { test, expect } from '@playwright/test';
import { open, seed, v2, welcome, STORAGE_KEY } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

/** @param {import('@playwright/test').Page} page */
async function savedFrequency(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.payFrequency, STORAGE_KEY);
}

test('Settings shows the pay question above "Your split", as the same chips as the paycheck result', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('#settings-sheet');
  const often = sheet.getByRole('radiogroup', { name: 'How often do you get paid?' });
  const top = async (/** @type {import('@playwright/test').Locator} */ l) => (await l.boundingBox())?.y ?? -1;
  expect(await top(often)).toBeLessThan(await top(sheet.getByRole('heading', { name: 'Your split' })));
  await expect(often.locator('.chip')).toHaveCount(5);
});

test('in Settings, arrow keys move the choice and save it', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('#settings-sheet');
  const chosen = sheet.getByRole('radio', { name: "It's different every time" });
  await chosen.focus();
  await page.keyboard.press('ArrowRight'); // wraps to the first
  await expect(sheet.getByRole('radio', { name: 'Every week' })).toBeChecked();
  await expect(sheet.getByRole('radio', { name: 'Every week' })).toBeFocused();
  expect(await savedFrequency(page)).toBe('weekly');
  await page.keyboard.press('ArrowLeft');
  await expect(chosen).toBeChecked();
  expect(await savedFrequency(page)).toBe('varies');
});

test('only the chosen chip is in the Tab order; with none chosen, the first one is', async ({ page }) => {
  await open(page);
  await welcome(page);
  const pay = page.locator('#pay-sheet');
  await pay.getByLabel('Take-home amount').fill('200');
  await pay.getByRole('button', { name: 'Add paycheck' }).click();
  const chips = pay.getByRole('radiogroup', { name: 'How often do you get paid?' }).getByRole('radio');
  expect(await chips.evaluateAll((nodes) => nodes.map((n) => /** @type {HTMLElement} */ (n).tabIndex))).toEqual([0, -1, -1, -1, -1]);
  await pay.getByRole('radio', { name: 'Once a month' }).click();
  expect(await chips.evaluateAll((nodes) => nodes.map((n) => /** @type {HTMLElement} */ (n).tabIndex))).toEqual([-1, -1, -1, 0, -1]);
});
