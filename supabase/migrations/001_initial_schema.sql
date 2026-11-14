-- ============================================================================
-- ReviewAssist — Hardened Multi-Tenant Database Schema & RLS Migration (v5)
-- Target: Supabase PostgreSQL 15+
-- Maps to TypeScript models in: src/types/business.ts
--
-- STATUS: NOT APPLIED. Review before running `supabase db push`.
--
-- Changes from v4:
-- 1. Section 0 adds a read-only PRE-FLIGHT that compares any EXISTING table
--    against the v5 target (columns, types, nullability, defaults, primary
--    key, foreign keys, unique slug, CHECK constraints, orphan rows). The
--    migration halts with a full list of problems instead of assuming that
--    CREATE TABLE IF NOT EXISTS upgraded anything. No data is deleted or
--    rewritten by this migration.
-- 2. consume_rate_limit(): advisory lock first, then clock_timestamp() for
--    the window start and the inserted row timestamp.
-- 3. Zero SECURITY DEFINER functions. Every server-side RPC is only
--    executable by service_role, which already has BYPASSRLS + table grants,
--    so privilege elevation is unnecessary. All functions use
--    `search_path = pg_catalog, pg_temp` with schema-qualified objects.
-- 4. Unexpected policies on the four tables are dropped dynamically (policies
--    are permissive and OR together), in addition to the named v1 drops.
-- 5. purge_expired_customer_drafts() added (service_role only); the approved
--    90-day retention schedule lives in migration 002.
-- 6. Final assertions halt the migration if service_role cannot bypass RLS,
--    if any ReviewAssist function is SECURITY DEFINER, lacks the hardened
--    search_path, or is owned by an API role.
--
-- Scheduled cleanup (Supabase Cron) lives in 002_schedule_rate_limit_cleanup.sql.
-- gen_random_uuid() is built into PostgreSQL 13+; pgcrypto is not required.
-- ============================================================================


