// @ts-check
// Ticket 007 in a real browser: phone widths, both themes, keyboard focus, labels, and backups.
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00-06:00'));
  await page.goto('/index.html');
});

/**
 * A teen with some history: two paychecks, a purchase, two goals, and a changed split.
 * @param {import('@playwright/test').Page} page
 */
async function fillWithData(page) {
  await page.getByRole('button', { name: 'Start budgeting' }).click();
  for (const [amount, date] of [['212.40', '2026-10-24'], ['187.65', '2026-11-06']]) {
    await page.getByLabel('Take-home amount').fill(amount);
    await page.getByLabel('Date paid').fill(date);
    await page.getByRole('button', { name: 'Add paycheck' }).click();
  }
  await page.getByLabel('Amount spent').fill('12.99');
  await page.getByLabel('What was it for?').fill('Burger');
  await page.getByRole('button', { name: 'Log purchase' }).click();
  for (const [name, target] of [['Concert', '85'], ['Phone', '450']]) {
    await page.getByLabel('What are you saving for?').fill(name);
    await page.getByLabel('How much does it cost?').fill(target);
    await page.getByRole('button', { name: 'Add goal' }).click();
  }
  await page.getByLabel('Goals share of each paycheck').fill('30');
  await page.getByRole('button', { name: 'Use this split' }).click();
}

/** @param {import('@playwright/test').Page} page */
async function readScreen(page) {
  return {
    spend: await page.locator('#balance-spend').textContent(),
    save: await page.locator('#balance-save').textContent(),
    goals: await page.locator('#balance-goals').textContent(),
    goalList: await page.locator('#goal-list').innerText(),
    history: await page.locator('#history').innerText(),
    split: await page.locator('#current-split').textContent(),
  };
}

test('a downloaded backup restores to identical balances on a fresh device', async ({ page, browser }, testInfo) => {
  await fillWithData(page);
  const before = await readScreen(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('budgeteer-backup-2026-11-07.json');
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8')).version).toBe(1);
  await expect(page.getByText('Backup downloaded. Keep the file somewhere safe.')).toBeVisible();

  // A new phone: empty storage. Restore straight from the first-run screen.
  const fresh = await (await browser.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'America/Chicago' })).newPage();
  await fresh.clock.setFixedTime(new Date('2026-11-07T10:00:00-06:00'));
  await fresh.goto('/index.html');
  await expect(fresh.getByRole('heading', { name: 'How should each paycheck be split?' })).toBeVisible();
  const chooser = fresh.waitForEvent('filechooser');
  await fresh.getByRole('button', { name: 'Restore a backup' }).click();
  await (await chooser).setFiles(file);
  await expect(fresh.getByText('Backup restored: 2 paychecks, 1 purchase and 2 goals.')).toBeVisible();
  expect(await readScreen(fresh)).toEqual(before);

  await fresh.reload();
  expect(await readScreen(fresh)).toEqual(before);
});

test('a corrupted or wrong file is rejected with a clear message and changes nothing', async ({ page }) => {
  await fillWithData(page);
  const before = await readScreen(page);
  const restore = async (/** @type {string} */ name, /** @type {string} */ text) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  };

  await restore('broken.json', '{"version":1,"split":{"spend":50');
  await expect(page.getByRole('alert')).toHaveText(
    "That file couldn't be restored, so nothing was changed. That file isn't a Budgeteer backup, or it's damaged.");

  const sneaky = {
    version: 1,
    split: { spend: 50, save: 30, goals: 20 },
    paychecks: [{ id: 'p1', date: '2026-11-01', cents: '99999', spend: 50, save: 30, goals: 20 }],
    purchases: [],
    goals: [],
  };
  await restore('sneaky.json', JSON.stringify(sneaky));
  await expect(page.getByRole('alert')).toHaveText(
    "That file couldn't be restored, so nothing was changed. Paycheck 1's amount must be a whole number of cents.");

  await restore('photo.json', 'GIF89a not json at all');
  await expect(page.getByRole('alert')).toContainText("couldn't be restored");

  expect(await readScreen(page)).toEqual(before);
  await page.reload();
  expect(await readScreen(page)).toEqual(before);
});

test('restoring over existing data asks first, and "no" keeps everything', async ({ page }, testInfo) => {
  await fillWithData(page);
  const before = await readScreen(page);
  const empty = { version: 1, split: { spend: 50, save: 30, goals: 20 }, paychecks: [], purchases: [], goals: [] };
  const chooser = page.waitForEvent('filechooser');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await (await chooser).setFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(empty)) });
  await expect(page.locator('#backup-result')).toBeEmpty();
  expect(await readScreen(page)).toEqual(before);
});

for (const width of [320, 360, 400]) {
  for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
    test(`no sideways scrolling at ${width}px in the ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.getByRole('button', { name: 'Start budgeting' }).click();
      await page.getByLabel('Take-home amount').fill('1000000');
      await page.getByRole('button', { name: 'Add paycheck' }).click();
      await page.getByLabel('What are you saving for?').fill('Supercalifragilisticexpialidocious-car');
      await page.getByLabel('How much does it cost?').fill('999,999.99');
      await page.getByRole('button', { name: 'Add goal' }).click();
      await page.getByLabel('Amount spent').fill('1');
      await page.getByLabel('What was it for?').fill('x'.repeat(80));
      await page.getByRole('button', { name: 'Log purchase' }).click();

      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits).toBe(true);
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(background).toBe(colorScheme === 'dark' ? 'rgb(18, 19, 26)' : 'rgb(245, 246, 250)');
    });
  }
}

test('every input has a label', async ({ page }) => {
  for (const stage of ['setup', 'main']) {
    if (stage === 'main') await page.getByRole('button', { name: 'Start budgeting' }).click();
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
      .filter((input) => !(/** @type {HTMLInputElement} */ (input).labels?.length) && !input.getAttribute('aria-label'))
      .map((input) => input.id || input.outerHTML));
    expect(unlabeled, stage).toEqual([]);
  }
});

test('keyboard focus is clearly visible', async ({ page }) => {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = /** @type {HTMLElement} */ (document.activeElement);
    const style = getComputedStyle(el);
    return { tag: el.tagName, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(focus.tag).toBe('INPUT');
  expect(focus.outline).toBe('solid');
  expect(focus.width).toBeGreaterThanOrEqual(2);
});

// Bug found while checking ticket 007 at phone width: "$2,057.60" broke onto two lines in the
// Spend card at 400px. Every money amount must stay on one line and inside its box.
for (const width of [320, 360, 400]) {
  test(`money amounts never break across lines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole('button', { name: 'Start budgeting' }).click();
    for (const amount of ['4115.20', '1000000']) {
      await page.getByLabel('Take-home amount').fill(amount);
      await page.getByRole('button', { name: 'Add paycheck' }).click();
    }
    await page.getByLabel('Amount spent').fill('999999.99');
    await page.getByRole('button', { name: 'Log purchase' }).click();

    const broken = await page.evaluate(() => [...document.querySelectorAll('.bucket-amount, .history-amount')]
      .filter((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        return lines !== 1 || el.scrollWidth > el.clientWidth + 1;
      })
      .map((el) => el.textContent));
    expect(broken).toEqual([]);
  });
}
