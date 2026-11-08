// @ts-check
// Overnight video scenarios (not part of ./check.sh). Run with:
//   npx playwright test -c overnight/playwright.overnight.config.js
// Videos, screenshots and checks go to overnight-review/ (gitignored).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = new URL('../', import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ||= fileURLToPath(new URL('.playwright-browsers', root));
const tmp = fileURLToPath(new URL('.playwright-tmp', root));
mkdirSync(tmp, { recursive: true });
process.env.TMPDIR = tmp;

const PORT = 8141;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const { defaultBrowserType: _iphone, ...iPhone15 } = devices['iPhone 15'];
const { defaultBrowserType: _se, ...iPhoneSE } = devices['iPhone SE'];

export default defineConfig({
  testDir: '.',
  testMatch: '*.scenario.js',
  outputDir: fileURLToPath(new URL('overnight-review/test-output', root)),
  timeout: 240_000,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    timezoneId: 'America/Chicago',
    locale: 'en-US',
    video: 'on',
    launchOptions: { slowMo: 400 },
  },
  projects: [
    { name: 'iphone15', use: { ...iPhone15, browserName: 'chromium' } },
    { name: 'pixel9', use: { ...devices['Pixel 9'], browserName: 'chromium' } },
    { name: 'iphoneSE', grep: /@se/, use: { ...iPhoneSE, browserName: 'chromium' } },
    // A rough stand-in for Safari: Playwright's WebKit build on Linux (not real iOS Safari).
    { name: 'webkit-iphone15', grep: /@webkit/, use: { ...iPhone15, browserName: 'webkit' } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    cwd: fileURLToPath(root),
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
