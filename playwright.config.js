// @ts-check
// Browser tests for Budgeteer. ./check.sh runs these once @playwright/test is installed.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Keep Playwright's browsers inside this project instead of ~/.cache. This runs before any
// test worker starts, so the workers inherit it. Install them with: npm run setup:browsers
process.env.PLAYWRIGHT_BROWSERS_PATH ||= fileURLToPath(new URL('./.playwright-browsers', import.meta.url));

// Browser profiles and downloads are temporary files. Keep those inside the project too.
const tmp = fileURLToPath(new URL('./.playwright-tmp', import.meta.url));
mkdirSync(tmp, { recursive: true });
process.env.TMPDIR = tmp;

const PORT = 8137;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    timezoneId: 'America/Chicago',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    // The old page, until ticket 019 retires it.
    { name: 'legacy', testIgnore: 'phone/**', use: { viewport: { width: 400, height: 860 } } },
    // The phone app at an iPhone size and a Pixel size. Only Chromium can run here, so the
    // iPhone project is Chromium with an iPhone screen, touch and user agent, not Safari.
    { name: 'iphone', testDir: './e2e/phone', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
    { name: 'pixel', testDir: './e2e/phone', use: { ...devices['Pixel 9'], browserName: 'chromium' } },
  ],
  webServer: {
    // Serves the files only. Bound to this computer so the folder is not shared on the network.
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
