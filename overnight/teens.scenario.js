// @ts-check
// Overnight scenarios a-i: a lazy teenager using Budgeteer, filmed with captions.
// Same clock control as the browser tests: page.clock.setFixedTime, then reload for a new day.
import { readFile } from 'node:fs/promises';
import { test, expect, on } from './kit.js';

const app = '/index.html';

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} amount
 * @param {{ same?: boolean }} [how]
 */
async function getPaid(page, amount, how = {}) {
  await page.getByRole('button', { name: 'I got paid' }).click();
  if (how.same) await page.getByRole('button', { name: /^Same as last time/ }).click();
  else await page.locator('#pay-sheet').getByLabel('Take-home amount').fill(amount);
  await page.getByRole('button', { name: 'Add paycheck' }).click();
}

test('a: first run with a goal, first paycheck, home screen @se @webkit', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await story.caption('Maya just got her first job and opens Budgeteer');
  await story.result('first-screen', 'First screen: "What are you saving for?"');
  await story.caption('Tap 0: she types what she wants (AirPods, $250)');
  await page.getByLabel('What is it?').fill('AirPods');
  await page.getByLabel('How much does it cost?').fill('250');
  await story.caption('Tap 1: Next');
  await page.getByRole('button', { name: 'Next' }).click();
  await story.result('paycheck-sheet', 'Paycheck sheet on first run');
  await story.caption('She types her first paycheck: $312.47');
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('312.47');
  await story.caption('Tap 2: Add paycheck. Her goal date appears right away');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText(/^AirPods: ready in about/)).toBeVisible();
  await story.result('first-result', 'After the first paycheck: where the money went and the goal date');
  await story.caption('Tap 3: Done. This is the home screen she will see from now on');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText(/^Spend about \$\d+ a week$/);
  await story.result('home', 'Home after the first paycheck');
});

test('b: a steady weekly paycheck for eight weeks, then "You can buy it!" and Buy it @se @webkit', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-10-03'));
  await page.goto(app);
  await story.caption('Leo saves for a $240 bike and gets $150 every Saturday');
  await page.getByLabel('What is it?').fill('Bike');
  await page.getByLabel('How much does it cost?').fill('240');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('150');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await story.result('week-1', 'Week 1: Home after the first $150');
  const days = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'];
  for (const [i, day] of days.entries()) {
    await page.clock.setFixedTime(on(day));
    await page.reload();
    await story.caption(`Week ${i + 2}: payday. One tap on "Same as last time"`);
    await getPaid(page, '150', { same: true });
    await page.getByRole('button', { name: 'Done' }).click();
    if (i === 0 || i === 3 || i === days.length - 1) await story.result(`week-${i + 2}`, `Week ${i + 2}: Home`);
  }
  await expect(page.locator('.goal-card').first()).toContainText('You can buy it!');
  await story.caption('Eight paychecks later: "You can buy it!"');
  await story.result('can-buy', 'Week 8: the bike is funded');
  await story.caption('He buys the bike for exactly $240');
  await page.getByRole('button', { name: 'Buy it: Bike' }).click();
  await story.result('buy-sheet', 'The Buy it sheet, price filled in');
  await page.getByRole('button', { name: 'Yes, I bought it' }).click();
  await expect(page.getByText('Nice! $240.00 came out of Goals for Bike.')).toBeVisible();
  await story.result('bought', 'After Buy it');
});

test('c: irregular hours, very different amounts and one missed week', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-10-03'));
  await page.goto(app);
  await story.caption('Sam works shifts: pay changes every week. Goal: $400 phone');
  await page.getByLabel('What is it?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('400');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('85');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const weeks = [['2026-10-10', '210'], ['2026-10-17', '40'], ['2026-10-31', '175'], ['2026-11-07', '120']];
  for (const [day, amount] of weeks) {
    await page.clock.setFixedTime(on(day));
    await page.reload();
    const missedWeek = day === '2026-10-31';
    await story.caption(missedWeek ? 'Sam skipped logging last week, then gets $175' : `Payday: $${amount} this week`);
    if (missedWeek) await story.result('missed-week-home', 'Home after a week with nothing logged');
    await getPaid(page, amount);
    const question = page.getByRole('button', { name: /^Yes, add/ });
    if (await question.isVisible()) {
      await story.result(`question-${amount}`, `An "Is that right?" question for a normal ${amount} paycheck`);
      await story.caption('Budgeteer asks if the amount is right. It is, so Sam taps Yes');
      await question.click();
    }
    if (missedWeek) await story.result('missed-week-result', 'Result after the skipped week');
    await page.getByRole('button', { name: 'Done' }).click();
    await story.result(`after-${amount}`, `Home after $${amount}`);
  }
});

