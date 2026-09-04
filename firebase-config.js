// Firebase Authentication configuration for BCAPrime.
// Students log in / sign up through Firebase (email/password + Google/Apple).
// Upload/download/storage stays with Supabase (see supabase-config.js).

// 1. Open Firebase Console > Project settings > Your apps > Web app.
// 2. Copy the "firebaseConfig" values below into this file.
// 3. Enable Email/Password (and optionally Google, Apple) under Authentication > Sign-in method.
// 4. Add your site domain (e.g. bcaprime.vercel.app) under Authentication > Authorized domains.
// 5. Save, reload index.html, and login/signup will use Firebase.

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