self.addEventListener('fetch', (event) => {
    // For navigation requests, serve index.html for all paths
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('/index.html');
            })
        );
        return;
    }
    
    // For all other requests, use network-first strategy
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