-- ============================================================================
-- 0. PRE-FLIGHT UPGRADE VALIDATION (read-only)
--    Skips tables that do not exist yet (they are created in section 1).
--    Phase A: structure. Phase B: data. Each phase raises ONE exception that
--    lists every problem found.
-- ============================================================================
do $do$
declare
  v_spec jsonb := $j$[
    {"tbl":"businesses","col":"id","typ":"uuid","nn":true,"add":false},
    {"tbl":"businesses","col":"owner_id","typ":"uuid","nn":true,"add":false},
    {"tbl":"businesses","col":"slug","typ":"text","nn":true,"add":false},
    {"tbl":"businesses","col":"name","typ":"text","nn":true,"add":false},
    {"tbl":"businesses","col":"category","typ":"text","nn":true,"add":false},
    {"tbl":"businesses","col":"city","typ":"text","nn":true,"add":false},
    {"tbl":"businesses","col":"google_review_url","typ":"text","nn":true,"add":false},
    {"tbl":"businesses","col":"google_review_url_is_placeholder","typ":"boolean","nn":true,"add":false},
    {"tbl":"businesses","col":"created_at","typ":"timestamp with time zone","nn":true,"add":false},
    {"tbl":"businesses","col":"updated_at","typ":"timestamp with time zone","nn":true,"add":true},

    {"tbl":"analytics_events","col":"id","typ":"uuid","nn":true,"add":false},
    {"tbl":"analytics_events","col":"business_id","typ":"uuid","nn":true,"add":false},
    {"tbl":"analytics_events","col":"event_type","typ":"text","nn":true,"add":false},
    {"tbl":"analytics_events","col":"metadata","typ":"jsonb","nn":true,"add":false},
    {"tbl":"analytics_events","col":"created_at","typ":"timestamp with time zone","nn":true,"add":false},

    {"tbl":"customer_drafts","col":"id","typ":"uuid","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"business_id","typ":"uuid","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"original_input","typ":"text","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"generated_review","typ":"text","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"mode","typ":"text","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"sentiment","typ":"text","nn":true,"add":false},
    {"tbl":"customer_drafts","col":"created_at","typ":"timestamp with time zone","nn":true,"add":false},

    {"tbl":"submission_rate_limits","col":"id","typ":"uuid","nn":true,"add":false},
    {"tbl":"submission_rate_limits","col":"business_id","typ":"uuid","nn":false,"add":false},
    {"tbl":"submission_rate_limits","col":"scope_key","typ":"text","nn":true,"add":true},
    {"tbl":"submission_rate_limits","col":"client_fingerprint_hash","typ":"text","nn":true,"add":false},
    {"tbl":"submission_rate_limits","col":"action_type","typ":"text","nn":true,"add":false},
    {"tbl":"submission_rate_limits","col":"created_at","typ":"timestamp with time zone","nn":true,"add":false}
  ]$j$::jsonb;

  -- Expected column defaults (columns not listed must have NO default).
  -- Differences are reported as NOTICEs and normalised in section 2;
  -- changing a default never modifies stored rows.
  v_defaults jsonb := $j${
    "businesses.id":"gen_random_uuid()",
    "businesses.owner_id":"auth.uid()",
    "businesses.google_review_url_is_placeholder":"true",
    "businesses.created_at":"now()",
    "businesses.updated_at":"now()",
    "analytics_events.id":"gen_random_uuid()",
    "analytics_events.metadata":"'{}'::jsonb",
    "analytics_events.created_at":"now()",
    "customer_drafts.id":"gen_random_uuid()",
    "customer_drafts.created_at":"now()",
    "submission_rate_limits.id":"gen_random_uuid()",
    "submission_rate_limits.created_at":"now()"
  }$j$::jsonb;

  -- child table, child column, parent schema, parent table, parent column
  v_fks jsonb := $j$[
    {"tbl":"businesses","col":"owner_id","rs":"auth","rt":"users","rc":"id"},
    {"tbl":"analytics_events","col":"business_id","rs":"public","rt":"businesses","rc":"id"},
    {"tbl":"customer_drafts","col":"business_id","rs":"public","rt":"businesses","rc":"id"},
    {"tbl":"submission_rate_limits","col":"business_id","rs":"public","rt":"businesses","rc":"id"}
  ]$j$::jsonb;

  -- Violations are counted with the SAME expressions used by the CHECK
  -- constraints in section 2 (NULLs are reported by the NOT NULL check).
  v_checks jsonb := $j$[
    {"tbl":"businesses","col":"slug","name":"businesses_slug_format_chk",
     "bad":"not (slug ~ '^[a-z0-9-]+$' and char_length(slug) between 3 and 80)"},
    {"tbl":"businesses","col":"name","name":"businesses_name_len_chk",
     "bad":"not (char_length(btrim(name)) between 2 and 120)"},
    {"tbl":"businesses","col":"category","name":"businesses_category_chk",
     "bad":"not (category in ('restaurant', 'cafe', 'hotel', 'pg'))"},
    {"tbl":"businesses","col":"city","name":"businesses_city_len_chk",
     "bad":"not (char_length(btrim(city)) between 2 and 80)"},
    {"tbl":"businesses","col":"google_review_url","name":"businesses_google_url_chk",
     "bad":"not (google_review_url ~ '^https?://' and char_length(google_review_url) <= 2048)"},
    {"tbl":"analytics_events","col":"event_type","name":"analytics_events_type_chk",
     "bad":"not (event_type in ('qr_scan', 'feedback_submitted', 'ai_generation', 'google_redirect_click'))"},
    {"tbl":"analytics_events","col":"metadata","name":"analytics_events_metadata_obj_chk",
     "bad":"not (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096)"},
    {"tbl":"customer_drafts","col":"original_input","name":"customer_drafts_input_len_chk",
     "bad":"not (char_length(btrim(original_input)) between 20 and 2000)"},
    {"tbl":"customer_drafts","col":"generated_review","name":"customer_drafts_review_len_chk",
     "bad":"not (char_length(btrim(generated_review)) between 1 and 4000)"},
    {"tbl":"customer_drafts","col":"mode","name":"customer_drafts_mode_chk",
     "bad":"not (mode in ('text', 'voice'))"},
    {"tbl":"customer_drafts","col":"sentiment","name":"customer_drafts_sentiment_chk",
     "bad":"not (sentiment in ('positive', 'neutral', 'mixed'))"},
    {"tbl":"submission_rate_limits","col":"action_type","name":"submission_rate_limits_action_chk",
     "bad":"not (action_type in ('slug_lookup', 'event_write', 'draft_generation'))"},
    {"tbl":"submission_rate_limits","col":"client_fingerprint_hash","name":"submission_rate_limits_hash_chk",
     "bad":"not (client_fingerprint_hash ~ '^[0-9a-f]{64}$')"},
    {"tbl":"submission_rate_limits","col":"scope_key","name":"submission_rate_limits_scope_chk",
     "bad":"not (char_length(btrim(scope_key)) between 3 and 120)"}
  ]$j$::jsonb;

  v_struct_errors text[] := array[]::text[];
  v_data_errors text[] := array[]::text[];
  v_rel regclass;
  v_parent regclass;
  v_type text;
  v_nullable boolean;
  v_default text;
  v_expected_default text;
  v_attnum int2;
  v_parent_attnum int2;
  v_pk name[];
  v_count bigint;
  r record;
  fk record;
begin
  -- ---------------------------------------------------------------- PHASE A
  -- A1. Columns: presence and exact data type (no implicit casts).
  for r in
    select * from pg_catalog.jsonb_to_recordset(v_spec)
      as s(tbl text, col text, typ text, nn boolean, "add" boolean)
  loop
    v_rel := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl));
    continue when v_rel is null;

    select pg_catalog.format_type(a.atttypid, a.atttypmod),
           not a.attnotnull,
           pg_catalog.pg_get_expr(d.adbin, d.adrelid)
      into v_type, v_nullable, v_default
      from pg_catalog.pg_attribute a
      left join pg_catalog.pg_attrdef d
        on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = v_rel
       and a.attname = r.col
       and a.attnum > 0
       and not a.attisdropped;

    if not found then
      if not r."add" then
        v_struct_errors := v_struct_errors || pg_catalog.format(
          'public.%s is missing required column %s (%s)', r.tbl, r.col, r.typ);
      end if;
      continue;
    end if;

    if v_type is distinct from r.typ then
      v_struct_errors := v_struct_errors || pg_catalog.format(
        'public.%s.%s has type "%s", expected "%s" (no automatic type conversion is performed)',
        r.tbl, r.col, v_type, r.typ);
    end if;

    v_expected_default := v_defaults ->> (r.tbl || '.' || r.col);
    if v_default is distinct from v_expected_default then
      raise notice 'public.%.% default is %, will be normalised to %',
        r.tbl, r.col, coalesce(v_default, '<none>'), coalesce(v_expected_default, '<none>');
    end if;
  end loop;

  -- A2. Extra columns are reported but never dropped.
  for r in
    select c.relname::text as tbl, a.attname::text as col
      from pg_catalog.pg_class c
      join pg_catalog.pg_attribute a on a.attrelid = c.oid
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('businesses', 'analytics_events', 'customer_drafts', 'submission_rate_limits')
       and a.attnum > 0
       and not a.attisdropped
       and not exists (
         select 1
           from pg_catalog.jsonb_to_recordset(v_spec) as s(tbl text, col text)
          where s.tbl = c.relname::text and s.col = a.attname::text
       )
  loop
    raise notice 'public.%.% is not part of the v5 schema; it is left untouched', r.tbl, r.col;
  end loop;

  -- A3. Primary key must be exactly (id).
  for r in
    select t.tbl
      from (values ('businesses'), ('analytics_events'), ('customer_drafts'), ('submission_rate_limits')) as t(tbl)
  loop
    v_rel := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl));
    continue when v_rel is null;

    select pg_catalog.array_agg(a.attname order by a.attname)
      into v_pk
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_attribute a
        on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
     where con.conrelid = v_rel
       and con.contype = 'p';

    if v_pk is null then
      v_struct_errors := v_struct_errors || pg_catalog.format(
        'public.%s has no PRIMARY KEY; expected PRIMARY KEY (id). Add it manually after checking id for duplicates/NULLs.',
        r.tbl);
    elsif v_pk is distinct from array['id']::name[] then
      v_struct_errors := v_struct_errors || pg_catalog.format(
        'public.%s PRIMARY KEY is (%s); expected (id)', r.tbl, pg_catalog.array_to_string(v_pk, ', '));
    end if;
  end loop;

  -- A4. Foreign keys: a child table cannot exist without its parent, and an
  --     existing FK on the column must point at the expected parent column.
  for r in
    select * from pg_catalog.jsonb_to_recordset(v_fks)
      as s(tbl text, col text, rs text, rt text, rc text)
  loop
    v_rel := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl));
    continue when v_rel is null;

    v_parent := pg_catalog.to_regclass(pg_catalog.format('%I.%I', r.rs, r.rt));
    if v_parent is null then
      v_struct_errors := v_struct_errors || pg_catalog.format(
        'public.%s exists but its parent table %s.%s does not', r.tbl, r.rs, r.rt);
      continue;
    end if;

    select a.attnum into v_attnum
      from pg_catalog.pg_attribute a
     where a.attrelid = v_rel and a.attname = r.col and not a.attisdropped;
    continue when v_attnum is null; -- missing column already reported in A1

    select a.attnum into v_parent_attnum
      from pg_catalog.pg_attribute a
     where a.attrelid = v_parent and a.attname = r.rc and not a.attisdropped;

    for fk in
      select con.conname, con.confrelid, con.confkey
        from pg_catalog.pg_constraint con
       where con.conrelid = v_rel
         and con.contype = 'f'
         and con.conkey = array[v_attnum]::int2[]
    loop
      if fk.confrelid <> v_parent or fk.confkey <> array[v_parent_attnum]::int2[] then
        v_struct_errors := v_struct_errors || pg_catalog.format(
          'public.%s.%s has foreign key %s that does not reference %s.%s(%s)',
          r.tbl, r.col, fk.conname, r.rs, r.rt, r.rc);
      end if;
    end loop;
  end loop;

  if pg_catalog.cardinality(v_struct_errors) > 0 then
    raise exception 'ReviewAssist v5 migration halted: existing schema is incompatible (% problem(s))',
        pg_catalog.cardinality(v_struct_errors)
      using errcode = '55000',
            detail = pg_catalog.array_to_string(v_struct_errors, E'\n'),
            hint = 'Fix these manually (no data has been changed), then re-run the migration.';
  end if;

  -- ---------------------------------------------------------------- PHASE B
  -- B1. NULLs in columns that must become NOT NULL (includes owner_id).
  for r in
    select * from pg_catalog.jsonb_to_recordset(v_spec)
      as s(tbl text, col text, typ text, nn boolean, "add" boolean)
     where s.nn
  loop
    v_rel := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl));
    continue when v_rel is null;
    continue when not exists (
      select 1 from pg_catalog.pg_attribute a
       where a.attrelid = v_rel and a.attname = r.col and not a.attisdropped);

    execute pg_catalog.format('select count(*) from public.%I where %I is null', r.tbl, r.col)
      into v_count;
    if v_count > 0 then
      v_data_errors := v_data_errors || pg_catalog.format(
        'public.%s.%s has %s NULL row(s); it must be NOT NULL%s',
        r.tbl, r.col, v_count,
        case when r.tbl = 'businesses' and r.col = 'owner_id'
             then ' (assign a real auth.users.id as owner before migrating; known dev seed rows may be removed manually)'
             else '' end);
    end if;
  end loop;

  -- B2. Rows that would violate the v5 CHECK constraints.
  for r in
    select * from pg_catalog.jsonb_to_recordset(v_checks)
      as s(tbl text, col text, name text, bad text)
  loop
    v_rel := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl));
    continue when v_rel is null;
    continue when not exists (
      select 1 from pg_catalog.pg_attribute a
       where a.attrelid = v_rel and a.attname = r.col and not a.attisdropped);

    execute pg_catalog.format('select count(*) from public.%I where %s', r.tbl, r.bad)
      into v_count;
    if v_count > 0 then
      v_data_errors := v_data_errors || pg_catalog.format(
        '%s row(s) in public.%s violate %s', v_count, r.tbl, r.name);
    end if;
  end loop;

  -- B3. Duplicate slugs (the slug must be UNIQUE).
  if pg_catalog.to_regclass('public.businesses') is not null then
    select count(*) into v_count
      from (select slug from public.businesses group by slug having count(*) > 1) d;
    if v_count > 0 then
      v_data_errors := v_data_errors || pg_catalog.format(
        'public.businesses has %s duplicated slug value(s)', v_count);
    end if;
  end if;

  -- B4. Orphan rows that would block the foreign keys.
  for r in
    select * from pg_catalog.jsonb_to_recordset(v_fks)
      as s(tbl text, col text, rs text, rt text, rc text)
  loop
    continue when pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tbl)) is null;
    continue when pg_catalog.to_regclass(pg_catalog.format('%I.%I', r.rs, r.rt)) is null;

    execute pg_catalog.format(
      'select count(*) from public.%I x where x.%I is not null and not exists '
      '(select 1 from %I.%I p where p.%I = x.%I)',
      r.tbl, r.col, r.rs, r.rt, r.rc, r.col)
      into v_count;
    if v_count > 0 then
      v_data_errors := v_data_errors || pg_catalog.format(
        'public.%s.%s has %s orphan row(s) with no matching %s.%s.%s',
        r.tbl, r.col, v_count, r.rs, r.rt, r.rc);
    end if;
  end loop;

  if pg_catalog.cardinality(v_data_errors) > 0 then
    raise exception 'ReviewAssist v5 migration halted: existing data cannot be migrated safely (% problem(s))',
        pg_catalog.cardinality(v_data_errors)
      using errcode = '23514',
            detail = pg_catalog.array_to_string(v_data_errors, E'\n'),
            hint = 'No rows were deleted or modified. Correct the data manually, then re-run the migration.';
  end if;
