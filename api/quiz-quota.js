// ============================================================
// BCAPrime — api/quiz-quota.js
// Check daily mock test generation quota:
// - Guest (unauthenticated): 3 tests/day
// - Logged-in user: 9 tests/day
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { verifySupabaseToken } = require('./_lib/supabaseAuth');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LOGGED_IN_LIMIT = 9;
const GUEST_LIMIT = 3;

module.exports = withCors(async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  let user = null;

  if (token) {
    try {
      user = await verifySupabaseToken(token);
    } catch (e) {
      user = null;
    }
  }

  const isGuest = !user || !user.uid;
  let userId;
  let limit;

  if (!isGuest) {
    userId = user.uid;
    limit = LOGGED_IN_LIMIT; // 9 tests/day for authenticated users
  } else {
    const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'guest').split(',')[0].trim();
    const clientGuestId = String(req.query.guestId || req.headers['x-guest-id'] || '').trim().slice(0, 64);
    const guestKey = clientGuestId || clientIp.replace(/[^a-zA-Z0-9_.-]/g, '_');
    userId = `guest:${guestKey}`;
    limit = GUEST_LIMIT; // 3 tests/day for guest users
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrowMidnight = new Date();
  tomorrowMidnight.setUTCHours(24, 0, 0, 0);

  let used = 0;
  try {
    const { data } = await supabase
      .from('ai_quiz_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();

    if (data && typeof data.count === 'number') {
      used = data.count;
    }
  } catch (e) {
    console.warn('[Quiz Quota Fetch Error]', e.message);
  }

  return send(res, 200, {
    ok: true,
    isGuest,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: tomorrowMidnight.toISOString()
  });
});
