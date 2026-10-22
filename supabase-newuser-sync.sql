-- ============================================================
-- BCAPrime — New-user Supabase profile sync / backfill
-- ============================================================
-- Supabase = auth (login/signup) + data (user_profiles,
-- resources, storage). Har account ki Supabase me EK
-- user_profiles row (uid + email + safe defaults) honi chahiye.
--
-- Normal flow ye row automatically banata hai:
--   1) api/google-welcome.js (server-side, service role) signup par
--   2) app.js ensureDefaultProfile() har verified login par (client
--      upsert — neeche di policies isey allow karti hain)
--
-- Ye file ek SAFETY NET hai: policies pakki karti hai + orphan
-- rows dhoondhne/repair karne ke audit queries deti hai.
-- IDEMPOTENT: baar-baar chalana safe hai.
-- ============================================================

-- 1) Client upserts kabhi RLS se block na hon — open policies pakki karo.
--    (Exposure sirf college/semester/verification jaisa low-sensitivity data.)
alter table public.user_profiles enable row level security;

drop policy if exists "Anyone can create user profiles" on public.user_profiles;
create policy "Anyone can create user profiles"
on public.user_profiles for insert
to anon, authenticated
with check (true);

drop policy if exists "Anyone can update user profiles" on public.user_profiles;
create policy "Anyone can update user profiles"
on public.user_profiles for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Anyone can read user profiles" on public.user_profiles;
create policy "Anyone can read user profiles"
on public.user_profiles for select
to anon, authenticated
using (true);

-- 2) Defaults pakke karo taaki nayi rows me download/notification
--    targeting ke liye sane values rahen. (Downloads Edge Function
--    service-role se authorize hote hain — koi extra role/permission
--    gate nahi hai; row ka hona hi kaafi hai.)
alter table public.user_profiles
  alter column college set default 'all';
alter table public.user_profiles
  alter column is_email_verified set default false;
alter table public.user_profiles
  add column if not exists welcome_email_sent boolean not null default false;
alter table public.user_profiles
  alter column welcome_email_sent set default false;

-- 3) AUDIT: aise rows jinme email/uid missing hai (kabhi nahi hona chahiye).
-- select uid, email, college, semester, is_email_verified, updated_at
-- from public.user_profiles
-- where uid is null or uid = '' or email is null or email = '';

-- 4) MANUAL BACKFILL TEMPLATE: agar kisi naye user (uid pata ho)
--    ki row phir bhi missing ho to ye chalao (uid + email bharo).
--    Pehle ki row ko ye overwrite NAHI karta (ON CONFLICT DO NOTHING).
--
-- insert into public.user_profiles (uid, email, name, college, semester, is_email_verified)
-- values ('FIREBASE_UID_YAHAN', 'user@example.com', '', 'all', null, true)
-- on conflict (uid) do nothing;
