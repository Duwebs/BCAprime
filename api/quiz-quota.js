// ============================================================
// BCAPrime — api/quiz-quota.js
// Check current user's daily AI quiz generation quota
// ============================================================
'use strict';

const { withCors, send } = require('./_lib/cors');
const { verifySupabaseToken } = require('./_lib/supabaseAuth');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DAILY_LIMIT = 3;

module.exports = withCors(async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (!token) {
    return send(res, 401, { error: 'Authentication required' });
  }

  const user = await verifySupabaseToken(token);
  if (!user || !user.uid) {
    return send(res, 401, { error: 'Invalid token' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrowMidnight = new Date();
  tomorrowMidnight.setUTCHours(24, 0, 0, 0);

  let used = 0;
  try {
    const { data } = await supabase
      .from('ai_quiz_usage')
      .select('count')
      .eq('user_id', user.uid)
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
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    resetAt: tomorrowMidnight.toISOString()
  });
});
