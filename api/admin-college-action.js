// api/admin-college-action.js
// Serverless handler for Admin College Approvals / Rejections / Deletions
// Uses Supabase Service Role key (or fallback key) to bypass RLS and guarantee action execution.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://kjesjaakjddfxykisssh.supabase.co').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, id, name } = req.body || {};
    if (!id || !action) {
      return res.status(400).json({ error: 'Missing required parameters (action, id)' });
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      let { data, error } = await supabase
        .from('custom_colleges')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, action: 'approve', id, data });
    }

    if (action === 'reject') {
      let { data, error } = await supabase
        .from('custom_colleges')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, action: 'reject', id, data });
    }

    if (action === 'delete') {
      const { data, error } = await supabase
        .from('custom_colleges')
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, action: 'delete', id, data });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[admin-college-action] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
