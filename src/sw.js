/* ====================================================================
  Provinent Scripture Study – sw.js
  Version‑aware Service Worker
==================================================================== */

// Core assets that must be available offline.
const CORE_ASSETS = [
    '/',                     // index.html (served via navigation fallback)
    '/index.html',
    '/styles.css',
    '/main.js',
    '/modules/api.js',
    '/modules/highlights.js',
    '/modules/hotkeys.js',
    '/modules/navigation.js',
    '/modules/passage.js',
    '/modules/settings.js',
    '/modules/state.js',
    '/modules/strongs.js',
    '/modules/ui.js',
    '/sw.js',                // the worker itself (helps self‑update)
    '/404.html',             // offline fallback page
    '/favicons/apple-touch-icon.png',
    '/favicons/favicon.ico',
    '/favicons/favicon-16x16.png',
    '/favicons/favicon-32x32.png'
];

// Global cache name – will be set once we receive the version.
let CURRENT_CACHE = null;   // e.g. "provinent-cache-v1.8.2025.11.18"

// Receive the version from the page (postMessage) and start pre‑caching the core assets.
self.addEventListener('message', event => {
    if (event.data?.type === 'VERSION') {
        const version = event.data.version;
        CURRENT_CACHE = `provinent-cache-v${version}`;
        preCacheCoreAssets();          // fire‑and‑forget
   }
});

// Pre‑cache core assets (runs once we know the cache name).
async function preCacheCoreAssets() {
    if (!CURRENT_CACHE) return;   // safety net
    const cache = await caches.open(CURRENT_CACHE);
    // `addAll` will reject if *any* request fails -> catch & log.
    try {
        await cache.addAll(
            CORE_ASSETS.map(u => new Request(u, { credentials: 'same-origin' }))
        );
        console.log('Core assets cached under', CURRENT_CACHE);
    } catch (e) {
        console.error('Failed to pre‑cache core assets', e);
    }
}

// Install – skip waiting so the new worker can activate ASAP.
self.addEventListener('install', evt => {
    self.skipWaiting();   // immediate activation once install finishes
});

// Activate – claim clients and delete stale versioned caches.
self.addEventListener('activate', evt => {
    evt.waitUntil(
        (async () => {
            // If for some reason we never got a VERSION message,
            // fall back to a deterministic name based on the registration scope.
            const expected = CURRENT_CACHE ||
                `provinent-cache-v${self.registration.scope}`;

            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(name => {
                    if (name !== expected && name.startsWith('provinent-cache-v')) {
                        console.log('Deleting old cache', name);
                        return caches.delete(name);
                    }
                })
            );

            // Take control of all open pages immediately.
            await self.clients.claim();
        })()
    );
});


// Fetch – network‑first, fall back to cache.
self.addEventListener('fetch', evt => {
    // Ignore anything that isn’t a GET (POST, PUT, etc.).
    if (evt.request.method !== 'GET') return;

    // Navigation requests (HTML pages)
    if (evt.request.mode === 'navigate') {
        evt.respondWith(
            fetch(evt.request)
                .then(resp => {
                    // Store a fresh copy for next time (if we have a cache name)
                    if (CURRENT_CACHE) {
                        const copy = resp.clone();
                        caches.open(CURRENT_CACHE).then(c => c.put(evt.request, copy));
                    }
                    return resp;
                })
                .catch(() => {
                    // Offline or network error -> try the cache first.
                    return caches.match(evt.request)
                        .then(cached => cached || caches.match('/404.html'));
                })
        );
      return;
    }

    // All other asset requests (CSS, JS, images, favicons, etc.)
    evt.respondWith(
        fetch(evt.request)
            .then(networkResp => {
                // Save a copy in the versioned cache (if we know the name)
                if (CURRENT_CACHE) {
                    const clone = networkResp.clone();
                    caches.open(CURRENT_CACHE).then(c => c.put(evt.request, clone));
                }
                return networkResp;
            })
            .catch(() => caches.match(evt.request))
    );
});
