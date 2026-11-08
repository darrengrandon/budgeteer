// @ts-check
// Ticket 006 in a real browser: the what-if slider changes weeks live and saves nothing until asked.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00-06:00'));
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Start budgeting' }).click(); // 50 / 30 / 20
  await page.getByLabel('Take-home amount').fill('400');
  await page.getByRole('button', { name: 'Add paycheck' }).click(); // $80 to goals, $100 a week average
  await page.getByLabel('What are you saving for?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Add goal' }).click(); // $220 left at $20 a week: 11 weeks
});

/** @param {import('@playwright/test').Page} page */
const savedState = (page) => page.evaluate(() => localStorage.getItem('budgeteer.v1'));

test('moving the slider updates the weeks live and saves nothing', async ({ page }) => {
  const slider = page.getByLabel('Goals share of each paycheck');
  await expect(slider).toHaveValue('20');
  await expect(slider).toHaveAttribute('max', '70');
  await expect(page.locator('#whatif-split')).toHaveText('Spend 50% · Save 30% · Goals 20%');
  await expect(page.locator('#whatif-goals')).toHaveText('Phone: about 11 weeks (same as now)');
  await expect(page.getByRole('button', { name: 'Use this split' })).toBeDisabled();
  const before = await savedState(page);

  // Keyboard: ten steps toward Goals.
  await slider.focus();
  for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue('30');
  await expect(page.locator('#whatif-split')).toHaveText('Spend 40% · Save 30% · Goals 30%');
  await expect(page.getByText("That's about $30.00 a week into Goals.")).toBeVisible();
  await expect(page.locator('#whatif-goals')).toHaveText('Phone: about 8 weeks (3 weeks sooner)'); // 220/30 = 7.3

  // Less to Goals makes it later.
  await slider.fill('10');
  await expect(page.locator('#whatif-goals')).toHaveText('Phone: about 22 weeks (11 weeks later)'); // 220/10

  // The real numbers and the saved data have not changed.
  await expect(page.locator('#goal-list > li').first()).toContainText('About 11 weeks to go.');
  await expect(page.locator('#pct-goals')).toHaveText('20% of each paycheck');
  expect(await savedState(page)).toBe(before);

  // Back to my split.
  await page.getByRole('button', { name: 'Back to my split' }).click();
  await expect(slider).toHaveValue('20');

  // Reloading forgets an unapplied trial.
  await slider.fill('60');
  await page.reload();
  await expect(page.getByLabel('Goals share of each paycheck')).toHaveValue('20');
  expect(await savedState(page)).toBe(before);
});

test('"Use this split" applies the trial to future paychecks only', async ({ page }) => {
  await page.getByLabel('Goals share of each paycheck').fill('40');
  await page.getByRole('button', { name: 'Use this split' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Done.' }))
    .toHaveText('Done. Paychecks you log from now on will be split 30% Spend, 30% Save, 40% Goals.');
  await expect(page.locator('#pct-goals')).toHaveText('40% of each paycheck');
  await expect(page.locator('#goal-list > li').first()).toContainText('About 6 weeks to go.'); // 220/40 = 5.5

  // The old paycheck kept its 50/30/20 split.
  await expect(page.locator('#balance-spend')).toHaveText('$200.00');
  await expect(page.locator('#balance-goals')).toHaveText('$80.00');

  await page.getByLabel('Take-home amount').fill('100');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.locator('#balance-spend')).toHaveText('$230.00');
  await expect(page.locator('#balance-goals')).toHaveText('$120.00');

  await page.reload();
  await expect(page.getByLabel('Goals share of each paycheck')).toHaveValue('40');
  await expect(page.getByText('Each paycheck is split 30% Spend, 30% Save, 40% Goals.')).toBeVisible();
});
