// @ts-check
// One spend number on the paycheck result (lazy-v2 step 3c, overnight report P7).
import { test, expect } from '@playwright/test';
import { open, welcome } from './helpers.js';

test('the result and the headline behind it show the same weekly spend number', async ({ page }) => {
  await open(page);
  await welcome(page);
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('312.47');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.locator('#pay-sentence'))
    .toHaveText('From your $312.47: $156.24 to spend (about $78 a week), $93.74 saved, $62.49 for goals.');
  await expect(page.locator('#headline')).toHaveText('Spend about $78 a week');
});

test('answering "How often do you get paid?" updates the number in brackets', async ({ page }) => {
  await open(page);
  await welcome(page);
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('312.47');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await sheet.getByRole('radio', { name: 'Every week' }).click();
  await expect(sheet.locator('#pay-sentence'))
    .toHaveText('From your $312.47: $156.24 to spend (about $156 a week), $93.74 saved, $62.49 for goals.');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $156 a week');
});
