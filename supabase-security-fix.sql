-- ============================================================
-- BCArime SECURITY HARDENING
-- SQL Editor mein EK BAAR run karo.
-- ============================================================

-- 1) Temporary open-moderation policies HATAO
--    (ye kisi bhi anon user ko resources update/delete karne deti thi!)
drop policy if exists "Temporary: open moderation for direct admin bypass" on public.resources;
drop policy if exists "Temporary: open delete for direct admin bypass" on public.resources;

-- 2) Admin-only management policy pakka karo
drop policy if exists "Authenticated admins can manage resources" on public.resources;
create policy "Authenticated admins can manage resources"
on public.resources for all
to authenticated
using (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
with check (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- ============================================================
-- 3) ADMIN USER KAISE BANE? (2 steps)
--
-- Step A: admin.html kholo → "Sign up" karke account banao
--         (jaise admin@bcaprime.com + apna strong password)
--
-- Step B: Neeche wala query chalao apne admin email ke saath —
--         isse us user ko admin role mil jayega:

-- update auth.users
-- set raw_app_meta_data = jsonb_set(
--       coalesce(raw_app_meta_data, '{}'::jsonb),
--       '{role}', '"admin"'
--     )
-- where email = 'admin@bcaprime.com';   <-- apna email daalo

-- Uske baad admin.html par login karo — dashboard khul jayega.
-- ============================================================
