// @ts-check
// Tap-to-explain on every number on Home (lazy-v2 step 3a).
import { test, expect } from '@playwright/test';
import { open, seed, v2, smallTargets } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });
const GOALS = [{ id: 'g1', name: 'Phone', targetCents: 30000 }, { id: 'g2', name: 'Shoes', targetCents: 5000 }];

/**
 * Tap a number and check its sentence shows right under it.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} number
 * @param {string} sentence
 */
async function explains(page, number, sentence) {
  await number.click();
  await expect(number).toHaveAttribute('aria-expanded', 'true');
  const box = page.locator(`#${await number.getAttribute('aria-controls')}`);
  await expect(box).toBeVisible();
  await expect(box).toHaveText(sentence);
}

test('the headline, the pay line and each goal\'s numbers explain themselves', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: GOALS }));
  await explains(page, page.locator('#headline'),
    'You get about $100 a week and 50% of each paycheck goes to Spend, so about $50 a week is yours to spend.');
  await explains(page, page.locator('#basis'),
    "Your payday was $200.00, and until you log another one Budgeteer guesses you get paid every 2 weeks, so that's about $100 a week.");
  const [phone, shoes] = [page.locator('.goal-card').nth(0), page.locator('.goal-card').nth(1)];
  await explains(page, phone.getByRole('button', { name: '$40 of $300' }),
    'You have $40 saved toward Phone, which costs $300, so $260 to go.');
  await explains(page, phone.getByRole('button', { name: 'Ready around Feb 13, 2027 (in about 14 weeks)' }),
    'About $40 of each paycheck goes to Goals, so the $260 still needed should be there by the payday around Feb 13, 2027.');
  await explains(page, shoes.getByRole('button', { name: '$0 of $50' }),
    'Goals money fills your goals from the top, so Shoes has $0 of its $50 so far, with $50 to go.');
  await explains(page, shoes.getByRole('button', { name: /^Ready around/ }),
    'About $40 of each paycheck goes to Goals, and the $310 needed for this goal and the ones above it should be there by the payday around Feb 27, 2027.');
});

test('a second tap closes it, and only one is open at a time', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: GOALS }));
  const headline = page.locator('#headline');
  const basis = page.locator('#basis');
  await headline.click();
  await basis.click();
  await expect(headline).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#headline-explain')).toBeHidden();
  await expect(basis).toHaveAttribute('aria-expanded', 'true');
  await basis.click();
  await expect(basis).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#basis-explain')).toBeHidden();
});

test('it works from the keyboard', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 20000)] }));
  await page.locator('#headline').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#headline-explain')).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.locator('#headline-explain')).toBeHidden();
});

test('with tracking on, "left to spend" and each latest amount explain themselves', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 500, note: 'Snack' }],
  }));
  await explains(page, page.locator('#left-to-spend'),
    "Your paychecks put $100.00 into Spend and you've logged $5.00 of purchases, so $95.00 is left.");
  const recent = page.locator('#recent');
  await explains(page, recent.getByRole('button', { name: '−$5.00' }), 'This $5.00 purchase came out of Spend.');
  await explains(page, recent.getByRole('button', { name: '+$200.00' }),
    'This $200.00 paycheck put $100.00 into Spend, $60.00 into Save and $40.00 into Goals.');
});

test('every number on Home can be tapped, and every tap target is big enough', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 500, note: 'Snack' }],
    goals: GOALS,
  }));
  // Any text on Home with a digit in it, except dates in the latest list and passing messages.
  const unexplained = await page.evaluate(() => [...document.querySelectorAll('#home *')]
    .filter((node) => !node.closest('[hidden], .explain, .history-when, .status-row'))
    .filter((node) => [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && /\d/.test(child.textContent ?? '')))
    .filter((node) => !node.closest('[aria-expanded]'))
    .map((node) => node.textContent));
  expect(unexplained).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  const tappable = await page.locator('#home [role="button"][aria-expanded]').evaluateAll((nodes) =>
    nodes.map((n) => { const box = n.getBoundingClientRect(); return box.height >= 24 ? '' : `${n.textContent} ${box.height}`; }).filter(Boolean));
  expect(tappable).toEqual([]);
});

test('lines without a number are not tappable, and the first-run headline still opens the paycheck sheet', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-11-07', 200000)], goals: [GOALS[0]] }));
  await expect(page.getByText('You can buy it!')).not.toHaveAttribute('role', 'button');
  await seed(page, v2({ goals: [GOALS[0]] }));
  await expect(page.getByText('Log a paycheck to see when.')).not.toHaveAttribute('role', 'button');
  await page.getByRole('button', { name: 'Log your first paycheck' }).click();
  await expect(page.locator('#pay-sheet')).toBeVisible();
});
