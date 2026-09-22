-- ============================================================
-- BCAPrime — Chat send FIX (run in Supabase SQL Editor)
-- "Message send nahi ho paa raha" ho to YE FILE run karo.
-- Safe + idempotent: har statement pehle check karta hai.
--
-- Fixes covered:
--  A) isolation columns missing  -> college/semester add + backfill
--  B) strict policy blocking old app / mismatched profile
--     -> permissive fallback (phone-verified + length cap only)
--  C) user_profiles row missing / phone flag false
--     -> diagnose (last SELECTs) + optional 1-line repair
--  D) realtime publication missing -> re-add table
-- ============================================================

-- ---------- A) Room columns (idempotent) ----------
alter table public.chat_messages
  add column if not exists college text not null default 'all';
alter table public.chat_messages
  add column if not exists semester integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_semester_check') then
    alter table public.chat_messages
      add constraint chat_messages_semester_check
      check (semester is null or (semester between 1 and 6));
  end if;
end $$;

update public.chat_messages
set college = 'all'
where college is null or college = '';

create index if not exists chat_messages_room_idx
  on public.chat_messages (college, semester, channel, id desc);

-- ---------- B) Permissive insert policy (compat) ----------
-- Strict same-room policy hatao; phone-gate wali policy wapas lao taaki
-- purana app + naya app DONO bhej sakein. (Room filtering client +
-- notify-chat fn par already enforced hai.)
drop policy if exists "Verified same-room students can send chat messages" on public.chat_messages;
drop policy if exists "Verified students can send chat messages" on public.chat_messages;
create policy "Verified students can send chat messages"
  on public.chat_messages for insert
  to anon, authenticated
  with check (
    public.is_phone_verified_student(uid)
    and length(body) <= 4000
  );

-- Strict room guard function rakho (future use), par policy se hata diya.
-- Wapas strict karna ho to supabase-chat-isolation.sql dobara run karo.

-- ---------- C) Diagnose: kaun block ho raha hai? ----------
-- 1) Kaun se uids phone-verified NAHI hain (ye kabhi send nahi kar sakte):
select uid, college, semester, is_phone_verified, updated_at
from public.user_profiles
where coalesce(is_phone_verified, false) = false
order by updated_at desc limit 20;

-- 2) Sabse recent failed-candidate rows nahi dikhengi (insert hi reject
--    hua), isliye apna uid yahan daal kar check karo:
--    select * from public.user_profiles where uid = 'PASTE_FIREBASE_UID';

-- OPTIONAL repair — sirf apne test uid ke liye, verify karke chalao:
-- update public.user_profiles
-- set is_phone_verified = true,
--     college = 'avviare',   -- apna college key
--     semester = 3            -- apna semester
-- where uid = 'PASTE_FIREBASE_UID';

-- ---------- D) Realtime publication ----------
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

-- ---------- E) Read policy open rakho (guest preview) ----------
drop policy if exists "Anyone can read chat messages" on public.chat_messages;
create policy "Anyone can read chat messages"
  on public.chat_messages for select
  to anon, authenticated
  using (true);