end;
$do$;


-- ============================================================================
-- 1. TABLES (fresh install only — CREATE TABLE IF NOT EXISTS never alters an
--    existing table; existing tables were validated in section 0 and are
--    normalised in section 2)
-- ============================================================================
create table if not exists public.businesses (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  slug text not null,
  name text not null,
  category text not null,
  city text not null,
  google_review_url text not null,
  google_review_url_is_placeholder boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_pkey primary key (id),
  constraint businesses_slug_key unique (slug)
);

create table if not exists public.analytics_events (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_pkey primary key (id)
);

create table if not exists public.customer_drafts (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  original_input text not null,
  generated_review text not null,
  mode text not null,
  sentiment text not null,
  created_at timestamptz not null default now(),
  constraint customer_drafts_pkey primary key (id)
);

-- business_id is nullable: global (pre-resolution) buckets have no business.
create table if not exists public.submission_rate_limits (
  id uuid not null default gen_random_uuid(),
  business_id uuid,
  scope_key text not null,
  client_fingerprint_hash text not null,
  action_type text not null,
  created_at timestamptz not null default now(),
  constraint submission_rate_limits_pkey primary key (id)
);


-- ============================================================================
-- 2. SCHEMA NORMALISATION (safe only because section 0 passed)
--    Adds missing columns, enforces nullability/defaults, foreign keys,
--    unique slug and CHECK constraints. Never deletes or rewrites rows
--    (ADD COLUMN ... DEFAULT only fills the new column).
-- ============================================================================

