// @ts-check
// Budgeteer served from a subfolder, like https://<name>.github.io/budgeteer/ (hosting branch).
// The "subfolder" project runs this against e2e/subfolder-server.mjs, which serves the project
// under /budgeteer/ only: every request must stay inside it, online and offline.
import { test, expect } from '@playwright/test';
import { TODAY } from './helpers.js';

const ORIGIN = 'http://127.0.0.1:8139';
const HOME = `${ORIGIN}/budgeteer/`;

test('the main flow, the manifest, the service worker and an offline reload all work under /budgeteer/', async ({ page, context }) => {
  /** @type {string[]} */
  const outside = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === ORIGIN && !url.pathname.startsWith('/budgeteer/')) outside.push(url.pathname);
  });
  await page.clock.setFixedTime(TODAY);
  await page.goto('./');
  expect(page.url()).toBe(HOME);

  // First run: a goal, then the first paycheck.
  await page.getByLabel('What is it?').fill('Phone');
  await page.getByLabel('How much does it cost?').fill('300');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');

  // The manifest, its start_url, scope and icons all resolve inside /budgeteer/.
  const manifestURL = await page.evaluate(() => /** @type {HTMLLinkElement} */ (document.querySelector('link[rel="manifest"]')).href);
  expect(manifestURL).toBe(`${HOME}manifest.webmanifest`);
  const manifest = await (await page.request.get(manifestURL)).json();
  expect(new URL(manifest.start_url, manifestURL).href).toBe(HOME);
  expect(new URL(manifest.scope, manifestURL).href).toBe(HOME);
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestURL);
    expect(url.pathname.startsWith('/budgeteer/'), icon.src).toBe(true);
    expect((await page.request.get(url.href)).ok(), icon.src).toBe(true);
  }

  // The service worker is scoped to /budgeteer/, its cache is named for it, and it holds only
  // /budgeteer/ files.
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(HOME);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['budgeteer-v2 /budgeteer/']);
  const cached = await page.evaluate(async () => (await (await caches.open('budgeteer-v2 /budgeteer/')).keys()).map((r) => r.url));
  expect(cached.length).toBeGreaterThanOrEqual(10);
  for (const url of cached) expect(url.startsWith(HOME), url).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // Offline: the app reloads from the cache and still logs a paycheck.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $50 a week');
  await page.getByRole('button', { name: 'I got paid' }).click();
  await page.locator('#pay-sheet').getByLabel('Take-home amount').fill('200');
  await page.getByRole('button', { name: 'Add paycheck' }).click();
  await page.getByRole('button', { name: 'Yes, log another' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(page.locator('#headline')).toHaveText('Spend about $100 a week');
  await context.setOffline(false);

  expect(outside).toEqual([]);
});

test('a visit to /budgeteer without the slash lands on the app', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto(`${ORIGIN}/budgeteer`);
  expect(page.url()).toBe(HOME);
  await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible();
});
