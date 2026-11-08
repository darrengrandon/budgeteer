// @ts-check
// Ticket 008: the whole teen flow in one test, against the real page served by python3 -m http.server.
import { test, expect } from '@playwright/test';

test('a teen sets up, gets paid, saves for a goal, plays with the split, spends, and comes back later', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T16:30:00-06:00'));
  await page.goto('/index.html');

  // 1. Set the split: 60 / 25 / 15.
  await expect(page.getByRole('heading', { name: 'How should each paycheck be split?' })).toBeVisible();
  await page.getByLabel('Spend %').fill('60');
  await page.getByLabel('Save %').fill('25');
  await expect(page.getByText('Adds up to 105%. Take away 5.')).toBeVisible();
  await page.getByLabel('Goals %').fill('15');
  await expect(page.getByText('Adds up to 100%. Good to go.')).toBeVisible();
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByText('Each paycheck is split 60% Spend, 25% Save, 15% Goals.')).toBeVisible();

  // 2. Log a paycheck: $180 today.
  await expect(page.getByLabel('Date paid')).toHaveValue('2026-11-07');
  await page.getByLabel('Take-home amount').fill('180');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your $180.00' }))
    .toHaveText('Nice. Your $180.00 became $108.00 to spend, $45.00 saved, $27.00 for goals.');
  await expect(page.locator('#balance-spend')).toHaveText('$108.00');
  await expect(page.locator('#balance-save')).toHaveText('$45.00');
  await expect(page.locator('#balance-goals')).toHaveText('$27.00');

  // 3. Add a goal and read its weeks.
  //    Weekly pay over 28 days: $180 / 4 = $45. 15% of that = $6.75 a week.
  //    $120 - $27 = $93 left. 93 / 6.75 = 13.8, so about 14 weeks.
  await page.getByLabel('What are you saving for?').fill('Concert tickets');
  await page.getByLabel('How much does it cost?').fill('120');
  await page.getByRole('button', { name: 'Add goal' }).click();
  const goal = page.locator('#goal-list > li').first();
  await expect(goal).toContainText('Concert tickets');
  await expect(goal).toContainText('$27.00 of $120.00 saved');
  await expect(goal).toContainText('About 14 weeks to go.');

  // 4. Move the what-if slider from 15% to 30% Goals with the keyboard.
  //    $45 x 30% = $13.50 a week. 93 / 13.5 = 6.9, so about 7 weeks: 7 sooner.
  const slider = page.getByLabel('Goals share of each paycheck');
  await expect(slider).toHaveValue('15');
  await slider.focus();
  for (let i = 0; i < 15; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue('30');
  await expect(page.locator('#whatif-split')).toHaveText('Spend 45% · Save 25% · Goals 30%');
  await expect(page.getByText("That's about $13.50 a week into Goals.")).toBeVisible();
  await expect(page.locator('#whatif-goals')).toHaveText('Concert tickets: about 7 weeks (7 weeks sooner)');
  // Only trying it out: the real goal and split have not changed.
  await expect(goal).toContainText('About 14 weeks to go.');
  await expect(page.locator('#pct-goals')).toHaveText('15% of each paycheck');

  // 5. Log a purchase.
  await page.getByLabel('Amount spent').fill('25.50');
  await page.getByLabel('What was it for?').fill('Movie ticket');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logged.' }))
    .toHaveText('Logged. $25.50 came out of Spend. You have $82.50 left to spend.');
  await expect(page.locator('#balance-spend')).toHaveText('$82.50');

  // 6. Try to overspend by one cent: blocked, and it says how much is available.
  await page.getByLabel('Amount spent').fill('82.51');
  await page.getByLabel('What was it for?').fill('Sneakers');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.getByRole('alert')).toHaveText("That's more than you have. You have $82.50 left to spend.");
  await expect(page.locator('#balance-spend')).toHaveText('$82.50');
  await expect(page.locator('#history li')).toHaveCount(2);

  // 7. Reload: everything that was saved is still there, and the untried split was not saved.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your money' })).toBeVisible();
  await expect(page.locator('#balance-spend')).toHaveText('$82.50');
  await expect(page.locator('#balance-save')).toHaveText('$45.00');
  await expect(page.locator('#balance-goals')).toHaveText('$27.00');
  await expect(page.getByText('Each paycheck is split 60% Spend, 25% Save, 15% Goals.')).toBeVisible();
  await expect(goal).toContainText('Concert tickets');
  await expect(goal).toContainText('$27.00 of $120.00 saved');
  await expect(goal).toContainText('About 14 weeks to go.');
  await expect(page.getByLabel('Goals share of each paycheck')).toHaveValue('15');
  const history = page.locator('#history li');
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText('Movie ticket');
  await expect(history.nth(0)).toContainText('−$25.50');
  await expect(history.nth(1)).toContainText('Paycheck');
  await expect(history.nth(1)).toContainText('+$180.00');
  await expect(page.getByText('Sneakers')).toHaveCount(0);
});
