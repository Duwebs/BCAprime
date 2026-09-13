// ============================================================
// BCAPrime — notify-lostfound Edge Function (Deno)
// Server-authoritative Lost & Found posting:
//   1) Validates the shared NOTIFY_SECRET (client must send it).
//   2) Enforces the DAILY spam limit (max 3 posts per user/day)
//      via lost_found_posts_today() — client bypass proof.
//   3) Sends a Web Push to every subscribed user of the SAME
//      college (plus 'all' watchers) via the web-push library.
//
// Notification text:
//   LOST  → "🔴 Lost: <Item> near <Location> – Can you help?"
//   FOUND → "🟢 Found: <Item> at <Location> – Is it yours?"
//
// The push URL points at "#lostfound-<id>" so tapping the alert
// opens that exact post. "tag: lostfound-<college>" groups alerts
// (multiple posts collapse into the latest for that college).
//
// Deploy:
//   supabase functions deploy notify-lostfound
//   (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY / VAPID_SUBJECT already set)
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const LF_MAX_DAILY = 3;

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);

  // --- Auth gate ---
  let body: any = {};
  try { body = await req.json(); } catch { return jsonRes({ error: 'Invalid JSON' }, 400); }

  const expected = (Deno.env.get('NOTIFY_SECRET') ?? '').trim();
  if (!expected || String(body.secret ?? '').trim() !== expected) {
    return jsonRes({ error: 'Unauthorized', hint: 'Secret does not match.' }, 401);
  }

  const postId = Number(body.post_id);
  if (!postId || Number.isNaN(postId)) return jsonRes({ error: 'post_id is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // --- Load the post ---
  const { data: rows, error: rErr } = await supabase
    .from('lost_found')
    .select('*')
    .eq('id', postId)
    .limit(1);
  if (rErr || !rows || rows.length === 0) return jsonRes({ error: 'Post not found' }, 404);
  const post = rows[0];

  // --- Anti-spam: max LF_MAX_DAILY per user per day (server authority) ---
  const uid = String(post.poster_uid || '');
  if (uid) {
    const { data: cnt, error: cntErr } = await supabase
      .rpc('lost_found_posts_today', { p_uid: uid });
    if (!cntErr && Number(cnt) > LF_MAX_DAILY) {
      return jsonRes({ ok: false, blocked: 'daily-limit', hint: 'Max ' + LF_MAX_DAILY + ' posts per day' }, 429);
    }
  }

  // Guard: sirf ek baar hi notify karo (parallel retry spam se bachaav)
  if (post.notified_at) {
    return jsonRes({ ok: true, skipped: true, reason: 'already notified' });
  }
  await supabase.from('lost_found')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', postId);

  // --- Item + notification copy ---
  const cat = String(post.custom_category || '').trim();
  const item = cat || String(post.title || '').trim() || 'an item';
  const place = String(post.location || '').trim() || 'campus';
  const college = String(post.college || 'all');
  const isLost = post.type === 'lost';
  const title = isLost
    ? '\u{1F534} Lost: ' + item + ' near ' + place + ' \u2013 Can you help?'
    : '\u{1F7E2} Found: ' + item + ' at ' + place + ' \u2013 Is it yours?';

  // --- Configure VAPID ---
  try {
    webpush.setVapidDetails(
      (Deno.env.get('VAPID_SUBJECT') ?? '').trim(),
      (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim(),
      (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim(),
    );
  } catch {
    return jsonRes({ error: 'VAPID misconfigured' }, 500);
  }

  // --- Targets: same college OR 'all' subscribers ---
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, college');
  if (subsErr) return jsonRes({ error: subsErr.message }, 500);

  const targets = (subs ?? []).filter((sub: any) => {
    const subCol = String(sub.college ?? 'all');
    if (college !== 'all' && subCol !== 'all' && subCol !== college) return false;
    return true;
  });

  const payload = JSON.stringify({
    title: title.slice(0, 80),
    body: (post.description || '').slice(0, 240),
    url: '/index.html#lostfound-' + postId,
    tag: 'lostfound-' + college,
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
        { TTL: 60 * 60 * 24 },
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

  return jsonRes({ ok: true, sent, failed, removed: stale.length, post_id: postId });
});