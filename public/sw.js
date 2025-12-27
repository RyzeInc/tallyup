// TallyUp Service Worker - Conservative Caching Strategy
// Cache: static assets + app shell routes only
// DO NOT cache: authenticated API JSON, user financial records, tokens

const CACHE_VERSION = 'tallyup-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline';

// Static assets and app shell routes that are safe to cache
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/log',
  '/summary',
  '/inbox',
  '/history',
  '/activity',
  '/insights',
  '/recurring',
  '/review',
  '/rules',
  '/settings',
  '/overview',
  '/profile',
  '/home',
  '/manifest.webmanifest',
  '/globals.css'
];

// Install: cache app shell and static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Failed to cache some assets:', err);
        // Continue anyway - partial cache is better than no cache
      });
    }).then(() => {
      console.log('[ServiceWorker] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('tallyup-') && cacheName !== STATIC_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch: network-first with fallback to cache for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER cache authenticated API requests, Convex data, or auth tokens
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.hostname.includes('convex.cloud') ||
    url.hostname.includes('clerk.') ||
    request.headers.get('Authorization') ||
    request.method !== 'GET'
  ) {
    // Pass through - no caching
    return event.respondWith(fetch(request));
  }

  // For static assets: network-first, fallback to cache
  if (
    url.origin === location.origin &&
    (STATIC_ASSETS.includes(url.pathname) ||
     url.pathname.startsWith('/_next/static/') ||
     url.pathname.startsWith('/icons/') ||
     /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?)$/.test(url.pathname))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If it's a page request and not in cache, show offline page
            if (request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            // Otherwise return a generic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
        })
    );
    return;
  }

  // Everything else: network only (no cache)
  event.respondWith(fetch(request));
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
