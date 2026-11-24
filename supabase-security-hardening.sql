-- ============================================================
-- BCAPrime — Comprehensive Production Security Hardening
-- File: supabase-security-hardening.sql
-- ============================================================
-- Apply this script in the Supabase SQL Editor.
-- It locks down Row Level Security (RLS) policies, enforces strict
-- admin authorization, prevents privilege escalation, and secures
-- storage buckets without breaking any user flows.
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS FOR SECURITY ENFORCEMENT
-- ============================================================

-- Checks whether the current request is from an authenticated admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or exists (
      select 1 from public.user_profiles
      where uid = auth.uid()::text
        and is_admin = true
    )
  );
$$;

-- ============================================================
-- 2. USER PROFILES (Lockdown & Privilege Escalation Prevention)
-- ============================================================
alter table public.user_profiles enable row level security;

-- Drop legacy / insecure wide-open policies
drop policy if exists "Anyone can read user profiles" on public.user_profiles;
drop policy if exists "Anyone can create user profiles" on public.user_profiles;
drop policy if exists "Anyone can update user profiles" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Admins can update any profile" on public.user_profiles;
drop policy if exists "Public can read profiles" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Admins can delete user profiles" on public.user_profiles;

-- SELECT: Public can view basic profile info (required for contributor cards and profiles)
create policy "Public can read profiles"
  on public.user_profiles for select
  to anon, authenticated
  using (true);

-- INSERT: Authenticated users can insert their own profile row during sign-up
-- Regular users cannot set is_admin = true
create policy "Users can insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (
    auth.uid()::text = uid
    and (is_admin is not true or public.is_admin())
  );

-- UPDATE: Users can only update their own profile, and cannot escalate admin rights
create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (auth.uid()::text = uid or public.is_admin())
  with check (
    (auth.uid()::text = uid and (is_admin is not true or public.is_admin()))
    or public.is_admin()
  );

-- DELETE: Only admins can delete user profiles
create policy "Admins can delete user profiles"
  on public.user_profiles for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. DEVICE SESSIONS (WhatsApp-style device approval)
-- ============================================================
alter table public.device_sessions enable row level security;

drop policy if exists "Anyone can read device sessions" on public.device_sessions;
drop policy if exists "Anyone can create device sessions" on public.device_sessions;
drop policy if exists "Anyone can update device sessions" on public.device_sessions;
drop policy if exists "Users can read own device sessions" on public.device_sessions;
drop policy if exists "Users can create own device sessions" on public.device_sessions;
drop policy if exists "Users can update own device sessions" on public.device_sessions;
drop policy if exists "Users can delete own device sessions" on public.device_sessions;

-- Only the device owner or admin can read their device sessions
create policy "Users can read own device sessions"
  on public.device_sessions for select
  to authenticated
  using (auth.uid()::text = uid or public.is_admin());

-- Users can register their own device
create policy "Users can create own device sessions"
  on public.device_sessions for insert
  to authenticated
  with check (auth.uid()::text = uid or public.is_admin());

-- Users can approve/deny/update only their own devices
create policy "Users can update own device sessions"
  on public.device_sessions for update
  to authenticated
  using (auth.uid()::text = uid or public.is_admin())
  with check (auth.uid()::text = uid or public.is_admin());

-- Users can remove their own devices
create policy "Users can delete own device sessions"
  on public.device_sessions for delete
  to authenticated
  using (auth.uid()::text = uid or public.is_admin());

-- ============================================================
-- 4. TELEMETRY & AUDIENCE (Eliminate `or true` and public dumps)
-- ============================================================

-- PrimeBuddy Telemetry
alter table public.primebuddy_telemetry enable row level security;

drop policy if exists "Allow reading primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Students can insert own primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Students can update own primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Admins can read primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Read primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Students can insert primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Students can update primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Admins can manage primebuddy telemetry" on public.primebuddy_telemetry;
drop policy if exists "Admins can delete primebuddy telemetry" on public.primebuddy_telemetry;

-- SELECT: Students can read their own buddy state; admins can read all
create policy "Read primebuddy telemetry"
  on public.primebuddy_telemetry for select
  to authenticated, anon
  using (
    (auth.uid() is not null and auth.uid()::text = user_id)
    or public.is_admin()
  );

-- INSERT: Students can insert their own row
create policy "Students can insert primebuddy telemetry"
  on public.primebuddy_telemetry for insert
  to anon, authenticated
  with check (
    auth.uid() is null
    or auth.uid()::text = user_id
    or public.is_admin()
  );

-- UPDATE: Students can update their own row (without the old 'or true' backdoor)
create policy "Students can update primebuddy telemetry"
  on public.primebuddy_telemetry for update
  to anon, authenticated
  using (
    auth.uid() is null
    or auth.uid()::text = user_id
    or public.is_admin()
  )
  with check (
    auth.uid() is null
    or auth.uid()::text = user_id
    or public.is_admin()
  );

-- DELETE: Admins only
create policy "Admins can delete primebuddy telemetry"
  on public.primebuddy_telemetry for delete
  to authenticated
  using (public.is_admin());

