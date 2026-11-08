// Installable and offline (ticket 020, docs/adr/0001 and 0002): the manifest, icons and the
// service worker's precache list, checked without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = (/** @type {string} */ path) => readFileSync(new URL(path, root), 'utf8');

/**
 * Width and height of a PNG, from its header.
 * @param {string} path
 */
function pngSize(path) {
  const bytes = readFileSync(new URL(path, root));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The files sw.js precaches. */
function precached() {
  const match = /const FILES = \[([^\]]*)\]/.exec(read('sw.js'));
  assert.ok(match, 'sw.js has a FILES list');
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, file]) => file);
}

test('the manifest makes Budgeteer installable as a portrait phone app', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'Budgeteer');
  assert.equal(manifest.short_name, 'Budgeteer');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
});

test('the manifest has 192 and 512 icons, including a maskable one, and they are real PNGs', () => {
  const { icons } = JSON.parse(read('manifest.webmanifest'));
  const find = (/** @type {string} */ sizes, /** @type {string} */ purpose) =>
    icons.find((/** @type {any} */ i) => i.sizes === sizes && i.purpose === purpose);
  assert.ok(find('192x192', 'any'));
  assert.ok(find('512x512', 'any'));
  assert.ok(find('512x512', 'maskable'));
  for (const icon of icons) {
    assert.equal(icon.type, 'image/png');
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(icon.src), { width: w, height: h }, icon.src);
  }
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), { width: 180, height: 180 });
});

test('the page links the manifest, the iPhone icon and theme colors for both themes', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon.png">/);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: light\)">/i);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)">/i);
  assert.match(html, /manifest-src 'self'/);
  assert.match(html, /worker-src 'self'/);
  assert.match(html, /connect-src 'none'/);
});

test('the service worker precaches every file the page needs, and every listed file exists', () => {
  const files = precached();
  const needed = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/apple-touch-icon.png',
    ...readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`),
    ...JSON.parse(read('manifest.webmanifest')).icons.map((/** @type {any} */ i) => i.src)];
  for (const file of needed) assert.ok(files.includes(file), `${file} is not precached`);
  for (const file of files) if (file !== './') assert.ok(existsSync(new URL(file, root)), `${file} does not exist`);
  for (const [, ref] of read('index.html').matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!ref.startsWith('data:')) assert.ok(files.includes(ref), `index.html uses ${ref}, which is not precached`);
  }
});

test('the service worker is plain JavaScript and only ever handles its own origin', () => {
  execFileSync(process.execPath, ['--check', new URL('sw.js', root).pathname]);
  const sw = read('sw.js');
  assert.doesNotMatch(sw, /https?:\/\//, 'no outside addresses');
  assert.match(sw, /url\.origin !== self\.location\.origin/);
});
