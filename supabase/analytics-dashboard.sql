-- ============================================================
-- BCAPrime Analytics Suite — Database Layer
-- Run this ONCE in Supabase SQL Editor after supabase-analytics.sql
-- ============================================================

-- ============================================================
-- 1. RPC: get_analytics_summary — single query for all top-level metrics
--    Input: date range (start/end timestamptz)
--    Returns: JSON object with all aggregated KPIs
-- ============================================================
create or replace function public.get_analytics_summary(
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns json
language sql stable
as $$
  with filtered as (
    select *
    from public.analytics_events
    where (p_start is null or created_at >= p_start)
      and (p_end   is null or created_at <= p_end)
  ),
  visitors as (
    select count(distinct visitor_id) as total_visitors,
           count(distinct case when user_email != '' then user_email end) as signed_up,
           count(distinct case when user_email = '' or user_email is null then visitor_id end) as guests
    from filtered
  ),
  events_agg as (
    select
      count(*) filter (where event_type = 'visit')         as visits,
      count(*) filter (where event_type = 'view')          as views,
      count(*) filter (where event_type = 'download')      as downloads,
      count(*) filter (where event_type = 'upload')        as uploads,
      count(*) filter (where event_type = 'save')          as saves,
      count(*) filter (where event_type = 'search')        as searches,
      count(*) filter (where event_type = 'session_end')   as sessions,
      avg(duration_seconds) filter (where event_type in ('session_end','session_heartbeat') and duration_seconds > 0) as avg_duration,
      max(created_at) as last_event_at
    from filtered
  ),
  devices as (
    select device, count(*) as cnt
    from filtered
    where device != ''
    group by device
    order by cnt desc
    limit 10
  ),
  browsers as (
    select browser, count(*) as cnt
    from filtered
    where browser != ''
    group by browser
    order by cnt desc
    limit 10
  ),
  os_list as (
    select os, count(*) as cnt
    from filtered
    where os != ''
    group by os
    order by cnt desc
    limit 10
  )
  select json_build_object(
    'total_visitors', v.total_visitors,
    'signed_up',      v.signed_up,
    'guests',         v.guests,
    'visits',         e.visits,
    'views',          e.views,
    'downloads',      e.downloads,
    'uploads',        e.uploads,
    'saves',          e.saves,
    'searches',       e.searches,
    'sessions',       e.sessions,
    'avg_duration',   coalesce(round(e.avg_duration::numeric, 1), 0),
    'last_event_at',  e.last_event_at,
    'devices',        (select coalesce(json_agg(row_to_json(d)), '[]'::json) from devices d),
    'browsers',       (select coalesce(json_agg(row_to_json(b)), '[]'::json) from browsers b),
    'os',             (select coalesce(json_agg(row_to_json(o)), '[]'::json) from os_list o)
  )
  from visitors v, events_agg e;
$$;


-- ============================================================
-- 2. RPC: get_daily_trend — daily Views vs Downloads line data
--    Input: number of days back, default 30
-- ============================================================
create or replace function public.get_daily_trend(p_days int default 30)
returns json
language sql stable
as $$
  with days as (
    select generate_series(
      current_date - (p_days - 1),
      current_date,
      '1 day'::interval
    )::date as day
  ),
  counts as (
    select
      created_at::date as day,
      count(*) filter (where event_type = 'view')     as views,
      count(*) filter (where event_type = 'download') as downloads,
      count(*) filter (where event_type = 'visit')    as visits,
      count(*) filter (where event_type = 'search')   as searches
    from public.analytics_events
    where created_at >= current_date - (p_days - 1)
    group by created_at::date
  )
  select coalesce(json_agg(json_build_object(
    'date',      d.day,
    'views',     coalesce(c.views, 0),
    'downloads', coalesce(c.downloads, 0),
    'visits',    coalesce(c.visits, 0),
    'searches',  coalesce(c.searches, 0)
  ) order by d.day), '[]'::json)
  from days d
  left join counts c on c.day = d.day;
$$;


-- ============================================================
-- 3. RPC: get_top_resources — top performing resources matrix
--    Input: limit (default 20)
-- ============================================================
create or replace function public.get_top_resources(p_limit int default 20)
returns json
language sql stable
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from (
    select
      resource_title as title,
      resource_type  as type,
      subject,
      semester,
      count(*) filter (where event_type = 'view')     as reads,
      count(*) filter (where event_type = 'download') as downloads,
      case
        when count(*) filter (where event_type in ('view','download')) > 0
        then round(
          (count(*) filter (where event_type = 'download')::numeric /
           nullif(count(*) filter (where event_type in ('view','download')), 0)) * 100,
          1
        )
        else 0
      end as download_rate,
      min(created_at) as first_seen,
      max(created_at) as last_activity
    from public.analytics_events
    where resource_title != '' and event_type in ('view', 'download')
    group by resource_title, resource_type, subject, semester
    order by (count(*) filter (where event_type = 'download') * 2 +
              count(*) filter (where event_type = 'view')) desc
    limit p_limit
  ) t;
$$;


-- ============================================================
-- 4. RPC: get_search_trends — search intelligence + zero-result tracker
--    Input: limit (default 50)
-- ============================================================
create or replace function public.get_search_trends(p_limit int default 50)
returns json
language sql stable
as $$
  with search_events as (
    select
      resource_title as query,
      results_count,
      created_at,
      visitor_id,
      user_email
    from public.analytics_events
    where event_type = 'search' and resource_title != ''
  ),
  aggregated as (
    select
      query,
      count(*) as total_count,
      count(*) filter (where results_count = 0 or results_count is null) as zero_result_count,
      count(*) filter (where results_count > 0) as result_count,
      max(created_at) as last_searched,
      array_agg(distinct visitor_id) filter (where results_count = 0 or results_count is null) as zero_visitors
    from search_events
    group by query
  )
  select coalesce(json_agg(json_build_object(
    'query',             a.query,
    'total_count',       a.total_count,
    'zero_result_count', a.zero_result_count,
    'result_count',      a.result_count,
    'last_searched',     a.last_searched,
    'is_failing',        (a.zero_result_count > 0)
  ) order by a.total_count desc), '[]'::json)
  from aggregated a
  limit p_limit;
$$;


-- ============================================================
-- 5. RPC: get_conversion_funnel — guest-to-student conversion
--    Input: date range
-- ============================================================
create or replace function public.get_conversion_funnel(
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns json
language sql stable
as $$
  with filtered as (
    select *
    from public.analytics_events
    where (p_start is null or created_at >= p_start)
      and (p_end   is null or created_at <= p_end)
  ),
  funnel as (
    select
      -- Step 1: Total unique visitors (guests)
      (select count(distinct visitor_id) from filtered) as total_guests,
      -- Step 2: PDF reads (view events)
      (select count(distinct visitor_id) from filtered where event_type = 'view') as pdf_reads,
      -- Step 3: Download attempts (download events)
      (select count(distinct visitor_id) from filtered where event_type = 'download') as download_attempts,
      -- Step 4: Search events (proxy for auth popup — users who explored more)
      (select count(distinct visitor_id) from filtered where event_type = 'search') as search_users,
      -- Step 5: Signed-up users (have user_email)
      (select count(distinct user_email) from filtered where user_email != '' and event_type in ('visit','view','download','search')) as successful_signups
  )
  select json_build_object(
    'total_guests',       f.total_guests,
    'pdf_reads',          f.pdf_reads,
    'download_attempts',  f.download_attempts,
    'search_users',       f.search_users,
    'successful_signups', f.successful_signups,
    'rate_reads',         case when f.total_guests > 0 then round((f.pdf_reads::numeric / f.total_guests) * 100, 1) else 0 end,
    'rate_downloads',     case when f.pdf_reads > 0 then round((f.download_attempts::numeric / f.pdf_reads) * 100, 1) else 0 end,
    'rate_search',        case when f.download_attempts > 0 then round((f.search_users::numeric / f.download_attempts) * 100, 1) else 0 end,
    'rate_signup',        case when f.search_users > 0 then round((f.successful_signups::numeric / f.search_users) * 100, 1) else 0 end
  )
  from funnel f;
$$;


-- ============================================================
-- 6. RPC: get_live_feed — recent events for the Live Wall
--    Input: limit (default 30)
-- ============================================================
create or replace function public.get_live_feed(p_limit int default 30)
returns json
language sql stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
  from (
    select
      event_type,
      visitor_id,
      user_name,
      user_email,
      resource_title,
      resource_type,
      subject,
      semester,
      device,
      os,
      browser,
      duration_seconds,
      created_at
    from public.analytics_events
    where created_at >= now() - interval '24 hours'
    order by created_at desc
    limit p_limit
  ) t;
$$;


-- ============================================================
-- 7. RPC: get_active_users — count of users active in last N minutes
--    Input: minutes (default 5)
-- ============================================================
create or replace function public.get_active_users(p_minutes int default 5)
returns json
language sql stable
as $$
  select json_build_object(
    'active_count', (
      select count(distinct visitor_id)
      from public.analytics_events
      where created_at >= now() - (p_minutes || ' minutes')::interval
    ),
    'recent_events', (
      select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
      from (
        select
          event_type,
          visitor_id,
          user_name,
          resource_title,
          subject,
          semester,
          device,
          created_at
        from public.analytics_events
        where created_at >= now() - (p_minutes || ' minutes')::interval
        order by created_at desc
        limit 20
      ) t
    )
  );
$$;


-- ============================================================
-- 8. Materialized view for heavy 30-day summaries (cached)
--    Refresh periodically (every 5 min via pg_cron or manual)
-- ============================================================
create materialized view if not exists public.analytics_summary_cache as
select
  date_trunc('hour', created_at) as hour_bucket,
  event_type,
  device,
  os,
  browser,
  count(*) as event_count,
  count(distinct visitor_id) as unique_visitors
from public.analytics_events
where created_at >= now() - interval '31 days'
group by 1, 2, 3, 4, 5;

create unique index if not exists idx_analytics_cache_unique
  on public.analytics_summary_cache (hour_bucket, event_type, device, os, browser);

-- Function to refresh the cache (call from dashboard or cron)
create or replace function public.refresh_analytics_cache()
returns void
language sql
as $$
  refresh materialized view concurrently public.analytics_summary_cache;
$$;


-- ============================================================
-- 9. Indexes for RPC performance
-- ============================================================
create index if not exists idx_analytics_event_created
  on public.analytics_events (event_type, created_at desc);

create index if not exists idx_analytics_resource_title
  on public.analytics_events (resource_title, event_type)
  where resource_title != '';

create index if not exists idx_analytics_search
  on public.analytics_events (event_type, results_count)
  where event_type = 'search';

create index if not exists idx_analytics_visitor_active
  on public.analytics_events (visitor_id, created_at desc);

-- ============================================================
-- 10. RLS: Only admins can call these read functions
-- ============================================================
-- The functions use SECURITY DEFINER is not needed since
-- analytics_events already has admin-only SELECT policy.
-- The RPC functions inherit the table's RLS.
-- ============================================================
