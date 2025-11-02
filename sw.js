import { APP_VERSION } from "./modules/state";
const CACHE_VERSION = {
  static: 'v2',    
  api: 'v1',       
  pdf: 'v1'        
};
const CACHE_NAME = `provinent-scripture-${APP_VERSION}-${CACHE_VERSION.static}`;
const API_CACHE_NAME = `provinent-api-cache-${CACHE_VERSION.api}`;
const OFFLINE_PDF_CACHE = `provinent-pdf-cache-${CACHE_VERSION.pdf}`;
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; 
const PDF_SIZE_LIMIT = 10 * 1024 * 1024;   
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/api.js',
  '/main.js',
  '/navigation.js',
  '/passage.js',
  '/pdf.js',
  '/settings.js',
  '/state.js',
  '/strongs.js',
  '/ui.js',
  '/styles.css',
  '/manifest.json'
];
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing and pre-caching static assets');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets:', PRECACHE_URLS);
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] Pre-caching complete, skipping waiting');
        return self.skipWaiting(); 
      })
      .catch((error) => {
        console.error('[Service Worker] Pre-caching failed:', error);
      })
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== OFFLINE_PDF_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName)
                .catch((error) => {
                  console.warn('[Service Worker] Failed to delete cache:', cacheName, error);
                });
            }
          })
        );
      })
      .then(() => {
        return Promise.all([
          manageCacheSize(API_CACHE_NAME, 100),
          manageCacheSize(OFFLINE_PDF_CACHE, 5)
        ]);
      })
      .then(() => {
        console.log('[Service Worker] Cache cleanup complete, claiming clients');
        return self.clients.claim();
      })
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === 'https://bible.helloao.org') {
    event.respondWith(handleApiRequest(event.request));
  }
  else if (url.hostname.includes('biblehub.com') || 
           url.hostname.includes('biblegateway.com') ||
           url.hostname.includes('bible.com')) {
    event.respondWith(handleExternalBibleResource(event.request));
  }
  else if (url.pathname.endsWith('.pdf')) {
    event.respondWith(handlePdfRequest(event.request));
  }
  else if (PRECACHE_URLS.includes(url.pathname) || 
           PRECACHE_URLS.includes(url.pathname + '/')) {
    event.respondWith(handleStaticAssetRequest(event.request));
  }
});
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    const cacheTime = new Date(cachedResponse.headers.get('sw-cache-time'));
    if (Date.now() - cacheTime.getTime() < MAX_CACHE_AGE) {
      console.log('[Service Worker] Serving fresh cached API response');
      return cachedResponse;
    }
  }
  try {
    console.log('[Service Worker] Fetching fresh API response from network');
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cache-time', new Date().toISOString());
      const responseToCache = new Response(
        await networkResponse.clone().blob(),
        {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: headers
        }
      );
      await cache.put(request, responseToCache);
      console.log('[Service Worker] Cached fresh API response');
      await manageCacheSize(API_CACHE_NAME, 100); 
    }
    return networkResponse;
  } 
  catch (error) {
    console.error('[Service Worker] API request failed, returning offline response');
    return new Response(
      JSON.stringify({ 
        error: 'Offline mode - Bible data not available',
        message: 'Please connect to the internet to access Scripture data'
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
async function handleExternalBibleResource(request) {
  try {
    console.log('[Service Worker] Fetching external Bible resource:', request.url);
    return await fetch(request);
  } 
  catch (error) {
    console.warn('[Service Worker] External resource unavailable offline:', request.url);
    return new Response(
      `<html>
        <body>
          <h2>Offline Mode</h2>
          <p>External Bible resources from ${new URL(request.url).hostname} 
             are not available offline.</p>
          <p>Please connect to the internet to access this resource.</p>
        </body>
      </html>`,
      { 
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}
async function handlePdfRequest(request) {
  const cache = await caches.open(OFFLINE_PDF_CACHE);
  const cachedPdf = await cache.match(request);
  if (cachedPdf) {
    console.log('[Service Worker] Serving cached PDF:', request.url);
    return cachedPdf;
  }
  try {
    console.log('[Service Worker] Fetching PDF from network:', request.url);
    const response = await fetch(request);
    if (response.status === 200) {
      const contentLength = response.headers.get('content-length');
      if (!contentLength || parseInt(contentLength) <= PDF_SIZE_LIMIT) {
        await cache.put(request, response.clone());
        console.log('[Service Worker] Cached PDF:', request.url);
        await manageCacheSize(OFFLINE_PDF_CACHE, 5); 
      }
    }
    return response;
  } 
  catch (error) {
    console.warn('[Service Worker] PDF unavailable offline:', request.url);
    return new Response(
      'PDF not available offline. Please connect to the internet to access this resource.',
      { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }
}
async function handleStaticAssetRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving cached static asset:', request.url);
      return cachedResponse;
    }
    console.log('[Service Worker] Fetching static asset from network:', request.url);
    return await fetch(request);
  } 
  catch (error) {
    console.error('[Service Worker] Static asset unavailable:', request.url);
    if (event.request.destination === 'document') {
      return new Response(
        `<html>
          <body>
            <h1>Offline</h1>
            <p>Provident Scripture Study is currently offline.</p>
            <p>Some features may be limited without an internet connection.</p>
          </body>
        </html>`,
        {
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    throw error; 
  }
}
self.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'CLEAR_CACHE':
      console.log('[Service Worker] Clearing caches per client request');
      caches.delete(CACHE_NAME).catch(console.warn);
      caches.delete(API_CACHE_NAME).catch(console.warn);
      break;
    case 'CACHE_PDF':
      console.log('[Service Worker] Caching PDF from client data:', event.data.url);
      caches.open(OFFLINE_PDF_CACHE)
        .then(cache => cache.put(event.data.url, new Response(event.data.data)))
        .catch(console.error);
      break;
    default:
      console.log('[Service Worker] Received unknown message:', event.data.type);
  }
});
async function manageCacheSize(cacheName, maxSize = 50) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    if (requests.length > maxSize) {
      const excessCount = requests.length - maxSize;
      const excessRequests = requests.slice(0, excessCount);
      await Promise.all(excessRequests.map(request => cache.delete(request)));
      console.log(`[Service Worker] Trimmed ${excessCount} entries from ${cacheName}`);
    }
  } 
  catch (error) {
    console.error(`[Service Worker] Failed to manage cache size for ${cacheName}:`, error);
  }
}