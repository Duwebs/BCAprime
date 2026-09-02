// ============================================================
// BCAPrime — api/verify-otp.js
// Verifies the 6-digit OTP a user typed.
// On success the SERVER (Admin SDK) flips emailVerified to true —
// the browser never gets to decide trust.
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');
const { verifyOtp } = require('./_lib/otp');

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

  // Normalise the code (numeric 6-digit like we issue it; strip spaces).
  const code = String(body.code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    return send(res, 400, { error: 'Please enter the 6-digit code exactly as sent.' });
  }

  const auth = getAuth();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (error) {
    return send(res, 401, { error: 'Invalid ID token' });
  }

  const user = await auth.getUser(decoded.uid);
  const email = (body.email || user.email || '').toString().trim().toLowerCase();

  const failure = await verifyOtp({ uid: decoded.uid, email, code });
  if (failure) {
    return send(res, 400, { error: failure });
  }

  // Server-side authority: mark the account as verified.
  await auth.updateUser(decoded.uid, { emailVerified: true });

  return send(res, 200, { ok: true, verified: true });
});