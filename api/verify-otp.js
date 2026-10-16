// ============================================================
// BCAPrime — api/verify-otp.js
// Verifies the 6-digit OTP a user typed.
// On success the SERVER (service role) flips
// user_profiles.is_email_verified to true — the browser never
// gets to decide trust.
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { verifySupabaseToken, upsertProfileVerified } = require('./_lib/supabaseAuth');
const { verifyOtp } = require('./_lib/otp');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (error) {
    return send(res, 400, { error: 'Invalid JSON' });
  }

  const idToken = body.idToken || body.accessToken;
  if (!idToken) return send(res, 400, { error: 'Missing idToken' });

  // Supabase access token verify karo (GoTrue /auth/v1/user se).
  const decoded = await verifySupabaseToken(idToken);
  if (!decoded) return send(res, 401, { error: 'Invalid ID token' });

  // Normalise the code (numeric 6-digit like we issue it; strip spaces).
  const code = String(body.code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    return send(res, 400, { error: 'Please enter the 6-digit code exactly as sent.' });
  }

  const email = (body.email || decoded.email || '').toString().trim().toLowerCase();

  const failure = await verifyOtp({ uid: decoded.uid, email, code });
  if (failure) {
    return send(res, 400, { error: failure });
  }

  // Server-side authority: mark the account as verified.
  // UPSERT (PATCH se safe — profile row abhi exist na bhi karti ho).
  await upsertProfileVerified(decoded.uid, email);

  return send(res, 200, { ok: true, verified: true });
});