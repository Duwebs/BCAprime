const SUPABASE_URL = 'https://kjesjaakjddfxykisssh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
