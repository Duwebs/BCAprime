-- ============================================================
-- BCAPrime — User Reading Progress Table & Synchronization
-- Table: user_reading_progress
-- Features:
--   1. Real-time synchronization of PDF reading progress across all user devices
--   2. Automatic upsert on conflict (user_id, pdf_id)
--   3. Row Level Security (RLS) ensuring users only access their own reading data
--   4. Fast ordering by recently updated for dashboard Continue Reading carousel
-- ============================================================

create table if not exists public.user_reading_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id text not null,
  title text not null default '',
  current_page integer not null default 1,
  total_pages integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_reading_progress_user_pdf_unique unique (user_id, pdf_id)
);

-- Index for instant querying by user and updated_at desc (for LIMIT 3)
create index if not exists idx_user_reading_progress_user_updated
  on public.user_reading_progress (user_id, updated_at desc);

-- Enable RLS
alter table public.user_reading_progress enable row level security;

-- Policies: users can only manage their own reading progress
drop policy if exists "Users can view own reading progress" on public.user_reading_progress;
create policy "Users can view own reading progress"
  on public.user_reading_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reading progress" on public.user_reading_progress;
create policy "Users can insert own reading progress"
  on public.user_reading_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reading progress" on public.user_reading_progress;
create policy "Users can update own reading progress"
  on public.user_reading_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reading progress" on public.user_reading_progress;
create policy "Users can delete own reading progress"
  on public.user_reading_progress for delete
  to authenticated
  using (auth.uid() = user_id);

-- Permissions
grant select, insert, update, delete on public.user_reading_progress to authenticated;
grant select, insert, update, delete on public.user_reading_progress to service_role;

