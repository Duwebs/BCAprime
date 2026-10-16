// ============================================================
// BCAPrime — sign-resource Edge Function (Deno)
// =================================================------------
// Guest Mode + download security ke liye. 'resources' bucket PRIVATE
// hai, isliye har Read/Preview/Download se pehle client ye function
// call karta hai aur ek short-lived SIGNED URL paata hai.
//
// AUTH MODEL (important):
//   App ki login Supabase Auth me hai — Supabase ko sab 'anon'
//   dikhte hain. Isliye is function ko caller ka SUPABASE JWT
//   verify karna padta hai (GoTrue /auth/v1/user se).
//     - Valid Supabase session -> full access (preview + download)
//     - Guest (koi user token nahi) -> UNLIMITED READING (preview
//       mode); DOWNLOAD hamesha sign-up wall ke peeche (403).
//
// Deploy:
//   supabase functions deploy sign-resource
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY automatic milte hain)
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  // Bearer header me Supabase access token aata hai (gateway ke liye
  // apikey header bhi wahi rehta hai). Publishable key (non-JWT) ya
  // koi token nahi = GUEST.
  const authHeader = (req.headers.get('authorization') ?? '').trim();
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  const attemptingUser = !!bearer && bearer.startsWith('eyJ');
  const user = attemptingUser ? await verifySupabaseToken(bearer) : null;

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
    // Token bheja gaya tha par verify nahi hua (expired/revoked/invalid) ->
    // ye GUEST nahi, expired session hai. Alag code do (401) taaki client
    // "log in again" dikha sake. Guest (bina token) ko 403 signup wall milti rahe.
    if (attemptingUser) {
      return json({ ok: false, error: 'token_invalid', message: 'Your session could not be verified. Please log in again to download.' }, 401);
    }
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


// Supabase access token verify karo (server-side GoTrue /auth/v1/user se).
async function verifySupabaseToken(token) {
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
    return { uid: data.id, email: data.email || '' };
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
