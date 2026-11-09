// @ts-check
// Ticket 017: Settings on the phone (SPEC.md "Settings").
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { APP, TODAY, open, seed, v2, smallTargets, noSideScroll, STORAGE_KEY } from './helpers.js';

const P = (/** @type {string} */ id, /** @type {string} */ date, /** @type {number} */ cents) =>
  ({ id, date, cents, spend: 50, save: 30, goals: 20 });

/** $200 today, a $300 phone: $40 saved, $100 a week of pay. */
const paid = v2({ paychecks: [P('p1', '2026-11-07', 20000)], goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }] });

/** @param {import('@playwright/test').Page} page */
async function openSettings(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await expect(sheet).toBeVisible();
  return sheet;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {string} text
 * @param {string} button
 */
async function restoreFile(page, name, text, button) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

/** @param {import('@playwright/test').Page} page */
async function screen(page) {
  return {
    headline: await page.locator('#headline').textContent(),
    goals: await page.locator('#goal-cards').innerText(),
  };
}

test('Settings opens from the gear and closes with Done', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const sheet = await openSettings(page);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
});

test('changing the split previews the new numbers and saves only on "Save split"', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const sheet = await openSettings(page);
  await expect(sheet.getByLabel('Spend %')).toHaveValue('50');
  await expect(sheet.getByLabel('Save %')).toHaveValue('30');
  await expect(sheet.getByLabel('Goals %')).toHaveValue('20');
  await expect(sheet.getByLabel('Spend %')).toHaveAttribute('inputmode', 'numeric');

  await sheet.getByLabel('Spend %').fill('40');
  await sheet.getByLabel('Goals %').fill('30');
  await expect(sheet.getByText('Adds up to 100%. Good to go.')).toBeVisible();
  const preview = sheet.locator('#split-preview');
  await expect(preview).toContainText('Spend about $40 a week');
  await expect(preview).toContainText('Phone: ready around Jan 16, 2027 (in about 10 weeks)');

  // Not saved yet: closing and reloading keeps the old split.
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await page.reload();
  const again = await openSettings(page);
  await expect(again.getByLabel('Spend %')).toHaveValue('50');

  await again.getByLabel('Spend %').fill('40');
  await again.getByLabel('Goals %').fill('30');
  await again.getByRole('button', { name: 'Save split' }).click();
  await expect(again.getByText('Saved. Paychecks you log from now on will be split 40% Spend, 30% Save, 30% Goals.')).toBeVisible();
  // The paycheck already logged keeps its 50/30/20 split.
  await expect(again.locator('#money')).toContainText('Spend$100.00');
  await expect(again.locator('#money')).toContainText('Goals$40.00');
  await again.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $40 a week');
  await expect(page.locator('.goal-card').first()).toContainText('Ready around Jan 16, 2027 (in about 10 weeks)');
});

test('a split that does not total 100 is explained and not saved', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const sheet = await openSettings(page);
  await sheet.getByLabel('Spend %').fill('60');
  await expect(sheet.getByText('Adds up to 110%. Take away 10.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Save split' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Adds up to 110%. Take away 10.');
  await expect(sheet.getByText('Adds up to 110%. Take away 10.').filter({ visible: true })).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
});

test('Your money shows each bucket', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const money = (await openSettings(page)).locator('#money');
  await expect(money).toContainText('Spend$100.00');
  await expect(money).toContainText('Save$60.00');
  await expect(money).toContainText('Goals$40.00');
});

test('History lists everything newest first, and Remove fixes a mistake', async ({ page }) => {
  await open(page);
  await seed(page, v2({ paychecks: [P('p1', '2026-10-24', 20000), P('p2', '2026-11-07', 2000000)] }));
  const sheet = await openSettings(page);
  const items = sheet.locator('#history li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Paycheck');
  await expect(items.nth(0)).toContainText('+$20,000.00');
  await expect(items.nth(0)).toContainText('Nov 7, 2026');
  page.once('dialog', (dialog) => dialog.accept());
  await sheet.getByRole('button', { name: 'Remove paycheck of $20,000.00 from Nov 7, 2026' }).click();
  await expect(sheet.getByText('Paycheck removed.')).toBeVisible();
  await expect(items).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
});

test('a paycheck whose money was already used says why before asking anything', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 20000)],
    goalPurchases: [{ id: 'x1', date: '2026-11-07', cents: 3000, name: 'Tickets' }],
  }));
  /** @type {string[]} */
  const dialogs = [];
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.dismiss(); });
  const sheet = await openSettings(page);
  await sheet.getByRole('button', { name: 'Remove paycheck of $200.00 from Nov 7, 2026' }).click();
  await expect(sheet.getByRole('alert')).toHaveText(
    "You can't remove this paycheck, because its goal money already paid for something you bought. Undo that buy first.");
  expect(dialogs).toEqual([]);
});

test('a paycheck that was partly spent says why before asking anything', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    trackSpending: true,
    paychecks: [P('p1', '2026-11-07', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-07', cents: 9000, note: 'Shoes' }],
  }));
  /** @type {string[]} */
  const dialogs = [];
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); dialog.dismiss(); });
  const sheet = await openSettings(page);
  await sheet.getByRole('button', { name: 'Remove paycheck of $200.00 from Nov 7, 2026' }).click();
  await expect(sheet.getByRole('alert')).toHaveText(
    "You can't remove this paycheck because you've already spent part of it. Remove some purchases first.");
  expect(dialogs).toEqual([]);
});