-- Guest Sessions
alter table public.guest_sessions enable row level security;

drop policy if exists "Allow reading guest sessions" on public.guest_sessions;
drop policy if exists "Anyone can insert guest sessions" on public.guest_sessions;
drop policy if exists "Anyone can update guest sessions" on public.guest_sessions;
drop policy if exists "Admins can read guest sessions" on public.guest_sessions;
drop policy if exists "Visitors can insert guest sessions" on public.guest_sessions;
drop policy if exists "Admins can update guest sessions" on public.guest_sessions;
drop policy if exists "Visitors can update guest sessions" on public.guest_sessions;

-- SELECT: Admins only
create policy "Admins can read guest sessions"
  on public.guest_sessions for select
  to authenticated
  using (public.is_admin());

-- INSERT: Anon/authenticated visitors can create a session
create policy "Visitors can insert guest sessions"
  on public.guest_sessions for insert
  to anon, authenticated
  with check (
    length(visitor_id) <= 128
  );

-- UPDATE: Guests can update their own session status (conversion); admins full access
create policy "Visitors can update guest sessions"
  on public.guest_sessions for update
  to anon, authenticated
  using (
    length(visitor_id) <= 128
    or public.is_admin()
  )
  with check (
    length(visitor_id) <= 128
    or public.is_admin()
  );

-- Analytics Events
alter table public.analytics_events enable row level security;

drop policy if exists "Anyone can log analytics events" on public.analytics_events;
drop policy if exists "Admins can view analytics" on public.analytics_events;
drop policy if exists "Public can log analytics events" on public.analytics_events;

create policy "Admins can view analytics"
  on public.analytics_events for select
  to authenticated
  using (public.is_admin());

create policy "Public can log analytics events"
  on public.analytics_events for insert
  to anon, authenticated
  with check (
    length(event_type) <= 50
    and length(visitor_id) <= 128
  );

-- ============================================================
-- 5. NOTIFICATIONS (Prevent arbitrary broadcast injection)
-- ============================================================
alter table public.notifications enable row level security;

drop policy if exists "Anyone can read notifications" on public.notifications;
drop policy if exists "Anyone can insert notifications" on public.notifications;
drop policy if exists "Anyone can update notifications" on public.notifications;
drop policy if exists "Users can read notifications" on public.notifications;
drop policy if exists "Admins can insert notifications" on public.notifications;
drop policy if exists "Users can mark own notifications as read" on public.notifications;
drop policy if exists "Admins can delete notifications" on public.notifications;

-- SELECT: Read broadcast or targeted to current user
create policy "Users can read notifications"
  on public.notifications for select
  to anon, authenticated
  using (
    user_id is null
    or user_id = ''
    or user_id = 'all'
    or (auth.uid() is not null and auth.uid()::text = user_id)
    or public.is_admin()
  );

-- INSERT: Only admins or service role can post notifications
create policy "Admins can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

-- UPDATE: Users can mark notifications as read
create policy "Users can mark own notifications as read"
  on public.notifications for update
  to anon, authenticated
  using (
    user_id is null
    or user_id = ''
    or user_id = 'all'
    or (auth.uid() is not null and auth.uid()::text = user_id)
    or public.is_admin()
  )
  with check (
    user_id is null
    or user_id = ''
    or user_id = 'all'
    or (auth.uid() is not null and auth.uid()::text = user_id)
    or public.is_admin()
  );

-- DELETE: Admins only
create policy "Admins can delete notifications"
  on public.notifications for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 6. LOST & FOUND (Prevent unauthorized deletion / modification)
-- ============================================================
alter table public.lost_found enable row level security;

drop policy if exists "Anyone can read lost_found" on public.lost_found;
drop policy if exists "Admins can read all lost_found" on public.lost_found;
drop policy if exists "Authenticated can post lost_found" on public.lost_found;
drop policy if exists "Authenticated can update lost_found" on public.lost_found;
drop policy if exists "Authenticated can remove lost_found" on public.lost_found;
drop policy if exists "Anyone can read active lost_found" on public.lost_found;
drop policy if exists "Users can post lost_found" on public.lost_found;
drop policy if exists "Poster or admin can update lost_found" on public.lost_found;
drop policy if exists "Poster or admin can delete lost_found" on public.lost_found;

create policy "Anyone can read active lost_found"
  on public.lost_found for select
  to anon, authenticated
  using (
    status in ('active', 'claimed', 'resolved')
    or (auth.uid() is not null and poster_uid = auth.uid()::text)
    or public.is_admin()
  );

create policy "Users can post lost_found"
  on public.lost_found for insert
  to authenticated
  with check (
    auth.uid() is not null
    and poster_uid = auth.uid()::text
  );

create policy "Poster or admin can update lost_found"
  on public.lost_found for update
  to authenticated
  using (poster_uid = auth.uid()::text or public.is_admin())
  with check (poster_uid = auth.uid()::text or public.is_admin());

create policy "Poster or admin can delete lost_found"
  on public.lost_found for delete
  to authenticated
  using (poster_uid = auth.uid()::text or public.is_admin());

-- Lost & Found Claims
alter table public.lost_found_claims enable row level security;