test('d: forgetting for three weeks, then opening the app', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-10-10'));
  await page.goto(app);
  await story.caption('Ava gets $260 every 2 weeks and saves for $500 concert trip');
  await page.getByLabel('What is it?').fill('Concert trip');
  await page.getByLabel('How much does it cost?').fill('500');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('260');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.clock.setFixedTime(on('2026-10-24'));
  await page.reload();
  await getPaid(page, '260', { same: true });
  await page.getByRole('button', { name: 'Done' }).click();
  await story.result('before-forgetting', 'Home with two paychecks logged');
  await story.caption('Ava forgets the app for three weeks...');
  await page.clock.setFixedTime(on('2026-11-14'));
  await page.reload();
  await story.caption('Three weeks later she opens it');
  await story.result('three-weeks-later', 'Home after three weeks without logging');
  await story.caption('She taps "Got paid? Log it."');
  await page.getByRole('button', { name: 'Got paid? Log it.' }).click();
  await story.result('nudge-sheet', 'Paycheck sheet from the nudge, with the missed-payday chip');
  const missed = page.getByRole('button', { name: /^Also add the paycheck/ });
  if (await missed.isVisible()) {
    await story.caption('She adds the paycheck she missed too');
    await missed.click();
  }
  await page.getByRole('button', { name: /^Same as last time/ }).click();
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await story.result('caught-up', 'Result after catching up');
  await page.getByRole('button', { name: 'Done' }).click();
  await story.result('home-caught-up', 'Home after catching up');
});

test('e: mistakes (double tap, missing dot, empty, huge, zero or negative goal price)', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await story.caption('Jay is in a hurry. Goal price typed as 0');
  await page.getByLabel('What is it?').fill('Shoes');
  await page.getByLabel('How much does it cost?').fill('0');
  await page.getByRole('button', { name: 'Next' }).click();
  await story.result('goal-zero', 'Goal price 0');
  await story.caption('Then a negative price: -80');
  await page.getByLabel('How much does it cost?').fill('-80');
  await page.getByRole('button', { name: 'Next' }).click();
  await story.result('goal-negative', 'Goal price -80');
  await page.getByLabel('How much does it cost?').fill('80');
  await page.getByRole('button', { name: 'Next' }).click();
  await story.caption('He taps Add paycheck with nothing typed');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await story.result('empty-amount', 'Empty amount');
  await story.caption('He double-taps Add paycheck with $212.40');
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('212.40');
  await page.getByRole('button', { name: 'Add paycheck' }).dblclick();
  await story.result('after-double-tap', 'After a double tap on Add paycheck');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('budgeteer.v1') ?? '{}').paychecks?.length);
  expect(saved).toBe(1);
  if (await page.locator('#pay-sheet').isVisible()) await page.keyboard.press('Escape');
  await page.clock.setFixedTime(on('2026-11-14'));
  await page.reload();
  await story.caption('Next week he forgets the dot: 21240 instead of 212.40');
  await getPaid(page, '21240');
  await story.result('missing-dot', 'Missing decimal point');
  await story.caption('He fixes it');
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('212.40');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await story.caption('A silly huge amount: 99999999');
  await getPaid(page, '99999999');
  await story.result('huge-amount', 'A huge amount');
  await page.keyboard.press('Escape');
  await story.result('home-after-mistakes', 'Home after all the mistakes');
});

