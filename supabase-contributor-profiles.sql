-- ============================================================
-- BCAPrime — DYNAMIC CONTRIBUTOR PROFILES (resource cards)
-- Supabase SQL Editor me EK BAAR run karo (poora idempotent hai).
--
-- PEHLE: resources.uploader_name / uploader_email ek *static snapshot* the.
--        User apna naam ya DP badalta tha to purane notes/PYQs par purana
--        naam hi dikhta rehta tha (re-upload ke bina fix nahi hota).
-- AB:    resources.uploader_uid -> user_profiles.uid ka LIVE reference.
--        Card ka naam + DP hamesha user_profiles se aata hai, isliye profile
--        update hote hi SAARE purane cards (notes + PYQs) auto-update ho
--        jaate hain — na re-upload, na manual refresh.
--
-- Teen layers se sync hota hai (belt + suspenders):
--   1. resources_feed view       -> backend query hi live naam/DP populate karti hai
--   2. Realtime (user_profiles)  -> browser me cards turant patch (0 refresh)
--   3. Sync trigger              -> legacy uploader_name snapshot bhi live rehta hai
--      (admin panel / push notifications jo uploader_name padhte hain)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Contributor ka live reference (Firebase uid) resources par
--    NULLABLE rakha gaya hai: anonymous / legacy rows bhi valid rehte hain,
--    aur koi FK/constraint upload flow ko break nahi karta.
-- ------------------------------------------------------------
alter table public.resources add column if not exists uploader_uid text;
create index if not exists resources_uploader_uid_idx on public.resources (uploader_uid);

-- ------------------------------------------------------------
-- 2) BACKFILL — purane rows ka contributor link
--    uploader_email se matching user_profiles.uid bhara jaata hai, taaki
--    pehle se uploaded material bhi dynamic naam/DP dikhane lage
--    (user ko kuch dobara upload nahi karna padega).
-- ------------------------------------------------------------
update public.resources r
   set uploader_uid = p.uid
  from public.user_profiles p
 where coalesce(r.uploader_uid, '') = ''
   and coalesce(r.uploader_email, '') <> ''
   and lower(p.email) = lower(r.uploader_email);

-- ------------------------------------------------------------
-- 3) Contributor ke live fields user_profiles me hi rehte hain
--    (avatar resources me duplicate NAHI hota — ek hi source of truth).
--    name / username / avatar_url schema me pehle se hain; ye safe re-run hai.
-- ------------------------------------------------------------
alter table public.user_profiles add column if not exists name text not null default '';
alter table public.user_profiles add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 4) REALTIME — profile badalte hi browser ko event milta hai
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_profiles'
  ) then
    alter publication supabase_realtime add table public.user_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resources'
  ) then
    alter publication supabase_realtime add table public.resources;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) POPULATED QUERY (backend join) — resources + live contributor
--
--    `security_invoker = true` zaroori hai: isse view caller ke RLS policies
--    follow karta hai (warna anon user pending/archived rows bhi padh leta).
--    Frontend isi view se `.eq('status','approved')` karta hai.
--
--    contributor_name fallback chain:
--      user_profiles.name  ->  legacy resources.uploader_name  ->  ''
--
--    NOTE: `security_invoker` ke liye Postgres 15+ chahiye (Supabase ka
--    default hai). Isse pehle ke version par ye line error degi — us case me
--    `with (security_invoker = true)` hata do aur app ka fallback
--    (client-side user_profiles populate) apne aap chalta rahega.
-- ------------------------------------------------------------
drop view if exists public.resources_feed;
create view public.resources_feed
with (security_invoker = true) as
select
  r.id, r.title, r.type, r.subject, r.college, r.semester, r.year,
  r.file_name, r.file_path, r.file_url, r.status, r.downloads, r.upvotes,
  r.created_at, r.uploader_email, r.uploader_name, r.uploader_uid,
  nullif(coalesce(nullif(trim(p.name), ''), nullif(trim(r.uploader_name), ''), ''), '') as contributor_name,
  coalesce(p.avatar_url, '') as contributor_avatar,
  coalesce(p.username, '') as contributor_username
from public.resources r
left join public.user_profiles p on p.uid = r.uploader_uid;

grant select on public.resources_feed to anon, authenticated;

-- ------------------------------------------------------------
-- 6) LEGACY SNAPSHOT SYNC
--    admin panel / push notifications abhi bhi uploader_name padhte hain,
--    isliye naam badalte hi ye snapshot bhi live rakha jaata hai.
--    DP yahan store NAHI hota — wo sirf user_profiles me rehta hai.
--    Blank name snapshot ko kabhi wipe nahi karta (guard neeche).
-- ------------------------------------------------------------
create or replace function public.sync_resource_contributor_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.name, '') <> '' and new.name is distinct from old.name then
    update public.resources
       set uploader_name = new.name
     where uploader_uid = new.uid;
  end if;
  return new;
end $$;

drop trigger if exists user_profiles_sync_resource_names on public.user_profiles;
create trigger user_profiles_sync_resource_names
after update of name on public.user_profiles
for each row execute function public.sync_resource_contributor_snapshot();

-- ============================================================
-- VERIFY (optional)
--   linked   = jin par live contributor link lag chuka hai
--   unlinked = legacy/anonymous rows (naam uploader_name se dikhta hai)
-- ============================================================
-- select count(*) filter (where coalesce(uploader_uid,'') = '')  as unlinked,
--        count(*) filter (where coalesce(uploader_uid,'') <> '') as linked
--   from public.resources;
