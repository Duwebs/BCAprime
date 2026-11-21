/* ============================================================
   BCAPrime Analytics Suite — Service Worker (analytics-sw.js)
   Native PWA offline shell caching + NetworkFirst for live analytics APIs
   ============================================================ */
const CACHE_NAME = 'bcaprime-analytics-v3';
const OFFLINE_URLS = [
  './',
  './index.html',
  './analytics.css?v=4',
  './analytics.js?v=4',
  './analytics-manifest.json',
  '../ui/ui.css',
  '../ui/config.js',
  '../ui/pressable.js',
  '../supabase-config.js',
  '../env.js',
  '../assets/logo.png',
  '../assets/icon-192.png',
  '../assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS.map(u => new Request(u, { cache: 'reload' }))))
      .catch(err => console.warn('[Analytics SW] Precache warning:', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Network-First for Supabase RPC, REST tables, and edge functions (never cache stale analytics data)
  if (
    url.includes('supabase.co') ||
    url.includes('/rest/v1/') ||
    url.includes('/functions/v1/') ||
    url.includes('/api/') ||
    event.request.method !== 'GET'
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-First with Network Revalidation for UI shell & static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
