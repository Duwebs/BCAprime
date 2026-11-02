-- ============================================================
-- BCAPrime — Database Migration for New User Stats & Telegram Notifications
-- Run this ONCE in the Supabase Dashboard -> SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create public.profiles table (if not exists)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null default '',
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure created_at and full_name exist if table was already created
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Ensure public.user_profiles has created_at as well (for backwards compatibility)
alter table public.user_profiles add column if not exists created_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 2. Configure Row Level Security (RLS) on public.profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Authenticated users can read their own profile, admins can read all profiles
drop policy if exists "Users can read own profile or admin can read all" on public.profiles;
create policy "Users can read own profile or admin can read all"
on public.profiles for select
to authenticated
using (
  auth.uid() = id
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
);

-- Users can update their own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admins have full access
drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
on public.profiles for all
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

-- ------------------------------------------------------------
-- 3. Automatic Trigger on auth.users (Signup Handler)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
begin
  -- Resolve display name from user metadata or email prefix
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    split_part(coalesce(new.email, 'User'), '@', 1)
  );

  -- 1. Insert into public.profiles
  insert into public.profiles (id, email, full_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    v_name,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    updated_at = now();

  -- 2. Insert into public.user_profiles for existing frontend/admin compatibility
  insert into public.user_profiles (uid, email, name, created_at, updated_at)
  values (
    new.id::text,
    coalesce(new.email, ''),
    v_name,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (uid) do update
  set
    email = coalesce(nullif(excluded.email, ''), public.user_profiles.email),
    name = coalesce(nullif(public.user_profiles.name, ''), excluded.name),
    created_at = coalesce(public.user_profiles.created_at, excluded.created_at),
    updated_at = now();

  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 4. Backfill existing auth.users into public.profiles & user_profiles
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name, created_at, updated_at)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(up.name), ''),
    split_part(coalesce(u.email, 'User'), '@', 1)
  ),
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from auth.users u
left join public.user_profiles up on up.uid = u.id::text
on conflict (id) do nothing;

-- Backfill created_at in user_profiles from auth.users if empty
update public.user_profiles up
set created_at = u.created_at
from auth.users u
where up.uid = u.id::text
  and (up.created_at is null or up.created_at = up.updated_at);

-- ------------------------------------------------------------
-- 5. RPC Function: get_admin_user_stats
-- Computes user metrics in Indian Standard Time (IST) and fetches recent signups
-- ------------------------------------------------------------
create or replace function public.get_admin_user_stats(p_limit int default 50)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_now_ist timestamp;
  v_today_start timestamp;
  v_week_start timestamp;
  v_month_start timestamp;
  v_last_month_start timestamp;
  v_last_month_end timestamp;

  v_total_users int;
  v_users_today int;
  v_users_week int;
  v_users_month int;
  v_users_last_month int;
  v_recent_users json;
begin
  -- Security check: Verify caller has admin role
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_role <> 'admin' and current_user not in ('postgres', 'service_role') then
    raise exception 'Access denied: Admin role required.';
  end if;

  -- Compute boundaries strictly in Indian Standard Time (IST, UTC+5:30)
  v_now_ist          := now() at time zone 'Asia/Kolkata';
  v_today_start      := date_trunc('day', v_now_ist);
  v_week_start       := date_trunc('week', v_now_ist);
  v_month_start      := date_trunc('month', v_now_ist);
  v_last_month_start := date_trunc('month', v_now_ist - interval '1 month');
  v_last_month_end   := v_month_start;

  -- Unified user set combining auth.users, public.profiles, and public.user_profiles
  with all_users as (
    select
      u.id::text as id,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(up.name), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        split_part(coalesce(u.email, 'User'), '@', 1)
      ) as name,
      coalesce(u.email, p.email, up.email, '') as email,
      coalesce(u.created_at, p.created_at, up.created_at, now()) as created_at,
      (coalesce(u.created_at, p.created_at, up.created_at, now()) at time zone 'Asia/Kolkata') as created_at_ist
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_profiles up on up.uid = u.id::text
  )
  select
    count(*),
    count(*) filter (where created_at_ist >= v_today_start),
    count(*) filter (where created_at_ist >= v_week_start),
    count(*) filter (where created_at_ist >= v_month_start),
    count(*) filter (where created_at_ist >= v_last_month_start and created_at_ist < v_last_month_end)
  into
    v_total_users,
    v_users_today,
    v_users_week,
    v_users_month,
    v_users_last_month
  from all_users;

  -- Fetch recent signups (last 20-50 users)
  with all_users as (
    select
      u.id::text as id,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(up.name), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        split_part(coalesce(u.email, 'User'), '@', 1)
      ) as name,
      coalesce(u.email, p.email, up.email, '') as email,
      coalesce(u.created_at, p.created_at, up.created_at, now()) as created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_profiles up on up.uid = u.id::text
    order by coalesce(u.created_at, p.created_at, up.created_at, now()) desc
    limit coalesce(p_limit, 50)
  )
  select coalesce(json_agg(row_to_json(all_users)), '[]'::json)
  into v_recent_users
  from all_users;

  return json_build_object(
    'total_users', coalesce(v_total_users, 0),
    'users_today', coalesce(v_users_today, 0),
    'users_this_week', coalesce(v_users_week, 0),
    'users_this_month', coalesce(v_users_month, 0),
    'users_last_month', coalesce(v_users_last_month, 0),
    'recent_users', coalesce(v_recent_users, '[]'::json)
  );
end;
$$;

-- Grant execution to authenticated users (admin role is verified inside the function)
grant execute on function public.get_admin_user_stats(int) to authenticated;

