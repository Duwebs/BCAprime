-- ============================================================
-- BCAPrime — Dedicated Guest Mode & Hardware Telemetry Schema
-- Migration: supabase-audience-and-guest-telemetry.sql
-- ============================================================

-- 1. Create table for dedicated Guest Sessions tracking
create table if not exists public.guest_sessions (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  session_id text not null default '',
  device_type text not null default 'Mobile',
  brand text not null default 'Generic',
  model text not null default '',
  os text not null default '',
  browser text not null default '',
  is_pwa boolean not null default false,
  screen_size text not null default '',
  traffic_source text not null default 'Direct/PWA',
  referrer text not null default '',
  page_path text not null default '/',
  pages_viewed jsonb not null default '[]'::jsonb,
  resources_viewed jsonb not null default '[]'::jsonb,
  converted_to_user_id text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- Fast lookup indexes
create index if not exists idx_guest_sessions_visitor on public.guest_sessions (visitor_id);
create index if not exists idx_guest_sessions_created on public.guest_sessions (created_at desc);
create index if not exists idx_guest_sessions_last_active on public.guest_sessions (last_active_at desc);
create index if not exists idx_guest_sessions_converted on public.guest_sessions (converted_to_user_id);

-- Enable Row Level Security
alter table public.guest_sessions enable row level security;

-- Policies for guest sessions
drop policy if exists "Anyone can insert guest sessions" on public.guest_sessions;
create policy "Anyone can insert guest sessions"
  on public.guest_sessions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update guest sessions" on public.guest_sessions;
create policy "Anyone can update guest sessions"
  on public.guest_sessions for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow reading guest sessions" on public.guest_sessions;
create policy "Allow reading guest sessions"
  on public.guest_sessions for select
  to anon, authenticated
  using (true);

-- 2. Enrich user_profiles with exact hardware, PWA & traffic telemetry
alter table public.user_profiles add column if not exists device_brand text default '';
alter table public.user_profiles add column if not exists device_model text default '';
alter table public.user_profiles add column if not exists os text default '';
alter table public.user_profiles add column if not exists browser text default '';
alter table public.user_profiles add column if not exists is_pwa boolean default false;
alter table public.user_profiles add column if not exists traffic_source text default 'Direct/PWA';
alter table public.user_profiles add column if not exists screen_size text default '';
alter table public.user_profiles add column if not exists last_active_at timestamptz default now();

-- 3. Enrich analytics_events with model, PWA & traffic telemetry
alter table public.analytics_events add column if not exists brand text default '';
alter table public.analytics_events add column if not exists model text default '';
alter table public.analytics_events add column if not exists is_pwa boolean default false;
alter table public.analytics_events add column if not exists traffic_source text default 'Direct/PWA';
alter table public.analytics_events add column if not exists screen_size text default '';

-- 4. Realtime Publication registration
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guest_sessions'
  ) then
    alter publication supabase_realtime add table public.guest_sessions;
  end if;
end $$;