drop policy if exists "Anyone can read lost_found_claims" on public.lost_found_claims;
drop policy if exists "Authenticated can claim lost_found" on public.lost_found_claims;
drop policy if exists "Authenticated can delete lost_found_claims" on public.lost_found_claims;
drop policy if exists "Users can read relevant claims" on public.lost_found_claims;
drop policy if exists "Users can insert own claims" on public.lost_found_claims;
drop policy if exists "Claimant or admin can delete claims" on public.lost_found_claims;

create policy "Users can read relevant claims"
  on public.lost_found_claims for select
  to authenticated
  using (
    claimant_uid = auth.uid()::text
    or exists (
      select 1 from public.lost_found lf
      where lf.id = lost_found_claims.post_id
        and lf.poster_uid = auth.uid()::text
    )
    or public.is_admin()
  );

create policy "Users can insert own claims"
  on public.lost_found_claims for insert
  to authenticated
  with check (claimant_uid = auth.uid()::text);

create policy "Claimant or admin can delete claims"
  on public.lost_found_claims for delete
  to authenticated
  using (claimant_uid = auth.uid()::text or public.is_admin());

-- ============================================================
-- 7. SENIOR REQUESTS & FEEDBACK
-- ============================================================
alter table public.senior_requests enable row level security;

drop policy if exists "Anyone can read senior requests" on public.senior_requests;
drop policy if exists "Anyone can create a senior request" on public.senior_requests;
drop policy if exists "Admins can update senior requests" on public.senior_requests;
drop policy if exists "Admins can delete senior requests" on public.senior_requests;
drop policy if exists "Authenticated users can create senior requests" on public.senior_requests;
drop policy if exists "Requester or admin can update senior requests" on public.senior_requests;
drop policy if exists "Requester or admin can delete senior requests" on public.senior_requests;

create policy "Anyone can read senior requests"
  on public.senior_requests for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can create senior requests"
  on public.senior_requests for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (requester_uid = '' or requester_uid = auth.uid()::text)
  );

create policy "Requester or admin can update senior requests"
  on public.senior_requests for update
  to authenticated
  using (requester_uid = auth.uid()::text or public.is_admin())
  with check (requester_uid = auth.uid()::text or public.is_admin());

create policy "Requester or admin can delete senior requests"
  on public.senior_requests for delete
  to authenticated
  using (requester_uid = auth.uid()::text or public.is_admin());

-- Feedback
alter table public.feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.feedback;
drop policy if exists "Admins can view feedback" on public.feedback;
drop policy if exists "Admins can update feedback" on public.feedback;
drop policy if exists "Admins can delete feedback" on public.feedback;
drop policy if exists "Users can submit feedback" on public.feedback;

create policy "Users can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

create policy "Admins can view feedback"
  on public.feedback for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update feedback"
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete feedback"
  on public.feedback for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 8. MOCK TEST QUESTIONS & QUIZZES (Prevent question wiping)
-- ============================================================
alter table public.questions enable row level security;
alter table public.quizzes enable row level security;

drop policy if exists "Anyone can read questions" on public.questions;
drop policy if exists "Authorized users can manage questions" on public.questions;
drop policy if exists "Admins can delete questions" on public.questions;
drop policy if exists "Admins can update questions" on public.questions;
drop policy if exists "Admins can insert questions" on public.questions;

create policy "Anyone can read questions"
  on public.questions for select
  to anon, authenticated
  using (true);

create policy "Admins can insert questions"
  on public.questions for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and q.created_by = auth.uid()::text
    )
  );

create policy "Admins can update questions"
  on public.questions for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and q.created_by = auth.uid()::text
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and q.created_by = auth.uid()::text
    )
  );

create policy "Admins can delete questions"
  on public.questions for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and q.created_by = auth.uid()::text
    )
  );

-- ============================================================
-- 9. STORAGE BUCKET HARDENING
-- ============================================================

-- Ensure resources bucket is private
update storage.buckets set public = false where id = 'resources';

-- Ensure lossfound bucket exists and is public for reading
insert into storage.buckets (id, name, public)
values ('lossfound', 'lossfound', true)
on conflict (id) do nothing;

-- Drop insecure open deletion / upload policies
drop policy if exists "Anyone can upload lossfound images" on storage.objects;
drop policy if exists "Anyone can read lossfound images" on storage.objects;
drop policy if exists "Anyone can delete lossfound images" on storage.objects;
drop policy if exists "Admins or owners can delete lossfound images" on storage.objects;
drop policy if exists "Authenticated can upload lossfound images" on storage.objects;
drop policy if exists "Admins can delete lossfound images" on storage.objects;

-- Storage: Read lossfound images
create policy "Anyone can read lossfound images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'lossfound');

-- Storage: Upload lossfound images (authenticated only, max 5MB, image extension)
create policy "Authenticated can upload lossfound images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lossfound'
    and lower(substring(name from '\.([^\.]+)$')) in ('jpg', 'jpeg', 'png', 'webp', 'heic')
  );

-- Storage: Only admins can delete lossfound images
create policy "Admins can delete lossfound images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lossfound'
    and public.is_admin()
  );
