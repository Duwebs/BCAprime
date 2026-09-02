// ============================================================
// BCAPrime — api/send-otp.js
// Issues and emails a branded 6-digit OTP for a freshly signed-up
// user. The code is stored hashed server-side with a short expiry.
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { getAuth } = require('./_lib/firebaseAdmin');
const { sendEmail, APP_URL, BRAND } = require('./_lib/email');
const { createOtp } = require('./_lib/otp');

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
  const email = (body.email || user.email || '').toString().trim().toLowerCase();
  if (!email) return send(res, 400, { error: 'No email address is associated with this account.' });

  // Already verified? No need to send another code.
  if (user.emailVerified) return send(res, 200, { ok: true, alreadyVerified: true });

  const code = await createOtp({ uid: decoded.uid, email });

  const codeBoxes = code
    .split('')
    .map(
      (c) =>
        `<span style="display:inline-block;width:38px;height:50px;line-height:50px;font-size:24px;font-weight:700;color:${BRAND};border:1px solid #d8e3e8;border-radius:10px;margin:0 3px;background:#f7fbfc;">${c}</span>`
    )
    .join('');

  await sendEmail({
    to: email,
    subject: 'Your BCAPrime verification code',
    preheader: 'Your BCAPrime verification code is ' + code + '.',
    eyebrow: 'Verify your email',
    title: 'Your verification code',
    bodyHtml: `
      <p style="margin:0 0 16px;">Hi there! Thanks for signing up. Enter this 6-digit code on the verification screen to confirm your email:</p>
      <p style="margin:0 0 18px;text-align:center;">${codeBoxes}</p>
      <p style="margin:0;font-size:13px;color:#7a8c98;">The code expires in 12 minutes and can be used only once. You can also verify by clicking the link in the other email we sent you.</p>`,
    ctaLabel: 'Open BCAPrime to enter the code',
    ctaUrl: APP_URL + '/',
    plainText: [
      'Your BCAPrime verification code is: ' + code,
      '',
      'Enter it on the verification screen. It expires in 12 minutes and can be used only once.',
      '',
      'Open the app at: ' + APP_URL,
    ].join('\n'),
  });

  return send(res, 200, { ok: true, sent: true, expiresInMinutes: 12 });
});