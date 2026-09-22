'use strict';

const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');
const { createClient } = require('@supabase/supabase-js');

let cachedSupabase = null;
function supabase() {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

/* ============================================================
   BCAPrime — api/mark-phone-verified.js
   Called by the client after Firebase Phone Auth SMS verification
   succeeds (linkWithPhoneNumber().confirm(code)). Firebase sets
   user.phoneNumber ONLY when the SMS code is confirmed server-side —
   so checking that field here is the authoritative proof that the
   number is genuinely verified. We then mirror that into Supabase.
   ============================================================ */
module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (error) {
    return send(res, 400, { error: 'Invalid JSON' });
  }

  const idToken = body.idToken;
  if (!idToken) return send(res, 400, { error: 'Missing idToken' });

  const auth = getAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (error) {
    return send(res, 401, { error: 'Invalid ID token' });
  }

  const user = await auth.getUser(decoded.uid);

  // Firebase only sets phoneNumber AFTER a successful SMS verification
  // (signInWithPhoneNumber / linkWithPhoneNumber + confirm). If it's
  // missing, the phone was NOT verified — reject.
  if (!user.phoneNumber) {
    return send(res, 400, { error: 'Phone number is not verified in Firebase.' });
  }

  const db = supabase();
  const { error } = await db
    .from('user_profiles')
    .update({
      is_phone_verified: true,
      mobile: user.phoneNumber,
      phone_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('uid', decoded.uid);

  if (error) {
    return send(res, 500, { error: 'Could not update profile: ' + (error.message || error) });
  }

  return send(res, 200, { ok: true, verified: true, phone: user.phoneNumber });
});