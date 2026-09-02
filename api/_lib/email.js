// ============================================================
// BCAPrime — api/_lib/email.js
// Single branded, anti-spam HTML template used by every
// authentication email (verification link, OTP, Google welcome,
// password reset). All styling is inline + table-based so it
// renders identically in Gmail/Outlook/Apple Mail.
//
// Anti-spam checklist handled here:
//   - Professional "From" name (BCAPrime Team) + real sending domain
//   - Clean, semantic, mobile-friendly layout
//   - Absolute HTTPS image URL for the logo (inline images get
//     blocked by Gmail/Outlook -> hurts deliverability + trust)
//   - Plain-text fallback body, preheader, and full footer
// The remaining deliverability fix lives in DNS (SPF/DKIM/DMARC) —
// see README.md > "Email deliverability (spam folder fix)".
// ============================================================
'use strict';

const { client, fromAddress } = require('./resend');

const APP_URL = process.env.BCAPRIME_APP_URL || 'https://bcaprime.vercel.app';
const LOGO_URL = APP_URL + '/assets/logo.png';
const BRAND = '#0f7b8f';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLayout(opts) {
  const preheader = esc(opts.preheader || '');
  const eyebrow = esc(opts.eyebrow || '');
  const title = esc(opts.title || '');
  const bodyHtml = opts.bodyHtml || '';
  const ctaLabel = esc(opts.ctaLabel || '');
  const ctaUrl = esc(opts.ctaUrl || '');
  const ctaNote = esc(opts.ctaNote || '');
  const footer = esc(opts.footer || 'You are receiving this because you signed up for BCAPrime with this email address.');

  const ctaBlock = ctaLabel && ctaUrl
    ? `
    <tr><td style="padding:6px 32px 18px;">
      <a href="${ctaUrl}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;line-height:1;padding:15px 34px;border-radius:10px;">${ctaLabel}</a>
      ${ctaNote ? `<p style="margin:12px 0 0;font-size:12px;color:#8898aa;">${ctaNote}</p>` : ''}
    </td></tr>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — BCAPrime</title>
</head>
<body style="margin:0;padding:0;background:#eef2f5;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(15,123,143,.08);">
        <!-- Header with official logo -->
        <tr><td style="background:#0a1e24;padding:24px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="BCAPrime" width="48" height="48" style="display:inline-block;width:48px;height:48px;border:0;vertical-align:middle;">
          <span style="display:inline-block;vertical-align:middle;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px;margin-left:10px;">BCA<span style="color:#4fd1c5;">Prime</span></span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:30px 32px 6px;text-align:center;">
          ${eyebrow ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND};">${eyebrow}</p>` : ''}
          <h1 style="margin:0 0 14px;font-size:24px;color:#0f2530;line-height:1.3;">${title}</h1>
        </td></tr>
        <tr><td style="padding:6px 32px 18px;color:#3b4b57;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        ${ctaBlock}
        <!-- Footer -->
        <tr><td style="background:#f6f9fb;padding:20px 32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#8898aa;line-height:1.6;">${footer}</p>
          <p style="margin:0;font-size:12px;color:#9fb0bd;">BCAPrime · Your entire BCA library in one place<br>Questions? Reply to this email or contact support@bcaprime.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// The plain-text fallback (spam filters + accessibility clients prefer it).
function renderPlain(bodyLines /* :string[] */) {
  return [
    'BCAPrime Team',
    '---------------',
    ...bodyLines,
    '',
    'BCAPrime — Your entire BCA library in one place',
  ].join('\n');
}

async function sendEmail({ to, subject, preheader, eyebrow, title, bodyHtml, ctaLabel, ctaUrl, ctaNote, plainText }) {
  const resend = client();
  const payload = {
    from: fromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html: renderLayout({ preheader, eyebrow, title, bodyHtml, ctaLabel, ctaUrl, ctaNote }),
    text: plainText || renderPlain([title]),
  };
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    const err = new Error(error.message || 'Resend failed to send email');
    err.statusCode = error.statusCode || 500;
    throw err;
  }
  return data;
}

module.exports = { renderLayout, renderPlain, sendEmail, APP_URL, LOGO_URL, BRAND };