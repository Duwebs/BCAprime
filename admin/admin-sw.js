const ADMIN_CACHE = 'bcaprime-admin-v2';
const ADMIN_SHELL = [
  './',
  './admin.html',
  './admin.css',
  './admin.js',
  '../supabase-config.js',
  './admin-manifest.webmanifest',
  '../assets/logo.png',
  '../assets/icon-192.png',
  '../assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(ADMIN_CACHE).then(cache => cache.addAll(ADMIN_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== ADMIN_CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

/* Network-first with cache fallback — admin data hamesha fresh mile, offline pe cached UI */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN requests ko bypass karo

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(ADMIN_CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || caches.match('./admin.html')))
  );
});