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

// ==========================================
// BACKGROUND SYNC: IDEMPOTENCY QUEUE
// ==========================================
const DB_NAME = 'HolmesOfflineDB';
const STORE_NAME = 'offline_rx_queue';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: '_offlineId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function syncPrescriptions() {
    console.log('[Service Worker] Syncing Prescriptions...');
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const records = await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (records.length === 0) {
            console.log('[Service Worker] No offline prescriptions to sync.');
            return;
        }

        console.log(`[Service Worker] Found ${records.length} records. Commencing transmission...`);

        // Use the domain the SW is running on to reconstruct the API_BASE_URL
        const apiBaseUrl = self.location.origin.includes('localhost') || self.location.origin.includes('127.0.0.1') 
            ? 'http://localhost:3000' 
            : 'https://holmes-erx-system.onrender.com';

        for (const record of records) {
            try {
                // Ensure the token exists
                const headers = { 'Content-Type': 'application/json' };
                if (record._token) headers['Authorization'] = record._token;

                // Fire the payload to the actual endpoint
                const res = await fetch(`${apiBaseUrl}/api/prescriptions`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(record)
                });

                if (res.ok || res.status === 200 || res.status === 201) {
                    console.log(`[Service Worker] Record ${record._offlineId} synced successfully.`);
                    // Delete from IndexedDB once confirmed
                    const delTx = db.transaction(STORE_NAME, 'readwrite');
                    delTx.objectStore(STORE_NAME).delete(record._offlineId);
                    await new Promise(resolve => delTx.oncomplete = resolve);
                } else {
                    console.error(`[Service Worker] Failed to sync record ${record._offlineId}. Server returned ${res.status}`);
                }
            } catch (err) {
                console.error(`[Service Worker] Network error while syncing record ${record._offlineId}:`, err);
                // Throw to let the browser retry later
                throw err;
            }
        }
    } catch (error) {
        console.error('[Service Worker] Sync process encountered a critical error:', error);
        throw error;
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-prescriptions') {
        console.log('[Service Worker] Background Sync event fired!');
        event.waitUntil(syncPrescriptions());
    }
});