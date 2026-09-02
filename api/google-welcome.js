// ============================================================
// BCAPrime — api/google-welcome.js
// Called once after a user signs in with Google. Google already
// verified their email, so we:
//   1. Confirm the account is truly Google-federated (from the ID token).
//   2. Generate a secure temporary password and set it on the account
//      (server-side only — never in the browser).
//   3. Email it with the user's Name + Email and a prominent
//      "Set your own password" button (a Firebase reset link) so they
//      can immediately replace it with their own.
// Idempotent: a returning Google user is never re-emailed / re-issued
// a temp password.
// ============================================================
'use strict';

const crypto = require('crypto');
const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');
const { sendEmail, APP_URL } = require('./_lib/email');

function generateTempPassword() {
  // ~12 chars of high entropy + required complexity (uppercase, digit, symbol).
  const base = crypto.randomBytes(9).toString('base64url'); // 12 chars
  return base.replace(/[-_]/g, 'X').slice(0, 11) + Math.floor(Math.random() * 10) + '!';
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

  const user = await auth.getUser(decoded.uid);
  const isGoogle = !!(user.providerData && user.providerData.some((p) => p.providerId === 'google.com'));
  if (!isGoogle) {
    return send(res, 400, { error: 'This account is not Google-federated.' });
  }

  const email = (user.email || decoded.email || '').trim().toLowerCase();
  if (!email) {
    return send(res, 400, { error: 'No email address is associated with this account.' });
  }

  // Idempotency guard: never re-email returning Google users.
  const claims = user.customClaims || {};
  if (claims.bcaWelcomeSent) {
    return send(res, 200, { ok: true, alreadySent: true });
  }

  // 1) Set a secure temporary password so they can use Email/Password later.
  const tempPassword = generateTempPassword();
  await auth.updateUser(decoded.uid, { password: tempPassword });

  // 2) A Firebase reset link = the prominent "Set your own password" button.
  const resetUrl = await auth.generatePasswordResetLink(email, { url: APP_URL + '/' });

  const name = (user.displayName || body.name || '').trim();
  const first = name.split(/\s+/)[0] || 'there';

  // 3) Branded welcome email with Name + Email + temp password + reset button.
  await sendEmail({
    to: email,
    subject: 'Your BCAPrime account is ready — set your password',
    preheader: 'Welcome to BCAPrime! Here is a secure temporary password and a link to make it your own.',
    eyebrow: 'Welcome',
    title: 'Welcome, ' + first + '!',
    bodyHtml: `
      <p style="margin:0 0 12px;">You're all set — your BCA study library is ready. You signed up with <strong>Google</strong>, but you can also log in later with email &amp; password using the credentials below.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f2f7f9;border:1px solid #e2eaee;border-radius:10px;padding:14px 20px;margin:16px 0;width:100%;">
        <tr><td width="150" style="padding:6px 0;color:#7a8c98;font-size:13px;">Name</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-weight:600;">${name || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Temporary password</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-family:Menlo,Consolas,monospace;font-weight:600;">${tempPassword}</td></tr>
      </table>
      <p style="margin:0 0 6px;">Set your own password now — the temporary one stops working the moment you choose your own.</p>`,
    ctaLabel: 'Set your own password',
    ctaUrl: resetUrl,
    ctaNote: 'This link expires shortly. It opens a secure page to choose your personal password.',
    plainText: [
      'Welcome to BCAPrime!',
      '',
      'You signed up with Google. If you ever want to log in with email & password, use:',
      '',
      '  Name:            ' + (name || '—'),
      '  Email:           ' + email,
      '  Temp password:   ' + tempPassword,
      '',
      'Set your own password here (the temp one stops working once you do):',
      resetUrl,
      '',
      'Store the temporary password somewhere safe until then.',
    ].join('\n'),
  });

  // Mark as done AFTER a successful send so failures are retried later.
  await auth.setCustomUserClaims(decoded.uid, { ...claims, bcaWelcomeSent: true });

  return send(res, 200, { ok: true, alreadySent: false, email });
});