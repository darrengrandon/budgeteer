// @ts-check
// Ticket 015: first run, Home and the paycheck sheet, at iPhone and Pixel sizes.
import { test, expect } from '@playwright/test';
import { APP, TODAY, open, seed, v2, welcome, logPaycheck, smallTargets, noSideScroll, STORAGE_KEY } from './helpers.js';

test('first run with a goal: name it, log a paycheck, and see what to spend and when', async ({ page }) => {
  await open(page);
  await welcome(page, { goal: 'Phone', price: '300' });
  const sheet = page.getByRole('dialog', { name: 'How much was your paycheck?' });
  await expect(sheet.getByLabel('Take-home amount')).toBeFocused();
  await expect(sheet.getByLabel('Take-home amount')).toHaveAttribute('inputmode', 'decimal');
  await expect(sheet.getByRole('button', { name: /Same as last time/ })).toBeHidden();

  await sheet.getByLabel('Take-home amount').fill('200');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText('Nice. Your $200.00 became $100.00 to spend, $60.00 saved, $40.00 for goals.')).toBeVisible();
  await expect(sheet.getByText('Phone: ready in about 13 weeks (around Feb 6, 2027)')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();

  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await expect(page.getByText('Out of about $100 a week of pay.')).toBeVisible();
  const card = page.locator('.goal-card').first();
  await expect(card).toContainText('Phone');
  await expect(card).toContainText('$40 of $300');
  await expect(card).toContainText('Ready in about 13 weeks (around Feb 6, 2027)');
  await expect(page.getByRole('button', { name: 'I got paid' })).toBeVisible();

  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeHidden();
});

test('first run, skipping both steps: Home asks for the first paycheck', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.getByRole('button', { name: 'Not paid yet' }).click();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
  await expect(page.locator('.goal-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
});

test('first run explains a missing price and a missing name', async ({ page }) => {
  await open(page);
  await page.getByLabel('What is it?').fill('Phone');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText('Type an amount, like 42.50.');
  await page.getByLabel('What is it?').fill('');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('alert')).toHaveText('Give your goal a name, like "New phone".');
});

test('bad amounts show a friendly message under the box and change nothing', async ({ page }) => {
  await open(page);
  await welcome(page);
  const sheet = page.locator('#pay-sheet');
  const amount = sheet.getByLabel('Take-home amount');
  const cases = [
    ['', 'Type an amount, like 42.50.'],
    ['-20', "The amount can't be negative."],
    ['twenty', "That doesn't look like an amount. Type it like 42.50."],
    ['12.345', 'Amounts only go down to cents, so use at most 2 digits after the dot.'],
    ['0', 'The amount has to be more than $0.'],
  ];
  for (const [text, message] of cases) {
    await amount.fill(text);
    await sheet.getByRole('button', { name: 'Add paycheck' }).click();
    await expect(sheet.getByRole('alert')).toHaveText(message);
    await expect(amount).toBeFocused();
  }
  await sheet.getByRole('button', { name: 'Not paid yet' }).click();
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
});

test('"Same as last time" fills in the last paycheck', async ({ page }) => {
  await open(page);
  await welcome(page);
  await logPaycheck(page, '212.40');
  await page.getByRole('button', { name: 'I got paid' }).click();
  const sheet = page.getByRole('dialog', { name: 'How much did you get paid?' });
  await sheet.getByRole('button', { name: 'Same as last time ($212.40)' }).click();
  await expect(sheet.getByLabel('Take-home amount')).toHaveValue('212.40');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText('Nice. Your $212.40 became $106.20 to spend, $63.72 saved, $42.48 for goals.')).toBeVisible();
});

test('Undo takes the paycheck back out', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#pay-sheet')).toBeHidden();
  await expect(page.getByText('Paycheck removed.')).toBeVisible();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
});

test('closing the sheet with Escape logs nothing', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pay-sheet')).toBeHidden();
  await expect(page.locator('#headline')).toHaveText('Log your first paycheck');
});

