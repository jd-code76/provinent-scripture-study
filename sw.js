const CORE_ASSETS = [
    '/',                     
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
    '/sw.js',                
    '/404.html',             
    '/favicons/apple-touch-icon.png',
    '/favicons/favicon.ico',
    '/favicons/favicon-16x16.png',
    '/favicons/favicon-32x32.png'
];
let CURRENT_CACHE = null;   
self.addEventListener('message', event => {
    if (event.data?.type === 'VERSION') {
        const version = event.data.version;
        CURRENT_CACHE = `provinent-cache-v${version}`;
        preCacheCoreAssets();          
   }
});
async function preCacheCoreAssets() {
    if (!CURRENT_CACHE) return;   
    const cache = await caches.open(CURRENT_CACHE);
    try {
        await cache.addAll(
            CORE_ASSETS.map(u => new Request(u, { credentials: 'same-origin' }))
        );
        console.log('Core assets cached under', CURRENT_CACHE);
    } catch (e) {
        console.error('Failed to pre‑cache core assets', e);
    }
}
self.addEventListener('install', evt => {
    self.skipWaiting();   
});
self.addEventListener('activate', evt => {
    evt.waitUntil(
        (async () => {
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
            await self.clients.claim();
        })()
    );
});
self.addEventListener('fetch', evt => {
    if (evt.request.method !== 'GET') return;
    if (evt.request.mode === 'navigate') {
        evt.respondWith(
            fetch(evt.request)
                .then(resp => {
                    if (CURRENT_CACHE) {
                        const copy = resp.clone();
                        caches.open(CURRENT_CACHE).then(c => c.put(evt.request, copy));
                    }
                    return resp;
                })
                .catch(() => {
                    return caches.match(evt.request)
                        .then(cached => cached || caches.match('/404.html'));
                })
        );
      return;
    }
    evt.respondWith(
        fetch(evt.request)
            .then(networkResp => {
                if (CURRENT_CACHE) {
                    const clone = networkResp.clone();
                    caches.open(CURRENT_CACHE).then(c => c.put(evt.request, clone));
                }
                return networkResp;
            })
            .catch(() => caches.match(evt.request))
    );
});