// ============================================================
// BCAPrime — api/_lib/otp.js
// Secure 6-digit email OTP handling.
//   - Codes are stored HASHED (never plaintext) in the email_otps
//     table, so a DB leak cannot be replayed to verify accounts.
//   - Short (12 min) expiry + one-time-use + attempt limiting.
//   - Verification is server-side only (Admin SDK flips
//     emailVerified) — the browser never decides trust.
//
// Supabase secrets needed:
//   SUPABASE_URL               (project URL)
//   SUPABASE_SERVICE_ROLE_KEY  (service role key)
// ============================================================
'use strict';

const crypto = require('crypto');

const OTP_TTL_MS = 12 * 60 * 1000; // 12 minutes
const MAX_ATTEMPTS = 5;

let cachedSupabase = null;
function supabase() {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
  }
  const { createClient } = require('@supabase/supabase-js');
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

function generateOtp() {
  // Numeric 6-digit code (000000–999999) — matches the "6-digit" UX expectation.
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(code) {
  // HMAC-SHA256 with a server-side pepper keeps the digest unguessable.
  const pepper = process.env.OTP_PEPPER || 'bca-otp-pepper';
  return crypto.createHmac('sha256', pepper).update(String(code)).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function createOtp({ uid, email }) {
  const db = supabase();
  const code = generateOtp();
  const { error } = await db.from('email_otps').upsert({
    uid,
    email: String(email).toLowerCase().trim(),
    code_hash: hashOtp(code),
    attempts: 0,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    created_at: new Date().toISOString(),
    used_at: null,
  });
  if (error) throw error;
  return code; // plaintext only returned to the caller for immediate emailing
}

// Returns null on success, or an error message string on failure.
async function verifyOtp({ uid, email, code }) {
  const db = supabase();
  const clean = String(email).toLowerCase().trim();
  const { data, error } = await db
    .from('email_otps')
    .select('uid, code_hash, attempts, expires_at, used_at')
    .eq('uid', uid)
    .eq('email', clean)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 'No verification code was issued for this email.';

  if (data.used_at) return 'This code has already been used. Request a new one.';
  if (new Date(data.expires_at).getTime() < Date.now()) return 'This code has expired. Request a new one.';
  if ((data.attempts || 0) >= MAX_ATTEMPTS) return 'Too many wrong attempts. Request a new code.';

  if (!safeEqual(data.code_hash, hashOtp(code))) {
    // Increment the attempt counter on failure.
    await db
      .from('email_otps')
      .update({ attempts: (data.attempts || 0) + 1 })
      .eq('uid', uid)
      .eq('email', clean);
    return 'That code is incorrect. Please try again.';
  }

  // Correct code -> mark used (one-time-use).
  const { error: usedError } = await db
    .from('email_otps')
    .update({ used_at: new Date().toISOString() })
    .eq('uid', uid)
    .eq('email', clean);
  if (usedError) throw usedError;
  return null;
}

module.exports = { createOtp, verifyOtp, generateOtp, hashOtp, OTP_TTL_MS, MAX_ATTEMPTS };