-- 2a. Columns introduced after v1
alter table public.businesses
  add column if not exists updated_at timestamptz not null default now();

alter table public.submission_rate_limits
  add column if not exists scope_key text not null default 'global';
alter table public.submission_rate_limits
  alter column scope_key drop default;

-- 2b. Nullability (NULL rows were rejected in section 0)
alter table public.businesses
  alter column id set not null,
  alter column owner_id set not null,
  alter column slug set not null,
  alter column name set not null,
  alter column category set not null,
  alter column city set not null,
  alter column google_review_url set not null,
  alter column google_review_url_is_placeholder set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.analytics_events
  alter column id set not null,
  alter column business_id set not null,
  alter column event_type set not null,
  alter column metadata set not null,
  alter column created_at set not null;

alter table public.customer_drafts
  alter column id set not null,
  alter column business_id set not null,
  alter column original_input set not null,
  alter column generated_review set not null,
  alter column mode set not null,
  alter column sentiment set not null,
  alter column created_at set not null;

alter table public.submission_rate_limits
  alter column id set not null,
  alter column business_id drop not null,
  alter column scope_key set not null,
  alter column client_fingerprint_hash set not null,
  alter column action_type set not null,
  alter column created_at set not null;

-- 2c. Defaults (metadata only; stored rows are not touched)
alter table public.businesses
  alter column id set default gen_random_uuid(),
  alter column owner_id set default auth.uid(),
  alter column slug drop default,
  alter column name drop default,
  alter column category drop default,
  alter column city drop default,
  alter column google_review_url drop default,
  alter column google_review_url_is_placeholder set default true,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.analytics_events
  alter column id set default gen_random_uuid(),
  alter column business_id drop default,
  alter column event_type drop default,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now();

alter table public.customer_drafts
  alter column id set default gen_random_uuid(),
  alter column business_id drop default,
  alter column original_input drop default,
  alter column generated_review drop default,
  alter column mode drop default,
  alter column sentiment drop default,
  alter column created_at set default now();

alter table public.submission_rate_limits
  alter column id set default gen_random_uuid(),
  alter column business_id drop default,
  alter column scope_key drop default,
  alter column client_fingerprint_hash drop default,
  alter column action_type drop default,
  alter column created_at set default now();

-- 2d. Unique slug (duplicates were rejected in section 0)
do $do$
declare
  v_slug_attnum int2;
