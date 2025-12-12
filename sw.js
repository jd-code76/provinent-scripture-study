const CORE_ASSETS = [
    '/', '/index.html', '/styles.css', '/main.js',
    '/modules/api.js', '/modules/highlights.js', '/modules/hotkeys.js',
    '/modules/navigation.js', '/modules/passage.js', '/modules/settings.js',
    '/modules/state.js', '/modules/strongs.js', '/modules/ui.js',
    '/sw.js', '/404.html',
    '/favicons/apple-touch-icon.png', '/favicons/favicon.ico',
    '/favicons/favicon-16x16.png', '/favicons/favicon-32x32.png'
];
let CURRENT_CACHE = null;   
self.addEventListener('message', e => {
    if (e.data?.type === 'VERSION') {
        CURRENT_CACHE = `provinent-cache-v${e.data.version}`;
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
    } catch (err) {
        console.error('Failed to pre‑cache core assets', err);
    }
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', evt => {
    evt.waitUntil(
        (async () => {
            const expected = CURRENT_CACHE ||
                `provinent-cache-v${self.registration.scope}`;
            const names = await caches.keys();
            await Promise.all(
                names.map(name =>
                    name !== expected && name.startsWith('provinent-cache-v')
                        ? caches.delete(name)
                        : null
                )
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
                    if (shouldCache(evt.request, resp)) {
                        const copy = resp.clone();
                        caches.open(CURRENT_CACHE).then(c => c.put(evt.request, copy));
                    }
                    return resp;
                })
                .catch(() => caches.match(evt.request).then(c => c || caches.match('/404.html')))
        );
        return;
    }
    evt.respondWith(
        fetch(evt.request)
            .then(resp => {
                if (shouldCache(evt.request, resp)) {
                    const copy = resp.clone();
                    caches.open(CURRENT_CACHE).then(c => c.put(evt.request, copy));
                }
                return resp;
            })
            .catch(() => caches.match(evt.request))
    );
});
function shouldCache(request, response) {
    return (
        CURRENT_CACHE &&
        isHttpScheme(request.url) &&
        response.type !== 'opaque'
    );
}
function isHttpScheme(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
        return false;
    }
}