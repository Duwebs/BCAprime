// ============================================================
// BCAPrime — sign-resource Edge Function (Deno)
// =================================================------------
// Guest Mode + download security ke liye. 'resources' bucket PRIVATE
// hai, isliye har Read/Preview/Download se pehle client ye function
// call karta hai aur ek short-lived SIGNED URL paata hai.
//
// AUTH MODEL (important):
//   App ki login Firebase Auth me hoti hai — Supabase ko sab 'anon'
//   dikhte hain. Isliye is function ko caller ka FIREBASE ID token
//   verify karna padta hai (identitytoolkit accounts:lookup se).
//     - Valid Firebase session  -> full access (preview + download)
//     - Guest (koi token nahi)  -> UNLIMITED READING (preview mode);
//       DOWNLOAD hamesha sign-up wall ke peeche (403).
//
// Deploy:
//   supabase functions deploy sign-resource
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY automatic milte hain)
//   Optional: supabase secrets set FIREBASE_API_KEY=<web api key>
//
// Body JSON: { "fileUrl": "https://.../object/public/resources/<path>",
//              "mode": "preview" | "download", "resourceId": "123",
//              "guestId": "<uuid>" }
// Response:  { "ok": true, "url": "<signed url>", "expiresIn": 300 }
//            { "ok": false, "error": "...", "status": 401|403|429 }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-firebase-token, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Firebase Web API key (public — same value firebase-config.js me hai).
const FALLBACK_FIREBASE_API_KEY = 'AIzaSyCFYgD5VBIw0YEAkMhRcIV2VVQQGSN7xWs';

// Signed URL lifetime — chhoti rakho taaki leak ho to bhi jaldi expire.
const PREVIEW_TTL_SECONDS = 300;   // 5 min
const DOWNLOAD_TTL_SECONDS = 600;  // 10 min
const SUPABASE_BUCKET = 'resources';

// fileUrl -> storage path nikaalo (public/sign/object URLs dono accept).
function storagePathFromUrl(fileUrl) {
  try {
    const u = new URL(fileUrl);
    const marker = '/storage/v1/object/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return '';
    let rest = u.pathname.slice(idx + marker.length);
    rest = rest.replace(/^(public|authenticated|private)\//, '');
    if (rest.startsWith(`${SUPABASE_BUCKET}/`)) rest = rest.slice(SUPABASE_BUCKET.length + 1);
    return decodeURIComponent(rest);
  } catch (e) {
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : '';
  const mode = body.mode === 'download' ? 'download' : 'preview';
  const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
  const guestId = typeof body.guestId === 'string' ? body.guestId.trim() : '';

  if (!fileUrl) {
    return json({ ok: false, error: 'fileUrl is required' }, 400);
  }

  const path = storagePathFromUrl(fileUrl);
  if (!path || path.includes('..')) {
    return json({ ok: false, error: 'Unrecognised file URL' }, 400);
  }

  // ---- Caller ki identity verify karo ----
  // NOTE: Supabase gateway ko Bearer me Supabase JWT (publishable key)
  // chahiye hota hai (verify_jwt on). Firebase token alag header me
  // bhejte hain taaki gateway na toote.
  const firebaseToken = (req.headers.get('x-firebase-token') ?? '').trim();
  const user = await verifyFirebaseIdToken(firebaseToken);

  // ---- Admin secret (panel ke liye) — full access ----
  const adminSecret = (Deno.env.get('ADMIN_SECRET') ?? '').trim();
  const gotAdmin = !!adminSecret &&
    (req.headers.get('x-admin-secret') ?? '').trim() === adminSecret;

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ---- GUEST rules (na user, na admin) ----
  // Guest reading UNLIMITED hai; DOWNLOAD hamesha sign-up wall ke peeche.
  if (!user && !gotAdmin) {
    // Guest kabhi download nahi kar sakta.
    if (mode === 'download') {
      return json({ ok: false, error: 'signup_required', message: 'Sign up to download this file.' }, 403);
    }
    // Preview = unlimited. Analytics ke liye log kar do (quota nahi).
    if (guestId) {
      try {
        await supabaseAdmin.rpc(
          'consume_guest_preview',
          { p_guest_id: guestId, p_resource_id: resourceId || path },
        );
      } catch (e) { /* logging fail ho to preview mat roko */ }
    }
  }

  // ---- Signed URL banao (service role -> RLS bypass, safe) ----
  const expiresIn = mode === 'download' ? DOWNLOAD_TTL_SECONDS : PREVIEW_TTL_SECONDS;
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (signError || !signed || !signed.signedUrl) {
    return json({ ok: false, error: 'sign_failed', detail: signError?.message || 'unknown' }, 500);
  }

  return json({ ok: true, url: signed.signedUrl, expiresIn, mode, uid: user ? user.uid : null });
});


// Firebase ID token verify karo (server-side accounts:lookup se).
async function verifyFirebaseIdToken(idToken) {
  if (!idToken) return null;
  const apiKey = (Deno.env.get('FIREBASE_API_KEY') ?? '').trim() || FALLBACK_FIREBASE_API_KEY;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data && data.users && data.users[0];
    if (!user || !user.localId) return null;
    return { uid: user.localId, email: user.email || '' };
  } catch (e) {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
