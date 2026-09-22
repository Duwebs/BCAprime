-- ============================================================
-- BCAPrime — Push notifications for Community Chat (FCM + dedupe + DB trigger)
-- Run this ONCE in Supabase SQL Editor, AFTER supabase-chat-isolation.sql.
--
-- What it does:
--  1) push_subscriptions += device_token / push_type columns (FCM tokens)
--     + index for fast same-room targeting.
--  2) chat_push_sent — de-dupe log so the notify-chat Edge Function never
--     double-sends a message (client beacon + DB trigger both call it).
--  3) AFTER INSERT trigger on chat_messages -> calls the notify-chat Edge
--     Function via pg_net, so EVERY new room message triggers the FCM /
--     Web Push fan-out even if the sender's client dies right after sending.
--  4) Re-affirms chat_messages is in the supabase_realtime publication
--     (idempotent — realtime history for the working app).
--
-- NOTE: pg_net must be enabled in your project (Supabase Dashboard >
--   Database > Extensions > pg_net). On new projects it is available by
--   default; on older ones toggle it once from the dashboard.
-- ============================================================

-- 1) FCM column stack for push_subscriptions (idempotent)
alter table public.push_subscriptions add column if not exists device_token text;
alter table public.push_subscriptions add column if not exists push_type text not null default 'webpush';
create index if not exists push_subs_room_idx on public.push_subscriptions (college, semester);
create index if not exists push_subs_device_token_idx on public.push_subscriptions (device_token)
  where device_token is not null;

-- 2) De-dupe log: one row per chat message ever pushed
create table if not exists public.chat_push_sent (
  message_id bigint primary key,
  sent_at timestamptz not null default now()
);
alter table public.chat_push_sent enable row level security;

-- 3) pg_net + INSERT trigger (guaranteed push on every new message)
create extension if not exists pg_net with schema extensions;

create or replace function public.on_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if tg_op = 'INSERT' and new.id is not null then
    perform net.http_post(
      url := 'https://kjesjaakjddfxykisssh.supabase.co/functions/v1/notify-chat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl',
        'Authorization', 'Bearer sb_publishable_ZZ-StuiDnSwyJ9xNRjbY7A_eoyZF7Fl'
      ),
      body := jsonb_build_object('message_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chat_message_push_trigger on public.chat_messages;
create trigger chat_message_push_trigger
  after insert on public.chat_messages
  for each row execute function public.on_chat_message_insert();

-- 4) Realtime publication for chat_messages (idempotent re-affirm)
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