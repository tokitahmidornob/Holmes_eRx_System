// frontend/offline-core.js
(function() {
    console.log("🛡️ IntelliScript BD Offline Core Activated.");

    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const url = args[0];
        const options = args[1] || {};

        try {
            // Fast-fail if browser knows we're offline
            if (!navigator.onLine) {
                throw new Error("Offline");
            }
            
            // Attempt the real network request
            const response = await originalFetch(...args);
            return response;

        } catch (error) {
            console.warn(`[Offline Core] Network request failed for ${url}`, error);

            // Specifically intercept prescription sealing failures
            if (url.includes('/api/prescriptions') && options.method === 'POST') {
                console.log("⚠️ [Offline Core] Intercepting failed prescription payload...");
                
                try {
                    const payload = JSON.parse(options.body);
                    
                    // Retrieve existing offline queue or create new
                    let queue = JSON.parse(localStorage.getItem('demo_prescriptions') || '[]');
                    
                    // Add offline metadata to simulate server processing
                    const offlineBroadcastId = 'LOCAL-' + Date.now();
                    payload._offlineId = offlineBroadcastId;
                    payload._timestamp = new Date().toISOString();
                    
                    queue.push(payload);
                    localStorage.setItem('demo_prescriptions', JSON.stringify(queue));
                    
                    console.log("✅ [Offline Core] Prescription securely queued in localStorage.");

                    // Return a mock successful response so the UI proceeds smoothly
                    return new Response(JSON.stringify({
                        msg: "Prescription sealed offline. Synced to local storage.",
                        broadcastId: offlineBroadcastId,
                        otp: "OFFLINE-OTP"
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (parseError) {
                    console.error("[Offline Core] Error parsing or saving payload", parseError);
                    throw error;
                }
            }
            
            // For other requests, just rethrow the error
            throw error;
        }
    };
})();
