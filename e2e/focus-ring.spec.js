// @ts-check
// One focus ring everywhere, which turns red on error (lazy-v3 review 2).
import { test, expect } from '@playwright/test';
import { open, welcome } from './helpers.js';

const ACCENT = 'rgb(15, 95, 115)'; // --focus, light theme
const ERROR = 'rgb(179, 38, 30)'; // --error, light theme

/** @param {import('@playwright/test').Locator} input */
const ring = (input) => input.evaluate((n) => {
  const s = getComputedStyle(n);
  return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, border: s.borderTopColor, borderWidth: s.borderTopWidth };
});

test('a field in focus has the accent ring; after an error the same ring turns red', async ({ page }) => {
  await open(page);
  await welcome(page);
  const amount = page.locator('#pay-sheet').getByLabel('Take-home amount');
  await amount.focus();
  expect(await ring(amount)).toMatchObject({ style: 'solid', width: '3px', color: ACCENT });
  await page.getByRole('button', { name: 'Add paycheck' }).click(); // empty: an error
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(amount).toBeFocused();
  expect(await ring(amount)).toEqual({ style: 'solid', width: '3px', color: ERROR, border: ERROR, borderWidth: '1px' });
});
