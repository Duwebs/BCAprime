-- ============================================================
-- BCAPrime — Real-Time In-App Notifications Schema
-- Backed by Supabase with Realtime publication & RLS
-- ============================================================

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id text default null, -- null for all users (broadcast) or specific user uid
  college text default 'all',
  semester integer default null,
  title text not null,
  message text not null,
  type text default 'note', -- 'note' | 'pyq' | 'request' | 'system'
  target_resource text default '', -- resource title/id or route
  target_url text default '', -- direct hash or URL
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_college_sem
  on public.notifications (college, semester, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications (is_read, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

-- Policies:
-- 1. Read: Users can view broadcast notifications or notifications targeted to them
drop policy if exists "Anyone can read notifications" on public.notifications;
create policy "Anyone can read notifications"
  on public.notifications for select
  to anon, authenticated
  using (
    user_id is null
    or user_id = ''
    or (auth.uid() is not null and auth.uid()::text = user_id)
  );

-- 2. Insert: Allowed so system / client actions (uploads, requests) can post notifications
drop policy if exists "Anyone can insert notifications" on public.notifications;
create policy "Anyone can insert notifications"
  on public.notifications for insert
  to anon, authenticated
  with check (true);

-- 3. Update: Allowed so users can mark notifications as read
drop policy if exists "Anyone can update notifications" on public.notifications;
create policy "Anyone can update notifications"
  on public.notifications for update
  to anon, authenticated
  using (true)
  with check (true);

-- Enable Supabase Realtime for notifications table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

grant select, insert, update on public.notifications to anon, authenticated, service_role;

-- 1. Deduplicate existing notifications (retains only the latest entry per title + message)
delete from public.notifications a
using public.notifications b
where a.created_at < b.created_at
  and a.title = b.title
  and a.message = b.message;

-- 2. Idempotent seed alerts (will not insert duplicates if already present)
insert into public.notifications (title, message, type, target_resource, target_url, is_read, created_at)
select 'Welcome to BCAPrime', 'Access syllabus, curated notes, and previous year question papers in one place.', 'system', 'Make this semester count', '#top', false, now() - interval '5 minutes'
where not exists (
  select 1 from public.notifications where title = 'Welcome to BCAPrime'
);

insert into public.notifications (title, message, type, target_resource, target_url, is_read, created_at)
select 'Semester PYQs Available', 'Explore recent university examination papers for BCA Semesters 1 to 6.', 'pyq', 'PYQs', '#finderSection', false, now() - interval '25 minutes'
where not exists (
  select 1 from public.notifications where title = 'Semester PYQs Available'
);

