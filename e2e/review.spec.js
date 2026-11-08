// @ts-check
// Ticket 009: browser tests for the fresh-eyes review findings (see REVIEW.md, U* and C*).
import { test, expect } from '@playwright/test';

const NOW = new Date('2026-11-07T10:00:00-06:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/index.html');
});

/** @param {import('@playwright/test').Page} page */
async function start(page) {
  await page.getByRole('button', { name: 'Start budgeting' }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 * @param {string} [date]
 */
async function logPaycheck(page, amount, date) {
  await page.getByLabel('Take-home amount').fill(amount);
  if (date) await page.getByLabel('Date paid').fill(date);
  await page.getByRole('button', { name: 'Add paycheck' }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {object} data
 */
async function restore(page, name, data) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Restore (a )?backup$/ }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
}

test('U1: a second open tab picks up changes instead of erasing them', async ({ page }) => {
  await start(page);
  await logPaycheck(page, '100');
  const other = await page.context().newPage();
  await other.clock.setFixedTime(NOW);
  await other.goto('/index.html');
  await expect(other.locator('#balance-spend')).toHaveText('$50.00');

  await logPaycheck(page, '50');
  await expect(other.locator('#balance-spend')).toHaveText('$75.00'); // updated without a reload
  await logPaycheck(other, '20');
  await expect(page.locator('#balance-spend')).toHaveText('$85.00');

  await page.reload();
  await expect(page.locator('#history li')).toHaveCount(3);
  await expect(page.locator('#balance-spend')).toHaveText('$85.00');
});

test('U1: if another tab saved and this tab missed it, nothing is overwritten', async ({ page }) => {
  await start(page);
  await logPaycheck(page, '100');
  // Another tab writes while this one is asleep (a page does not get events for its own writes).
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('budgeteer.v1') ?? '');
    saved.paychecks.push({ id: 'p2', date: '2026-11-07', cents: 4000, spend: 50, save: 30, goals: 20 });
    localStorage.setItem('budgeteer.v1', JSON.stringify(saved));
  });
  await logPaycheck(page, '7');
  await expect(page.getByText('Budgeteer was changed in another tab, so this page has been updated. Please try that again.')).toBeVisible();
  await expect(page.locator('#balance-spend')).toHaveText('$70.00'); // $100 + $40 from the other tab, not the $7
  await page.reload();
  await expect(page.locator('#history li')).toHaveCount(2);
});

test('U2: a purchase note pasted with a tab in it still logs', async ({ page }) => {
  await start(page);
  await logPaycheck(page, '100');
  await page.getByLabel('Amount spent').fill('1');
  await page.getByLabel('What was it for?').fill('Tab\there');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.locator('#history li').first()).toContainText('Tab here');
  await expect(page.locator('#balance-spend')).toHaveText('$49.00');
});

test('U3: every entry can be shown and removed, and a wrong year is caught', async ({ page }) => {
  await start(page);
  for (let day = 1; day <= 25; day++) await logPaycheck(page, '10', `2026-10-${String(day).padStart(2, '0')}`);
  await expect(page.locator('#history li')).toHaveCount(20);
  await page.getByRole('button', { name: 'Show all 25' }).click();
  await expect(page.locator('#history li')).toHaveCount(25);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove paycheck of $10.00 from Oct 1, 2026' }).click();
  await expect(page.locator('#history li')).toHaveCount(24);
  await expect(page.locator('#balance-spend')).toHaveText('$120.00');

  await logPaycheck(page, '10', '1999-01-01');
  await expect(page.getByRole('alert')).toHaveText("That's more than 2 years ago. Check the year.");
});

