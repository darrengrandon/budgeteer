// Makes the PNG icons from icons/icon.svg. Run once after changing the SVG: npm run icons
// The PNGs are committed; the app itself has no build step (docs/adr/0001).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const icons = new URL('../icons/', import.meta.url);
const svg = await readFile(new URL('icon.svg', icons));
const sizes = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style>
    <img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="${size}" height="${size}" alt="">`);
  await page.locator('img').screenshot({ path: fileURLToPath(new URL(file, icons)) });
  console.log(`made icons/${file}`);
}
await browser.close();
