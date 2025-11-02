/*=====================================================================
  Provinent Scripture Study – Service Worker
  =====================================================================
  
  Service Worker for offline functionality and resource caching.
  Handles static assets, Bible API requests, PDFs, and external resources.
  
  Features:
  - Precaching of static assets
  - Intelligent API caching with freshness validation
  - PDF caching with size limits
  - Graceful offline fallbacks
  - Cache versioning and cleanup
=====================================================================*/

import { APP_VERSION } from "./modules/state";

// Cache version configuration - increment when cache structure changes
const CACHE_VERSION = {
  static: 'v2',    // Increment when static assets change
  api: 'v1',       // Increment when API response format changes
  pdf: 'v1'        // Increment when PDF handling logic changes
};

// Cache names with versioning for proper cache invalidation
const CACHE_NAME = `provinent-scripture-${APP_VERSION}-${CACHE_VERSION.static}`;
const API_CACHE_NAME = `provinent-api-cache-${CACHE_VERSION.api}`;
const OFFLINE_PDF_CACHE = `provinent-pdf-cache-${CACHE_VERSION.pdf}`;

// Cache expiration settings
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours for API responses
const PDF_SIZE_LIMIT = 10 * 1024 * 1024;   // 10MB maximum PDF cache size

// Static assets to pre-cache for offline functionality
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
  // Add any other core static assets here
];


/* ====================================================================
   SERVICE WORKER LIFECYCLE EVENTS
   ==================================================================== */

/**
 * INSTALL EVENT
 * Pre-caches static assets during service worker installation
 */
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
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Pre-caching failed:', error);
      })
  );
});

/**
 * ACTIVATE EVENT
 * Cleans up old caches and claims clients for immediate control
 */
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
        // Manage sizes of current caches on activation
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


/* ====================================================================
   FETCH EVENT HANDLING
   Intercepts and manages network requests
   ==================================================================== */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Route requests to appropriate handlers based on URL patterns
  if (url.origin === 'https://bible.helloao.org') {
    // Bible API requests - cache with freshness validation
    event.respondWith(handleApiRequest(event.request));
  }
  else if (url.hostname.includes('biblehub.com') || 
           url.hostname.includes('biblegateway.com') ||
           url.hostname.includes('bible.com')) {
    // External Bible resources - network first, offline fallback
    event.respondWith(handleExternalBibleResource(event.request));
  }
  else if (url.pathname.endsWith('.pdf')) {
    // PDF files - cache with size limits
    event.respondWith(handlePdfRequest(event.request));
  }
  else if (PRECACHE_URLS.includes(url.pathname) || 
           PRECACHE_URLS.includes(url.pathname + '/')) {
    // Static assets - cache first, network fallback
    event.respondWith(handleStaticAssetRequest(event.request));
  }
});


/* ====================================================================
   REQUEST HANDLER FUNCTIONS
   ==================================================================== */

/**
 * Handles Bible API requests with cache-first strategy and freshness validation
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} - The response from cache or network
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Return fresh cached response if available
  if (cachedResponse) {
    const cacheTime = new Date(cachedResponse.headers.get('sw-cache-time'));
    if (Date.now() - cacheTime.getTime() < MAX_CACHE_AGE) {
      console.log('[Service Worker] Serving fresh cached API response');
      return cachedResponse;
    }
  }
  
  try {
    // Fetch fresh response from network
    console.log('[Service Worker] Fetching fresh API response from network');
    const networkResponse = await fetch(request);
    
    // Cache successful responses with timestamp
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
      
      // Manage cache size after adding new entry
      await manageCacheSize(API_CACHE_NAME, 100); // 100 API responses max
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

/**
 * Handles external Bible resource requests with network-first strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} - The network response or offline fallback
 */
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

/**
 * Handles PDF requests with caching and size limitations
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} - The cached or network PDF response
 */
async function handlePdfRequest(request) {
  const cache = await caches.open(OFFLINE_PDF_CACHE);
  const cachedPdf = await cache.match(request);
  
  // Return cached PDF if available
  if (cachedPdf) {
    console.log('[Service Worker] Serving cached PDF:', request.url);
    return cachedPdf;
  }
  
  try {
    console.log('[Service Worker] Fetching PDF from network:', request.url);
    const response = await fetch(request);
    
    // Cache successful PDF responses within size limit
    if (response.status === 200) {
      const contentLength = response.headers.get('content-length');
      if (!contentLength || parseInt(contentLength) <= PDF_SIZE_LIMIT) {
        await cache.put(request, response.clone());
        console.log('[Service Worker] Cached PDF:', request.url);
        
        // Manage PDF cache size after adding new entry
        await manageCacheSize(OFFLINE_PDF_CACHE, 5); // 5 PDFs max (they're large)
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

/**
 * Handles static asset requests with cache-first strategy
 * @param {Request} request - The fetch request
 * @returns {Promise<Response>} - The cached or network response
 */
async function handleStaticAssetRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving cached static asset:', request.url);
      return cachedResponse;
    }
    
    // Fall back to network
    console.log('[Service Worker] Fetching static asset from network:', request.url);
    return await fetch(request);
  } 
  catch (error) {
    console.error('[Service Worker] Static asset unavailable:', request.url);
    
    // Provide basic offline page for document requests
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
    
    throw error; // Re-throw for other asset types
  }
}


/* ====================================================================
   MESSAGE HANDLING
   Communication with client pages for cache management
   ==================================================================== */

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


/* ====================================================================
   UTILITY FUNCTIONS
   ==================================================================== */

/**
 * Manages cache size by removing oldest entries when limit exceeded
 * @param {string} cacheName - Name of the cache to manage
 * @param {number} maxSize - Maximum number of entries to retain
 * @returns {Promise<void>}
 */
async function manageCacheSize(cacheName, maxSize = 50) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    if (requests.length > maxSize) {
      // Get cache metadata to sort by usage time (simplified LRU)
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

