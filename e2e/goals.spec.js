// @ts-check
// Ticket 016: goals on the phone, including Buy it (SPEC.md "Buy it", decisions 7 and 8).
import { test, expect } from '@playwright/test';
import { open, seed, v2, welcome, logPaycheck, smallTargets, noSideScroll } from './helpers.js';

/** A paycheck of $200 today: $40 in Goals. Tickets ($30) is funded; Phone ($300) has $10. */
const twoGoals = v2({
  paychecks: [{ id: 'p1', date: '2026-11-07', cents: 20000, spend: 50, save: 30, goals: 20 }],
  goals: [{ id: 'g1', name: 'Tickets', targetCents: 3000 }, { id: 'g2', name: 'Phone', targetCents: 30000 }],
});

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} price
 */
async function addGoal(page, name, price) {
  await page.getByRole('button', { name: '+ Add a goal' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a goal' });
  await sheet.getByLabel('Goal name').fill(name);
  await sheet.getByLabel('Price').fill(price);
  await sheet.getByRole('button', { name: 'Save goal' }).click();
  await expect(sheet).toBeHidden();
}

const cards = (/** @type {import('@playwright/test').Page} */ page) => page.locator('.goal-card');

test('with no goals, Home invites one; adding it shows its card and date', async ({ page }) => {
  await open(page);
  await welcome(page);
  await logPaycheck(page, '200');
  await expect(page.getByText('Saving for something? Add a goal and Budgeteer will tell you when you can buy it.')).toBeVisible();
  await addGoal(page, 'Phone', '300');
  await expect(page.getByText('Added "Phone".')).toBeVisible();
  await expect(cards(page).first()).toContainText('$40 of $300');
  await expect(cards(page).first()).toContainText('Ready in about 14 weeks (around Feb 13, 2027)');
  await expect(page.getByText('Saving for something?')).toBeHidden();
});

test('the goal sheet explains mistakes and changes nothing', async ({ page }) => {
  await open(page);
  await welcome(page);
  await page.getByRole('button', { name: 'Not paid yet' }).click();
  await page.getByRole('button', { name: '+ Add a goal' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a goal' });
  await sheet.getByLabel('Price').fill('300');
  await sheet.getByRole('button', { name: 'Save goal' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Give your goal a name, like "New phone".');
  await sheet.getByLabel('Goal name').fill('Phone');
  await sheet.getByLabel('Price').fill('lots');
  await sheet.getByRole('button', { name: 'Save goal' }).click();
  await expect(sheet.getByRole('alert')).toHaveText("That doesn't look like an amount. Type it like 42.50.");
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(cards(page)).toHaveCount(0);
});

test('goals fill top to bottom; a funded goal offers "Buy it"', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await expect(cards(page).nth(0)).toContainText('$30 of $30');
  await expect(cards(page).nth(0)).toContainText('You can buy it!');
  await expect(page.getByRole('button', { name: 'Buy it: Tickets' })).toBeVisible();
  await expect(cards(page).nth(1)).toContainText('$10 of $300');
  await expect(page.getByRole('button', { name: 'Buy it: Phone' })).toHaveCount(0);
});

test('edit a goal: name and price change, and focus comes back to it', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Options for Phone' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit "Phone"' });
  await expect(sheet.getByLabel('Goal name')).toHaveValue('Phone');
  await expect(sheet.getByLabel('Price')).toHaveValue('300.00');
  await sheet.getByLabel('Goal name').fill('New phone');
  await sheet.getByLabel('Price').fill('250');
  await sheet.getByRole('button', { name: 'Save goal' }).click();
  await expect(cards(page).nth(1)).toContainText('New phone');
  await expect(cards(page).nth(1)).toContainText('$10 of $250');
  await expect(page.getByRole('button', { name: 'Options for New phone' })).toBeFocused();
});

test('move a goal up: it gets Goals money first', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Options for Tickets' }).click();
  await expect(page.getByRole('button', { name: 'Move up' })).toHaveCount(0); // already at the top
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Options for Phone' }).click();
  await page.getByRole('button', { name: 'Move up' }).click();
  await expect(page.getByText('Moved "Phone" up.')).toBeVisible();
  await expect(cards(page).nth(0)).toContainText('Phone');
  await expect(cards(page).nth(0)).toContainText('$40 of $300');
  await expect(cards(page).nth(1)).toContainText('$0 of $30');
});

test('remove a goal: it says where the money goes, and "no" keeps it', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  /** @type {string[]} */
  const asked = [];
  page.once('dialog', (dialog) => { asked.push(dialog.message()); dialog.dismiss(); });
  await page.getByRole('button', { name: 'Options for Tickets' }).click();
  await page.getByRole('button', { name: 'Remove this goal' }).click();
  await expect(cards(page)).toHaveCount(2);

  page.once('dialog', (dialog) => { asked.push(dialog.message()); dialog.accept(); });
  await page.getByRole('button', { name: 'Remove this goal' }).click();
  expect(asked).toEqual([
    'Remove "Tickets"? The money saved for it stays in Goals and goes to "Phone" next.',
    'Remove "Tickets"? The money saved for it stays in Goals and goes to "Phone" next.',
  ]);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('$40 of $300');
});

test('Buy it at the goal price takes it out of Goals and removes the goal', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  const sheet = page.getByRole('dialog', { name: 'Did you buy Tickets?' });
  await expect(sheet.getByLabel('What did it cost?')).toHaveValue('30.00');
  await expect(sheet.getByLabel('What did it cost?')).toHaveAttribute('inputmode', 'decimal');
  await sheet.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText('Nice! $30.00 came out of Goals for Tickets.')).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('$10 of $300');
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('$10 of $300');
});

test('Buy it for less leaves the rest for the next goal', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  await page.getByLabel('What did it cost?').fill('25');
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText('Nice! $25.00 came out of Goals for Tickets.')).toBeVisible();
  await expect(cards(page).first()).toContainText('$15 of $300');
});

test('Buy it for more takes only the goal price out of Goals, and says so', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  await page.getByLabel('What did it cost?').fill('45');
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText("Nice! $30.00 came out of Goals for Tickets. The extra $15.00 didn't come from Goals.")).toBeVisible();
  await expect(cards(page).first()).toContainText('$10 of $300');
});

test('the Buy it sheet explains a bad price and changes nothing', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  const sheet = page.getByRole('dialog', { name: 'Did you buy Tickets?' });
  await sheet.getByLabel('What did it cost?').fill('0');
  await sheet.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('The amount has to be more than $0.');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(cards(page)).toHaveCount(2);
});

test('with 0% to Goals the card says why there is no date', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    split: { spend: 70, save: 30, goals: 0 },
    paychecks: [{ id: 'p1', date: '2026-11-07', cents: 20000, spend: 70, save: 30, goals: 0 }],
    goals: [{ id: 'g1', name: 'Car', targetCents: 500000 }],
  }));
  await expect(cards(page).first()).toContainText('Your split puts nothing into Goals. Change it in Settings.');
});

test('goal sheets fit the phone and their targets are big enough', async ({ page }) => {
  await open(page);
  await seed(page, twoGoals);
  expect(await smallTargets(page)).toEqual([]);
  await page.getByRole('button', { name: 'Options for Phone' }).click();
  expect(await smallTargets(page)).toEqual([]);
  expect(await noSideScroll(page)).toBe(true);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Buy it: Tickets' }).click();
  expect(await smallTargets(page)).toEqual([]);
  expect(await noSideScroll(page)).toBe(true);
});
