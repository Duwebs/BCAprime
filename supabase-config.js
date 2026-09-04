const SUPABASE_URL = 'https://kjesjaakjddfxykisssh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

/* ---- Auth / email functions (Vercel serverless) ----
   The functions ONLY live on Vercel. So the API origin always points at the
   Vercel domain — even when this static site is served from Firebase Hosting
   (bcaprimeweb.firebaseapp.com) or a preview domain. Locally (vercel dev) it
   runs on http://localhost:3000. */
const AUTH_API_ORIGIN = (function () {
  try {
    var host = location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1') {
      return location.protocol + '//' + location.hostname + ':' + (location.port || '3000');
    }
    // Everything else (vercel.app, firebaseapp.com, custom domain, preview) ->
    // call the functions on the Vercel deployment where they actually live.
    return 'https://bcaprime.vercel.app';
  } catch (e) {
    return 'https://bcaprime.vercel.app';
  }
})();

const AUTH_API = {
  sendOtp: AUTH_API_ORIGIN + '/api/send-otp',
  verifyOtp: AUTH_API_ORIGIN + '/api/verify-otp',
  googleWelcome: AUTH_API_ORIGIN + '/api/google-welcome',
  forgotPassword: AUTH_API_ORIGIN + '/api/forgot-password',
};

/* ---- Web Push (VAPID) ----
   Public key is safe for the browser. The matching private key lives only
   as a Supabase Edge Function secret (VAPID_PRIVATE_KEY). */
const VAPID_PUBLIC_KEY = 'BOp0K96ECGm8PnrQQL3aFNQoQAAgbeaEnUJSx16jT4D_WSkAk95OqTYn48RpxwId3tieyHC1w_JN2SYccQKyWfQ';
const SEND_PUSH_FUNCTION_URL = SUPABASE_URL + '/functions/v1/send-push';

/* ---- Google Drive Picker (upload import) ----
   Setup (Google Cloud Console):
   1. Enable "Google Drive API" + create an API Key (restricted to your domain).
   2. OAuth consent screen -> add scope drive.readonly.
   3. Credentials -> OAuth Client ID (Web) -> authorized JS origins:
      https://bcaprime.vercel.app, http://localhost:3000
   Dono values fill karo, phir "Import from Google Drive" button kaam karega. */
const GOOGLE_CLIENT_ID = ''; // e.g. '1234567890-abc.apps.googleusercontent.com'
const GOOGLE_API_KEY = '';   // e.g. 'AIzaSy...'

