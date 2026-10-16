// ============================================================
// BCAPrime — api/google-welcome.js
// Called once after a user signs in with Google. Google already
// verified their email, so we:
//   1. Confirm the account is truly Google-federated (from the
//      Supabase token's app_metadata.providers).
//   2. For Google-first signups, set the password the user chose
//      BEFORE the Google picker opened (admin REST — server only).
//   3. Send a branded welcome email with a prominent
//      "Set your own password" button (Supabase recovery link).
// Idempotent: a returning Google user is never re-emailed
// (tracked in app_metadata.welcome_sent).
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const {
  verifySupabaseToken,
  adminSetAppMetadata,
  adminSetPassword,
  adminSetUserMetadata,
  adminRecoveryLink,
} = require('./_lib/supabaseAuth');
const { sendEmail, APP_URL } = require('./_lib/email');

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

  // Optional Google-first signup fields: the username + password the user
  // chose BEFORE the Google account picker opened. If present, we set THAT
  // password (instead of leaving the account OAuth-only) and store the username.
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const chosenPassword = typeof body.password === 'string' ? body.password : '';
  const validUsername = /^[a-z0-9_]{3,20}$/.test(username);
  const validPassword = chosenPassword.length >= 6 && chosenPassword.length <= 128;

  // Supabase access token verify karo (GoTrue /auth/v1/user se).
  const decoded = await verifySupabaseToken(idToken);
  if (!decoded) return send(res, 401, { error: 'Invalid ID token' });

  const isGoogle = Array.isArray(decoded.providers) && decoded.providers.includes('google');
  if (!isGoogle) {
    return send(res, 400, { error: 'This account is not Google-federated.' });
  }

  const email = (decoded.email || '').trim().toLowerCase();
  if (!email) {
    return send(res, 400, { error: 'No email address is associated with this account.' });
  }

  // Idempotency guard: never re-email returning Google users.
  if (decoded.appMetadata && decoded.appMetadata.welcome_sent) {
    return send(res, 200, { ok: true, alreadySent: true });
  }

  // 1) Google-first signup: use the user's OWN chosen password (they typed it
  //    in the signup form) so Email/Password login also works later.
  //    Plain "Continue with Google" logins stay OAuth-only until they pick a
  //    password through the recovery link below.
  const usingChosen = validPassword;
  if (usingChosen) {
    await adminSetPassword(decoded.uid, chosenPassword);
  }
  if (validUsername) {
    try { await adminSetUserMetadata(decoded.uid, { full_name: username }); } catch (e) {}
  }

  // 2) A Supabase recovery link = the prominent "Set your own password" button.
  const resetUrl = (await adminRecoveryLink(decoded.uid)) || (APP_URL + '/');

  const name = ((decoded.userMetadata && (decoded.userMetadata.full_name || decoded.userMetadata.name)) || body.name || username || '').trim();
  const first = name.split(/\s+/)[0] || 'there';

  // 3) Branded welcome email. When the user chose their own password we do
  //    NOT print it — we just confirm the account and offer the reset link.
  const credRows = usingChosen
    ? `
      <tr><td width="150" style="padding:6px 0;color:#7a8c98;font-size:13px;">Username</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-weight:600;">${username || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${email}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Password</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">The one you chose at sign-up ✓ (never shared, stored securely)</td></tr>`
    : `
      <tr><td width="150" style="padding:6px 0;color:#7a8c98;font-size:13px;">Name</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-weight:600;">${name || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${email}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Next step</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">Tap the button below to choose your own password</td></tr>`;
  await sendEmail({
    to: email,
    subject: 'Your BCAPrime account is ready' + (usingChosen ? '' : ' — set your password'),
    preheader: usingChosen
      ? 'Welcome to BCAPrime! Your account is ready — here are your login details.'
      : 'Welcome to BCAPrime! Choose a password to unlock email & password login.',
    eyebrow: 'Welcome',
    title: 'Welcome, ' + first + '!',
    bodyHtml: `
      <p style="margin:0 0 12px;">You're all set — your BCA study library is ready. You signed up with <strong>Google</strong>, but you can also log in later with your username or email &amp; password using the details below.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f2f7f9;border:1px solid #e2eaee;border-radius:10px;padding:14px 20px;margin:16px 0;width:100%;">
        ${credRows}
      </table>
      ${usingChosen
        ? '<p style="margin:0 0 6px;">Want to change your password anytime? Use the secure button below.</p>'
        : '<p style="margin:0 0 6px;">Tap the button below to choose your own password — you can do this any time.</p>'}`,
    ctaLabel: usingChosen ? 'Change your password' : 'Set your own password',
    ctaUrl: resetUrl,
    ctaNote: 'This link expires shortly. It opens a secure page to manage your password.',
    plainText: usingChosen
      ? [
          'Welcome to BCAPrime!',
          '',
          'You signed up with Google. You can also log in with:',
          '',
          '  Username:        ' + (username || '—'),
          '  Email:           ' + email,
          '  Password:        the one you chose at sign-up',
          '',
          'Change your password here:',
          resetUrl,
        ].join('\n')
      : [
          'Welcome to BCAPrime!',
          '',
          'You signed up with Google. To also log in with email & password later:',
          '',
          '  Name:            ' + (name || '—'),
          '  Email:           ' + email,
          '',
          'Choose your password here:',
          resetUrl,
        ].join('\n'),
  });

  // 4) Save username/email/name in Supabase (server-side, service role).
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      await fetch(supabaseUrl.replace(/\/$/, '') + '/rest/v1/user_profiles', {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: 'Bearer ' + serviceKey,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          uid: decoded.uid,
          email,
          name: username || name,
          ...(validUsername ? { username } : {}),
          updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch (e) {
    // Non-fatal: profile sync is best-effort here; client also upserts.
  }

  // Mark as done AFTER a successful send so failures are retried later.
  await adminSetAppMetadata(decoded.uid, { welcome_sent: true });

  return send(res, 200, { ok: true, alreadySent: false, email });
});