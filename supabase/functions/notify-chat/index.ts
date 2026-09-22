// ============================================================
// BCAPrime — notify-chat Edge Function (Deno)
// WhatsApp-style push for College & Semester isolated chat rooms.
//
// Flow: a new chat_messages row triggers this function — EITHER the
// client's fire-and-forget beacon (chat.js notifyRoomPush) OR the
// Postgres INSERT trigger (supabase-chat-push.sql, pg_net). The
// function loads THAT row server-side (source of truth), then pushes
// ONLY to push_subscriptions enrolled in the SAME college + semester
// room. No client-supplied targeting, no secret in the browser.
//
// Delivery is dual-path per device subscription:
//   - device_token present  -> Firebase Cloud Messaging (best
//     lock-screen support; handled by firebase-messaging-sw.js)
//   - otherwise             -> VAPID Web Push fallback
// The chat_push_sent table de-dupes the two entry points so a message
// never double-notifies.
//
// Anti-spam guards:
//   - message must exist and be < 10 minutes old
//   - sender never gets their own push (filtered by uid)
//   - stale endpoints/tokens (404/410) are pruned
//
// Deploy:
//   supabase functions deploy notify-chat
//   Secrets already set: VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY /
//   VAPID_SUBJECT. Add FIREBASE_SERVICE_ACCOUNT (JSON string) for the
//   FCM path — it is optional; without it VAPID fallback still works.
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

/* Lazy FCM (service account) init — firebase-admin is imported on
   demand so a missing FIREBASE_SERVICE_ACCOUNT secret can never take
   the VAPID path down. */
let fcm: { app: any; messaging: any } | null = null;
async function getFcm() {
  const sa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!sa) return null;
  try {
    if (!fcm) {
      const { default: admin, messaging } = await import('npm:firebase-admin@12.2.0');
      const app = (admin.apps && admin.apps.length)
        ? admin.apps[0]
        : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
      fcm = { app, messaging };
    }
    return fcm;
  } catch (err: any) {
    console.error('FCM init failed:', err?.message || err);
    return null;
  }
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

  // --- De-dupe the client beacon vs the DB trigger (single push per message) ---
  try {
    const { data: claim } = await supabase
      .from('chat_push_sent')
      .insert({ message_id: messageId })
      .onConflict('message_id')
      .ignore()
      .select('message_id')
      .maybeSingle();
    if (!claim || claim.message_id == null) {
      return jsonRes({ ok: true, skipped: true, reason: 'duplicate' });
    }
  } catch (e: any) {
    // chat_push_sent missing → still push (best-effort), just don't dedupe.
    console.warn('chat_push_sent dedupe unavailable:', e?.message || e);
  }

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
    .select('endpoint, p256dh, auth, college, semester, uid, device_token');
  if (subsErr) return jsonRes({ error: subsErr.message }, 500);

  const targets = (subs ?? []).filter((sub: any) => {
    if (senderUid && sub.uid != null && String(sub.uid) === senderUid) return false; // no self-push
    const subCol = String(sub.college ?? 'all');
    if (subCol !== roomCollege) return false; // strict college match
    if (roomSem == null) return sub.semester == null; // legacy room only
    return sub.semester != null && Number(sub.semester) === roomSem; // strict sem match
  });

  const preview = String(msg.body || '').slice(0, 120) || 'Sent a photo 📷';
  const semLabel = roomSem == null ? '' : ` • Sem ${roomSem}`;
  const title = `💬 ${msg.author_name || 'Student'} (${roomCollege}${semLabel})`;
  const link = '/index.html#community';
  const tag = `chat-${roomCollege}-${roomSem ?? 'all'}-${msg.channel}`;

  const fcmClient = await getFcm();

  let sent = 0, failed = 0;
  const stale: string[] = [];
  const staleTokens: string[] = [];
  await Promise.all(targets.map(async (sub: any) => {
    try {
      if (sub.device_token && fcmClient) {
        // Data-only FCM push: foreground shows a toast, background (app
        // closed / phone locked) shows the lock-screen notification in
        // firebase-messaging-sw.js via onBackgroundMessage.
        await fcmClient.messaging(fcmClient.app).send({
          token: sub.device_token,
          data: { title, body: preview, url: link, tag, type: 'chat' },
          webpush: {
            fcm_options: { link, analytics_label: 'community-chat' },
            headers: { TTL: '43200' },
          },
        });
      } else {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title, body: preview, url: link, tag,
            icon: '/assets/logo.png', badge: '/assets/logo.png',
          }),
          { TTL: 60 * 60 * 12 },
        );
      }
      sent += 1;
    } catch (err: any) {
      failed += 1;
      const code = String(err?.errorInfo?.code || err?.code || '');
      if (err?.statusCode === 404 || err?.statusCode === 410 || code.includes('registration-token-not-registered')) {
        if (sub.device_token) staleTokens.push(sub.device_token);
        else stale.push(sub.endpoint);
      }
    }
  }));

  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }
  if (staleTokens.length) {
    await supabase.from('push_subscriptions').update({ device_token: null, push_type: 'webpush' }).in('device_token', staleTokens);
  }

  return jsonRes({
    ok: true, sent, failed, removed: stale.length + staleTokens.length,
    room: { college: roomCollege, semester: roomSem, channel: msg.channel },
  });
});