test('f: backup and restore, and clearing site data', async ({ page, story }, testInfo) => {
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await page.getByLabel('What is it?').fill('Headphones');
  await page.getByLabel('How much does it cost?').fill('120');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  const before = await page.locator('main').innerText();
  await story.caption('Kim backs up her info from Settings');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#backup-title').scrollIntoViewIfNeeded();
  await story.result('settings-backup', 'Settings, Backup section');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = testInfo.outputPath('backup.json');
  await (await downloadPromise).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(3);
  await page.getByRole('button', { name: 'Done' }).click();
  await story.caption('Her browser clears the site data');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await story.result('after-clear', 'After clearing site data: back to the first screen');
  await story.caption('She restores the backup file');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore a backup' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText(/^Backup restored/)).toBeVisible();
  await story.result('restored', 'After restoring the backup');
  expect((await page.locator('main').innerText()).replace(/Backup restored[^\n]*\n?/, '')).toContain(before.split('\n')[0]);
});

test('g: offline: load once, go offline, reload, log a paycheck', async ({ page, context, story }) => {
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await story.caption('Ren opens Budgeteer once with Wi-Fi');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => {
    const keys = await caches.keys();
    return keys.length ? (await (await caches.open(keys[0])).keys()).length : 0;
  })).toBeGreaterThanOrEqual(10);
  await story.caption('No signal now. Reload');
  await context.setOffline(true);
  await page.reload();
  await story.result('offline-first-screen', 'Offline after one visit: first screen still loads');
  await page.getByLabel('What is it?').fill('Game');
  await page.getByLabel('How much does it cost?').fill('70');
  await page.getByRole('button', { name: 'Next' }).click();
  await story.caption('Logs a paycheck with no connection');
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('140');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await story.result('offline-result', 'Offline: paycheck result');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await story.result('offline-home', 'Offline: Home after a reload');
  await context.setOffline(false);
});

test('h: dark mode and large text', async ({ page, story }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await story.caption('Night owl: dark mode');
  await page.getByLabel('What is it?').fill('Concert tickets');
  await page.getByLabel('How much does it cost?').fill('85');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('212.40');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await story.result('dark-result', 'Dark mode: paycheck result');
  await page.getByRole('button', { name: 'Done' }).click();
  await story.result('dark-home', 'Dark mode: Home');
  await story.caption('Large text (the phone set to big text: 150%)');
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  await story.result('large-text-home', 'Large text: Home');
  await page.getByRole('button', { name: 'I got paid' }).click();
  await story.result('large-text-sheet', 'Large text: paycheck sheet');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await story.result('large-text-settings', 'Large text: Settings');
  await page.getByRole('button', { name: 'Done' }).click();
  await story.caption('Large text on the smallest phone (320px wide)');
  await page.setViewportSize({ width: 320, height: 568 });
  await story.result('large-text-320', 'Large text at 320px');
});

test('i: changing the split, and Track my spending with the balance check', async ({ page, story }) => {
  await page.clock.setFixedTime(on('2026-11-07'));
  await page.goto(app);
  await page.getByLabel('What is it?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await story.caption('Zoe wants the phone sooner: 40% Spend, 30% Save, 30% Goals');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Spend %').fill('40');
  await page.getByLabel('Goals %').fill('30');
  await story.result('split-preview', 'Settings: the split preview');
  await page.getByRole('button', { name: 'Save split' }).click();
  await story.result('split-saved', 'Settings: split saved');
  await story.caption('She turns on "Track my spending"');
  await page.getByRole('switch', { name: 'Track my spending' }).click();
  await story.result('tracking-on', 'Settings: tracking on');
  await page.getByRole('button', { name: 'Done' }).click();
  await story.result('home-tracking', 'Home with the Spending card');
  await story.caption('She logs a $60 hoodie');
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  await page.getByLabel('Amount spent').fill('60');
  await page.getByLabel('What was it for? (optional)').fill('Hoodie');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await story.result('after-purchase', 'After a purchase');
  await story.caption('Then tries to spend $40.01 with $40.00 left');
  await page.getByRole('button', { name: 'Log a purchase' }).click();
  await page.getByLabel('Amount spent').fill('40.01');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  await expect(page.getByRole('alert')).toContainText('left to spend');
  await story.result('balance-check', 'The balance check (one cent over)');
});
