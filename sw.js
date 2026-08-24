const CACHE_NAME = 'bcaprime-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './push-subscribe.js',
  './manifest.webmanifest',
  './firebase-config.js',
  './supabase-config.js',
  './assets/logo.png'
];


self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || caches.match('./index.html')))
  );
});

/* ============================================================
   Web Push notifications
   Payload JSON: { title, body, url, tag, icon, badge }
   ============================================================ */
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'BCAPrime', body: event.data ? event.data.text() : 'New update available' };
  }

  const title = payload.title || 'BCAPrime';
  const options = {
    body: payload.body || '',
    icon: payload.icon || './assets/logo.png',
    badge: payload.badge || './assets/logo.png',
    image: payload.image || undefined,
    dir: 'auto',
    lang: 'en-IN',
    tag: payload.tag || 'bcaprime-update',          // replaces older notification of same tag
    renotify: true,                                 // buzz again even if tag matches
    requireInteraction: false,
    silent: false,                                  // let the OS play its alert sound
    vibrate: [90, 50, 90, 50, 160],                 // premium double-tap pulse pattern
    timestamp: Date.now(),
    data: { url: payload.url || './index.html' },
    actions: [
      { action: 'open', title: 'Open now' },
      { action: 'dismiss', title: 'Later' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus an existing BCAPrime window if one is open, else open a new one
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'push-clicked', url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

/* Allow the page to ask the SW to show a local notification (in-app preview) */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'show-notification') {
    self.registration.showNotification(event.data.title || 'BCAPrime', event.data.options || {});
  }
});

