// ============================================================
// BCAPrime — notify-chat Edge Function (Deno)
// WhatsApp-style push for College & Semester isolated chat rooms.
//
// Flow: client inserts a chat_messages row, then POSTs { message_id }
// here. The function loads THAT row server-side (source of truth),
// then pushes ONLY to push_subscriptions enrolled in the SAME
// college + semester room. No client-supplied targeting, no secret
// in the browser — spoof-proof (unlike generic send-push callers).
//
// Anti-spam guards:
//   - message must exist and be < 10 minutes old
//   - sender never gets their own push (filtered by uid)
//   - stale endpoints (404/410) are pruned
//
// Deploy:
//   supabase functions deploy notify-chat
//   (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY / VAPID_SUBJECT already set)
//
// Body JSON: { "message_id": 123 }
// Response:  { ok:true, sent, failed, removed, room:{college,semester,channel} }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonRes({ error: 'Invalid JSON' }, 400); }
  const messageId = Number(body.message_id);
  if (!messageId || Number.isNaN(messageId)) return jsonRes({ error: 'message_id is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // --- Load the message (server truth: room + author + recency) ---
  const { data: rows, error: rErr } = await supabase
    .from('chat_messages')
    .select('id, channel, college, semester, uid, author_name, body, created_at')
    .eq('id', messageId)
    .limit(1);
  if (rErr || !rows || rows.length === 0) return jsonRes({ error: 'Message not found' }, 404);
  const msg = rows[0];

  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return jsonRes({ ok: true, skipped: true, reason: 'too old' });

  const roomCollege = String(msg.college ?? 'all');
  const roomSem = msg.semester == null ? null : Number(msg.semester);
  const senderUid = String(msg.uid ?? '');

  try {
    webpush.setVapidDetails(
      (Deno.env.get('VAPID_SUBJECT') ?? '').trim(),
      (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim(),
      (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim(),
    );
  } catch {
    return jsonRes({ error: 'VAPID misconfigured' }, 500);
  }

  // --- Targets: STRICT same-room match (college AND semester) ---
  // 'all'/NULL room only reaches 'all'/unset subscribers — Sem 1..6
  // rooms never leak into each other.
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, college, semester, uid');
  if (subsErr) return jsonRes({ error: subsErr.message }, 500);

  const targets = (subs ?? []).filter((sub: any) => {
    if (senderUid && sub.uid != null && String(sub.uid) === senderUid) return false; // no self-push
    const subCol = String(sub.college ?? 'all');
    if (subCol !== roomCollege) return false; // strict college match
    if (roomSem == null) return sub.semester == null; // legacy room only
    return sub.semester != null && Number(sub.semester) === roomSem; // strict sem match
  });

  const preview = String(msg.body || '').slice(0, 120);
  const semLabel = roomSem == null ? '' : ` • Sem ${roomSem}`;
  const payload = JSON.stringify({
    title: `💬 ${msg.author_name || 'Student'} (${roomCollege}${semLabel})`,
    body: preview || 'Sent a photo 📷',
    url: '/index.html#community',
    tag: `chat-${roomCollege}-${roomSem ?? 'all'}-${msg.channel}`,
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
  });

  let sent = 0, failed = 0;
  const stale: string[] = [];
  await Promise.all(targets.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 12 },
      );
      sent += 1;
    } catch (err: any) {
      failed += 1;
      if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(sub.endpoint);
    }
  }));

  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return jsonRes({
    ok: true, sent, failed, removed: stale.length,
    room: { college: roomCollege, semester: roomSem, channel: msg.channel },
  });
});
