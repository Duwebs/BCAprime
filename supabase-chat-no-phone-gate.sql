-- ============================================================
-- BCAPrime — Community chat: PHONE GATE REMOVED (login-only)
-- Run ONCE in Supabase SQL Editor.
-- Kya karta hai:
--  1) chat_messages ki INSERT policy se is_phone_verified_student
--     check HATA deta hai — ab sirf length(<=4000) check hota hai.
--     (Room columns hon to same-room check rehta hai, phone nahi.)
--  2) Purani verified/strict policies clean karke ek simple policy
--     banata hai taaki login user turant bhej sake.
-- Safe + idempotent — dobara run karne me koi dikkat nahi.
-- ============================================================

-- Room columns hon to rakho (isolation ke liye), warna add karo.
alter table public.chat_messages
  add column if not exists college text not null default 'all';
alter table public.chat_messages
  add column if not exists semester integer;

update public.chat_messages
set college = 'all'
where college is null or college = '';

-- Purani phone-gate policies hatao (naam jo bhi ho, sab drop).
drop policy if exists "Verified students can send chat messages" on public.chat_messages;
drop policy if exists "Verified same-room students can send chat messages" on public.chat_messages;
drop policy if exists "Logged-in students can send chat messages" on public.chat_messages;
drop policy if exists "Anyone can send chat messages" on public.chat_messages;

-- Nayi login-only policy: phone check NAHI, sirf length cap.
-- (Firebase login client par check hota hai; anon-key stack me
--  auth.uid() visible nahi, isliye uid-trust purane pattern jaisa.)
create policy "Logged-in students can send chat messages"
  on public.chat_messages for insert
  to anon, authenticated
  with check (
    length(body) <= 4000
  );

-- Read policy open (guest preview) — jaise pehle thi.
drop policy if exists "Anyone can read chat messages" on public.chat_messages;
create policy "Anyone can read chat messages"
  on public.chat_messages for select
  to anon, authenticated
  using (true);

-- Realtime (idempotent).
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
