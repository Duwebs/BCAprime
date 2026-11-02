// ============================================================
// BCAPrime — telegram-new-user Edge Function (Deno)
// Dispatches instant Telegram notification when a new user signs up.
//
// Triggered automatically by:
//   Supabase Database Webhook (on INSERT on public.profiles or public.user_profiles)
//
// Required Secrets (configure via Supabase Dashboard or CLI):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Format a Date object or ISO string to Indian Standard Time (IST, UTC+5:30)
 * Example output: "30 Oct 2026, 11:15:20 PM IST"
 */
function formatToIST(dateInput?: string | Date): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
      return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    }
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(d) + ' IST'
    );
  } catch (_e) {
    return new Date().toISOString() + ' (UTC)';
  }
}

/**
 * Clean string for safe Telegram Markdown V1 rendering
 */
function escapeMarkdown(text: string): string {
  return String(text || '').replace(/[*_`\[\]]/g, ' ');
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Fetch and validate environment secrets
  const botToken = (Deno.env.get('TELEGRAM_BOT_TOKEN') || '').trim();
  const chatId = (Deno.env.get('TELEGRAM_CHAT_ID') || '').trim();

  if (!botToken || !chatId) {
    console.error('[telegram-new-user] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return new Response(
      JSON.stringify({
        error: 'Telegram credentials missing.',
        hint: 'Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Supabase Secrets.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // 3. Parse payload
  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 4. Filter: Only fire for real new signups (INSERT events)
  // Database Webhooks provide body.type ('INSERT', 'UPDATE', 'DELETE')
  if (body.type && body.type !== 'INSERT') {
    return new Response(
      JSON.stringify({
        ignored: true,
        reason: `Ignored ${body.type} event. Telegram alerts only trigger for new signups (INSERT).`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Extract record (Database Webhooks place the row inside `body.record`)
  const record = body.record || body;

  // Extract email
  const email = (
    record.email ||
    record.raw_user_meta_data?.email ||
    body.email ||
    ''
  ).trim();

  // Extract display name with sensible fallbacks
  const rawName =
    record.full_name ||
    record.name ||
    record.raw_user_meta_data?.full_name ||
    record.raw_user_meta_data?.name ||
    record.raw_user_meta_data?.user_name ||
    record.username ||
    body.name ||
    body.full_name ||
    (email ? email.split('@')[0] : 'New Student');

  const name = String(rawName).trim() || 'New Student';
  const createdAt = record.created_at || record.updated_at || body.created_at || new Date().toISOString();
  const userId = record.id || record.uid || body.userId || body.id || '';
  const timeIST = formatToIST(createdAt);

  const isTest = Boolean(body.is_test);
  const header = isTest
    ? '🧪 *[TEST ALERT] New User Signup — BCAPrime*'
    : '🎉 *New User Signup on BCAPrime!*';

  const cleanName = escapeMarkdown(name);
  const cleanEmail = escapeMarkdown(email || 'No email provided');
  const uidLine = userId ? `\n🆔 *User ID:* \`${escapeMarkdown(String(userId))}\`` : '';

  // Clean, readable Markdown message
  const markdownText = [
    header,
    '',
    `👤 *Name:* ${cleanName}`,
    `📧 *Email:* ${cleanEmail}`,
    `⏰ *Signup Time:* ${timeIST}${uidLine}`,
    '',
    '🚀 _A new student has joined the BCAPrime community._',
  ].join('\n');

  // Plain-text fallback in case Markdown parsing is rejected
  const plainText = [
    isTest ? '[TEST ALERT] New User Signup — BCAPrime' : 'New User Signup on BCAPrime!',
    '',
    `Name: ${name}`,
    `Email: ${email || 'No email provided'}`,
    `Signup Time: ${timeIST}${userId ? `\nUser ID: ${userId}` : ''}`,
  ].join('\n');

  // 5. Send Telegram Bot API request
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    let tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: markdownText,
        parse_mode: 'Markdown',
      }),
    });

    // If Telegram returns an error on Markdown parsing, retry once with plain text
    if (!tgRes.ok) {
      console.warn('[telegram-new-user] Telegram Markdown send failed, retrying plain text...');
      tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
        }),
      });
    }

    const tgData = await tgRes.json();

    if (!tgRes.ok || !tgData.ok) {
      console.error('[telegram-new-user] Telegram API error:', tgData);
      return new Response(
        JSON.stringify({
          error: 'Telegram delivery rejected.',
          details: tgData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: tgData.result?.message_id,
        user: {
          name,
          email,
          timeIST,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[telegram-new-user] Network error:', err);
    return new Response(
      JSON.stringify({
        error: 'Failed to communicate with Telegram API',
        message: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

