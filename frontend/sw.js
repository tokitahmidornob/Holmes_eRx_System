const CACHE_NAME = 'holmes-erx-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/patient_app.html',
  '/pharmacist_portal.html',
  '/pathology_portal.html',
  '/admin_portal.html',
  '/manifest.json'
];

// Install Event: Cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching Core Assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches if we update the app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
                console.log('[Service Worker] Purging Old Cache');
                return caches.delete(cache);
            }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-First Strategy for API calls, Cache-First for UI
self.addEventListener('fetch', (event) => {
  // If it's an API call to your backend, ALWAYS go to the network
  if (event.request.url.includes('/api/')) {
      event.respondWith(fetch(event.request));
      return;
  }

  // Otherwise (for HTML/CSS/UI), check the cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
            return cachedResponse;
        }
        return fetch(event.request);
      })
  );
});