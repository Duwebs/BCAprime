// ============================================================
// BCAPrime — api/phone-webhook.js
// Telegram bot webhook that redeems phone-verification codes.
// The student sends "BCAVERIFY <6-digit-code>" to the bot from
// their phone; this endpoint:
//   1. matches the code hash in phone_verifications (service_role),
//   2. checks expiry + one-time-use + attempt limits,
//   3. flips user_profiles.is_phone_verified = true and records
//      the mobile number the message came from,
//   4. replies to the student inside Telegram.
//
// Required Vercel env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   OTP_PEPPER, TELEGRAM_BOT_TOKEN, (optional) TELEGRAM_WEBHOOK_SECRET
//
// Setup: point the bot's webhook at
//   https://bcaprime.vercel.app/api/phone-webhook
// ============================================================
'use strict';

const crypto = require('crypto');
const { withCors, send } = require('./_lib/cors');

const MAX_ATTEMPTS = 6;

let cachedSupabase = null;
function supabase() {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
  const { createClient } = require('@supabase/supabase-js');
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

function hashOtp(code) {
  const pepper = process.env.OTP_PEPPER || 'bca-otp-pepper';
  return crypto.createHmac('sha256', pepper).update('phone:' + String(code)).digest('hex');
}

async function reply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) { /* non-fatal */ }
}

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  // Optional shared-secret check on the webhook URL.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) return send(res, 401, { error: 'Unauthorized webhook' });
  }

  let update = {};
  try {
    update = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (error) {
    return send(res, 400, { error: 'Invalid JSON' });
  }

  const msg = update.message || update.edited_message;
  const text = (msg && msg.text ? msg.text : '').trim();
  const chatId = msg && msg.chat && msg.chat.id;
  if (!msg || !text) return send(res, 200, { ok: true, ignored: true });

  if (/^\/start/i.test(text)) {
    await reply(chatId,
      'Welcome to BCAPrime! \ud83c\udf93\n\n' +
      'To join the Community Chat, open BCAPrime \u2192 Community \u2192 verify your number, ' +
      'then send the code shown in the app here as:\n\n' +
      'BCAVERIFY 123456');
    return send(res, 200, { ok: true });
  }

  const match = text.match(/BCAVERIFY\s*(\d{6})/i);
  if (!match) {
    await reply(chatId, 'Send the code shown in the BCAPrime app as: BCAVERIFY 123456');
    return send(res, 200, { ok: true });
  }

  const code = match[1];
  const db = supabase();
  /* The SAME 6-digit code that was emailed to the student (email_otps,
     hashed by api/_lib/otp.js hashOtp — HMAC with no prefix). Redeeming
     it here proves the message came from the student's own phone. */
  const hash = crypto.createHmac('sha256', process.env.OTP_PEPPER || 'bca-otp-pepper').update(String(code)).digest('hex');
  const { data: row } = await db
    .from('email_otps')
    .select('uid, code_hash, attempts, expires_at, used_at, email')
    .eq('code_hash', hash)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    await reply(chatId, '\u274c That code is not valid. Open BCAPrime \u2192 Community and get a fresh OTP.');
    return send(res, 200, { ok: true });
  }
  if (row.used_at) {
    await reply(chatId, '\u2713 This code was already used. You are verified \u2014 enjoy the Community Chat!');
    return send(res, 200, { ok: true });
  }
  if (new Date(row.expires_at) < new Date()) {
    await reply(chatId, '\u23f0 That code expired. Open BCAPrime \u2192 Community for a new OTP.');
    return send(res, 200, { ok: true });
  }
  if ((row.attempts || 0) >= MAX_ATTEMPTS) {
    await reply(chatId, '\ud83d\udeab Too many attempts for this code. Get a fresh OTP in the app.');
    return send(res, 200, { ok: true });
  }

  // Redeem: mark the OTP used + flip the profile flag.
  await db.from('email_otps')
    .update({ used_at: new Date().toISOString() })
    .eq('uid', row.uid);

  const from = msg.from || {};
  const phone = (msg.contact && msg.contact.phone_number)
    ? String(msg.contact.phone_number)
    : (from.username ? '@' + from.username : '');
  await db.from('user_profiles')
    .update({
      is_phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      mobile: phone,
    })
    .eq('uid', row.uid);

  await reply(chatId,
    '\u2705 Verified! Your BCAPrime account now has the Verified Student badge.\n' +
    'Head back to the app \u2192 Community \u2192 start chatting! \ud83d\udcac');
  return send(res, 200, { ok: true, verified: true, uid: row.uid });
});