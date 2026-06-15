// frontend/offline-core.js
(function() {
    console.log("🛡️ IntelliScript BD Offline Core Activated.");

    // IndexedDB Setup for Offline Queue
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

    async function saveToOfflineQueue(payload) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(payload);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const url = args[0];
        const options = args[1] || {};

        try {
            if (!navigator.onLine) {
                throw new Error("Offline");
            }
            return await originalFetch(...args);
        } catch (error) {
            console.warn(`[Offline Core] Network request failed for ${url}`, error);

            if (url.includes('/api/prescriptions') && options.method === 'POST') {
                console.log("⚠️ [Offline Core] Intercepting failed prescription payload...");
                
                try {
                    const payload = JSON.parse(options.body);
                    const offlineId = generateUUID();
                    payload._offlineId = offlineId;
                    payload._timestamp = new Date().toISOString();
                    
                    // Attach the authorization token if it exists (needed for sync)
                    if (options.headers && options.headers['Authorization']) {
                        payload._token = options.headers['Authorization'];
                    } else if (sessionStorage.getItem('eRx_Token')) {
                        payload._token = `Bearer ${sessionStorage.getItem('eRx_Token')}`;
                    }

                    await saveToOfflineQueue(payload);
                    console.log("✅ [Offline Core] Prescription securely queued in IndexedDB.");

                    // Attempt to register Background Sync
                    if ('serviceWorker' in navigator && 'SyncManager' in window) {
                        navigator.serviceWorker.ready.then(reg => {
                            return reg.sync.register('sync-prescriptions');
                        }).catch(err => console.error("Sync registration failed:", err));
                    }

                    // Dispatch custom event to update UI badges immediately
                    window.dispatchEvent(new Event('offline-queue-updated'));

                    return new Response(JSON.stringify({
                        msg: "Prescription sealed offline. Synced to secure local database.",
                        broadcastId: `LOCAL-${offlineId.split('-')[0].toUpperCase()}`,
                        otp: "OFFLINE"
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (parseError) {
                    console.error("[Offline Core] Error parsing or saving payload", parseError);
                    throw error;
                }
            }
            throw error;
        }
    };
})();
