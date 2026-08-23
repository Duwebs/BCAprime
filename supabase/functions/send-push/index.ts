// ============================================================
// BCAPrime — send-push Edge Function (Deno)
// Sends a Web Push to every subscribed device.
//
// Deploy:
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PRIVATE_KEY=<private key>
//   supabase secrets set VAPID_SUBJECT="mailto:admin@bcaprime.com"
//
// Body JSON: { "title": "...", "body": "...", "url": "/index.html", "tag": "...", "secret": "<NOTIFY_SECRET>" }
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
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@bcaprime.com';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'VAPID misconfigured', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Fetch all subscriptions with the service role ---
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

  await Promise.all((subs ?? []).map(async (sub: any) => {
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
