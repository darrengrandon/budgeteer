// @ts-check
// Ticket 021: browser tests for the second review's findings (REVIEW.md, L1-L14).
import { test, expect } from '@playwright/test';
import { TODAY, APP, open, seed, v2, logPaycheck, welcome } from './helpers.js';

/** @param {string} day */
const on = (day) => new Date(`${day}T10:00:00-06:00`);
const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
/** One $312.47 paycheck on Nov 7 and AirPods for $250. */
const airpods = v2({ paychecks: [P('p1', '2026-11-07', 31247)], goals: [{ id: 'g1', name: 'AirPods', targetCents: 25000 }] });

test('L1: the sheet says a paycheck was already logged, and a next-day duplicate no longer fakes a 1-day gap', async ({ page }) => {
  await open(page);
  await seed(page, airpods);
  await page.getByRole('button', { name: 'I got paid' }).click();
  await expect(page.locator('#pay-sheet').getByText('You already logged $312.47 today.')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.clock.setFixedTime(on('2026-11-08'));
  await page.reload();
  await page.getByRole('button', { name: 'I got paid' }).click();
  await expect(page.locator('#pay-sheet').getByText('You already logged $312.47 yesterday.')).toBeVisible();
  await page.getByRole('button', { name: 'Same as last time ($312.47)' }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Yes, log another' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  // One payday of $624.94 every 2 weeks: $312.47 a week, half of it to spend. Not $1,094.
  await expect(page.locator('#headline')).toHaveText('Spend about $156 a week');
});

test('L2: a clearly missed payday can be added with one tap, so the numbers stay right', async ({ page }) => {
  await open(page, on('2026-12-05'));
  await seed(page, airpods);
  await page.getByRole('button', { name: 'Got paid? Log it.' }).click();
  const missed = page.getByRole('button', { name: 'Also add the paycheck I missed (around Nov 21)' });
  await expect(missed).toHaveAttribute('aria-pressed', 'false');
  await missed.click();
  await expect(missed).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Same as last time ($312.47)' }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText('Also added the paycheck from Nov 21.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $78 a week'); // not $39
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#history li')).toHaveCount(3);
  await expect(page.locator('#history li').nth(1)).toContainText('Nov 21, 2026');
});

test('L3: coming back to the open app re-checks the date and shows "Got paid? Log it."', async ({ page }) => {
  await open(page);
  await seed(page, airpods);
  await expect(page.getByRole('button', { name: 'Got paid? Log it.' })).toBeHidden();
  await page.clock.setFixedTime(on('2026-11-27'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('button', { name: 'Got paid? Log it.' })).toBeVisible();
});

test('L4: the iPhone card explains that Safari can clear data', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'the card is for iPhone in Safari only');
  await open(page);
  await seed(page, airpods);
  await expect(page.getByRole('region', { name: 'Put Budgeteer on your Home Screen' }))
    .toContainText("Until then, Safari may clear your info if you don't open Budgeteer for a week.");
});

test('L4: after 4 paychecks Home suggests a backup, once, until 4 more', async ({ page }) => {
  await open(page);
  const four = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'].map((d, i) => P(`p${i + 1}`, d, 20000));
  await seed(page, v2({ paychecks: four.slice(0, 3) }));
  const card = page.getByRole('region', { name: 'Back up your info' });
  await expect(card).toHaveCount(0);
  await seed(page, v2({ paychecks: four }));
  await expect(card).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download backup' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('budgeteer-backup-2026-11-07.json');
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $100 a week');
  await expect(card).toHaveCount(0);
});

test('L4: "Not now" hides the backup card until 4 more paychecks', async ({ page }) => {
  await open(page);
  const four = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'].map((d, i) => P(`p${i + 1}`, d, 20000));
  await seed(page, v2({ paychecks: four }));
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('region', { name: 'Back up your info' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $100 a week');
  await expect(page.getByRole('region', { name: 'Back up your info' })).toHaveCount(0);
});

test('L5: a paycheck 4 times the last one asks first, and Undo stays on Home after Done', async ({ page }) => {
  await open(page, on('2026-11-21'));
  await seed(page, airpods);
  await page.getByRole('button', { name: 'I got paid' }).click();
  const sheet = page.locator('#pay-sheet');
  await sheet.getByLabel('Take-home amount').fill('31247');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByRole('alert')).toHaveText("That's a lot more than last time ($312.47). Is $31,247.00 right?");
  await expect(sheet.getByText(/^Nice\./)).toBeHidden(); // nothing saved yet
  await sheet.getByLabel('Take-home amount').fill('312.47');
  await expect(sheet.getByRole('button', { name: 'Add paycheck' })).toBeVisible();
  await sheet.getByLabel('Take-home amount').fill('31247');
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await sheet.getByRole('button', { name: 'Yes, add $31,247.00' }).click();
  await expect(sheet.getByText('Nice. Your $31,247.00 became')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Undo paycheck' }).click();
  await expect(page.getByText('Paycheck removed.')).toBeVisible();
  await expect(page.locator('#headline')).toHaveText('Spend about $78 a week');
});

test('L6: a cheap goal below an expensive one says the money is there, and "Move to top" fixes it', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 31247)],
    goals: [
      { id: 'g1', name: 'Car', targetCents: 500000 },
      { id: 'g2', name: 'Concert tickets', targetCents: 8500 },
      { id: 'g3', name: 'Phone case', targetCents: 2000 },
    ],
  }));
  const cards = page.locator('.goal-card');
  await expect(cards.nth(2)).toContainText("The money's already in Goals. Move it to the top to buy it now.");
  await page.getByRole('button', { name: 'Options for Phone case' }).click();
  await page.getByRole('button', { name: 'Move to top' }).click();
  await expect(page.getByText('Moved "Phone case" to the top.')).toBeVisible();
  await expect(cards.nth(0)).toContainText('Phone case');
  await expect(cards.nth(0)).toContainText('You can buy it!');
});

