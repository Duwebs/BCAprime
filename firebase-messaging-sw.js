/* ---------------------------------------------------------------
   BCAPrime — firebase-messaging-sw.js
   THE canonical service worker for the app. Registered as sw.js?v=25
   (sw.js is a one-line forwarder that importScripts() this file), so
   existing installs upgrade in place.

   Layers:
   1) App shell (same-origin static)  -> network-first, precache
   2) Supabase storage files (PDF/img) -> cache-first (offline files)
   3) Supabase REST (library/chat list) -> network-first w/ cache fallback
   4) Trusted CDNs (firebase, supabase, fonts, font-awesome) -> network-first
   5) Firebase Cloud Messaging (FCM) -> onBackgroundMessage, shown even
      when the page is closed or the phone is locked.
   6) VAPID Web Push (legacy/raw)    -> push handler for non-FCM pushes.
   --------------------------------------------------------------- */
const CACHE_NAME = 'bcaprime-app-v25';
const FILE_CACHE = 'bcaprime-files-v1';
const CDN_CACHE  = 'bcaprime-cdn-v1';
const SUPABASE_HOST = 'kjesjaakjddfxykisssh.supabase.co';
const FCM_SENDER_ID = '968038469293';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './chat.js',
  './whats-new.js',
  './push-subscribe.js',
  './firebase-messaging-sw.js',
  './manifest.webmanifest',
  './firebase-config.js',
  './supabase-config.js',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
const CDN_DOMAINS = ['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net','cdnjs.cloudflare.com'];


/* network-first: online pe fresh, offline pe cached */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      try { await cache.put(request, response.clone()); } catch (e) { /* ignore quota */ }
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/* cache-first: pehle cached, warna download + save (static files khulte hain offline) */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      try { await cache.put(request, response.clone()); } catch (e) { /* ignore quota */ }
    }
    return response;
  } catch (err) {
    throw err;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME && key !== FILE_CACHE && key !== CDN_CACHE)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  /* 2) Supabase storage files (PDF/images/watch) — cache-first, offline re-paid */
  if (!isSameOrigin && url.hostname === SUPABASE_HOST && url.pathname.indexOf('/storage/v1/object/') !== -1) {
    event.respondWith(
      cacheFirst(event.request, FILE_CACHE).catch(() =>
        new Response('', { status: 503, statusText: 'Offline: this file has not been saved yet — open it once while online' })
      )
    );
    return;
  }

  /* 3) Supabase REST data (library/chat metadata) — network-first, offline
        fallback to cached. Only /rest/v1 page reads are cached;
        auth/realtime/functions pass through untouched. */
  if (!isSameOrigin && url.hostname === SUPABASE_HOST && url.pathname.indexOf('/rest/v1/') !== -1) {
    event.respondWith(
      networkFirst(event.request, FILE_CACHE).catch(() =>
        new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
      )
    );
    return;
  }

  /* 4) Trusted CDNs — firebase + supabase libs, fonts, font-awesome (network-first) */
  if (!isSameOrigin && CDN_DOMAINS.includes(url.hostname)) {
    event.respondWith(
      networkFirst(event.request, CDN_CACHE).catch(() =>
        caches.match(event.request).then(r => r || new Response('', { status: 503 }))
      )
    );
    return;
  }

  /* 1) Same-origin app shell (existing network-first with index.html fallback) */
  if (isSameOrigin) {
    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/functions/') || url.pathname.startsWith('/realtime/')) return;
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response || !response.ok || response.type === 'opaque') return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(response => response || caches.match('./index.html')))
    );
  }
});

/* ============================================================
   Firebase Cloud Messaging — background push (lock-screen alerts)
   firebase-config.js (same file the page uses) initializes the app.
   Every FCM message in this app is DATA-ONLY {title,body,url,tag},
   so:
     - foreground: handled by push-subscribe.js onMessage → in-app toast
     - background / app closed / phone locked: handled HERE via
       onBackgroundMessage → system notification (shows on lock screen
       and in the notification center, independent of the browser tab).
   ============================================================ */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
importScripts('./firebase-config.js');

if (typeof firebase !== 'undefined' && firebase.messaging) {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const data = (payload && payload.data) || {};
    const title = (payload && payload.notification && payload.notification.title) || data.title || '💬 New community message';
    const body = (payload && payload.notification && payload.notification.body) || data.body || 'You have a new message.';
    const link = data.url || '/index.html#community';
    const tag = data.tag || 'bcaprime-chat';
    self.registration.showNotification(title, {
      body,
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      data: { url: link },
      actions: [
        { action: 'open', title: 'Open now' },
        { action: 'dismiss', title: 'Later' }
      ]
    });
  });
}

/* ============================================================
   VAPID Web Push (legacy/raw notifications)
   Payload JSON: { title, body, url, tag, icon, badge }
   FCM-sent pushes carry google.c.a.* data keys — those are handled
   by the FCM SDK above, so we skip them here to avoid duplicate
   notifications.
   ============================================================ */
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'BCAPrime', body: event.data ? event.data.text() : 'New update available' };
  }

  const fcmData = (payload && payload.data) || {};
  const isFcmDelivered =
    fcmData['google.c.a.e'] || fcmData['google.c.a.ts'] ||
    (payload && payload.from && payload.from === FCM_SENDER_ID && payload.notification);
  if (isFcmDelivered) return; /* FCM SDK handles these */

  const title = payload.title || 'BCAPrime';
  const options = {
    body: payload.body || '',
    icon: payload.icon || './assets/logo.png',
    badge: payload.badge || './assets/logo.png',
    image: payload.image || undefined,
    dir: 'auto',
    lang: 'en-IN',
    tag: payload.tag || 'bcaprime-update',
    renotify: true,
    requireInteraction: payload.requireInteraction === true || String(payload.tag || '').startsWith('senior-request'),
    silent: false,
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