// Budgeteer service worker (docs/adr/0002): precache the app's own files, then for every
// same-origin GET try the network first and fall back to the cache when offline.
// It never handles or fetches anything from another origin.

const CACHE = 'budgeteer-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'src/app.js',
  'src/budget.js',
  'src/forms.js',
  'src/goals.js',
  'src/money.js',
  'src/pay.js',
  'src/plan.js',
  'src/storage.js',
  'src/words.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

/**
 * The latest file when online (and keep a copy); the saved copy when offline.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    return Response.error();
  }
}
