/* ============================================================
   BCAPrime — sw.js (VERSION FORWARDER)
   The real service worker lives in firebase-messaging-sw.js
   (offline cache + Firebase Cloud Messaging + VAPID Web Push).
   This file exists so already-registered installs (./sw.js?v=24)
   upgrade in place without losing their registration. It imports
   the canonical implementation into this global scope.
   ============================================================ */
importScripts('./firebase-messaging-sw.js?v=1');