begin
  select a.attnum into v_slug_attnum
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.businesses'::regclass and a.attname = 'slug';

  if not exists (
    select 1
      from pg_catalog.pg_index i
     where i.indrelid = 'public.businesses'::regclass
       and i.indisunique
       and i.indnkeyatts = 1
       and i.indkey[0] = v_slug_attnum
       and i.indpred is null
  ) then
    alter table public.businesses add constraint businesses_slug_key unique (slug);
  end if;
end;
$do$;

-- 2e. Foreign keys: replace whatever FK exists on each column with the
--     canonical definition (orphans were rejected in section 0).
do $do$
declare
  r record;
  fk record;
begin
  for r in
    select * from (values
      ('businesses',             'owner_id',    'businesses_owner_id_fkey',
         'foreign key (owner_id) references auth.users(id) on delete restrict'),
      ('analytics_events',       'business_id', 'analytics_events_business_id_fkey',
         'foreign key (business_id) references public.businesses(id) on delete cascade'),
      ('customer_drafts',        'business_id', 'customer_drafts_business_id_fkey',
         'foreign key (business_id) references public.businesses(id) on delete cascade'),
      ('submission_rate_limits', 'business_id', 'submission_rate_limits_business_id_fkey',
         'foreign key (business_id) references public.businesses(id) on delete cascade')
    ) as t(tbl, col, conname, definition)
  loop
    for fk in
      select con.conname
        from pg_catalog.pg_constraint con
        join pg_catalog.pg_attribute a
          on a.attrelid = con.conrelid and a.attname = r.col
       where con.conrelid = pg_catalog.format('public.%I', r.tbl)::regclass
         and con.contype = 'f'
         and con.conkey = array[a.attnum]::int2[]
    loop
      execute pg_catalog.format('alter table public.%I drop constraint %I', r.tbl, fk.conname);
    end loop;

    execute pg_catalog.format('alter table public.%I add constraint %I %s', r.tbl, r.conname, r.definition);
  end loop;
end;
$do$;

-- 2f. CHECK constraints (violations were rejected in section 0)
alter table public.businesses
  drop constraint if exists businesses_slug_format_chk,
  drop constraint if exists businesses_name_len_chk,
  drop constraint if exists businesses_category_chk,
  drop constraint if exists businesses_city_len_chk,
  drop constraint if exists businesses_google_url_chk;

alter table public.businesses
  add constraint businesses_slug_format_chk
    check (slug ~ '^[a-z0-9-]+$' and char_length(slug) between 3 and 80),
  add constraint businesses_name_len_chk
    check (char_length(btrim(name)) between 2 and 120),
  add constraint businesses_category_chk
    check (category in ('restaurant', 'cafe', 'hotel', 'pg')),
  add constraint businesses_city_len_chk
    check (char_length(btrim(city)) between 2 and 80),
  add constraint businesses_google_url_chk
    check (google_review_url ~ '^https?://' and char_length(google_review_url) <= 2048);

alter table public.analytics_events
  drop constraint if exists analytics_events_type_chk,
  drop constraint if exists analytics_events_metadata_obj_chk;

alter table public.analytics_events
  add constraint analytics_events_type_chk
    check (event_type in ('qr_scan', 'feedback_submitted', 'ai_generation', 'google_redirect_click')),
  add constraint analytics_events_metadata_obj_chk
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096);

alter table public.customer_drafts
  drop constraint if exists customer_drafts_input_len_chk,
  drop constraint if exists customer_drafts_review_len_chk,
  drop constraint if exists customer_drafts_mode_chk,
  drop constraint if exists customer_drafts_sentiment_chk;

alter table public.customer_drafts
  add constraint customer_drafts_input_len_chk
    check (char_length(btrim(original_input)) between 20 and 2000),
  add constraint customer_drafts_review_len_chk
    check (char_length(btrim(generated_review)) between 1 and 4000),
  add constraint customer_drafts_mode_chk
    check (mode in ('text', 'voice')),
  add constraint customer_drafts_sentiment_chk
    check (sentiment in ('positive', 'neutral', 'mixed'));

alter table public.submission_rate_limits
  drop constraint if exists submission_rate_limits_action_chk,
  drop constraint if exists submission_rate_limits_hash_chk,
  drop constraint if exists submission_rate_limits_scope_chk;

