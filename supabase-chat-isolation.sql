-- ============================================================
-- BCAPrime — College & Semester-Wise Chat Isolation (Room Mapping)
-- Run this ONCE in Supabase SQL Editor AFTER supabase-schema.sql.
-- What it does:
--  1) Adds college + semester columns to chat_messages (the room key).
--  2) Backfills old rows to a legacy room so history stays visible.
--  3) Adds composite index for fast room-scoped history queries.
--  4) Adds server-side room-match guard so a sender can ONLY insert
--     into their OWN college+semester room (profile must match).
--  5) Ensures chat_messages is in the supabase_realtime publication.
--
-- NOTE on "zero access" + this stack: Firebase handles login while
-- Supabase is accessed with the anon key, so Supabase RLS cannot see
-- the Firebase uid via auth.uid(). Row ownership is therefore proven
-- by the client-supplied `uid` column joined against user_profiles
-- (same pattern as the existing is_phone_verified_student gate).
-- INSERTs are strictly room-checked server-side below. SELECTs stay
-- open (guests see the community is alive) — strict per-room READ
-- isolation is enforced by the client query filters
--   .eq('college', myCollege).eq('semester', mySem)
-- plus the realtime transport filter (college=eq.X + client sem check).
-- For hard server-side read isolation, proxy reads through the
-- notify-chat Edge Function or mint Supabase Auth JWTs from Firebase.
-- ============================================================

-- 1) Room columns (idempotent)
alter table public.chat_messages
  add column if not exists college text not null default 'all';
alter table public.chat_messages
  add column if not exists semester integer;

-- Keep semester in 1..6 when present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_messages_semester_check'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_semester_check
      check (semester is null or (semester between 1 and 6));
  end if;
end $$;

-- 2) Backfill legacy rows (no room yet) into the 'all'/NULL room so
--    existing history does not break. New sends always carry a room.
update public.chat_messages
set college = 'all'
where college is null or college = '';

-- 3) Fast room-scoped history: WHERE college=? AND semester=? AND channel=? ORDER BY id DESC
create index if not exists chat_messages_room_idx
  on public.chat_messages (college, semester, channel, id desc);
create index if not exists chat_messages_room_created_idx
  on public.chat_messages (college, semester, created_at desc);

-- 4) Server-side room-match guard.
--    Sender's user_profiles.college/semester MUST equal the message room.
create or replace function public.is_same_room_student(p_uid text, p_college text, p_sem integer)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_profiles p
    where p.uid = p_uid
      and lower(coalesce(p.college, 'all')) = lower(coalesce(nullif(trim(p_college), ''), 'all'))
      and (
        -- 'all'/NULL semester profiles are onboarding-incomplete: allow them
        -- to post only into the legacy 'all' room, never into Sem 1..6 rooms.
        (p.semester is null and p_sem is null)
        or (p_sem is not null and p.semester = p_sem)
      )
  );
$$;

-- Replace the insert policy: phone-verified AND same-room AND length cap.
drop policy if exists "Verified students can send chat messages" on public.chat_messages;
create policy "Verified same-room students can send chat messages"
  on public.chat_messages for insert
  to anon, authenticated
  with check (
    public.is_phone_verified_student(uid)
    and public.is_same_room_student(uid, college, semester)
    and length(body) <= 4000
  );

-- 5) Realtime publication (idempotent) — required for postgres_changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- 6) Read policy stays open (guest preview). Per-room read isolation is
--    enforced client-side via .eq('college',…).eq('semester',…) queries
--    and the realtime college transport filter. Do NOT lock SELECT down
--    here or guest preview + anon-key reads break.
drop policy if exists "Anyone can read chat messages" on public.chat_messages;
create policy "Anyone can read chat messages"
  on public.chat_messages for select
  to anon, authenticated
  using (true);