test('"Got paid? Log it." shows when a paycheck is overdue and goes away after logging', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [{ id: 'p1', date: '2026-10-20', cents: 20000, spend: 50, save: 30, goals: 20 }] }));
  const nudge = page.getByRole('button', { name: 'Got paid? Log it.' });
  await expect(nudge).toBeVisible();
  await nudge.click();
  await logPaycheck(page, '200');
  await expect(nudge).toBeHidden();
});

test('no nudge when the last paycheck is recent', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [{ id: 'p1', date: '2026-10-25', cents: 20000, spend: 50, save: 30, goals: 20 }] }));
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await expect(page.getByRole('button', { name: 'Got paid? Log it.' })).toBeHidden();
});

test('data from the old version opens with nothing lost', async ({ page }) => {
  await open(page);
  await seed(page, {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [{ id: 'p1', date: '2026-11-06', cents: 20000, spend: 50, save: 30, goals: 20 }],
    purchases: [{ id: 'b1', date: '2026-11-06', cents: 500, note: 'Snack' }],
    goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }],
  });
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await expect(page.locator('.goal-card').first()).toContainText('$40 of $300');
  await logPaycheck(page, '10');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(saved.version).toBe(2);
  expect(saved.purchases).toEqual([{ id: 'b1', date: '2026-11-06', cents: 500, note: 'Snack' }]);
  expect(saved.settings).toEqual({ trackSpending: true });
});

test('two open tabs never erase each other', async ({ page }) => {
  await open(page);
  await welcome(page);
  await logPaycheck(page, '100');
  const other = await page.context().newPage();
  await other.clock.setFixedTime(TODAY);
  await other.goto(APP);
  await logPaycheck(page, '100'); // two paydays on one day: $200 per 14 days
  await expect(other.locator('#headline')).toHaveText('Spend about $50 a week'); // picked up without a reload
  await logPaycheck(other, '100');
  await expect(page.locator('#headline')).toHaveText('Spend about $75 a week');
});

test('fits the phone: no sideways scroll, big targets, "I got paid" in the thumb zone', async ({ page }) => {
  await open(page);
  expect(await noSideScroll(page)).toBe(true);
  expect(await smallTargets(page)).toEqual([]);
  await page.getByLabel('What is it?').fill('Supercalifragilisticexpialidocious-car');
  await page.getByLabel('How much does it cost?').fill('999,999.99');
  await page.getByRole('button', { name: 'Next' }).click();
  expect(await smallTargets(page)).toEqual([]);
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('1000000');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  expect(await noSideScroll(page)).toBe(true);
  await page.getByRole('button', { name: 'Done' }).click();
  expect(await noSideScroll(page)).toBe(true);
  expect(await smallTargets(page)).toEqual([]);

  const viewport = page.viewportSize();
  const box = await page.getByRole('button', { name: 'I got paid' }).boundingBox();
  expect(box && viewport && box.y + box.height).toBeGreaterThan((viewport?.height ?? 0) - 110);
  expect(box?.height).toBeGreaterThanOrEqual(56);
});

test('dark theme follows the phone setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(18, 19, 26)');
});

test('the app makes no requests outside its own files', async ({ page }) => {
  /** @type {string[]} */
  const outside = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:8137/')) outside.push(request.url());
  });
  await open(page);
  await welcome(page, { goal: 'Phone', price: '300' });
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  expect(outside).toEqual([]);
});

// Bug found in screenshots for ticket 015: the top goal card used the header's "top" class and
// was laid out sideways, so "New phone" broke into "Ne / w / ph / on / e".
test('the top goal card stacks name, amounts, bar and date, and the name stays on one line', async ({ page }) => {
  await open(page);
  await welcome(page, { goal: 'New phone', price: '300' });
  await page.getByRole('button', { name: 'Not paid yet' }).click();
  const card = page.locator('.goal-card').first();
  const tops = await card.evaluate((li) => [...li.children].map((child) => Math.round(child.getBoundingClientRect().top)));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(tops.length); // every part on its own row
  const name = await card.locator('.goal-name').evaluate((h) => {
    const range = document.createRange();
    range.selectNodeContents(h);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  });
  expect(name).toBe(1);
});
