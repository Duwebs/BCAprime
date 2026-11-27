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

  // When a college request is received, guarantee persistence in Supabase custom_colleges table
  if (type === 'college_request' && payload) {
    try {
      const collegeName = String(payload.name || payload.college_name || '').trim();
      if (collegeName) {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').trim();
        const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl').trim();
        if (supabaseUrl && serviceKey) {
          const supabaseAdmin = createClient(supabaseUrl, serviceKey);
          const isValidUuid = (uid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(uid || ''));
          const submittedBy = isValidUuid(payload.submitted_by) ? payload.submitted_by : null;
          const submittedByName = payload.submitted_by_name || payload.username || 'A student';

          const { data: existing } = await supabaseAdmin
            .from('custom_colleges')
            .select('id, name, status')
            .ilike('name', collegeName)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from('custom_colleges').insert({
              name: collegeName,
              submitted_by: submittedBy,
              submitted_by_name: submittedByName,
              status: 'pending'
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn('[telegram-admin-alert] custom_colleges persistence note:', dbErr.message || dbErr);
    }
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
