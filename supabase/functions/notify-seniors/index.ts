// ============================================================
// BCAPrime — notify-seniors Edge Function (Deno)
// A junior's senior-help request पूरा करने पर समान college के
// seniors (semester N+1..6) ko push notification bhejta hai.
//
// Logic (user ka spec):
//   sem 1 request -> sem 2..6 ke seniors
//   sem 2 request -> sem 3..6
//   sem 3 -> 4..6
//   sem 4 -> 5..6
//   sem 5 -> 6
//   sem 6 -> कोई senior nahi (client UI hata deta hai)
//
// Deploy:
//   supabase functions deploy notify-seniors
//   (VAPID_PRIVATE_KEY, VAPID_SUBJECT, VAPID_PUBLIC_KEY already set)
//
// Body JSON: { "request_id": 123 }
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

  let body: any = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const requestId = Number(body.request_id);
  if (!requestId || Number.isNaN(requestId)) {
    return new Response(JSON.stringify({ error: 'request_id is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  /* ============================================================
     MODE 2 — "fulfilled": junior ko bataya jaata hai ki uski
     request poori ho gayi (senior ne upload ki ya Done mark kiya).
     Body: { mode:'fulfilled', request_id:123, kind:'upload'|'done' }
     ============================================================ */
  if (body.mode === 'fulfilled') {
    const { data: rows, error: rErr } = await supabase
      .from('senior_requests')
      .select('*')
      .eq('id', requestId)
      .limit(1);
    if (rErr || !rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const req = rows[0];
    // Guards: request done hui ho + junior ko pehle na bata chuke hon
    if (req.status !== 'done') {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'not done yet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (req.fulfilled_notified_at) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'already notified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Mark FIRST — parallel retry spam se bachaav
    await supabase.from('senior_requests')
      .update({ fulfilled_notified_at: new Date().toISOString() })
      .eq('id', requestId);

    if (!req.requester_uid) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no requester uid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const vapidPrivateKey = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
    const vapidSubject = (Deno.env.get('VAPID_SUBJECT') ?? '').trim();
    const vapidPublicKey = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch {
      return new Response(JSON.stringify({ error: 'VAPID misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const subjectText = req.subject || 'your material';
    const kindLabel = body.kind === 'upload' ? 'upload kar diya gaya hai ✅' : 'poori kar di gayi hai 🤝';
    const payload = JSON.stringify({
      title: '🎓 Your request is ready!',
      body: `"${subjectText}" ${kindLabel} Library mein check karo.`,
      url: '/index.html',
      tag: `junior-fulfilled-${requestId}`,
      requireInteraction: true,
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
    });
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('uid', String(req.requester_uid));
    let sent = 0, failed = 0;
    const stale: string[] = [];
    await Promise.all((subs ?? []).map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 * 3 }, // 3 din tak valid — junior thodi der baad bhi dekh le
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
    return new Response(JSON.stringify({ ok: true, fulfilled: true, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  /* ============================================================
     MODE 1 — default "notify seniors" (original behavior)
     ============================================================ */

  // --- Read the request row (with anti-replay anti-spam guards) ---
  const { data: rows2, error: reqErr } = await supabase
    .from('senior_requests')
    .select('*')
    .eq('id', requestId)
    .limit(1);
  if (reqErr || !rows2 || rows2.length === 0) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const reqRow = rows2[0];
  // Anti-spam: sirf recently-created pending requests hi send kar sakte hain.
  const ageMs = Date.now() - new Date(reqRow.created_at).getTime();
  if (reqRow.status !== 'pending' || ageMs > 15 * 60 * 1000) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'not pending or too old' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Configure VAPID ---
  const vapidPrivateKey = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
  const vapidSubject = (Deno.env.get('VAPID_SUBJECT') ?? '').trim();
  const vapidPublicKey = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch {
    return new Response(JSON.stringify({ error: 'VAPID misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // --- Targeting: same college, semester in (requesterSem+1 .. 6) ---
  const fromSem = Number(reqRow.semester) + 1;
  const college = reqRow.college || 'all';

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, college, semester');
  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targets = (subs ?? []).filter((sub: any) => {
    // college: same ya 'all'
    const subCol = sub.college ?? 'all';
    if (college !== 'all' && subCol !== 'all' && subCol !== college) return false;
    // semester: N+1..6 range (ya alag set nahi)
    const sem = Number(sub.semester);
    if (Number.isNaN(sem)) return false; // bina semester wale ko senior request nahi
    return sem >= fromSem && sem <= 6;
  });

  const subjectText = (reqRow.subject || 'notes/PYQ');
  const typeLabel = reqRow.type === 'pyq' ? 'PYQ' : 'notes';
  const semLabel = `Semester ${reqRow.semester}`;
  const payload = JSON.stringify({
    title: `📩 ${reqRow.requester_name || 'A junior'} needs ${typeLabel}`,
    body: `${semLabel} — "${subjectText}". 1 min laga ke help kar do. Tap to help 🤝`,
    url: '/index.html',
    tag: `senior-request-${requestId}`,
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

  // Mark as notified
  await supabase.from('senior_requests')
    .update({ status: 'notified', notified_at: new Date().toISOString() })
    .eq('id', requestId);

  return new Response(JSON.stringify({ ok: true, sent, failed, removed: stale.length, fromSem, toSem: 6 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