alter table public.submission_rate_limits
  add constraint submission_rate_limits_action_chk
    check (action_type in ('slug_lookup', 'event_write', 'draft_generation')),
  add constraint submission_rate_limits_hash_chk
    check (client_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  add constraint submission_rate_limits_scope_chk
    check (char_length(btrim(scope_key)) between 3 and 120);


-- ============================================================================
-- 3. INDEXES & IMMUTABILITY TRIGGER
-- ============================================================================
create index if not exists idx_businesses_owner_id
  on public.businesses(owner_id);
create index if not exists idx_businesses_created_at
  on public.businesses(created_at desc);

create index if not exists idx_analytics_events_business_time
  on public.analytics_events(business_id, created_at desc);
create index if not exists idx_analytics_events_business_type
  on public.analytics_events(business_id, event_type);

create index if not exists idx_customer_drafts_business_time
  on public.customer_drafts(business_id, created_at desc);
create index if not exists idx_customer_drafts_created_at
  on public.customer_drafts(created_at);

drop index if exists public.idx_rate_limits_lookup;
create index if not exists idx_rate_limits_scope_lookup
  on public.submission_rate_limits(scope_key, client_fingerprint_hash, action_type, created_at desc);
create index if not exists idx_rate_limits_created_at
  on public.submission_rate_limits(created_at);

-- Legacy v1 trigger/function
drop trigger if exists trg_businesses_updated_at on public.businesses;
drop function if exists public.set_updated_at();

create or replace function public.enforce_businesses_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Cannot modify business id' using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Cannot transfer or modify business owner_id' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify business created_at' using errcode = '42501';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Trigger functions are not called directly; EXECUTE is only checked when
-- the trigger is created, so no API role needs it.
revoke all on function public.enforce_businesses_update_rules() from public, anon, authenticated, service_role;

drop trigger if exists trg_businesses_update_rules on public.businesses;
create trigger trg_businesses_update_rules
  before update on public.businesses
  for each row
  execute function public.enforce_businesses_update_rules();


-- ============================================================================
-- 4. SCHEMA & TABLE PRIVILEGES
-- ============================================================================
-- API roles must not create objects in public (prevents shadowing objects
-- that functions or policies might resolve).
revoke create on schema public from public, anon, authenticated;

revoke all on table public.businesses from public, anon, authenticated;
revoke all on table public.analytics_events from public, anon, authenticated;
revoke all on table public.customer_drafts from public, anon, authenticated;
revoke all on table public.submission_rate_limits from public, anon, authenticated;

-- Authenticated owners manage their own businesses (rows filtered by RLS)
grant select, insert, update on table public.businesses to authenticated;

-- Authenticated owners read their own drafts & events; no direct client writes
grant select on table public.customer_drafts to authenticated;
grant select on table public.analytics_events to authenticated;

-- Edge Functions (service_role, BYPASSRLS)
grant all on table public.businesses to service_role;
grant all on table public.analytics_events to service_role;
grant all on table public.customer_drafts to service_role;
grant all on table public.submission_rate_limits to service_role;


-- ============================================================================
-- 5. ROW LEVEL SECURITY & POLICY CLEANUP
-- ============================================================================
alter table public.businesses enable row level security;
alter table public.analytics_events enable row level security;
alter table public.customer_drafts enable row level security;
alter table public.submission_rate_limits enable row level security;

alter table public.businesses force row level security;
alter table public.analytics_events force row level security;
alter table public.customer_drafts force row level security;
alter table public.submission_rate_limits force row level security;

-- Named legacy v1 permissive policies
drop policy if exists "businesses_select_all" on public.businesses;
drop policy if exists "businesses_insert_mvp" on public.businesses;
drop policy if exists "businesses_update_mvp" on public.businesses;
drop policy if exists "analytics_events_select_mvp" on public.analytics_events;
drop policy if exists "analytics_events_insert_public" on public.analytics_events;
drop policy if exists "customer_drafts_select_mvp" on public.customer_drafts;
drop policy if exists "customer_drafts_insert_public" on public.customer_drafts;

-- Any OTHER policy on these tables (e.g. created by hand in the dashboard)
-- would be OR-combined with ours, so it is dropped and reported.
do $do$
declare
  p record;
begin
  for p in
    select pol.tablename, pol.policyname
      from pg_catalog.pg_policies pol
     where pol.schemaname = 'public'
       and pol.tablename in ('businesses', 'analytics_events', 'customer_drafts', 'submission_rate_limits')
       and pol.policyname not in (
         'businesses_owner_select',
         'businesses_owner_insert',
         'businesses_owner_update',
         'customer_drafts_owner_select',
         'analytics_events_owner_select'
       )
  loop
    raise notice 'Dropping unexpected policy % on public.%', p.policyname, p.tablename;
    execute pg_catalog.format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$do$;


-- ============================================================================
-- 6. SECURITY HELPER: public.is_business_owner(uuid)
--    SECURITY INVOKER: evaluated under the caller's own RLS on businesses.
--    EXECUTE: authenticated only.
-- ============================================================================
create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
      from public.businesses b
     where b.id = p_business_id
       and auth.uid() is not null
       and b.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_business_owner(uuid) to authenticated;


-- ============================================================================
-- 7. RLS POLICIES (authenticated owners only)
-- ============================================================================
drop policy if exists "businesses_owner_select" on public.businesses;
create policy "businesses_owner_select"
  on public.businesses as permissive for select to authenticated
  using (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "businesses_owner_insert" on public.businesses;
create policy "businesses_owner_insert"
  on public.businesses as permissive for insert to authenticated
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "businesses_owner_update" on public.businesses;
create policy "businesses_owner_update"
  on public.businesses as permissive for update to authenticated
  using (auth.uid() is not null and owner_id = auth.uid())
  with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists "customer_drafts_owner_select" on public.customer_drafts;
create policy "customer_drafts_owner_select"
  on public.customer_drafts as permissive for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists "analytics_events_owner_select" on public.analytics_events;
create policy "analytics_events_owner_select"
  on public.analytics_events as permissive for select to authenticated
  using (public.is_business_owner(business_id));

-- public.submission_rate_limits: no client policies (service_role only).


-- ============================================================================
-- 8. SERVER-SIDE SLUG LOOKUP: public.get_public_business_by_slug(text)
--    SECURITY INVOKER — only service_role (BYPASSRLS) may execute, so no
--    privilege elevation is needed. Returns at most one row, public columns
--    only (never owner_id).
-- ============================================================================
create or replace function public.get_public_business_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  category text,
  city text,
  google_review_url text,
  google_review_url_is_placeholder boolean,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
begin
  if v_clean_slug !~ '^[a-z0-9-]{3,80}$' then
    return;
  end if;

  return query
  select b.id, b.slug, b.name, b.category, b.city,
         b.google_review_url, b.google_review_url_is_placeholder, b.created_at
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;
end;
$$;

revoke all on function public.get_public_business_by_slug(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_business_by_slug(text) to service_role;


-- ============================================================================
-- 9. ATOMIC RATE LIMITER & CLEANUP
-- ============================================================================
-- consume_rate_limit: validate -> advisory lock -> read clock -> prune bucket
-- -> count -> insert. The count and insert happen while holding the
-- transaction-level lock for this bucket, so concurrent callers serialise.
-- clock_timestamp() is read AFTER the lock: now() would return the
-- transaction start time, which can be stale for a caller that waited.
create or replace function public.consume_rate_limit(
  p_scope_key text,
  p_client_fingerprint_hash text,
  p_action_type text,
  p_business_id uuid,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_scope text := pg_catalog.btrim(coalesce(p_scope_key, ''));
  v_clean_hash text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_client_fingerprint_hash, '')));
  v_clean_action text := pg_catalog.btrim(coalesce(p_action_type, ''));
  v_now timestamptz;
  v_window_start timestamptz;
  v_recent_count bigint;
begin
  if pg_catalog.char_length(v_clean_scope) < 3 or pg_catalog.char_length(v_clean_scope) > 120 then
    raise exception 'Invalid scope_key length' using errcode = '22023';
  end if;

  if v_clean_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid client_fingerprint_hash format' using errcode = '22023';
  end if;

  if v_clean_action not in ('slug_lookup', 'event_write', 'draft_generation') then
    raise exception 'Invalid action_type' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid p_window_seconds (1..86400)' using errcode = '22023';
  end if;

  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 10000 then
    raise exception 'Invalid p_max_requests (1..10000)' using errcode = '22023';
  end if;

  -- 1. Lock this bucket for the rest of the transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_clean_scope || ':' || v_clean_hash || ':' || v_clean_action, 0)
  );

  -- 2. Read the real current time only after the lock is held.
  v_now := pg_catalog.clock_timestamp();
  v_window_start := v_now - pg_catalog.make_interval(secs => p_window_seconds);

  -- 3. Prune this bucket's expired rows.
  delete from public.submission_rate_limits r
   where r.scope_key = v_clean_scope
     and r.client_fingerprint_hash = v_clean_hash
     and r.action_type = v_clean_action
     and r.created_at < v_window_start;

  -- 4. Count and conditionally insert (still under the lock).
  select count(*)
    into v_recent_count
    from public.submission_rate_limits r
   where r.scope_key = v_clean_scope
     and r.client_fingerprint_hash = v_clean_hash
     and r.action_type = v_clean_action
     and r.created_at >= v_window_start;

  if v_recent_count >= p_max_requests then
    return false;
  end if;

  insert into public.submission_rate_limits
    (business_id, scope_key, client_fingerprint_hash, action_type, created_at)
  values
    (p_business_id, v_clean_scope, v_clean_hash, v_clean_action, v_now);

  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, text, uuid, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.consume_rate_limit(text, text, text, uuid, integer, integer) to service_role;

