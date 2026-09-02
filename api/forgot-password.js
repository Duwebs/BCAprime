// ============================================================
// BCAPrime — api/forgot-password.js
// Emails a secure password-reset link (Firebase) with the branded
// template. Never reveals whether an email exists (anti-enumeration).
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');
const { sendEmail, APP_URL } = require('./_lib/email');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (error) {
    return send(res, 400, { error: 'Invalid JSON' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return send(res, 400, { error: 'Missing email' });

  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    // Silent no-op: do not reveal whether this email is registered.
    return send(res, 200, { ok: true, sent: false });
  }

  const resetUrl = await auth.generatePasswordResetLink(email, { url: APP_URL + '/' });

  await sendEmail({
    to: email,
    subject: 'Reset your BCAPrime password',
    preheader: 'Use the link below to choose a new BCAPrime password.',
    eyebrow: 'Security',
    title: 'Reset your password',
    bodyHtml: `
      <p style="margin:0 0 16px;">We received a request to reset the password for <strong>${email}</strong>. If that was you, tap the button below to choose a new password.</p>
      <p style="margin:0;font-size:13px;color:#7a8c98;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    ctaNote: 'This link expires shortly. It will ask you to sign in, then let you set a new password.',
    plainText: [
      'Reset your BCAPrime password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email — your password will not change.',
    ].join('\n'),
  });

  return send(res, 200, { ok: true, sent: true });
});