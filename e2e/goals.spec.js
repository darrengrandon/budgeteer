// @ts-check
// Ticket 005 in a real browser: goals fill top to bottom and the weeks change as paychecks come in.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00-06:00'));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Start budgeting' }).click(); // 50 / 30 / 20
});

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 * @param {string} date
 */
async function logPaycheck(page, amount, date) {
  await page.getByLabel('Take-home amount').fill(amount);
  await page.getByLabel('Date paid').fill(date);
  await page.getByRole('button', { name: 'Add paycheck' }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} target
 */
async function addGoal(page, name, target) {
  await page.getByLabel('What are you saving for?').fill(name);
  await page.getByLabel('How much does it cost?').fill(target);
  await page.getByRole('button', { name: 'Add goal' }).click();
}

test('weeks to go change as paychecks are added, and goals fill top to bottom', async ({ page }) => {
  const goals = page.locator('#goal-list > li');
  await expect(page.getByText('No goals yet. What are you saving up for?')).toBeVisible();

  await addGoal(page, 'Phone', '300');
  await expect(page.getByText('Added "Phone".')).toBeVisible();
  await expect(goals.nth(0)).toContainText('$0.00 of $300.00 saved');
  await expect(goals.nth(0)).toContainText('Log a paycheck to see a date.');
  await expect(goals.nth(0)).not.toContainText('Infinity');

  // $200 today: $40 to goals. Weekly pay 200/4 = $50, 20% = $10 a week. $260 left: 26 weeks.
  await logPaycheck(page, '200', '2026-11-07');
  await expect(goals.nth(0)).toContainText('$40.00 of $300.00 saved');
  await expect(goals.nth(0)).toContainText('About 26 weeks to go.');

  // Another $200 a week ago: $80 saved, $20 a week. $220 left: 11 weeks.
  await logPaycheck(page, '200', '2026-10-31');
  await expect(goals.nth(0)).toContainText('$80.00 of $300.00 saved');
  await expect(goals.nth(0)).toContainText('About 11 weeks to go.');

  // A second goal waits for the first: $350 total, $270 left at $20 a week = 13.5 -> 14 weeks.
  await addGoal(page, 'Concert tickets', '50');
  await expect(goals.nth(1)).toContainText('$0.00 of $50.00 saved');
  await expect(goals.nth(1)).toContainText('About 14 weeks to go.');

  // Move it to the top: it takes the first $50 and is finished.
  await page.getByRole('button', { name: 'Move Concert tickets up' }).click();
  await expect(goals.nth(0)).toContainText('Concert tickets');
  await expect(goals.nth(0)).toContainText('$50.00 of $50.00 saved');
  await expect(goals.nth(0)).toContainText('Done! You saved enough for this.');
  await expect(goals.nth(1)).toContainText('$30.00 of $300.00 saved');
  await expect(page.getByRole('button', { name: 'Move Concert tickets down' })).toBeFocused();

  // Rename and change the target: $250 + $50 = $300 total, $220 left: 11 weeks.
  await page.getByRole('button', { name: 'Edit Phone' }).click();
  await expect(page.getByLabel('What are you saving for?')).toHaveValue('Phone');
  await expect(page.getByLabel('How much does it cost?')).toHaveValue('300.00');
  await page.getByLabel('What are you saving for?').fill('New phone');
  await page.getByLabel('How much does it cost?').fill('250');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(goals.nth(1)).toContainText('New phone');
  await expect(goals.nth(1)).toContainText('About 11 weeks to go.');
  await expect(page.getByRole('button', { name: 'Add goal' })).toBeVisible();

  // Remove the finished goal: its money flows to the phone. $80 of $250, $170 left: 8.5 -> 9 weeks.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove Concert tickets' }).click();
  await expect(goals).toHaveCount(1);
  await expect(goals.nth(0)).toContainText('$80.00 of $250.00 saved');
  await expect(goals.nth(0)).toContainText('About 9 weeks to go.');

  await page.reload();
  await expect(goals).toHaveCount(1);
  await expect(goals.nth(0)).toContainText('New phone');
  await expect(goals.nth(0)).toContainText('About 9 weeks to go.');
});

test('goal form explains mistakes and money beyond every goal is pointed out', async ({ page }) => {
  await page.getByLabel('How much does it cost?').fill('100');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await expect(page.getByRole('alert')).toHaveText('Give your goal a name, like "New phone".');

  await page.getByLabel('What are you saving for?').fill('Shoes');
  await page.getByLabel('How much does it cost?').fill('lots');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await expect(page.getByRole('alert')).toHaveText("That doesn't look like an amount. Type it like 42.50.");
  await expect(page.locator('#goal-list > li')).toHaveCount(0);

  await page.getByLabel('How much does it cost?').fill('10');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await logPaycheck(page, '100', '2026-11-07'); // $20 to goals, $10 more than Shoes needs
  await expect(page.getByText('You have $10.00 in Goals that no goal needs right now.')).toBeVisible();
});

test('a split with 0% to Goals explains why there is no date', async ({ page }) => {
  await page.getByRole('button', { name: 'Change my split' }).click();
  await page.getByLabel('Spend %').fill('70');
  await page.getByLabel('Goals %').fill('0');
  await page.getByRole('button', { name: 'Save split' }).click();
  await addGoal(page, 'Car', '5000');
  await logPaycheck(page, '100', '2026-11-07');
  await expect(page.locator('#goal-list > li').first())
    .toContainText("Your split puts 0% into Goals, so this won't fill up. Change your split to get here.");
});