-- prune_expired_rate_limits: bounded batch delete of rows older than the
-- retention period (default 24 h, which is >= the maximum window accepted by
-- consume_rate_limit, so no live bucket is affected). Invoked by Supabase
-- Cron (migration 002) running as the function owner, or by service_role.
create or replace function public.prune_expired_rate_limits(
  p_retention_seconds integer default 86400,
  p_batch_limit integer default 5000
)
returns bigint
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_deleted_count bigint;
begin
  if p_retention_seconds is null or p_retention_seconds < 86400 or p_retention_seconds > 2592000 then
    raise exception 'Invalid p_retention_seconds (86400..2592000)' using errcode = '22023';
  end if;

  if p_batch_limit is null or p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'Invalid p_batch_limit (1..50000)' using errcode = '22023';
  end if;

  with expired_batch as (
    select r.ctid
      from public.submission_rate_limits r
     where r.created_at < pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => p_retention_seconds)
     order by r.created_at
     limit p_batch_limit
       for update skip locked
  ),
  deleted as (
    delete from public.submission_rate_limits r
     using expired_batch b
     where r.ctid = b.ctid
    returning 1
  )
  select count(*) into v_deleted_count from deleted;

  return coalesce(v_deleted_count, 0);
end;
$$;

revoke all on function public.prune_expired_rate_limits(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.prune_expired_rate_limits(integer, integer) to service_role;


-- ============================================================================
-- 10. ATOMIC DRAFT + ANALYTICS RECORDING
--     One function call = one transaction: the draft row, 'feedback_submitted'
--     (attempt 0) and 'ai_generation' commit or roll back together.
--     Event metadata never contains customer text (length/mode/sentiment only).
-- ============================================================================
create or replace function public.record_customer_draft_with_events(
  p_business_id uuid,
  p_original_input text,
  p_generated_review text,
  p_mode text,
  p_sentiment text,
  p_attempt integer default 0
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_input text := pg_catalog.btrim(coalesce(p_original_input, ''));
  v_clean_review text := pg_catalog.btrim(coalesce(p_generated_review, ''));
  v_draft_id uuid;
begin
  if p_business_id is null then
    raise exception 'p_business_id is required' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_clean_input) < 20 or pg_catalog.char_length(v_clean_input) > 2000 then
    raise exception 'p_original_input must be 20..2000 characters' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_clean_review) < 1 or pg_catalog.char_length(v_clean_review) > 4000 then
    raise exception 'p_generated_review must be 1..4000 characters' using errcode = '22023';
  end if;

  if p_mode is null or p_mode not in ('text', 'voice') then
    raise exception 'Invalid p_mode' using errcode = '22023';
  end if;

  if p_sentiment is null or p_sentiment not in ('positive', 'neutral', 'mixed') then
    raise exception 'Invalid p_sentiment' using errcode = '22023';
  end if;

  if p_attempt is null or p_attempt < 0 or p_attempt > 10 then
    raise exception 'Invalid p_attempt' using errcode = '22023';
  end if;

  insert into public.customer_drafts (business_id, original_input, generated_review, mode, sentiment)
  values (p_business_id, v_clean_input, v_clean_review, p_mode, p_sentiment)
  returning id into v_draft_id;

  if p_attempt = 0 then
    insert into public.analytics_events (business_id, event_type, metadata)
    values (
      p_business_id,
      'feedback_submitted',
      pg_catalog.jsonb_build_object('mode', p_mode, 'length', pg_catalog.char_length(v_clean_input))
    );
  end if;

  insert into public.analytics_events (business_id, event_type, metadata)
  values (
    p_business_id,
    'ai_generation',
    pg_catalog.jsonb_build_object('attempt', p_attempt, 'mode', p_mode, 'sentiment', p_sentiment)
  );

  return v_draft_id;
