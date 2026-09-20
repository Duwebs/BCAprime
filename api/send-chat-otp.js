// ============================================================
// BCAPrime — api/send-chat-otp.js
// Community-Chat verification: ALWAYS issues + emails a fresh
// 6-digit OTP (no "already verified" short-circuit, unlike
// send-otp.js). The same code can ALSO be redeemed on Telegram:
// the student forwards "BCAVERIFY <code>" from their phone to
// the bot (api/phone-webhook.js) to prove number ownership.
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
  const email = (user.email || '').toString().trim().toLowerCase();
  if (!email) return send(res, 400, { error: 'No email is associated with this account.' });

  // Always issue + send a fresh code (community gate needs it even
  // for email-verified accounts — it also gets redeemed on Telegram).
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
    subject: 'Your BCAPrime community verification code',
    preheader: 'Your BCAPrime community verification code is ' + code + '.',
    eyebrow: 'Community verification',
    title: 'Your verification code',
    bodyHtml: `
      <p style="margin:0 0 16px;">To join the BCAPrime Community Chat, use this 6-digit code:</p>
      <p style="margin:0 0 18px;text-align:center;">${codeBoxes}</p>
      <p style="margin:0;font-size:13px;color:#7a8c98;">Enter it in the app, or forward it as <b>BCAVERIFY ${code}</b> to our Telegram bot to verify your number. It expires in 12 minutes and works only once.</p>`,
    ctaLabel: 'Open BCAPrime Community',
    ctaUrl: APP_URL + '/',
    plainText: [
      'Your BCAPrime community verification code is: ' + code,
      '',
      'Enter it in the app, or send "BCAVERIFY ' + code + '" to our Telegram bot to verify your number.',
      'It expires in 12 minutes and works only once.',
      '',
      'Open the app at: ' + APP_URL,
    ].join('\n'),
  });

  return send(res, 200, { ok: true, sent: true, expiresInMinutes: 12 });
});