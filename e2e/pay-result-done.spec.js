// @ts-check
// The paycheck result: Done is pinned to the bottom and only the content above it scrolls, so
// Done is always on screen, even at 320px and with large text (lazy-v3 review 2). And no chip
// is chosen when it opens: Done without an answer saves "It's different every time".
import { test, expect } from '@playwright/test';
import { open, welcome, STORAGE_KEY } from './helpers.js';

const SE = { width: 320, height: 568 };

/**
 * First run with a goal, then the first paycheck, to reach the longest result sheet.
 * @param {import('@playwright/test').Page} page
 * @param {{ largeText?: boolean }} [options]
 */
async function firstResult(page, { largeText = false } = {}) {
  await page.setViewportSize(SE);
  await open(page);
  if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  await welcome(page, { goal: 'Concert tickets', price: '120' });
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('312.47');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.locator('#pay-sentence')).toBeVisible();
  return sheet;
}

/**
 * Done is wholly inside the screen, and nothing covers its middle.
 * @param {import('@playwright/test').Page} page
 */
async function doneOnScreen(page) {
  const done = page.getByRole('button', { name: 'Done' });
  const box = await done.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(SE.height);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [box.x + box.width / 2, box.y + box.height / 2])).toBe('pay-close');
}

for (const largeText of [false, true]) {
  test(`Done stays on screen and only the content above it scrolls (320px${largeText ? ', 150% text' : ''})`, async ({ page }) => {
    await firstResult(page, { largeText });
    await doneOnScreen(page);
    const body = page.locator('#pay-done .sheet-body');
    expect(await body.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
    const before = await page.getByRole('button', { name: 'Done' }).boundingBox();
    await body.evaluate((n) => { n.scrollTop = n.scrollHeight; });
    await expect(page.getByRole('radio', { name: "It's different every time" })).toBeInViewport();
    expect(await page.getByRole('button', { name: 'Done' }).boundingBox()).toEqual(before);
    await doneOnScreen(page);
  });
}

test('no chip is chosen when the first result opens, and Done saves "It\'s different every time", not "Every 2 weeks"', async ({ page }) => {
  const sheet = await firstResult(page);
  const chips = sheet.getByRole('radiogroup', { name: 'How often do you get paid?' }).getByRole('radio');
  await expect(chips).toHaveCount(5);
  for (const chip of await chips.all()) await expect(chip).toHaveAttribute('aria-checked', 'false');
  await sheet.getByRole('button', { name: 'Done' }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.payFrequency, STORAGE_KEY);
  expect(saved).toBe('varies');
  expect(saved).not.toBe('biweekly');
});
