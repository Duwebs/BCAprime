// ============================================================
// BCAPrime — api/_lib/firebaseAdmin.js
// Lazily initialises Firebase Admin from a service-account JSON
// stored in the FIREBASE_SERVICE_ACCOUNT_JSON env var.
//
// Required secret (Vercel project env):
//   FIREBASE_SERVICE_ACCOUNT_JSON = <contents of service-account key JSON>
//
// NEVER expose this secret to the browser; it only lives server-side.
// ============================================================
'use strict';

const admin = require('firebase-admin');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('[BCAPrime] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.', error.message);
    return null;
  }
}

let app = null;
function auth() {
  if (app) return app.auth();
  if (!loadServiceAccount()) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in Vercel env.');
  }
  app = admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
  });
  return app.auth();
}

function isConfigured() {
  try {
    return !!loadServiceAccount();
  } catch (error) {
    return false;
  }
}

module.exports = { getAuth: auth, admin, isConfigured };