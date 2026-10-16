// ============================================================
// BCAPrime — firebase-config.js  (REMOVED — auth moved to Supabase)
// This tombstone file is left only because file deletion is not
// available in this environment — safe to delete. Nothing loads
// it anymore (index.html / sw.js / analytics all updated).
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCFYgD5VBIw0YEAkMhRcIV2VVQQGSN7xWs',
  authDomain: 'bcaprimeweb.firebaseapp.com',
  projectId: 'bcaprimeweb',
  storageBucket: 'bcaprimeweb.firebasestorage.app',
  messagingSenderId: '968038469293',
  appId: '1:968038469293:web:bce27901134b5d7f0a0024',
  measurementId: 'G-F027ECV443'
};

const firebaseApp =
  typeof firebase !== 'undefined' &&
  Object.values(FIREBASE_CONFIG).every(value => value && !value.startsWith('YOUR_'))
    ? firebase.initializeApp(FIREBASE_CONFIG)
    : null;

/* ---- Auth persistence (CRITICAL for session survival across restarts) ----
   browserLocalPersistence = IndexedDB me refresh token save hota hai, isliye
   page reload / app band-kholne par user logged-in rehta hai. Ye EXPLICITLY
   set karna zaroori hai — warna naye users restart par guest ban jaate hain
   aur unke downloads (signed-URL token ke bina) fail hote hain. */
if (firebaseApp && typeof firebase !== 'undefined' && firebase.auth) {
  try {
    var __bcaPersistP = firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    if (__bcaPersistP && typeof __bcaPersistP.then === 'function') {
      __bcaPersistP.then(
        function () { try { window.__bcaPersistReady = true; } catch (e) {} },
        function () { try { window.__bcaPersistReady = false; } catch (e) {} }
      );
    } else {
      try { window.__bcaPersistReady = true; } catch (e) {}
    }
  } catch (e) {
    /* Persistence set na ho paye to SDK default par chalne do (fail open). */
    try { window.__bcaPersistReady = false; } catch (e2) {}
  }
} else {
  try { window.__bcaPersistReady = false; } catch (e) {}
}