test('L7: undoing a goal buy offers to bring the goal back', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 50000)], // $100 in Goals
    goals: [{ id: 'g2', name: 'Shoes', targetCents: 5000 }],
    goalPurchases: [{ id: 'x1', date: '2026-11-07', cents: 8500, name: 'Concert tickets' }],
  }));
  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Undo buying Concert tickets ($85.00) from Nov 7, 2026' }).click();
  await page.getByRole('button', { name: 'Add it back' }).click();
  await expect(page.getByText('Concert tickets is back at the top, with its $85.00.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.goal-card').nth(0)).toContainText('Concert tickets');
  await expect(page.locator('.goal-card').nth(0)).toContainText('You can buy it!');
  await expect(page.locator('.goal-card').nth(1)).toContainText('$15 of $50');
});

test('L8: with tracking off, Your money shows everything that went into Spend', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 31247)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 1240, note: 'Snack' }],
  }));
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#money')).toContainText('Spend$156.24');
});

test('L9: buying a goal for more offers to take the extra from Spend', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 50000)], // $250 to spend, $100 to goals
    goals: [{ id: 'g1', name: 'Concert tickets', targetCents: 8500 }],
  }));
  await page.getByRole('button', { name: 'Buy it: Concert tickets' }).click();
  await page.getByLabel('What did it cost?').fill('120');
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.locator('#recent li').first()).toContainText('from Goals');
  await page.getByRole('button', { name: 'Take $35.00 from Spend' }).click();
  await expect(page.locator('#left-to-spend')).toHaveText('$215.00 left to spend');
  await expect(page.locator('#recent li').first()).toContainText('Extra for Concert tickets');
});

test('L11: Done asks before throwing away a new split, and old messages clear', async ({ page }) => {
  await open(page);
  await seed(page, airpods);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Spend %').fill('60');
  await page.getByLabel('Goals %').fill('10');
  await page.getByRole('button', { name: 'Save split' }).click();
  await expect(page.getByText('Saved. Paychecks you log from now on will be split 60% Spend, 30% Save, 10% Goals.')).toBeVisible();
  await page.getByLabel('Spend %').fill('70');
  await page.getByLabel('Goals %').fill('0');
  await expect(page.getByText(/^Saved\./)).toBeHidden();
  await expect(page.locator('#split-preview')).toContainText('AirPods: nothing goes to Goals with this split');

  /** @type {string[]} */
  const asked = [];
  page.once('dialog', (dialog) => { asked.push(dialog.message()); dialog.accept(); });
  await page.getByRole('button', { name: 'Done' }).click();
  expect(asked).toEqual(['Save your new split (70% Spend, 30% Save, 0% Goals)?']);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Goals %')).toHaveValue('0');
});

test('L12: "Skip for now" keeps a goal that was typed in, and "Log your first paycheck" can be tapped', async ({ page }) => {
  await open(page);
  await page.getByLabel('What is it?').fill('AirPods');
  await page.getByLabel('How much does it cost?').fill('250');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Not paid yet' }).click();
  await expect(page.locator('.goal-card').first()).toContainText('AirPods');
  await page.getByRole('button', { name: 'Log your first paycheck' }).click();
  await expect(page.getByRole('dialog', { name: 'How much did you get paid?' })).toBeVisible();
});

test('L13: a message about something undone or changed does not stay on Home', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 50000)], goals: [{ id: 'g1', name: 'Tickets', targetCents: 3000 }] }));
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText('Nice! $30.00 came out of Goals for Tickets.')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Undo buying Tickets ($30.00) from Nov 7, 2026' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Nice! $30.00 came out of Goals for Tickets.')).toBeHidden();
});

test('L13: messages on Home fade after a while', async ({ page }) => {
  await page.clock.install({ time: TODAY });
  await page.goto(APP);
  await welcome(page);
  await logPaycheck(page, '200');
  await page.getByRole('button', { name: '+ Add a goal' }).click();
  await page.getByLabel('Goal name').fill('Shoes');
  await page.getByLabel('Price').fill('50');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByText('Added "Shoes".')).toBeVisible();
  await page.clock.runFor(11_000);
  await expect(page.getByText('Added "Shoes".')).toBeHidden();
});

test('L14: a long wait is said in years', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 31247)], goals: [{ id: 'g1', name: 'Car', targetCents: 500000 }] }));
  await expect(page.locator('.goal-card').first()).toContainText('Ready in about 3 years (around Dec 1, 2029)');
});
