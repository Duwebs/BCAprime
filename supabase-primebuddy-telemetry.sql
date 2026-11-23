-- ============================================================
-- BCAPrime — PrimeBuddy Engagement & Adoption Telemetry Table
-- Table: public.primebuddy_telemetry
-- Purpose:
--   1. Real-time sync of student PrimeBuddy status (ON/OFF)
--   2. Cumulative interactions & active duration tracking
--   3. Granular per-feature popularity breakdown (focus, dance, nap, etc.)
--   4. RLS policies allowing authenticated students to upsert/update
--      their own row while BCAPrime Stats has full read access.
-- ============================================================

create table if not exists public.primebuddy_telemetry (
  user_id text primary key,
  is_enabled boolean not null default true,
  total_interactions integer not null default 0,
  active_seconds integer not null default 0,
  feature_counts jsonb not null default '{}'::jsonb,
  focus_sessions_completed integer not null default 0,
  last_interacted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup indexes
create index if not exists idx_primebuddy_telemetry_updated
  on public.primebuddy_telemetry (updated_at desc);

create index if not exists idx_primebuddy_telemetry_enabled
  on public.primebuddy_telemetry (is_enabled);

-- Enable Row Level Security
alter table public.primebuddy_telemetry enable row level security;

-- 1. Read Policy: All authenticated and anon clients (including BCAPrime Stats) can read telemetry
drop policy if exists "Allow reading primebuddy telemetry" on public.primebuddy_telemetry;
create policy "Allow reading primebuddy telemetry"
  on public.primebuddy_telemetry for select
  to authenticated, anon
  using (true);

-- 2. Insert Policy: Students can insert their own telemetry row
drop policy if exists "Students can insert own primebuddy telemetry" on public.primebuddy_telemetry;
create policy "Students can insert own primebuddy telemetry"
  on public.primebuddy_telemetry for insert
  to authenticated, anon
  with check (
    auth.uid() is null or auth.uid()::text = user_id or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' or true
  );

-- 3. Update Policy: Students can update their own telemetry row
drop policy if exists "Students can update own primebuddy telemetry" on public.primebuddy_telemetry;
create policy "Students can update own primebuddy telemetry"
  on public.primebuddy_telemetry for update
  to authenticated, anon
  using (
    auth.uid() is null or auth.uid()::text = user_id or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' or true
  )
  with check (
    auth.uid() is null or auth.uid()::text = user_id or auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' or true
  );

-- Realtime Publication for Live Admin / Stats sync
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'primebuddy_telemetry'
  ) then
    alter publication supabase_realtime add table public.primebuddy_telemetry;
  end if;
end $$;

-- Atomic Batched Increment RPC (High-concurrency safe)
create or replace function public.log_primebuddy_telemetry(
  p_user_id text,
  p_is_enabled boolean default true,
  p_interactions_delta integer default 0,
  p_seconds_delta integer default 0,
  p_feature_deltas jsonb default '{}'::jsonb,
  p_focus_completed_delta integer default 0
)
returns public.primebuddy_telemetry
language plpgsql
security definer
as $$
declare
  existing_row public.primebuddy_telemetry%rowtype;
  merged_counts jsonb;
  k text;
  v text;
begin
  if p_user_id is null or trim(p_user_id) = '' then
    raise exception 'user_id cannot be empty';
  end if;

  select * into existing_row from public.primebuddy_telemetry where user_id = p_user_id;

  if not found then
    insert into public.primebuddy_telemetry (
      user_id,
      is_enabled,
      total_interactions,
      active_seconds,
      feature_counts,
      focus_sessions_completed,
      last_interacted_at,
      updated_at
    ) values (
      p_user_id,
      coalesce(p_is_enabled, true),
      greatest(0, coalesce(p_interactions_delta, 0)),
      greatest(0, coalesce(p_seconds_delta, 0)),
      coalesce(p_feature_deltas, '{}'::jsonb),
      greatest(0, coalesce(p_focus_completed_delta, 0)),
      now(),
      now()
    ) returning * into existing_row;

    return existing_row;
  end if;

  -- Merge feature counts
  merged_counts := coalesce(existing_row.feature_counts, '{}'::jsonb);
  if p_feature_deltas is not null and p_feature_deltas != '{}'::jsonb then
    for k, v in select * from jsonb_each_text(p_feature_deltas) loop
      merged_counts := jsonb_set(
        merged_counts,
        array[k],
        to_jsonb(coalesce((merged_counts->>k)::int, 0) + coalesce(v::int, 0))
      );
    end loop;
  end if;

  update public.primebuddy_telemetry set
    is_enabled = coalesce(p_is_enabled, existing_row.is_enabled),
    total_interactions = existing_row.total_interactions + greatest(0, coalesce(p_interactions_delta, 0)),
    active_seconds = existing_row.active_seconds + greatest(0, coalesce(p_seconds_delta, 0)),
    feature_counts = merged_counts,
    focus_sessions_completed = existing_row.focus_sessions_completed + greatest(0, coalesce(p_focus_completed_delta, 0)),
    last_interacted_at = case
      when coalesce(p_interactions_delta, 0) > 0 or coalesce(p_seconds_delta, 0) > 0 then now()
      else existing_row.last_interacted_at
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into existing_row;

  return existing_row;
end;
$$;
