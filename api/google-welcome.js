// ============================================================
// BCAPrime — api/google-welcome.js
// Welcome email endpoint for new user registration:
//   1. Supports both Google/OAuth and Email/Password signups.
//   2. Strictly idempotent: checks database (user_profiles.welcome_email_sent)
//      and app_metadata to ensure welcome email is sent ONLY ONCE per account.
//   3. Sends a pure branded welcome email with zero password reset emails/links.
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const {
  verifySupabaseToken,
  adminSetAppMetadata,
  adminSetPassword,
  adminSetUserMetadata,
  getServiceProfile,
  markProfileWelcomeSent,
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

  // Optional chosen username + password (set before OAuth or on signup)
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const chosenPassword = typeof body.password === 'string' ? body.password : '';
  const validUsername = /^[a-z0-9_]{3,20}$/.test(username);
  const validPassword = chosenPassword.length >= 6 && chosenPassword.length <= 128;

  // Verify caller's token with Supabase GoTrue
  const decoded = await verifySupabaseToken(idToken);
  if (!decoded) return send(res, 401, { error: 'Invalid ID token' });

  const email = (decoded.email || body.email || '').trim().toLowerCase();
  if (!email) {
    return send(res, 400, { error: 'No email address is associated with this account.' });
  }

  // 1) Idempotency Check 1: Auth user app_metadata
  if (decoded.appMetadata && (decoded.appMetadata.welcome_sent || decoded.appMetadata.welcome_email_sent)) {
    return send(res, 200, { ok: true, alreadySent: true });
  }

  // 2) Idempotency Check 2: Database check on public.user_profiles.welcome_email_sent
  const existingProfile = await getServiceProfile(decoded.uid);
  if (existingProfile && existingProfile.welcome_email_sent) {
    // Sync metadata as well so future token refreshes catch it immediately
    try { await adminSetAppMetadata(decoded.uid, { welcome_sent: true, welcome_email_sent: true }); } catch (e) {}
    return send(res, 200, { ok: true, alreadySent: true });
  }

  const providers = Array.isArray(decoded.providers) ? decoded.providers : [];
  const isGoogle = providers.includes('google');
  const isOAuth = providers.some((p) => p !== 'email');

  // If user signed up via Google-first flow and set a custom password, store it for future email/password logins
  if (validPassword && isGoogle) {
    try { await adminSetPassword(decoded.uid, chosenPassword); } catch (e) {}
  }
  if (validUsername) {
    try { await adminSetUserMetadata(decoded.uid, { full_name: username }); } catch (e) {}
  }

  const name = ((decoded.userMetadata && (decoded.userMetadata.full_name || decoded.userMetadata.name)) || (existingProfile && existingProfile.name) || body.name || username || '').trim();
  const first = name ? name.split(/\s+/)[0] : 'there';

  const providerLabel = isGoogle ? 'Google' : (isOAuth ? 'Social Login' : 'Email & Password');

  // Build clean account details table (NO password reset / recovery links)
  const credRows = username
    ? `
      <tr><td width="140" style="padding:6px 0;color:#7a8c98;font-size:13px;">Username</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-weight:600;">${username}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${email}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Sign-in method</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${providerLabel}</td></tr>`
    : `
      <tr><td width="140" style="padding:6px 0;color:#7a8c98;font-size:13px;">Name</td><td style="padding:6px 0;font-size:14px;color:#0f2530;font-weight:600;">${name || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${email}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8c98;font-size:13px;">Sign-in method</td><td style="padding:6px 0;font-size:14px;color:#0f2530;">${providerLabel}</td></tr>`;

  // 3) Send pure branded welcome message (only once)
  await sendEmail({
    to: email,
    subject: 'Welcome to BCAPrime! Your BCA study library is ready',
    preheader: 'Welcome to BCAPrime! Explore BCA notes, previous year question papers, and study resources.',
    eyebrow: 'Welcome to BCAPrime',
    title: 'Welcome, ' + first + '!',
    bodyHtml: `
      <p style="margin:0 0 14px;">You're all set &mdash; your BCA study library is ready. Welcome to BCAPrime! You can access all your notes, previous year question papers, syllabus, and AI practice quizzes anytime.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f2f7f9;border:1px solid #e2eaee;border-radius:10px;padding:14px 20px;margin:16px 0;width:100%;">
        ${credRows}
      </table>
      <p style="margin:14px 0 6px;">Tap the button below to start exploring your semester notes and PYQs.</p>`,
    ctaLabel: 'Start Studying',
    ctaUrl: APP_URL + '/',
    ctaNote: 'Free notes, PYQs, and study resources for every semester.',
    plainText: [
      'Welcome to BCAPrime, ' + first + '!',
      '',
      'Your BCA study desk is ready. You can access notes, PYQs, and syllabus anytime.',
      '',
      'Account Details:',
      '  Email:          ' + email,
      '  Username:       ' + (username || '—'),
      '  Sign-in method: ' + providerLabel,
      '',
      'Start studying now at:',
      APP_URL,
    ].join('\n'),
  });

  // 4) Save username/email/name and mark welcome_email_sent in Supabase (server-side, service role)
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
          welcome_email_sent: true,
          updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch (e) {
    // Non-fatal: profile sync is best-effort here
  }

  // Double-ensure database flag & app_metadata are marked
  await markProfileWelcomeSent(decoded.uid);
  await adminSetAppMetadata(decoded.uid, { welcome_sent: true, welcome_email_sent: true });

  return send(res, 200, { ok: true, alreadySent: false, email });
});