// ============================================================
// BCAPrime — api/verify-phone.js
// Issues a 6-digit phone-verification code for the Community
// Chat gate. The student then sends "BCAVERIFY <code>" to the
// BCAPrime Telegram/WhatsApp bot from THEIR phone — the bot
// webhook (api/phone-webhook.js) proves possession of the number
// and flips user_profiles.is_phone_verified.
//
// Codes are stored HASHED in phone_verifications (service_role
// only). Expiry 15 min, one-time-use, attempt limited.
// ============================================================
'use strict';

const crypto = require('crypto');
const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

let cachedSupabase = null;
function supabase() {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
  const { createClient } = require('@supabase/supabase-js');
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

function hashOtp(code) {
  const pepper = process.env.OTP_PEPPER || 'bca-otp-pepper';
  return crypto.createHmac('sha256', pepper).update('phone:' + String(code)).digest('hex');
}

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

  const db = supabase();

  // Already verified? Nothing to do.
  const { data: profile } = await db
    .from('user_profiles')
    .select('uid, is_phone_verified')
    .eq('uid', decoded.uid)
    .maybeSingle();
  if (profile && profile.is_phone_verified) {
    return send(res, 200, { ok: true, alreadyVerified: true });
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const { error } = await db.from('phone_verifications').upsert({
    uid: decoded.uid,
    code_hash: hashOtp(code),
    attempts: 0,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    used_at: null,
    created_at: new Date().toISOString(),
  }, { onConflict: 'uid' });
  if (error) return send(res, 500, { error: 'Could not issue verification code.' });

  // The code is shown IN THE APP and must be sent by the student from
  // their own WhatsApp/Telegram number. Possession of the code + the
  // bot message originating from that number proves ownership.
  return send(res, 200, {
    ok: true,
    code,
    ttlMinutes: 15,
    instructions: 'Send "BCAVERIFY ' + code + '" to the BCAPrime bot from your WhatsApp/Telegram to verify this number.',
  });
});