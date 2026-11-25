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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
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

  // --- Auth gate: caller must send the shared admin secret OR have an authenticated admin session ---
  const NOTIFY_SECRET = (Deno.env.get('NOTIFY_SECRET') ?? '').trim();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = (req.headers.get('authorization') ?? '').trim();
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  const receivedSecret = String(body.secret ?? req.headers.get('x-admin-secret') ?? '').trim();

  let isAuthorized = false;
  if (NOTIFY_SECRET && receivedSecret === NOTIFY_SECRET) {
    isAuthorized = true;
  } else if (bearer && bearer.startsWith('eyJ')) {
    const adminUser = await verifyAdminToken(bearer);
    if (adminUser) isAuthorized = true;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      hint: 'Admin session or secret does not match.',
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
  const targetCollege = typeof body.college === 'string' && body.college.trim() ? body.college.trim().toLowerCase() : null;
  const targetSemesterRaw = body.semester == null || body.semester === '' ? null : Number(body.semester);
  // STRICT semester targeting: agar semester diya gaya hai to valid number hona
  // chahiye. Invalid value ko chupke se broadcast mat banao — 400 bhejo taaki
  // galti se Sem X ki notification sabko na chali jaaye.
  if (targetSemesterRaw != null && (Number.isNaN(targetSemesterRaw) || targetSemesterRaw < 1)) {
    return new Response(JSON.stringify({ error: 'Invalid semester', hint: 'semester must be a number >= 1 (or omitted for an intentional broadcast).' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const targetSemester = targetSemesterRaw;
  const targetUid = typeof body.uid === 'string' && body.uid.trim() ? body.uid.trim() : null;
  const excludeUid = typeof body.excludeUid === 'string' && body.excludeUid.trim() ? body.excludeUid.trim() : null;
  const targetRole = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : null;
  const isStrict = body.strict === true || (typeof body.tag === 'string' && body.tag.startsWith('resource-approved'));

  // Subscription ki enrolled college/semester/uid target se match karni chahiye.
  // - Strict mode: MUST match exact college and exact semester. Never broad-match.
  // - Non-strict broadcast: 'all' matches all.
  function matchUid(subUid: any) {
    if (!targetUid) return true;
    return subUid != null && String(subUid) === targetUid;
  }
  function matchExcludeUid(subUid: any) {
    if (!excludeUid) return true;
    return !subUid || String(subUid) !== excludeUid;
  }
  function matchRole(subRole: any) {
    if (!targetRole) return true; // no role filter = broadcast to everyone
    if (subRole == null || subRole === '') return targetRole === 'user' || targetRole === 'all';
    return String(subRole) === targetRole;
  }
  function matchCollege(subCollege: any) {
    if (!targetCollege || targetCollege === 'all') {
      return !isStrict;
    }
    const normSub = typeof subCollege === 'string' ? subCollege.trim().toLowerCase() : '';
    if (isStrict) {
      return normSub === targetCollege;
    }
    if (!normSub || normSub === 'all') return true;
    return normSub === targetCollege;
  }
  // STRICT: semester-targeted push SIRF exact-match subscribers ko jaati hai.
  // Jiske paas koi enrolled semester nahi (null/'') wo is push ko NAHI payega —
  // Sem 1 wali notification sirf Sem 1 subscribers tak.
  function matchSemester(subSemester: any) {
    if (targetSemester == null) {
      return !isStrict;
    }
    if (subSemester == null || subSemester === '') return false;
    return Number(subSemester) === targetSemester;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, college, semester, uid, role');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sirf un subscriptions ko push karo jo targeting match karti hon.
  const targets = (subs ?? []).filter((sub: any) =>
    matchUid(sub.uid) &&
    matchExcludeUid(sub.uid) &&
    matchCollege(sub.college) &&
    matchSemester(sub.semester) &&
    matchRole(sub.role)
  );

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

  // Also persist in-app notification row for Supabase Realtime in-app bell trigger (unless skipInApp is set)
  if (!body.skipInApp) {
    try {
      await supabase.from('notifications').insert({
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'BCAPrime',
        message: typeof body.body === 'string' ? body.body.slice(0, 240) : '',
        type: body.tag === 'resource-approved' ? (body.title?.includes('PYQ') ? 'pyq' : 'note') : 'announcement',
        college: targetCollege || 'all',
        semester: targetSemester || null,
        user_id: targetUid || null,
        target_url: typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '#top',
        is_read: false
      });
    } catch (_e) {
      // Non-blocking if table or permissions are pending
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, removed: stale.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function verifyAdminToken(token: string) {
  if (!token) return null;
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim().replace(/\/$/, '');
  const apikey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (!supabaseUrl || !apikey) return null;
  try {
    const res = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { apikey, Authorization: 'Bearer ' + token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.id) return null;
    const role = data.app_metadata?.role || data.user_metadata?.role;
    const email = String(data.email || '').toLowerCase();
    const isOwner = email === 'contact.bcaprime@gmail.com' || email === 'admin@bcaprime.web' || email.includes('admin');
    if (role === 'admin' || isOwner) {
      return { uid: data.id, email: data.email };
    }
    return null;
  } catch {
    return null;
  }
}
