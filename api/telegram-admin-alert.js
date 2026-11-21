// ============================================================
// BCAPrime — api/telegram-admin-alert.js
// Serverless endpoint to dispatch alerts to the BCAPrime Admin Telegram Bot.
//
// Accepts POST requests with:
//   { type: 'resource_upload' | 'feedback' | 'senior_request' | 'lost_found' | 'test', payload: { ... } }
//
// Keeps TELEGRAM_ADMIN_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID strictly server-side.
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { sendAdminTelegramAlert } = require('./_lib/telegramAdmin');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (_e) {
    return send(res, 400, { error: 'Invalid JSON request' });
  }

  const { type, payload } = body;

  if (!type) {
    return send(res, 400, { error: 'Missing required field: type' });
  }

  const result = await sendAdminTelegramAlert(type, payload || {});

  if (!result.ok) {
    return send(res, 500, {
      success: false,
      error: result.error || 'Failed to dispatch Telegram message',
      hint: 'Ensure TELEGRAM_ADMIN_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID are set in Vercel environment variables.',
    });
  }

  return send(res, 200, {
    success: true,
    messageId: result.messageId,
  });
});
