const SUPABASE_URL = 'https://kjesjaakjddfxykisssh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

/* ---- Auth / email functions (Vercel serverless) ----
   In production these live at https://bcaprime.vercel.app/api/* .
   Locally (vercel dev) the same paths run on http://localhost:3000. */
const AUTH_API_ORIGIN = (function () {
  try {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const port = location.port || '3000';
      return location.protocol + '//' + location.hostname + ':' + port;
    }
    if (location.protocol === 'https:' && location.hostname === 'bcaprime.vercel.app') {
      return 'https://bcaprime.vercel.app';
    }
    // Fallback: use the same origin (works on any preview/domain where the
    // function is deployed alongside the static site).
    return location.protocol + '//' + location.host;
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

