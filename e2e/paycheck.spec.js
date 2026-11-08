// @ts-check
// Ticket 003 in a real browser: choose a split, log paychecks, reload, and bad amounts change nothing.
import { test, expect } from '@playwright/test';

const TODAY = new Date('2026-11-07T10:00:00-06:00'); // a Saturday morning in America/Chicago

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/index.html');
});

test('first run: the split must total 100 before you can start', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'How should each paycheck be split?' })).toBeVisible();
  await expect(page.getByLabel('Spend %')).toHaveValue('50');
  await expect(page.getByLabel('Save %')).toHaveValue('30');
  await expect(page.getByLabel('Goals %')).toHaveValue('20');
  await expect(page.getByText('Adds up to 100%. Good to go.')).toBeVisible();

  await page.getByLabel('Spend %').fill('60');
  await expect(page.getByText('Adds up to 110%. Take away 10.')).toBeVisible();
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByRole('alert')).toHaveText('Adds up to 110%. Take away 10.');
  await expect(page.getByRole('heading', { name: 'Log a paycheck' })).toBeHidden();

  await page.getByLabel('Spend %').fill('');
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use whole numbers from 0 to 100 in each box.');

  await page.getByRole('button', { name: 'Use 50 / 30 / 20' }).click();
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByRole('heading', { name: 'Log a paycheck' })).toBeVisible();
  await expect(page.getByLabel('Take-home amount')).toBeFocused();
});

test('log three paychecks, reload, and everything is still there', async ({ page }) => {
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByLabel('Date paid')).toHaveValue('2026-11-07');

  await page.getByLabel('Take-home amount').fill('42.50');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your' }))
    .toHaveText('Nice. Your $42.50 became $21.25 to spend, $12.75 saved, $8.50 for goals.');
  await expect(page.getByLabel('Take-home amount')).toHaveValue('');

  await page.getByLabel('Take-home amount').fill('$100.01');
  await page.getByLabel('Date paid').fill('2026-11-01');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText('Your $100.01 became $50.01 to spend, $30.00 saved, $20.00 for goals.')).toBeVisible();

  await page.getByLabel('Take-home amount').fill('1,234');
  await page.getByRole('button', { name: 'Add paycheck' }).click();

  // 42.50 + 100.01 + 1234.00 = 1376.51 -> spend 21.25+50.01+617.00, save 12.75+30.00+370.20, goals 8.50+20.00+246.80
  const expectBalances = async () => {
    await expect(page.locator('#balance-spend')).toHaveText('$688.26');
    await expect(page.locator('#balance-save')).toHaveText('$412.95');
    await expect(page.locator('#balance-goals')).toHaveText('$275.30');
  };
  await expectBalances();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Log a paycheck' })).toBeVisible();
  await expectBalances();
});

test('bad amounts and dates show a friendly message and change nothing', async ({ page }) => {
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByLabel('Take-home amount').fill('10');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.locator('#balance-spend')).toHaveText('$5.00');

  const amount = page.getByLabel('Take-home amount');
  const cases = [
    ['', 'Type an amount, like 42.50.'],
    ['-20', "The amount can't be negative."],
    ['twenty', "That doesn't look like an amount. Type it like 42.50."],
    ['12.345', 'Amounts only go down to cents, so use at most 2 digits after the dot.'],
    ['0', 'The amount has to be more than $0.'],
  ];
  for (const [text, message] of cases) {
    await amount.fill(text);
    await page.getByRole('button', { name: 'Add paycheck' }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(amount).toBeFocused();
  }

  await amount.fill('25');
  await page.getByLabel('Date paid').fill('2026-11-08');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByRole('alert')).toHaveText("That date hasn't happened yet. Pick today or an earlier day.");

  // Nothing changed, even after a reload.
  await expect(page.locator('#balance-spend')).toHaveText('$5.00');
  await page.reload();
  await expect(page.locator('#balance-spend')).toHaveText('$5.00');
  await expect(page.locator('#balance-save')).toHaveText('$3.00');
  await expect(page.locator('#balance-goals')).toHaveText('$2.00');
});

test('changing the split later only affects new paychecks', async ({ page }) => {
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByLabel('Take-home amount').fill('100');
  await page.getByRole('button', { name: 'Add paycheck' }).click();

  await page.getByRole('button', { name: 'Change my split' }).click();
  await expect(page.getByRole('heading', { name: 'Change your split' })).toBeVisible();
  await page.getByLabel('Spend %').fill('40');
  await page.getByLabel('Goals %').fill('30');
  await page.getByRole('button', { name: 'Save split' }).click();
  await expect(page.getByText('Each paycheck is split 40% Spend, 30% Save, 30% Goals.')).toBeVisible();

  await page.getByLabel('Take-home amount').fill('100');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.locator('#balance-spend')).toHaveText('$90.00');
  await expect(page.locator('#balance-save')).toHaveText('$60.00');
  await expect(page.locator('#balance-goals')).toHaveText('$50.00');
});

test('the page makes no network requests beyond its own files', async ({ page }) => {
  /** @type {string[]} */
  const outside = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:8137/')) outside.push(request.url());
  });
  await page.reload();
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await page.getByLabel('Take-home amount').fill('10');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  expect(outside).toEqual([]);
});
