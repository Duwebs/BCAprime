// ============================================================
// BCAPrime — api/_lib/resend.js
// Thin wrapper around the Resend Node SDK.
//
// Required secret:
//   RESEND_API_KEY = <Resend API key>
// Recommended (the sending domain must be verified in Resend):
//   BCAPRIME_FROM_EMAIL = no-reply@bcaprime.com
//   BCAPRIME_FROM_NAME  = BCAPrime Team
// ============================================================
'use strict';

let cachedClient = null;
let cachedKey = null;

function client() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY in Vercel env.');
  }
  if (!cachedClient || cachedKey !== apiKey) {
    const { Resend } = require('resend');
    cachedClient = new Resend(apiKey);
    cachedKey = apiKey;
  }
  return cachedClient;
}

function fromAddress() {
  const name = process.env.BCAPRIME_FROM_NAME || 'BCAPrime Team';
  const email = process.env.BCAPRIME_FROM_EMAIL || 'no-reply@bcaprime.com';
  return `${name} <${email}>`;
}

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

module.exports = { client, fromAddress, isConfigured };