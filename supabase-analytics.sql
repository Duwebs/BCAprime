-- ============================================================
-- BCAPrime Analytics — supabase-analytics.sql
-- Supabase SQL Editor mein EK BAAR chalao.
-- ============================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null,              -- visit | view | download | upload | save | search | session_end
  visitor_id text not null default '',   -- anonymous device id (localStorage)
  session_id text not null default '',
  user_id text not null default '',      -- Firebase uid (empty for guests)
  user_email text not null default '',
  user_name text not null default '',
  resource_title text not null default '',
  resource_type text not null default '',-- notes | pyq
  subject text not null default '',
  semester int,
  duration_seconds int,                  -- session_end ke liye
  results_count int,                     -- search events ke liye: kitne results mile
  device text not null default '',       -- Mobile | Desktop | Tablet
  os text not null default '',
  browser text not null default '',
  page_path text not null default ''
);

-- Agar table pehle bana li thi to ye column safely add karo:
alter table public.analytics_events add column if not exists results_count int;

create index if not exists idx_analytics_type on public.analytics_events (event_type);
create index if not exists idx_analytics_visitor on public.analytics_events (visitor_id);
create index if not exists idx_analytics_created on public.analytics_events (created_at);

alter table public.analytics_events enable row level security;

-- Koi bhi (anonymous ya logged-in) events log kar sakta hai
drop policy if exists "Anyone can log analytics events" on public.analytics_events;
create policy "Anyone can log analytics events"
on public.analytics_events for insert
to anon, authenticated
with check (true);

-- Sirf admin hi analytics dekh sakta hai
drop policy if exists "Admins can view analytics" on public.analytics_events;
create policy "Admins can view analytics"
on public.analytics_events for select
to authenticated
using (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