test('U5: paychecks older than 4 weeks get their own message', async ({ page }) => {
  await start(page);
  await logPaycheck(page, '500', '2026-09-01');
  await page.getByLabel('What are you saving for?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await expect(page.locator('#goal-list > li').first())
    .toContainText("No paychecks in the last 4 weeks, so there's no estimate yet. Log your next one to see the weeks to go.");
  await expect(page.locator('#whatif-weekly')).toHaveText('No paychecks in the last 4 weeks, so there are no estimates yet.');
});

test('U7: a backup with dates after tomorrow is refused', async ({ page }) => {
  const future = {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [{ id: 'p1', date: '2026-11-09', cents: 10000, spend: 50, save: 30, goals: 20 }],
    purchases: [],
    goals: [],
  };
  await restore(page, 'future.json', future);
  await expect(page.getByRole('alert'))
    .toHaveText("That file couldn't be restored, so nothing was changed. Paycheck 1's date is in the future.");
});

test('C3: a backup with very high ids keeps working after more entries are added', async ({ page }) => {
  const high = {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [{ id: 'p999999999', date: '2026-11-01', cents: 10000, spend: 50, save: 30, goals: 20 }],
    purchases: [],
    goals: [],
  };
  await restore(page, 'high.json', high);
  await logPaycheck(page, '20');
  await page.reload();
  await expect(page.locator('#notice')).toBeHidden();
  await expect(page.locator('#balance-spend')).toHaveText('$60.00');
});

test('U8: saved data that cannot be read can be downloaded to get help', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('budgeteer.v1', '{not json'));
  await page.reload();
  await expect(page.locator('#notice')).toContainText("Your saved info couldn't be read");
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the unreadable data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('budgeteer-unreadable-2026-11-07.txt');
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk;
  expect(text).toBe('{not json');
});

test('U10: the paycheck and purchase forms come right after the balances', async ({ page }) => {
  await start(page);
  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(headings.slice(0, 4)).toEqual(['Your money', 'Log a paycheck', 'Log a purchase', 'Goals']);
});

test('U11: each error shows once, right next to the box it is about', async ({ page }) => {
  await page.getByLabel('Spend %').fill('60');
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  await expect(page.getByText('Adds up to 110%. Take away 10.').filter({ visible: true })).toHaveCount(1);

  await page.getByLabel('Spend %').fill('50');
  await start(page);
  await logPaycheck(page, '100');
  await page.getByLabel('Amount spent').fill('500');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  const amountField = page.locator('.field').filter({ has: page.getByLabel('Amount spent') });
  await expect(amountField.getByRole('alert')).toHaveText("That's more than you have. You have $50.00 left to spend.");

  await logPaycheck(page, '10', '2026-11-08');
  const dateField = page.locator('.field').filter({ has: page.getByLabel('Date paid') });
  await expect(dateField.getByRole('alert')).toHaveText("That date hasn't happened yet. Pick today or an earlier day.");
});

test('U12: Escape closes "Change your split", and focus returns after editing a goal', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Change my split' }).click();
  await expect(page.getByRole('heading', { name: 'Change your split' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Your money' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change my split' })).toBeFocused();

  await page.getByLabel('What are you saving for?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await page.getByRole('button', { name: 'Edit Phone' }).click();
  await page.getByLabel('What are you saving for?').fill('New phone');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit New phone' })).toBeFocused();
});

test('U6: removing a goal says where its money goes', async ({ page }) => {
  await start(page);
  for (const [name, target] of [['Tickets', '30'], ['Phone', '300']]) {
    await page.getByLabel('What are you saving for?').fill(name);
    await page.getByLabel('How much does it cost?').fill(target);
    await page.getByRole('button', { name: 'Add goal' }).click();
  }
  /** @type {string[]} */
  const messages = [];
  page.on('dialog', (dialog) => { messages.push(dialog.message()); dialog.dismiss(); });
  await page.getByRole('button', { name: 'Remove Tickets' }).click();
  await page.getByRole('button', { name: 'Remove Phone' }).click();
  expect(messages).toEqual([
    'Remove the goal "Tickets"? The money saved for it stays in your Goals bucket and goes to "Phone" next.',
    'Remove the goal "Phone"? The money saved for it stays in your Goals bucket for future goals.',
  ]);
});
