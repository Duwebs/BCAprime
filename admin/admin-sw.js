/* ============================================================
   BCAPrime Admin — admin-sw.js
   Minimal service worker for the admin panel.
   Handles push notifications (admin alerts: new uploads, new signups)
   and caches the app shell for offline use.
   ============================================================ */
const CACHE_NAME = 'bcaprime-admin-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME));
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

/* ---- Web Push: admin new-upload / new-signup alerts ---- */
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: 'BCAPrime Admin',
      body: event.data ? event.data.text() : 'New activity'
    };
  }

  const title = payload.title || 'BCAPrime Admin';
  const options = {
    body: payload.body || '',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    tag: payload.tag || 'admin-alert',
    renotify: true,
    requireInteraction: true,   /* admin alert stays until dismissed */
    data: {
      url: payload.url || './admin.html',
      resourceId: payload.resourceId || null,
      type: payload.alertType || 'upload'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './admin.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('admin.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});