test('undoing a goal buy puts the money back in Goals', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 20000)],
    goalPurchases: [{ id: 'x1', date: '2026-11-07', cents: 3000, name: 'Tickets' }],
  }));
  const sheet = await openSettings(page);
  await expect(sheet.locator('#history li').first()).toContainText('Bought: Tickets');
  await expect(sheet.locator('#history li').first()).toContainText('−$30.00');
  await expect(sheet.locator('#money')).toContainText('Goals$10.00');
  page.once('dialog', (dialog) => dialog.accept());
  await sheet.getByRole('button', { name: 'Undo buying Tickets ($30.00) from Nov 7, 2026' }).click();
  await expect(sheet.getByText('Undone. $30.00 is back in Goals. Add the goal again if you still want it.')).toBeVisible();
  await expect(sheet.locator('#money')).toContainText('Goals$40.00');
});

test('a downloaded backup restores on a new phone from the first screen', async ({ page, browser }, testInfo) => {
  await open(page);
  await seed(page, paid);
  const before = await screen(page);
  const sheet = await openSettings(page);
  const downloadPromise = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('budgeteer-backup-2026-11-07.json');
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(3);

  const fresh = await browser.newContext({ viewport: page.viewportSize(), timezoneId: 'America/Chicago' });
  const phone = await fresh.newPage();
  await phone.clock.setFixedTime(TODAY);
  await phone.goto(`http://127.0.0.1:8137${APP}`);
  const chooser = phone.waitForEvent('filechooser');
  await phone.getByRole('button', { name: 'Restore a backup' }).click();
  await (await chooser).setFiles(file);
  await expect(phone.getByText('Backup restored: 1 paycheck and 1 goal.')).toBeVisible();
  expect(await screen(phone)).toEqual(before);
});

test('an old (version 1) backup restores with nothing lost, and tracking turns on', async ({ page }) => {
  await open(page);
  const old = {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [P('p1', '2026-11-06', 20000)],
    purchases: [{ id: 'b1', date: '2026-11-06', cents: 500, note: 'Snack' }],
    goals: [{ id: 'g1', name: 'Phone', targetCents: 30000 }],
  };
  await restoreFile(page, 'old.json', JSON.stringify(old), 'Restore a backup');
  await expect(page.getByText('Backup restored: 1 paycheck, 1 purchase and 1 goal.')).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
  expect(saved.version).toBe(3);
  expect(saved.settings).toEqual({ trackSpending: true, payFrequency: 'varies' });
  expect(saved.purchases).toEqual(old.purchases);
  const sheet = await openSettings(page);
  await expect(sheet.locator('#history')).toContainText('Snack');
});

test('a damaged or future-dated backup is refused and changes nothing', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const before = await screen(page);
  const sheet = await openSettings(page);
  await restoreFile(page, 'broken.json', '{"version":2,"split":', 'Restore backup');
  await expect(sheet.getByRole('alert')).toHaveText(
    "Nothing was changed. That file isn't a Budgeteer backup, or it's damaged.");
  const future = v2({ paychecks: [P('p1', '2026-11-09', 20000)] });
  await restoreFile(page, 'future.json', JSON.stringify(future), 'Restore backup');
  await expect(sheet.getByRole('alert')).toHaveText(
    "Nothing was changed. Paycheck 1's date is in the future.");
  await sheet.getByRole('button', { name: 'Done' }).click();
  expect(await screen(page)).toEqual(before);
});

test('restoring over existing data asks first, and "no" keeps everything', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const before = await screen(page);
  await openSettings(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await restoreFile(page, 'empty.json', JSON.stringify(v2()), 'Restore backup');
  await page.getByRole('button', { name: 'Done' }).click();
  expect(await screen(page)).toEqual(before);
});

test('saved data that cannot be read can be downloaded to get help', async ({ page }) => {
  await open(page);
  await seed(page, '{not json');
  await expect(page.locator('#notice')).toContainText("Your saved info couldn't be read");
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the unreadable data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('budgeteer-unreadable-2026-11-07.txt');
  let text = '';
  for await (const chunk of await download.createReadStream()) text += chunk;
  expect(text).toBe('{not json');
});

test('Settings explains how to add Budgeteer to the Home Screen', async ({ page }) => {
  await open(page);
  await seed(page, paid);
  const sheet = await openSettings(page);
  await expect(sheet.getByRole('heading', { name: 'Add to Home Screen' })).toBeVisible();
  await expect(sheet.getByText('On iPhone: tap the Share button in Safari, then "Add to Home Screen".')).toBeVisible();
});

test('Settings fits the phone and its targets are big enough', async ({ page }) => {
  await open(page);
  await seed(page, v2({
    paychecks: [P('p1', '2026-11-07', 20000)],
    goalPurchases: [{ id: 'x1', date: '2026-11-07', cents: 3000, name: 'Supercalifragilisticexpialidocious' }],
  }));
  await openSettings(page);
  expect(await smallTargets(page)).toEqual([]);
  expect(await noSideScroll(page)).toBe(true);
});
