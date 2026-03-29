// CuePoint Planning — Service Worker v2
// Aggressive cache busting to clear old broken versions

const CACHE_NAME = 'cuepoint-v2';

// On install — clear ALL old caches immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.skipWaiting())
  );
});

// On activate — take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch — network first, no caching for now
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  // Always go to network — no cache
  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === 'navigate') return caches.match('/index.html');
      return new Response('Offline', { status: 503 });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