end;
$$;

revoke all on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer) to service_role;


-- ============================================================================
-- 11. CUSTOMER DRAFT RETENTION (mechanism; schedule lives in migration 002)
--     Deletes customer_drafts rows (raw customer input + generated text)
--     older than p_retention_days, in bounded batches. analytics_events are
--     NOT touched, so dashboard metrics remain intact.
--     p_retention_days has no default on purpose so the period is always
--     explicit. Approved period: 90 days (scheduled hourly in 002).
-- ============================================================================
create or replace function public.purge_expired_customer_drafts(
  p_retention_days integer,
  p_batch_limit integer default 5000
)
returns bigint
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_deleted_count bigint;
begin
  if p_retention_days is null or p_retention_days < 7 or p_retention_days > 3650 then
    raise exception 'Invalid p_retention_days (7..3650)' using errcode = '22023';
  end if;

  if p_batch_limit is null or p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'Invalid p_batch_limit (1..50000)' using errcode = '22023';
  end if;

  with expired_batch as (
    select d.ctid
      from public.customer_drafts d
     where d.created_at < pg_catalog.clock_timestamp() - pg_catalog.make_interval(days => p_retention_days)
     order by d.created_at
     limit p_batch_limit
       for update skip locked
  ),
  deleted as (
    delete from public.customer_drafts d
     using expired_batch b
     where d.ctid = b.ctid
    returning 1
  )
  select count(*) into v_deleted_count from deleted;

  return coalesce(v_deleted_count, 0);
end;
$$;

revoke all on function public.purge_expired_customer_drafts(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.purge_expired_customer_drafts(integer, integer) to service_role;


-- ============================================================================
-- 12. OWNER METRICS: public.get_business_metrics(uuid)
--     SECURITY INVOKER + explicit ownership check. EXECUTE: authenticated only.
-- ============================================================================
create or replace function public.get_business_metrics(p_business_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Forbidden: you do not own this business' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'qrScans',              count(*) filter (where e.event_type = 'qr_scan'),
    'feedbackSubmissions',  count(*) filter (where e.event_type = 'feedback_submitted'),
    'aiGenerations',        count(*) filter (where e.event_type = 'ai_generation'),
    'googleRedirectClicks', count(*) filter (where e.event_type = 'google_redirect_click')
  )
    into v_result
    from public.analytics_events e
   where e.business_id = p_business_id;

  return v_result;
end;
$$;

revoke all on function public.get_business_metrics(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_business_metrics(uuid) to authenticated;


-- ============================================================================
-- 13. POST-MIGRATION ASSERTIONS (halt + roll back if any fail)
-- ============================================================================
do $do$
declare
  v_bad text;
begin
  -- service_role must bypass RLS: all four tables FORCE RLS and have no
  -- service_role policies.
  if not exists (
    select 1 from pg_catalog.pg_roles
     where rolname = 'service_role' and (rolbypassrls or rolsuper)
  ) then
    raise exception 'service_role does not have BYPASSRLS; Edge Function RPCs would fail under FORCE RLS'
      using errcode = '42501';
  end if;

  -- No ReviewAssist function may be SECURITY DEFINER, lack the hardened
  -- search_path, or be owned by an API role.
  select pg_catalog.string_agg(p.oid::regprocedure::text, ', ')
    into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in (
       'enforce_businesses_update_rules', 'is_business_owner', 'get_public_business_by_slug',
       'consume_rate_limit', 'prune_expired_rate_limits', 'record_customer_draft_with_events',
       'purge_expired_customer_drafts', 'get_business_metrics'
     )
     and (
       p.prosecdef
       or not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=pg_catalog, pg_temp'])
       or pg_catalog.pg_get_userbyid(p.proowner) in ('anon', 'authenticated', 'service_role', 'authenticator')
     );

  if v_bad is not null then
    raise exception 'Function hardening assertion failed for: %', v_bad using errcode = '42501';
  end if;
end;
$do$;


-- ============================================================================
-- 14. DEVELOPMENT-ONLY SEED DATA (commented out; requires a real auth.users id)
-- ============================================================================
/*
insert into public.businesses (
  owner_id, slug, name, category, city, google_review_url, google_review_url_is_placeholder
)
values (
  '00000000-0000-0000-0000-000000000000', -- DEV ONLY: replace with a real dev auth.users.id
  'the-urban-kitchen',
  'The Urban Kitchen',
  'restaurant',
  'Hyderabad',
  'https://example.com/PLACEHOLDER-google-review-link-not-configured',
  true
)
on conflict (slug) do nothing;
*/
