// The service worker on a shared address (hosting branch). On GitHub Pages every project site of
// one account shares https://<name>.github.io, and so one cache storage. Budgeteer's cache is
// named for its own folder, and it only ever deletes its own old caches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

/**
 * Run sw.js as if served from `swURL`, with these caches, then activate it.
 * @param {string} swURL
 * @param {string[]} keys existing cache names
 * @returns {Promise<{ deleted: string[], cacheName: string }>}
 */
async function activate(swURL, keys) {
  /** @type {Record<string, Function>} */
  const handlers = {};
  const deleted = [];
  const self = {
    location: new URL(swURL),
    addEventListener: (/** @type {string} */ type, /** @type {Function} */ fn) => { handlers[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const caches = { keys: async () => keys, delete: async (/** @type {string} */ key) => { deleted.push(key); return true; } };
  const context = vm.createContext({ self, caches, URL, Promise, fetch: () => Promise.reject(new Error('offline')) });
  vm.runInContext(`${source}\n;globalThis.__cache = CACHE;`, context);
  let done = Promise.resolve();
  handlers.activate({ waitUntil: (/** @type {Promise<unknown>} */ p) => { done = p; } });
  await done;
  return { deleted, cacheName: context.__cache };
}

test('the cache is named for the folder the app is served from', async () => {
  assert.equal((await activate('https://name.github.io/budgeteer/sw.js', [])).cacheName, 'budgeteer-v2 /budgeteer/');
  assert.equal((await activate('https://example.com/sw.js', [])).cacheName, 'budgeteer-v2 /');
});

test('activating deletes only this copy\'s old caches, never another site\'s', async () => {
  const { deleted } = await activate('https://name.github.io/budgeteer/sw.js', [
    'budgeteer-v2 /budgeteer/', // this version: kept
    'budgeteer-v1', // this app's old, unnamed cache: deleted
    'budgeteer-v1 /budgeteer/', // an older version for this folder: deleted
    'budgeteer-v2 /other-copy/', // Budgeteer in another folder of the same address: kept
    'workbox-precache-v2', // another site on the same address: kept
    'my-game-cache',
  ]);
  assert.deepEqual(deleted.sort(), ['budgeteer-v1', 'budgeteer-v1 /budgeteer/']);
});
