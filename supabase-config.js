const SUPABASE_URL = 'https://kjesjaakjddfxykisssh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

/* ---- Web Push (VAPID) ----
   Public key is safe for the browser. The matching private key lives only
   as a Supabase Edge Function secret (VAPID_PRIVATE_KEY). */
const VAPID_PUBLIC_KEY = 'BOp0K96ECGm8PnrQQL3aFNQoQAAgbeaEnUJSx16jT4D_WSkAk95OqTYn48RpxwId3tieyHC1w_JN2SYccQKyWfQ';
const SEND_PUSH_FUNCTION_URL = SUPABASE_URL + '/functions/v1/send-push';

