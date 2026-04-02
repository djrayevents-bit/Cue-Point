// CuePoint Planning — Service Worker
// Version timestamp updates on every deploy so browsers always get latest
const CACHE_VERSION = 'cuepoint-v3-BUILD_TIME';
const CACHE_NAME = `cuepoint-${Date.now()}`;

// Install — clear ALL old caches immediately, take control right away
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.skipWaiting())
  );
});

// Activate — claim all clients immediately so new SW takes effect without refresh
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload so they get the latest version
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED' });
          });
        });
      })
  );
});

// Fetch — always network first, never serve stale content
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  // API calls — never cache, always network
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Only cache successful responses for static assets
        if (response.ok && (
          request.url.includes('/assets/') ||
          request.url.includes('/icons/') ||
          request.url.endsWith('.svg') ||
          request.url.endsWith('/favicon.svg')
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve cached index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Listen for skip waiting message from app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
