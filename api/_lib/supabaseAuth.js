// ============================================================
// BCAPrime — api/_lib/supabaseAuth.js
// Server-side Supabase auth helpers (replaces the old
// firebase-admin based _lib/firebaseAdmin.js).
//
//   verifySupabaseToken(token)  -> { uid, email, providers, ... }
//                                 or null when invalid/expired
//   getServiceUser(uid)         -> raw auth user (admin REST) or null
//   updateProfile(uid, patch)   -> service-role PATCH on user_profiles
//   adminSetAppMetadata(uid, p) -> merge app_metadata (admin REST)
//   adminRecoveryLink(uid)      -> password-recovery action link
//
// Verification calls GET {SUPABASE_URL}/auth/v1/user with the
// caller's bearer token — GoTrue validates signature + expiry
// there, so no JWT library is needed server-side.
//
// Required secrets (already present on Vercel):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
'use strict';

function baseUrl() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
  }
  return { url, key };
}

/* Verify a user's Supabase access token (JWT) against GoTrue. */
async function verifySupabaseToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return null; }
  try {
    const res = await fetch(url + '/auth/v1/user', {
      method: 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + raw },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user || !user.id) return null;
    const appMeta = user.app_metadata || {};
    return {
      uid: user.id,
      email: (user.email || '').toLowerCase(),
      providers: Array.isArray(appMeta.providers) ? appMeta.providers : [],
      appMetadata: appMeta,
      userMetadata: user.user_metadata || {},
    };
  } catch (e) {
    return null;
  }
}

/* Raw auth user via admin REST (or null). */
async function getServiceUser(uid) {
  if (!uid) return null;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return null; }
  try {
    const res = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(uid), {
      method: 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.user) || null;
  } catch (e) {
    return null;
  }
}

/* Service-role GET on public.user_profiles (single row or null). */
async function getServiceProfile(uid) {
  if (!uid) return null;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return null; }
  try {
    const res = await fetch(
      url + '/rest/v1/user_profiles?uid=eq.' + encodeURIComponent(uid) + '&select=uid,email,is_email_verified,username,name&limit=1',
      {
        method: 'GET',
        headers: { apikey: key, Authorization: 'Bearer ' + key },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0]) || null;
  } catch (e) {
    return null;
  }
}

/* Service-role UPSERT on public.user_profiles (used by verify-otp so the
   is_email_verified flag lands even when the profile row does not exist yet). */
async function upsertProfileVerified(uid, email) {
  if (!uid) return false;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return false; }
  try {
    const res = await fetch(url + '/rest/v1/user_profiles', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        uid,
        email: String(email || '').toLowerCase(),
        is_email_verified: true,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Service-role PATCH on public.user_profiles (partial update). */
async function updateProfile(uid, patch) {
  if (!uid || !patch) return false;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return false; }
  try {
    const res = await fetch(
      url + '/rest/v1/user_profiles?uid=eq.' + encodeURIComponent(uid),
      {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patch),
      },
    );
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Set a user's password (admin REST — server-side only). */
async function adminSetPassword(uid, password) {
  if (!uid || !password) return false;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return false; }
  try {
    const res = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(uid), {
      method: 'PUT',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: String(password) }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Merge (not replace) user_metadata on the auth user. */
async function adminSetUserMetadata(uid, patch) {
  if (!uid || !patch) return false;
  const user = await getServiceUser(uid);
  if (!user) return false;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return false; }
  try {
    const merged = Object.assign({}, user.user_metadata || {}, patch);
    const res = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(uid), {
      method: 'PUT',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_metadata: merged }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Merge (not replace) app_metadata on the auth user. */
async function adminSetAppMetadata(uid, patch) {
  if (!uid || !patch) return false;
  const user = await getServiceUser(uid);
  if (!user) return false;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return false; }
  try {
    const merged = Object.assign({}, user.app_metadata || {}, patch);
    const res = await fetch(url + '/auth/v1/admin/users/' + encodeURIComponent(uid), {
      method: 'PUT',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app_metadata: merged }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* Password-recovery action link for a user (admin REST). Null on failure. */
async function adminRecoveryLink(uid) {
  if (!uid) return null;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return null; }
  try {
    const res = await fetch(
      url + '/auth/v1/admin/users/' + encodeURIComponent(uid) + '/links',
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'recovery' }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data && (data.action_link || data.properties && data.properties.action_link)) || null;
  } catch (e) {
    return null;
  }
}

/* Password-recovery action link by EMAIL (admin REST generateLink).
   Returns null when the account does not exist — callers must treat
   that as a silent no-op so emails are never enumerated. */
async function adminRecoveryLinkByEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  let url, key;
  try { ({ url, key } = baseUrl()); } catch (e) { return null; }
  try {
    const res = await fetch(url + '/auth/v1/admin/generate_link', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'recovery', email: clean }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.action_link) || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  verifySupabaseToken,
  getServiceUser,
  getServiceProfile,
  updateProfile,
  adminSetPassword,
  adminSetUserMetadata,
  adminSetAppMetadata,
  adminRecoveryLink,
  adminRecoveryLinkByEmail,
  upsertProfileVerified,
};
