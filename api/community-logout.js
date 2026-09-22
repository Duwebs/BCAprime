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
   BCAPrime - api/community-logout.js
   Ends a student's COMMUNITY CHAT session without touching the
   main BCAPrime login (the Firebase session stays alive, so the
   library keeps working). It revokes community membership so the
   student must run phone verification again before rejoining:

     1. user_profiles.is_phone_verified = false  (RLS gate closes)
     2. phone_verified_at = null
     3. unlink the phone from the Firebase account - Firebase
        refuses to link a number that is already attached to the
        account, so without this step re-verifying with the SAME
        number would fail.

   Required Vercel env vars: FIREBASE_SERVICE_ACCOUNT_JSON,
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
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

  // 1) Close the community gate: the chat_messages insert policy checks this
  //    flag, so the student can no longer post until they verify again.
  const db = supabase();
  const { error } = await db
    .from('user_profiles')
    .update({
      is_phone_verified: false,
      phone_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('uid', decoded.uid);

  if (error) {
    return send(res, 500, { error: 'Could not update profile: ' + (error.message || error) });
  }

  // 2) Unlink the Firebase phone number so the student can verify again later
  //    with the same number (or a different one). Non-fatal: the gate above
  //    is already closed even if this fails.
  let unlinked = false;
  try {
    const user = await auth.getUser(decoded.uid);
    if (user.phoneNumber) {
      await auth.updateUser(decoded.uid, { phoneNumber: null });
      unlinked = true;
    }
  } catch (e) {
    console.error('[BCAPrime] community-logout: could not unlink phone', e && e.message);
  }

  return send(res, 200, { ok: true, loggedOut: true, unlinked });
});
