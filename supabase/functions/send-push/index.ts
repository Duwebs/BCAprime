// ============================================================
// BCAPrime — send-push Edge Function (Deno)
// Sends a Web Push to every subscribed device.
//
// Deploy:
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PRIVATE_KEY=<private key>
//   supabase secrets set VAPID_SUBJECT="mailto:admin@bcaprime.com"
//
// Body JSON: { "title": "...", "body": "...", "url": "/index.html", "tag": "...", "secret": "<NOTIFY_SECRET>", "college": "avviare", "semester": 1 }
// "college" + "semester" OPTIONAL targeting. Jab diye jaate hain, notification SIRF
// un subscriptions ko jaata hai jinke enrolled college / semester match karte hain.
// Koi filter nahi -> broadcast to every subscribed device (default).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Auth gate: caller must send the shared admin secret ---
  const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? '';
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!NOTIFY_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized', hint: 'Server has NO NOTIFY_SECRET set' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Trim both sides so stray spaces from copy-paste never break auth
  const receivedSecret = String(body.secret ?? '').trim();
  const expectedSecret = NOTIFY_SECRET.trim();
  if (receivedSecret !== expectedSecret) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      hint: `Length mismatch -> server: ${expectedSecret.length} chars | browser sent: ${receivedSecret.length} chars`,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Configure VAPID ---
  // .trim() guards against stray spaces from copy-paste into the secrets UI
  const vapidPrivateKey = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
  const vapidSubject = (Deno.env.get('VAPID_SUBJECT') ?? '').trim();
  const vapidPublicKey = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (error) {
    const hint = [
      `details=${String((error && error.message) || error)}`,
      `subject=${vapidSubject.length}ch(starts:${vapidSubject.slice(0, 6)})`,
      `public=${vapidPublicKey.length}ch(expected:87)`,
      `private=${vapidPrivateKey.length}ch(expected:43)`,
    ].join(' | ');
    return new Response(JSON.stringify({ error: 'VAPID misconfigured', hint }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Targeting: optional college/semester/uid filters (broadcast when absent) ---
  const targetCollege = typeof body.college === 'string' && body.college.trim() ? body.college.trim() : null;
  const targetSemester = body.semester == null || body.semester === '' ? null : Number(body.semester);
  const targetUid = typeof body.uid === 'string' && body.uid.trim() ? body.uid.trim() : null;

  // Subscription ki enrolled college/semester/uid target se match karni chahiye.
  // - 'all' college walon ko (jinhone college choose nahi kiya) kisi bhi college ki news milti hai.
  // - Koi filter nahi -> sab match (broadcast).
  function matchUid(subUid: any) {
    if (!targetUid) return true;
    return subUid != null && String(subUid) === targetUid;
  }
  function matchCollege(subCollege: any) {
    if (!targetCollege || targetCollege === 'all') return true;
    if (subCollege == null || subCollege === '' || subCollege === 'all') return true;
    return subCollege === targetCollege;
  }
  function matchSemester(subSemester: any) {
    if (targetSemester == null || Number.isNaN(targetSemester)) return true;
    return subSemester != null && Number(subSemester) === targetSemester;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, college, semester, uid');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sirf un subscriptions ko push karo jo targeting match karti hon.
  const targets = (subs ?? []).filter((sub: any) => matchUid(sub.uid) && matchCollege(sub.college) && matchSemester(sub.semester));

  const payload = JSON.stringify({
    title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'BCAPrime',
    body: typeof body.body === 'string' ? body.body.slice(0, 240) : '',
    url: typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '/index.html',
    tag: typeof body.tag === 'string' && body.tag ? body.tag.slice(0, 60) : undefined,
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
  });

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.all(targets.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 24 }, // 24h
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      const statusCode = err?.statusCode ?? 0;
      if (statusCode === 404 || statusCode === 410) stale.push(sub.endpoint);
    }
  }));

  // Remove dead subscriptions
  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, removed: stale.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
