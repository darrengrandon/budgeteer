// @ts-check
// The whole lazy-teen flow in one test, at iPhone and Pixel sizes (ticket 019, replaces ticket 008's).
// Promise: "Log your paycheck. Budgeteer tells you what to spend and when you can buy your thing."
import { test, expect } from '@playwright/test';
import { APP } from './helpers.js';

/** @param {string} day 'YYYY-MM-DD', morning in America/Chicago */
const on = (day) => new Date(`${day}T10:00:00-06:00`);

test('a lazy teen names a goal, logs paychecks, buys the thing, and is nudged when they forget', async ({ page }) => {
  // Day 1 (Sat Nov 7): first run, no setup screen.
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(APP);
  await page.getByLabel('What is it?').fill('Concert tickets');
  await page.getByLabel('How much does it cost?').fill('90');
  await page.getByRole('button', { name: 'Next' }).click();

  const first = page.getByRole('dialog', { name: 'How much was your paycheck?' });
  await first.getByLabel('Take-home amount').fill('180');
  await first.getByRole('button', { name: 'Add paycheck' }).click();
  // $180 every 2 weeks = $90 a week. Goals: 20% = $18 a week. $90 - $36 = $54 left: 3 weeks.
  await expect(first.getByText('Nice. Your $180.00 became $90.00 to spend (about $45 a week), $54.00 saved, $36.00 for goals.')).toBeVisible();
  await expect(first.getByText('Concert tickets: ready around Dec 5 (in about 4 weeks)')).toBeVisible();
  await first.getByRole('button', { name: 'Done' }).click();

  await expect(page.locator('#headline')).toHaveText('Spend about $45 a week');
  await expect(page.getByText('Out of about $90 a week of pay.')).toBeVisible();
  const card = page.locator('.goal-card').first();
  await expect(card).toContainText('$36 of $90');
  await expect(card).toContainText('Ready around Dec 5 (in about 4 weeks)');

  // Curious about a different split: the preview changes, nothing is saved.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Spend %').fill('40');
  await page.getByLabel('Goals %').fill('30');
  await expect(page.locator('#split-preview')).toContainText('Concert tickets: ready around Nov 21 (in about 2 weeks)');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $45 a week');

  // Two weeks later: paid again. One tap for the same amount.
  await page.clock.setFixedTime(on('2026-11-21'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Got paid? Log it.' })).toBeHidden(); // 14 days is on time
  await page.getByRole('button', { name: 'I got paid' }).click();
  const sheet = page.getByRole('dialog', { name: 'How much did you get paid?' });
  await sheet.getByRole('button', { name: 'Same as last time ($180.00)' }).click();
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText('Concert tickets: ready around Dec 5 (in about 2 weeks)')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();

  // Two weeks later again: the goal is funded, and they buy it for a bit less.
  await page.clock.setFixedTime(on('2026-12-05'));
  await page.reload();
  await page.getByRole('button', { name: 'I got paid' }).click();
  await sheet.getByRole('button', { name: 'Same as last time ($180.00)' }).click();
  await sheet.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(sheet.getByText('Concert tickets: you can buy it!')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(card).toContainText('You can buy it!');
  await page.getByRole('button', { name: 'Buy it: Concert tickets' }).click();
  await page.getByLabel('What did it cost?').fill('85');
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText('Nice! $85.00 came out of Goals for Concert tickets.')).toBeVisible();
  await expect(page.locator('.goal-card')).toHaveCount(0);
  await expect(page.getByText('Saving for something? Add a goal and Budgeteer will tell you when you can buy it.')).toBeVisible();

  // They forget to log the next paycheck. 17 days later the app nudges them, once, gently.
  await page.clock.setFixedTime(on('2026-12-22'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Got paid? Log it.' })).toBeVisible();
  await expect(page.locator('#headline')).toHaveText('Spend about $45 a week'); // doesn't drop while they forget

  // Later they decide to track spending: a purchase, and one cent too many is blocked.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Track my spending' }).click();
  await expect(page.locator('#history li')).toHaveCount(4); // 3 paychecks and the buy
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#left-to-spend')).toHaveText('$270.00 left to spend');
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  await page.getByLabel('Amount spent').fill('270.01');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.getByRole('alert')).toHaveText("That's more than you have. You have $270.00 left to spend.");
  await page.getByLabel('Amount spent').fill('20');
  await page.getByLabel('What was it for? (optional)').fill('Pizza');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.locator('#left-to-spend')).toHaveText('$250.00 left to spend');

  // Everything is still there after closing and reopening.
  await page.reload();
  await expect(page.locator('#left-to-spend')).toHaveText('$250.00 left to spend');
  await expect(page.locator('#headline')).toHaveText('Spend about $45 a week');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#history li').first()).toContainText('Pizza');
  await expect(page.locator('#history')).toContainText('Bought: Concert tickets');
});
