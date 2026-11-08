// @ts-check
// Ticket 020: installable and offline, and the iPhone "Add to Home Screen" card.
// Only Chromium can run here: this checks the service worker in Chromium, not on a real phone.
import { test, expect } from '@playwright/test';
import { open, seed, v2, welcome, logPaycheck, smallTargets } from './helpers.js';

const paid = v2({ paychecks: [{ id: 'p1', date: '2026-11-07', cents: 20000, spend: 50, save: 30, goals: 20 }] });

test('the manifest is served as a web app manifest', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
});

test('after one visit, the app opens and logs a paycheck with no connection', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => caches.keys().then((keys) => keys.length))).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]);
    return (await cache.keys()).length;
  })).toBeGreaterThanOrEqual(10);

  await context.setOffline(true);
  await page.reload();
  await welcome(page, { goal: 'Phone', price: '300' });
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await expect(page.getByText('Phone: ready in about 13 weeks (around Feb 6, 2027)')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await context.setOffline(false);
});

test('the "Add to Home Screen" card shows on iPhone in Safari, and "Got it" hides it for good', async ({ page }, testInfo) => {
  await open(page);
  await seed(page, paid);
  const card = page.getByRole('region', { name: 'Put Budgeteer on your Home Screen' });
  if (testInfo.project.name !== 'iphone') {
    await expect(card).toHaveCount(0); // Android gets its own install prompt from Chrome
    return;
  }
  await expect(card).toBeVisible();
  await expect(card).toContainText('Tap the Share button, then "Add to Home Screen". Budgeteer then opens like an app and works without internet.');
  expect(await smallTargets(page)).toEqual([]);
  await card.getByRole('button', { name: 'Got it' }).click();
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await expect(card).toBeHidden();
});

test('no "Add to Home Screen" card once Budgeteer is installed, or on the first screen', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await open(page);
  await expect(page.getByRole('region', { name: 'Put Budgeteer on your Home Screen' })).toHaveCount(0);
  await welcome(page);
  await logPaycheck(page, '200');
  await expect(page.getByRole('region', { name: 'Put Budgeteer on your Home Screen' })).toBeHidden();
});
