-- ============================================================
-- BCAPrime — Text encoding cleanup (mojibake repair)
-- ============================================================
-- Kuch DB rows me accented/special characters DOUBLE-ENCODED hain:
-- UTF-8 bytes ko Latin-1/Windows-1252 padhne se bane mojibake.
-- Frontend + emails ab UTF-8 bhejte hain; ye migration PURANE
-- corrupted text ko sahi karta hai.
--
-- SAFE + IDEMPOTENT: jin rows me mojibake nahi hai wo untouched
-- rehti hain; doosri baar chalana kuch nahi badalta.
--
-- NOTE: ye file pure-ASCII hai — saare mojibake patterns chr()
-- codes se bane hain, taaki file ka apna encoding kabhi issue na bane.
--
-- Supabase SQL Editor me EK BAAR run karo.
-- ============================================================

-- 1) Repair helper: common double-encoded sequences -> sahi Unicode.
create or replace function public.bca_mojibake_fix(txt text)
returns text
language plpgsql
immutable
as $func$
begin
  if txt is null then return null; end if;

  -- Punctuation / symbols (UTF-8 misread as Windows-1252)
  txt := replace(txt, chr(226)||chr(128)||chr(153), chr(8217));
  txt := replace(txt, chr(226)||chr(128)||chr(152), chr(8216));
  txt := replace(txt, chr(226)||chr(128)||chr(156), chr(8220));
  txt := replace(txt, chr(226)||chr(128)||chr(157), chr(8221));
  txt := replace(txt, chr(226)||chr(128)||chr(148), chr(8212));
  txt := replace(txt, chr(226)||chr(128)||chr(147), chr(8211));
  txt := replace(txt, chr(226)||chr(128)||chr(166), chr(8230));
  txt := replace(txt, chr(226)||chr(130)||chr(172), chr(8364));
  txt := replace(txt, chr(194)||' ', ' ');
  txt := replace(txt, chr(194)||chr(171), chr(171));
  txt := replace(txt, chr(194)||chr(187), chr(187));
  txt := replace(txt, chr(194)||chr(169), chr(169));
  txt := replace(txt, chr(194)||chr(174), chr(174));
  txt := replace(txt, chr(194)||chr(163), chr(163));
  txt := replace(txt, chr(239)||chr(191)||chr(189), '');

  -- Letters: 'A-tilde' (chr 195) + 2nd byte -> sahi letter
  txt := replace(txt, chr(195)||chr(160), chr(224));
  txt := replace(txt, chr(195)||chr(161), chr(225));
  txt := replace(txt, chr(195)||chr(162), chr(226));
  txt := replace(txt, chr(195)||chr(164), chr(228));
  txt := replace(txt, chr(195)||chr(165), chr(229));
  txt := replace(txt, chr(195)||chr(167), chr(231));
  txt := replace(txt, chr(195)||chr(168), chr(232));
  txt := replace(txt, chr(195)||chr(169), chr(233));
  txt := replace(txt, chr(195)||chr(170), chr(234));
  txt := replace(txt, chr(195)||chr(171), chr(235));
  txt := replace(txt, chr(195)||chr(173), chr(237));
  txt := replace(txt, chr(195)||chr(174), chr(238));
  txt := replace(txt, chr(195)||chr(175), chr(239));
  txt := replace(txt, chr(195)||chr(177), chr(241));
  txt := replace(txt, chr(195)||chr(179), chr(243));
  txt := replace(txt, chr(195)||chr(180), chr(244));
  txt := replace(txt, chr(195)||chr(182), chr(246));
  txt := replace(txt, chr(195)||chr(184), chr(248));
  txt := replace(txt, chr(195)||chr(186), chr(250));
  txt := replace(txt, chr(195)||chr(188), chr(252));
  txt := replace(txt, chr(195)||chr(189), chr(253));
  txt := replace(txt, chr(195)||chr(128), chr(192));
  txt := replace(txt, chr(195)||chr(129), chr(193));
  txt := replace(txt, chr(195)||chr(135), chr(199));
  txt := replace(txt, chr(195)||chr(137), chr(201));
  txt := replace(txt, chr(195)||chr(145), chr(209));
  txt := replace(txt, chr(195)||chr(150), chr(214));
  txt := replace(txt, chr(195)||chr(158), chr(222));

  return txt;
end;
$func$;


-- 2) Har user-facing TEXT column par apply karo (dynamic — future
--    columns apne aap cover). Sirf mojibake-signal wali cells par.
do $batch$
declare
  t record;
  c record;
  n int;
  total int := 0;
  sig text := '['||chr(195)||chr(194)||chr(226)||chr(239)||']';
begin
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'resources', 'user_profiles', 'feedback', 'senior_requests',
        'lost_found', 'subjects', 'device_sessions', 'qr_login_sessions'
      )
  loop
    for c in
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t.table_name
        and data_type = 'text'
    loop
      execute format(
        'update public.%I set %I = public.bca_mojibake_fix(%I) where %I ~ %L',
        t.table_name, c.column_name, c.column_name, c.column_name, sig
      ) into n;
      total := total + coalesce(n, 0);
    end loop;
  end loop;
  raise notice 'bca_mojibake_fix: % cell(s) repaired', total;
end;
$batch$;

-- 3) Verify (optional — ab bhi corrupted rows dikhein to inspect karo).
-- select 'resources' AS tbl, id::text AS rid, title AS value
--   from public.resources
--   where title ~ ('['||chr(195)||chr(194)||chr(226)||chr(239)||']')
-- union all
-- select 'user_profiles', uid, name
--   from public.user_profiles
--   where name ~ ('['||chr(195)||chr(194)||chr(226)||chr(239)||']')
-- union all
-- select 'feedback', id::text, message
--   from public.feedback
--   where message ~ ('['||chr(195)||chr(194)||chr(226)||chr(239)||']')
-- union all
-- select 'lost_found', id::text, title
--   from public.lost_found
--   where title ~ ('['||chr(195)||chr(194)||chr(226)||chr(239)||']');

-- ============================================================
-- Prevention (yeh wapas na aaye):
--   * Saare HTML pages: <meta charset="utf-8"> (already present)
--   * vercel.json: text/html|js|css|json|svg par charset=utf-8
--   * api/_lib/cors.js: JSON responses me charset=utf-8
--   * sw.js: BOM-free + version bump (v31)
--   * Supabase default text = UTF-8 — naye inputs sahi store honge
-- ============================================================

