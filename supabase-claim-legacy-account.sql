-- ============================================================
-- BCAPrime — supabase-claim-legacy-account.sql
-- Firebase -> Supabase auth migration: CLAIM-ON-LOGIN.
--
-- Purane accounts Firebase uid par the; naye Supabase accounts ki
-- uid ALAG hoti hai. Ye SECURITY DEFINER function pehle login par
-- caller ki EMAIL se purani user_profiles row dhoondh kar uske saare
-- data (uploads, device sessions, push subscriptions, lost & found,
-- subjects, analytics) ko NAYE Supabase uid par re-key kar deta hai.
--
-- Setup: SQL Editor me EK BAAR chalao (idempotent — dobara chalana
-- safe hai). App isse har pehle login par call karta hai
-- (app.js: tryClaimLegacyAccount -> rpc 'claim_legacy_account').
-- ============================================================

create or replace function public.claim_legacy_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_uid  text := coalesce(auth.uid()::text, '');
  v_email    text := coalesce(auth.email(), '');
  v_old_uid  text := '';
  v_new_exists boolean := false;
begin
  if v_new_uid = '' or v_email = '' then
    return false;  -- logged-in nahi hai — kuch nahi
  end if;

  -- 1) Legacy row: MERI email par kisi PURANE uid se bani user_profiles row.
  begin
    select uid into v_old_uid
    from public.user_profiles
    where lower(email) = lower(v_email)
      and uid is distinct from v_new_uid
    limit 1;
  exception when undefined_table then
    return false;
  end;

  if v_old_uid is null or v_old_uid = '' then
    return false;  -- koi legacy data nahi (naya account) — kuch nahi
  end if;

  -- 2) user_profiles: merge ya re-key (PK conflict se bachne ke liye dono case).
  select exists(select 1 from public.user_profiles where uid = v_new_uid)
    into v_new_exists;

  if v_new_exists then
    -- Merge: legacy ki zaroori fields naye row me aa jayein, phir legacy row hatao.
    update public.user_profiles n
    set username = coalesce(nullif(l.username, ''), n.username),
        name = case when n.name is null or n.name = '' then coalesce(l.name, n.name) else n.name end,
        is_email_verified = coalesce(n.is_email_verified, false) or coalesce(l.is_email_verified, false),
        updated_at = now()
    from public.user_profiles l
    where n.uid = v_new_uid
      and l.uid = v_old_uid;
    delete from public.user_profiles where uid = v_old_uid;
  else
    -- Common case: purani row ko hi naye uid par re-key kar do.
    update public.user_profiles
    set uid = v_new_uid, updated_at = now()
    where uid = v_old_uid;
  end if;

  -- 3) Baaki sab uid-keyed tables. Har update GUARDED hai — koi table/column
  --    missing ho to silent skip (function kabhi fail nahi hogi).
  begin update public.resources          set uploader_uid  = v_new_uid where uploader_uid  = v_old_uid; exception when others then null; end;
  begin update public.device_sessions    set uid           = v_new_uid where uid           = v_old_uid; exception when others then null; end;
  begin update public.qr_login_sessions  set uid           = v_new_uid where uid           = v_old_uid; exception when others then null; end;
  begin update public.push_subscriptions set uid           = v_new_uid where uid           = v_old_uid; exception when others then null; end;
  begin update public.email_otps         set uid           = v_new_uid where uid           = v_old_uid; exception when others then null; end;
  begin update public.senior_requests    set requester_uid = v_new_uid where requester_uid = v_old_uid; exception when others then null; end;
  begin update public.lost_found         set poster_uid    = v_new_uid where poster_uid    = v_old_uid; exception when others then null; end;
  begin update public.lost_found_claims  set claimant_uid  = v_new_uid where claimant_uid  = v_old_uid; exception when others then null; end;
  begin update public.subjects           set created_by    = v_new_uid where created_by    = v_old_uid; exception when others then null; end;
  begin update public.analytics_events   set user_id       = v_new_uid where user_id       = v_old_uid; exception when others then null; end;

  return true;
end;
$$;

revoke execute on function public.claim_legacy_account() from public;
grant execute on function public.claim_legacy_account() to authenticated;
