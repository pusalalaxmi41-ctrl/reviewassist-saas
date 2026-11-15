-- ============================================================================
-- ReviewAssist � Hardened Multi-Tenant Database Schema & RLS Migration (v5)
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
-- 1. TABLES (fresh install only � CREATE TABLE IF NOT EXISTS never alters an
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
--    SECURITY INVOKER � only service_role (BYPASSRLS) may execute, so no
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


-- ============================================================================
-- ReviewAssist � Scheduled cleanup via Supabase Cron (pg_cron):
--   1. expired rate-limit rows (24 h)   2. customer drafts (90-day retention)
-- Depends on: 001_initial_schema.sql
--
-- STATUS: NOT APPLIED. Review before running `supabase db push`.
--
-- Execution path:
--   pg_cron runs the job as the role that scheduled it (current_user when this
--   migration runs, normally `postgres`). That role owns
--   public.prune_expired_rate_limits() and therefore has EXECUTE on it even
--   though EXECUTE is revoked from PUBLIC/anon/authenticated. The only other
--   role with EXECUTE is service_role. API clients cannot reach the cron
--   schema (Supabase does not grant it to anon/authenticated) and cannot call
--   the function through PostgREST.
--
-- Because public.submission_rate_limits uses FORCE ROW LEVEL SECURITY with no
-- policies for the job role, the job role must have BYPASSRLS (or be
-- superuser). This is asserted below; the migration halts otherwise.
-- ============================================================================

create extension if not exists pg_cron;

do $do$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
     where rolname = current_user and (rolbypassrls or rolsuper)
  ) then
    raise exception
      'Cron job role % lacks BYPASSRLS; it could not delete rows from public.submission_rate_limits under FORCE RLS',
      current_user
      using errcode = '42501';
  end if;

  if not pg_catalog.has_function_privilege(
       current_user,
       'public.prune_expired_rate_limits(integer, integer)'::regprocedure,
       'EXECUTE')
  then
    raise exception 'Cron job role % cannot execute public.prune_expired_rate_limits', current_user
      using errcode = '42501';
  end if;
end;
$do$;

-- Every 10 minutes, delete up to 5,000 rows older than 24 hours
-- (max ~720k rows/day). cron.schedule() with a job name updates the existing
-- job of that name, so re-running this migration does not create duplicates.
select cron.schedule(
  'reviewassist-prune-expired-rate-limits',
  '*/10 * * * *',
  $cron$select public.prune_expired_rate_limits(86400, 5000);$cron$
);

-- ----------------------------------------------------------------------------
-- Customer draft retention � APPROVED DECISION: 90 days (2026-11-11).
-- Deletes customer_drafts rows (raw customer input + generated review) older
-- than 90 days. analytics_events are NOT touched, so dashboard metrics are
-- unaffected. Runs hourly at minute 23; each run deletes at most 5,000 rows
-- (max ~120k/day), so a backlog drains gradually without long locks.
-- To change the period, re-run cron.schedule with the same job name and a new
-- value (allowed range enforced by the function: 7..3650 days).
-- ----------------------------------------------------------------------------
do $do$
begin
  if not pg_catalog.has_function_privilege(
       current_user,
       'public.purge_expired_customer_drafts(integer, integer)'::regprocedure,
       'EXECUTE')
  then
    raise exception 'Cron job role % cannot execute public.purge_expired_customer_drafts', current_user
      using errcode = '42501';
  end if;
end;
$do$;

select cron.schedule(
  'reviewassist-purge-customer-drafts',
  '23 * * * *',
  $cron$select public.purge_expired_customer_drafts(90, 5000);$cron$
);


-- ============================================================================
-- ReviewAssist � Platform Admin Panel, Approval Workflow & Account Lifecycle
-- Migration: 003_platform_admin_and_account_lifecycle.sql
-- Depends on: 001_initial_schema.sql, 002_schedule_rate_limit_cleanup.sql
--
-- STATUS: NOT APPLIED. Review before running `supabase db push` or SQL Editor.
--
-- Summary of Changes:
-- 1. Adds approval status columns to public.businesses:
--    - status ('pending' | 'active' | 'rejected' | 'suspended'), default 'pending'
--    - status_changed_at, status_changed_by, status_reason
-- 2. Adds account lifecycle columns to public.businesses:
--    - account_state ('active' | 'disabled' | 'pending_deletion'), default 'active'
--    - deletion_requested_at, deletion_scheduled_for, deleted_reason
-- 3. Enforces owner immutability on status & lifecycle columns:
--    - Owners creating a business always start at status = 'pending' and
--      account_state = 'active'.
--    - Owners cannot modify status, status_changed_*, account_state, or
--      deletion_* columns via direct UPDATE.
-- 4. Updates public.get_public_business_by_slug(text) so ONLY businesses with
--    status = 'active' AND account_state = 'active' are returned to the public
--    review page (/r/:businessSlug) and customer Edge Functions.
-- 5. Creates public.platform_admins (RLS enabled + forced) and
--    public.is_platform_admin() (SECURITY DEFINER, search_path = pg_catalog, public, pg_temp,
--    executable ONLY by authenticated).
-- 6. Creates public.admin_audit_log (append-only via trigger, readable ONLY by
--    platform admins, stores plain-text business_name and owner_email with NO
--    foreign key to businesses so audit records survive permanent deletion).
-- 7. Creates platform-admin RPCs (all gated by public.is_platform_admin()):
--    - public.admin_get_client_counts()
--    - public.admin_list_businesses(text, text, integer, integer)
--    - public.admin_set_business_status(uuid, text, text)
--    - public.admin_set_account_state(uuid, text, text)
--    - public.admin_request_account_deletion(uuid, text, integer)
--    - public.admin_restore_account(uuid, text)
--    - public.admin_record_password_reset_audit(uuid)
--    - public.admin_list_audit_log(integer, integer)
-- 8. Creates service_role helper RPCs for the admin-delete-account Edge Function
--    and daily scheduled cleanup (handling owner_id ON DELETE RESTRICT by
--    deleting public.businesses first so child tables cascade, recording the
--    plain-text audit log, and then deleting the auth user).
-- 9. Explicitly preserves strict customer_drafts privacy: platform admins do
--    NOT receive SELECT policies or RPC access to customer_drafts raw text.
-- ============================================================================


-- ============================================================================
-- 1. BUSINESS APPROVAL & ACCOUNT LIFECYCLE COLUMNS
-- ============================================================================
alter table public.businesses
  add column if not exists status text not null default 'pending',
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists status_reason text,
  add column if not exists account_state text not null default 'active',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deleted_reason text;

alter table public.businesses
  alter column status set default 'pending',
  alter column status set not null,
  alter column status_changed_at set default now(),
  alter column status_changed_at set not null,
  alter column account_state set default 'active',
  alter column account_state set not null;

alter table public.businesses
  drop constraint if exists businesses_status_chk,
  drop constraint if exists businesses_status_reason_len_chk,
  drop constraint if exists businesses_account_state_chk,
  drop constraint if exists businesses_deleted_reason_len_chk,
  drop constraint if exists businesses_deletion_schedule_chk;

alter table public.businesses
  add constraint businesses_status_chk
    check (status in ('pending', 'active', 'rejected', 'suspended')),
  add constraint businesses_status_reason_len_chk
    check (status_reason is null or char_length(btrim(status_reason)) between 1 and 500),
  add constraint businesses_account_state_chk
    check (account_state in ('active', 'disabled', 'pending_deletion')),
  add constraint businesses_deleted_reason_len_chk
    check (deleted_reason is null or char_length(btrim(deleted_reason)) between 1 and 500),
  add constraint businesses_deletion_schedule_chk
    check (
      (account_state <> 'pending_deletion')
      or (deletion_requested_at is not null and deletion_scheduled_for is not null)
    );

create index if not exists idx_businesses_status_created_at
  on public.businesses(status, created_at desc);

create index if not exists idx_businesses_account_state_schedule
  on public.businesses(account_state, deletion_scheduled_for)
  where account_state = 'pending_deletion';

-- Allow 'admin_account_action' in submission_rate_limits for admin-delete-account Edge Function
alter table public.submission_rate_limits
  drop constraint if exists submission_rate_limits_action_chk;

alter table public.submission_rate_limits
  add constraint submission_rate_limits_action_chk
    check (action_type in ('slug_lookup', 'event_write', 'draft_generation', 'admin_account_action'));


-- ============================================================================
-- 2. PLATFORM ADMINS TABLE & is_platform_admin() HELPER
-- ============================================================================
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  note text
);

revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to authenticated;
grant all on table public.platform_admins to service_role;

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

drop policy if exists "platform_admins_self_select" on public.platform_admins;
create policy "platform_admins_self_select"
  on public.platform_admins
  as permissive
  for select
  to authenticated
  using (auth.uid() is not null and user_id = auth.uid());

-- Required specification:
-- is_platform_admin() as a SECURITY DEFINER function with
-- search_path = pg_catalog, public, pg_temp, executable by authenticated only.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
      from public.platform_admins pa
     where auth.uid() is not null
       and pa.user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated;


-- ============================================================================
-- 3. APPEND-ONLY ADMIN AUDIT LOG TABLE
--    Stores plain-text business_name and owner_email with NO foreign key to
--    public.businesses so audit entries persist after permanent account deletion.
-- ============================================================================
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  business_id uuid,
  business_name text,
  owner_id uuid,
  owner_email text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_chk check (
    action in (
      'approve_business',
      'reject_business',
      'suspend_business',
      'reactivate_business',
      'disable_account',
      'enable_account',
      'request_password_reset',
      'request_account_deletion',
      'restore_account',
      'permanent_delete_account',
      'scheduled_purge_account'
    )
  ),
  constraint admin_audit_log_reason_len_chk check (
    reason is null or char_length(btrim(reason)) <= 500
  ),
  constraint admin_audit_log_metadata_obj_chk check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096
  )
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log(created_at desc);
create index if not exists idx_admin_audit_log_business_id
  on public.admin_audit_log(business_id, created_at desc);

-- Append-only enforcement: block UPDATE and DELETE for all roles
create or replace function public.prevent_admin_audit_log_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'public.admin_audit_log is append-only and cannot be updated or deleted'
    using errcode = '42501';
end;
$$;

revoke all on function public.prevent_admin_audit_log_mutation() from public, anon, authenticated, service_role;

drop trigger if exists trg_admin_audit_log_immutable on public.admin_audit_log;
create trigger trg_admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row
  execute function public.prevent_admin_audit_log_mutation();

revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
grant select, insert on table public.admin_audit_log to service_role;

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

drop policy if exists "admin_audit_log_admin_select" on public.admin_audit_log;
create policy "admin_audit_log_admin_select"
  on public.admin_audit_log
  as permissive
  for select
  to authenticated
  using (public.is_platform_admin());


-- ============================================================================
-- 4. BUSINESS INSERT & UPDATE TRIGGERS (Prevent Owners from Self-Approving)
-- ============================================================================
create or replace function public.enforce_businesses_insert_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  -- Unless explicitly invoked inside a privileged admin/service transaction,
  -- new business signups MUST start in 'pending' status and 'active' account_state.
  if coalesce(pg_catalog.current_setting('reviewassist.admin_mutation', true), '') <> 'true'
     and session_user not in ('postgres', 'supabase_admin')
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
  then
    new.status := 'pending';
    new.status_changed_at := pg_catalog.now();
    new.status_changed_by := null;
    new.status_reason := null;
    new.account_state := 'active';
    new.deletion_requested_at := null;
    new.deletion_scheduled_for := null;
    new.deleted_reason := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_businesses_insert_rules() from public, anon, authenticated, service_role;

drop trigger if exists trg_businesses_insert_rules on public.businesses;
create trigger trg_businesses_insert_rules
  before insert on public.businesses
  for each row
  execute function public.enforce_businesses_insert_rules();

create or replace function public.enforce_businesses_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_is_admin_mutation boolean :=
    coalesce(pg_catalog.current_setting('reviewassist.admin_mutation', true), '') = 'true'
    or session_user in ('postgres', 'supabase_admin')
    or current_user in ('postgres', 'supabase_admin', 'service_role');
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

  if not v_is_admin_mutation then
    if new.status is distinct from old.status
       or new.status_changed_at is distinct from old.status_changed_at
       or new.status_changed_by is distinct from old.status_changed_by
       or new.status_reason is distinct from old.status_reason
       or new.account_state is distinct from old.account_state
       or new.deletion_requested_at is distinct from old.deletion_requested_at
       or new.deletion_scheduled_for is distinct from old.deletion_scheduled_for
       or new.deleted_reason is distinct from old.deleted_reason
    then
      raise exception 'Forbidden: business owners cannot modify approval status or account lifecycle fields'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.enforce_businesses_update_rules() from public, anon, authenticated, service_role;


-- ============================================================================
-- 5. PUBLIC SLUG LOOKUP: ONLY SERVE 'active' BUSINESSES & 'active' ACCOUNTS
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
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;
end;
$$;

revoke all on function public.get_public_business_by_slug(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_business_by_slug(text) to service_role;


-- ============================================================================
-- 6. PLATFORM ADMIN RPCs (Executable by authenticated, gated by is_platform_admin())
--    NOTE: These functions run as SECURITY DEFINER with hardened
--    search_path = pg_catalog, public, pg_temp so that verified platform
--    admins can read cross-tenant businesses and auth.users email/sign-in
--    metadata WITHOUT granting authenticated direct SELECT on all businesses
--    or auth.users, and WITHOUT exposing customer_drafts text.
-- ============================================================================

-- 6a. Dashboard counts + 30-day daily signup series
create or replace function public.admin_get_client_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  with counts as (
    select
      count(*)::bigint as total,
      count(*) filter (where b.status = 'pending')::bigint as pending,
      count(*) filter (where b.status = 'active')::bigint as active,
      count(*) filter (where b.status = 'suspended')::bigint as suspended,
      count(*) filter (where b.status = 'rejected')::bigint as rejected,
      count(*) filter (where b.account_state = 'disabled')::bigint as disabled_accounts,
      count(*) filter (where b.account_state = 'pending_deletion')::bigint as pending_deletion_accounts
    from public.businesses b
  ),
  days as (
    select pg_catalog.generate_series(
      (current_date - 29)::timestamp,
      current_date::timestamp,
      interval '1 day'
    )::date as day
  ),
  daily_counts as (
    select
      d.day,
      count(b.id)::bigint as count
    from days d
    left join public.businesses b
      on (b.created_at at time zone 'UTC')::date = d.day
    group by d.day
    order by d.day asc
  )
  select pg_catalog.jsonb_build_object(
    'total', c.total,
    'pending', c.pending,
    'active', c.active,
    'suspended', c.suspended,
    'rejected', c.rejected,
    'disabledAccounts', c.disabled_accounts,
    'pendingDeletionAccounts', c.pending_deletion_accounts,
    'signupsPerDay', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'date', pg_catalog.to_char(dc.day, 'YYYY-MM-DD'),
            'count', dc.count
          )
          order by dc.day asc
        )
        from daily_counts dc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from counts c;

  return v_result;
end;
$$;

revoke all on function public.admin_get_client_counts() from public, anon, authenticated, service_role;
grant execute on function public.admin_get_client_counts() to authenticated;


-- 6b. Paginated & searchable list of businesses + owner account metadata
create or replace function public.admin_list_businesses(
  p_search text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  owner_id uuid,
  owner_email text,
  owner_created_at timestamptz,
  owner_last_sign_in_at timestamptz,
  slug text,
  name text,
  category text,
  city text,
  google_review_url text,
  google_review_url_is_placeholder boolean,
  status text,
  status_changed_at timestamptz,
  status_changed_by uuid,
  status_reason text,
  account_state text,
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  deleted_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_search text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_search, ''))), '');
  v_status text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  if v_status is not null and v_status <> 'all' and v_status not in ('pending', 'active', 'rejected', 'suspended') then
    raise exception 'Invalid status filter' using errcode = '22023';
  end if;

  return query
  select
    b.id,
    b.owner_id,
    coalesce(u.email::text, 'unknown@redacted.local') as owner_email,
    coalesce(u.created_at, b.created_at) as owner_created_at,
    u.last_sign_in_at as owner_last_sign_in_at,
    b.slug,
    b.name,
    b.category,
    b.city,
    b.google_review_url,
    b.google_review_url_is_placeholder,
    b.status,
    b.status_changed_at,
    b.status_changed_by,
    b.status_reason,
    b.account_state,
    b.deletion_requested_at,
    b.deletion_scheduled_for,
    b.deleted_reason,
    b.created_at,
    b.updated_at,
    count(*) over () as total_count
  from public.businesses b
  left join auth.users u on u.id = b.owner_id
  where (v_status is null or v_status = 'all' or b.status = v_status)
    and (
      v_search is null
      or pg_catalog.lower(b.name) like '%' || v_search || '%'
      or pg_catalog.lower(b.slug) like '%' || v_search || '%'
      or pg_catalog.lower(b.city) like '%' || v_search || '%'
      or pg_catalog.lower(coalesce(u.email::text, '')) like '%' || v_search || '%'
    )
  order by
    case when b.status = 'pending' then 0 else 1 end asc,
    b.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;


-- 6c. Approve, Reject, Suspend, or Reactivate a Business
create or replace function public.admin_set_business_status(
  p_business_id uuid,
  p_new_status text,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_new_status, '')));
  v_clean_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_biz public.businesses%rowtype;
  v_owner_email text;
  v_action text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  if p_business_id is null then
    raise exception 'p_business_id is required' using errcode = '22023';
  end if;

  if v_clean_status not in ('pending', 'active', 'rejected', 'suspended') then
    raise exception 'Invalid p_new_status' using errcode = '22023';
  end if;

  if v_clean_status in ('rejected', 'suspended') and (v_clean_reason is null or pg_catalog.char_length(v_clean_reason) < 3) then
    raise exception 'A reason of at least 3 characters is required when rejecting or suspending a business'
      using errcode = '22023';
  end if;

  if v_clean_reason is not null and pg_catalog.char_length(v_clean_reason) > 500 then
    raise exception 'Reason must be 500 characters or fewer' using errcode = '22023';
  end if;

  select * into v_biz
    from public.businesses b
   where b.id = p_business_id
     for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin_id;

  v_action := case
    when v_clean_status = 'active' and v_biz.status in ('suspended', 'rejected') then 'reactivate_business'
    when v_clean_status = 'active' then 'approve_business'
    when v_clean_status = 'rejected' then 'reject_business'
    when v_clean_status = 'suspended' then 'suspend_business'
    else 'suspend_business'
  end;

  perform pg_catalog.set_config('reviewassist.admin_mutation', 'true', true);

  update public.businesses
     set status = v_clean_status,
         status_changed_at = pg_catalog.clock_timestamp(),
         status_changed_by = v_admin_id,
         status_reason = v_clean_reason
   where id = p_business_id;

  insert into public.admin_audit_log (
    admin_id,
    admin_email,
    action,
    business_id,
    business_name,
    owner_id,
    owner_email,
    reason,
    metadata
  )
  values (
    v_admin_id,
    v_admin_email,
    v_action,
    v_biz.id,
    v_biz.name,
    v_biz.owner_id,
    v_owner_email,
    v_clean_reason,
    pg_catalog.jsonb_build_object(
      'previousStatus', v_biz.status,
      'newStatus', v_clean_status
    )
  );
end;
$$;

revoke all on function public.admin_set_business_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_business_status(uuid, text, text) to authenticated;


-- 6d. Disable or Re-enable an Owner Account (blocks/unblocks login + suspends/activates business)
create or replace function public.admin_set_account_state(
  p_business_id uuid,
  p_new_state text,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_state text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_new_state, '')));
  v_clean_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_biz public.businesses%rowtype;
  v_owner_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  if v_clean_state not in ('active', 'disabled') then
    raise exception 'Invalid account state (expected active or disabled)' using errcode = '22023';
  end if;

  if v_clean_state = 'disabled' and (v_clean_reason is null or pg_catalog.char_length(v_clean_reason) < 3) then
    raise exception 'A reason of at least 3 characters is required to disable an account'
      using errcode = '22023';
  end if;

  select * into v_biz
    from public.businesses b
   where b.id = p_business_id
     for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  if v_biz.owner_id = v_admin_id or exists (select 1 from public.platform_admins pa where pa.user_id = v_biz.owner_id) then
    raise exception 'Cannot disable a platform administrator account' using errcode = '42501';
  end if;

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin_id;

  perform pg_catalog.set_config('reviewassist.admin_mutation', 'true', true);

  if v_clean_state = 'disabled' then
    update public.businesses
       set account_state = 'disabled',
           status = 'suspended',
           status_changed_at = pg_catalog.clock_timestamp(),
           status_changed_by = v_admin_id,
           status_reason = v_clean_reason
     where id = p_business_id;

    update auth.users
       set banned_until = '2099-12-31T23:59:59Z'::timestamptz,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_biz.owner_id;

    insert into public.admin_audit_log (
      admin_id, admin_email, action, business_id, business_name, owner_id, owner_email, reason, metadata
    ) values (
      v_admin_id, v_admin_email, 'disable_account', v_biz.id, v_biz.name, v_biz.owner_id, v_owner_email, v_clean_reason,
      pg_catalog.jsonb_build_object('previousAccountState', v_biz.account_state, 'newAccountState', 'disabled')
    );
  else
    update public.businesses
       set account_state = 'active',
           status = 'active',
           status_changed_at = pg_catalog.clock_timestamp(),
           status_changed_by = v_admin_id,
           status_reason = v_clean_reason,
           deletion_requested_at = null,
           deletion_scheduled_for = null,
           deleted_reason = null
     where id = p_business_id;

    update auth.users
       set banned_until = null,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_biz.owner_id;

    insert into public.admin_audit_log (
      admin_id, admin_email, action, business_id, business_name, owner_id, owner_email, reason, metadata
    ) values (
      v_admin_id, v_admin_email, 'enable_account', v_biz.id, v_biz.name, v_biz.owner_id, v_owner_email, v_clean_reason,
      pg_catalog.jsonb_build_object('previousAccountState', v_biz.account_state, 'newAccountState', 'active')
    );
  end if;
end;
$$;

revoke all on function public.admin_set_account_state(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_account_state(uuid, text, text) to authenticated;


-- 6e. Soft Account Deletion with Configurable Grace Period (default 14 days)
create or replace function public.admin_request_account_deletion(
  p_business_id uuid,
  p_reason text,
  p_grace_days integer default 14
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_grace integer := coalesce(p_grace_days, 14);
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_biz public.businesses%rowtype;
  v_owner_email text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_scheduled_for timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  if v_clean_reason is null or pg_catalog.char_length(v_clean_reason) < 3 or pg_catalog.char_length(v_clean_reason) > 500 then
    raise exception 'A deletion reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  if v_grace < 1 or v_grace > 90 then
    raise exception 'p_grace_days must be between 1 and 90 days' using errcode = '22023';
  end if;

  select * into v_biz
    from public.businesses b
   where b.id = p_business_id
     for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  if v_biz.owner_id = v_admin_id or exists (select 1 from public.platform_admins pa where pa.user_id = v_biz.owner_id) then
    raise exception 'Cannot schedule deletion for a platform administrator account'
      using errcode = '42501';
  end if;

  v_scheduled_for := v_now + pg_catalog.make_interval(days => v_grace);

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin_id;

  perform pg_catalog.set_config('reviewassist.admin_mutation', 'true', true);

  update public.businesses
     set account_state = 'pending_deletion',
         status = 'suspended',
         status_changed_at = v_now,
         status_changed_by = v_admin_id,
         status_reason = v_clean_reason,
         deletion_requested_at = v_now,
         deletion_scheduled_for = v_scheduled_for,
         deleted_reason = v_clean_reason
   where id = p_business_id;

  update auth.users
     set banned_until = '2099-12-31T23:59:59Z'::timestamptz,
         updated_at = v_now
   where id = v_biz.owner_id;

  insert into public.admin_audit_log (
    admin_id, admin_email, action, business_id, business_name, owner_id, owner_email, reason, metadata
  ) values (
    v_admin_id, v_admin_email, 'request_account_deletion', v_biz.id, v_biz.name, v_biz.owner_id, v_owner_email, v_clean_reason,
    pg_catalog.jsonb_build_object(
      'graceDays', v_grace,
      'deletionScheduledFor', v_scheduled_for
    )
  );

  return v_scheduled_for;
end;
$$;

revoke all on function public.admin_request_account_deletion(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_request_account_deletion(uuid, text, integer) to authenticated;


-- 6f. Restore an Account During the Deletion Grace Period
create or replace function public.admin_restore_account(
  p_business_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_biz public.businesses%rowtype;
  v_owner_email text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  select * into v_biz
    from public.businesses b
   where b.id = p_business_id
     for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin_id;

  perform pg_catalog.set_config('reviewassist.admin_mutation', 'true', true);

  update public.businesses
     set account_state = 'active',
         status = 'active',
         status_changed_at = v_now,
         status_changed_by = v_admin_id,
         status_reason = coalesce(v_clean_reason, 'Restored by platform admin'),
         deletion_requested_at = null,
         deletion_scheduled_for = null,
         deleted_reason = null
   where id = p_business_id;

  update auth.users
     set banned_until = null,
         updated_at = v_now
   where id = v_biz.owner_id;

  insert into public.admin_audit_log (
    admin_id, admin_email, action, business_id, business_name, owner_id, owner_email, reason, metadata
  ) values (
    v_admin_id, v_admin_email, 'restore_account', v_biz.id, v_biz.name, v_biz.owner_id, v_owner_email,
    coalesce(v_clean_reason, 'Restored during grace period'),
    pg_catalog.jsonb_build_object('previousAccountState', v_biz.account_state)
  );
end;
$$;

revoke all on function public.admin_restore_account(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_restore_account(uuid, text) to authenticated;


-- 6g. Audit log entry when an admin triggers a password reset email
create or replace function public.admin_record_password_reset_audit(
  p_business_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_admin_email text;
  v_biz public.businesses%rowtype;
  v_owner_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  select * into v_biz from public.businesses b where b.id = p_business_id;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = v_admin_id;

  insert into public.admin_audit_log (
    admin_id, admin_email, action, business_id, business_name, owner_id, owner_email, reason
  ) values (
    v_admin_id, v_admin_email, 'request_password_reset', v_biz.id, v_biz.name, v_biz.owner_id, v_owner_email,
    'Password recovery email sent to account owner'
  );
end;
$$;

revoke all on function public.admin_record_password_reset_audit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_password_reset_audit(uuid) to authenticated;


-- 6h. Read Admin Audit Log
create or replace function public.admin_list_audit_log(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  admin_id uuid,
  admin_email text,
  action text,
  business_id uuid,
  business_name text,
  owner_id uuid,
  owner_email text,
  reason text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  return query
  select
    l.id,
    l.admin_id,
    l.admin_email,
    l.action,
    l.business_id,
    l.business_name,
    l.owner_id,
    l.owner_email,
    l.reason,
    l.metadata,
    l.created_at
  from public.admin_audit_log l
  order by l.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_audit_log(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_audit_log(integer, integer) to authenticated;


-- ============================================================================
-- 7. CONTROLLED PERMANENT ACCOUNT DELETION (service_role ONLY)
--    Called by the `admin-delete-account` Edge Function and the daily Cron job.
--    Deletion order:
--      1. Verify caller is in platform_admins (for interactive delete) and
--         target owner is NOT the caller and NOT a platform_admin.
--      2. Delete all public.businesses rows for that owner_id FIRST (which
--         cascades to analytics_events, customer_drafts, submission_rate_limits
--         and satisfies businesses_owner_id_fkey ON DELETE RESTRICT).
--      3. Insert plain-text audit record into public.admin_audit_log (with no
--         FK to businesses so it survives permanently).
--      4. Return owner_id + snapshot so `admin-delete-account` can call
--         auth.admin.deleteUser(owner_id).
-- ============================================================================
create or replace function public.service_prepare_permanent_account_deletion(
  p_business_id uuid,
  p_caller_admin_id uuid,
  p_confirmation_name text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_confirm text := pg_catalog.btrim(coalesce(p_confirmation_name, ''));
  v_clean_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_biz public.businesses%rowtype;
  v_owner_email text;
  v_admin_email text;
  v_deleted_biz_count integer;
  v_audit_id uuid;
  v_businesses_snapshot jsonb;
  v_events_snapshot jsonb;
  v_drafts_snapshot jsonb;
begin
  if p_caller_admin_id is null or not exists (
    select 1 from public.platform_admins pa where pa.user_id = p_caller_admin_id
  ) then
    raise exception 'Forbidden: caller is not a platform administrator' using errcode = '42501';
  end if;

  if pg_catalog.char_length(v_clean_reason) < 3 or pg_catalog.char_length(v_clean_reason) > 500 then
    raise exception 'A deletion reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select * into v_biz
    from public.businesses b
   where b.id = p_business_id
     for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  if v_biz.owner_id = p_caller_admin_id then
    raise exception 'Forbidden: cannot delete your own administrator account'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.platform_admins pa where pa.user_id = v_biz.owner_id) then
    raise exception 'Forbidden: cannot delete another platform administrator account'
      using errcode = '42501';
  end if;

  if v_clean_confirm <> v_biz.name then
    raise exception 'Confirmation business name does not match "%"', v_biz.name
      using errcode = '22023';
  end if;

  select u.email::text into v_owner_email from auth.users u where u.id = v_biz.owner_id;
  select u.email::text into v_admin_email from auth.users u where u.id = p_caller_admin_id;

  -- Capture complete snapshot of the owner's businesses, events, and drafts so
  -- if auth.admin.deleteUser() fails in the Edge Function, the entire state can
  -- be restored atomically via service_rollback_permanent_account_deletion().
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.row_to_json(b)), '[]'::jsonb)
    into v_businesses_snapshot
    from public.businesses b
   where b.owner_id = v_biz.owner_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.row_to_json(e)), '[]'::jsonb)
    into v_events_snapshot
    from public.analytics_events e
    join public.businesses b on b.id = e.business_id
   where b.owner_id = v_biz.owner_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.row_to_json(d)), '[]'::jsonb)
    into v_drafts_snapshot
    from public.customer_drafts d
    join public.businesses b on b.id = d.business_id
   where b.owner_id = v_biz.owner_id;

  -- Step 1: Delete all businesses owned by this user FIRST so ON DELETE RESTRICT
  -- on businesses_owner_id_fkey is satisfied and child tables cascade cleanly.
  delete from public.businesses b
   where b.owner_id = v_biz.owner_id;

  get diagnostics v_deleted_biz_count = row_count;

  -- Step 2: Write plain-text audit record (no FK to businesses).
  insert into public.admin_audit_log (
    admin_id,
    admin_email,
    action,
    business_id,
    business_name,
    owner_id,
    owner_email,
    reason,
    metadata
  ) values (
    p_caller_admin_id,
    v_admin_email,
    'permanent_delete_account',
    v_biz.id,
    v_biz.name,
    v_biz.owner_id,
    coalesce(v_owner_email, 'unknown@redacted.local'),
    v_clean_reason,
    pg_catalog.jsonb_build_object(
      'slug', v_biz.slug,
      'category', v_biz.category,
      'city', v_biz.city,
      'deletedBusinessCount', v_deleted_biz_count
    )
  )
  returning id into v_audit_id;

  return pg_catalog.jsonb_build_object(
    'ownerId', v_biz.owner_id,
    'ownerEmail', coalesce(v_owner_email, 'unknown@redacted.local'),
    'businessId', v_biz.id,
    'businessName', v_biz.name,
    'auditId', v_audit_id,
    'businessesSnapshot', v_businesses_snapshot,
    'eventsSnapshot', v_events_snapshot,
    'draftsSnapshot', v_drafts_snapshot
  );
end;
$$;

revoke all on function public.service_prepare_permanent_account_deletion(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.service_prepare_permanent_account_deletion(uuid, uuid, text, text) to service_role;


-- Compensating rollback RPC if auth.admin.deleteUser() fails in the Edge Function,
-- ensuring no account is ever left half-deleted.
create or replace function public.service_rollback_permanent_account_deletion(
  p_snapshot jsonb,
  p_error_detail text default null
)
returns void
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_snapshot is null or pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Invalid snapshot payload' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('reviewassist.admin_mutation', 'true', true);

  insert into public.businesses
  select *
    from pg_catalog.jsonb_populate_recordset(
      null::public.businesses,
      coalesce(p_snapshot -> 'businessesSnapshot', '[]'::jsonb)
    )
  on conflict (id) do nothing;

  insert into public.analytics_events
  select *
    from pg_catalog.jsonb_populate_recordset(
      null::public.analytics_events,
      coalesce(p_snapshot -> 'eventsSnapshot', '[]'::jsonb)
    )
  on conflict (id) do nothing;

  insert into public.customer_drafts
  select *
    from pg_catalog.jsonb_populate_recordset(
      null::public.customer_drafts,
      coalesce(p_snapshot -> 'draftsSnapshot', '[]'::jsonb)
    )
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.service_rollback_permanent_account_deletion(jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.service_rollback_permanent_account_deletion(jsonb, text) to service_role;


-- Daily scheduled purge of accounts whose deletion_scheduled_for has passed.
-- Runs the exact same deletion order (delete public.businesses first -> cascade
-- child tables -> write plain-text audit log -> delete auth.users row) inside
-- a single atomic PostgreSQL transaction.
create or replace function public.purge_expired_pending_deletion_accounts(
  p_batch_limit integer default 100
)
returns bigint
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_batch_limit, 100), 1), 1000);
  v_rec record;
  v_purged_count bigint := 0;
begin
  for v_rec in
    select
      b.id as business_id,
      b.name as business_name,
      b.slug as business_slug,
      b.category as business_category,
      b.city as business_city,
      b.owner_id,
      b.deleted_reason,
      b.deletion_requested_at,
      b.deletion_scheduled_for,
      coalesce(u.email::text, 'unknown@redacted.local') as owner_email
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    where b.account_state = 'pending_deletion'
      and b.deletion_scheduled_for is not null
      and b.deletion_scheduled_for <= pg_catalog.clock_timestamp()
      and not exists (
        select 1 from public.platform_admins pa where pa.user_id = b.owner_id
      )
    order by b.deletion_scheduled_for asc
    limit v_limit
    for update of b skip locked
  loop
    -- 1. Delete business rows first (cascades analytics_events, customer_drafts, rate limits)
    delete from public.businesses where owner_id = v_rec.owner_id;

    -- 2. Record permanent plain-text audit log entry
    insert into public.admin_audit_log (
      admin_id,
      admin_email,
      action,
      business_id,
      business_name,
      owner_id,
      owner_email,
      reason,
      metadata
    ) values (
      null,
      'system:cron',
      'scheduled_purge_account',
      v_rec.business_id,
      v_rec.business_name,
      v_rec.owner_id,
      v_rec.owner_email,
      coalesce(v_rec.deleted_reason, 'Scheduled grace period expired'),
      pg_catalog.jsonb_build_object(
        'slug', v_rec.business_slug,
        'category', v_rec.business_category,
        'city', v_rec.business_city,
        'deletionRequestedAt', v_rec.deletion_requested_at,
        'deletionScheduledFor', v_rec.deletion_scheduled_for
      )
    );

    -- 3. Delete the auth.users row now that ON DELETE RESTRICT is cleared
    delete from auth.users where id = v_rec.owner_id;

    v_purged_count := v_purged_count + 1;
  end loop;

  return v_purged_count;
end;
$$;

revoke all on function public.purge_expired_pending_deletion_accounts(integer) from public, anon, authenticated, service_role;
grant execute on function public.purge_expired_pending_deletion_accounts(integer) to service_role;


-- ============================================================================
-- 8. SCHEDULE DAILY CRON JOB FOR EXPIRED PENDING-DELETION ACCOUNTS
-- ============================================================================
do $do$
begin
  if pg_catalog.to_regclass('cron.job') is not null then
    perform cron.schedule(
      'reviewassist-purge-scheduled-account-deletions',
      '17 2 * * *',
      $cron$select public.purge_expired_pending_deletion_accounts(100);$cron$
    );
  end if;
end;
$do$;


-- ============================================================================
-- ReviewAssist � Phase 3: Per-Business AI Configuration Schema & RLS Migration
-- File: supabase/migrations/004_business_ai_configuration.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- 1. Creates public.business_ai_settings (1:1 with public.businesses) to store
--    each business owner's independent AI configuration:
--      - business_id (PK, FK -> public.businesses(id) ON DELETE CASCADE)
--      - ai_tone ('friendly' | 'professional' | 'formal' | 'warm_and_welcoming'
--                 | 'conversational' | 'premium' | 'short_and_direct')
--      - ai_custom_instructions (text, max 500 chars, prompt-override check)
--      - ai_response_length ('short' | 'medium' | 'long')
--      - ai_language ('en' | 'hi' | 'te')
--      - created_at, updated_at
-- 2. Enforces strict tenant isolation via ENABLE + FORCE ROW LEVEL SECURITY:
--      - Only the authenticated owner of the parent business (b.owner_id = auth.uid())
--        can SELECT, INSERT, UPDATE, or DELETE their business_ai_settings row.
--      - Anonymous (anon) users have zero privileges on business_ai_settings,
--        ensuring customer review generation on /r/:businessSlug never reads
--        or applies business-owner tone/instruction settings.
-- 3. Does not delete or modify any existing data.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE DEFINITION: public.business_ai_settings
-- ============================================================================
create table if not exists public.business_ai_settings (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  ai_tone text not null default 'professional',
  ai_custom_instructions text not null default '',
  ai_response_length text not null default 'medium',
  ai_language text not null default 'en',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint business_ai_settings_tone_chk check (
    ai_tone in (
      'friendly',
      'professional',
      'formal',
      'warm_and_welcoming',
      'conversational',
      'premium',
      'short_and_direct'
    )
  ),
  constraint business_ai_settings_length_chk check (
    ai_response_length in ('short', 'medium', 'long')
  ),
  constraint business_ai_settings_language_chk check (
    ai_language in ('en', 'hi', 'te')
  ),
  constraint business_ai_settings_instructions_len_chk check (
    pg_catalog.char_length(ai_custom_instructions) <= 500
  ),
  constraint business_ai_settings_instructions_safety_chk check (
    ai_custom_instructions !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
    and ai_custom_instructions !~* '\m(turn|change|convert|rewrite)\s+(negative|bad|critical|poor)\s+(reviews?|feedback|comments?)\s+(into|to)\s+(positive|good|5[\s-]*star|five[\s-]*star)\M'
  )
);

comment on table public.business_ai_settings is
  'Per-business AI configuration for business-owner responses (strictly isolated from customer review generation).';

-- ============================================================================
-- 2. UPDATED_AT TRIGGER
-- ============================================================================
create or replace function public.touch_business_ai_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$fn$;

revoke all on function public.touch_business_ai_settings_updated_at() from public, anon;
grant execute on function public.touch_business_ai_settings_updated_at() to authenticated, service_role;

drop trigger if exists trg_business_ai_settings_updated_at on public.business_ai_settings;
create trigger trg_business_ai_settings_updated_at
  before update on public.business_ai_settings
  for each row
  execute function public.touch_business_ai_settings_updated_at();

-- ============================================================================
-- 3. GRANTS & ROW LEVEL SECURITY (STRICT TENANT ISOLATION)
-- ============================================================================
alter table public.business_ai_settings enable row level security;
alter table public.business_ai_settings force row level security;

revoke all on table public.business_ai_settings from public, anon;
grant select, insert, update, delete on table public.business_ai_settings to authenticated;
grant all on table public.business_ai_settings to service_role;

drop policy if exists business_ai_settings_owner_select on public.business_ai_settings;
create policy business_ai_settings_owner_select
  on public.business_ai_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_insert on public.business_ai_settings;
create policy business_ai_settings_owner_insert
  on public.business_ai_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_update on public.business_ai_settings;
create policy business_ai_settings_owner_update
  on public.business_ai_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_delete on public.business_ai_settings;
create policy business_ai_settings_owner_delete
  on public.business_ai_settings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

-- Backfill default AI settings row for any existing business that does not have one yet
insert into public.business_ai_settings (business_id)
select b.id
from public.businesses b
where not exists (
  select 1
  from public.business_ai_settings s
  where s.business_id = b.id
)
on conflict (business_id) do nothing;

commit;


-- ============================================================================
-- ReviewAssist � Phase 4: Business Knowledge & Local SEO Context Migration
-- File: supabase/migrations/005_business_knowledge_and_local_seo.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- Creates a normalized, multi-tenant schema for per-business knowledge:
--   1. public.business_knowledge_profiles (1:1 with public.businesses)
--        - business_id (PK, FK -> public.businesses(id) ON DELETE CASCADE)
--        - description (text, max 600 chars)
--        - primary_category (text, max 80 chars)
--        - additional_info (text, max 400 chars)
--   2. public.business_target_keywords (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), keyword (2..80 chars),
--          normalized_keyword (generated lower/trimmed), display_order
--        - UNIQUE (business_id, normalized_keyword) prevents duplicate keywords
--   3. public.business_products (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), name (1..80 chars),
--          normalized_name (generated lower/trimmed), description (<=200 chars),
--          category (<=60 chars), display_order
--        - UNIQUE (business_id, normalized_name) prevents duplicate products
--   4. public.business_services (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), name (1..80 chars),
--          normalized_name (generated lower/trimmed), description (<=200 chars),
--          display_order
--        - UNIQUE (business_id, normalized_name) prevents duplicate services
--   5. public.business_service_areas (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), location_name (2..80 chars),
--          normalized_location (generated lower/trimmed), display_order
--        - UNIQUE (business_id, normalized_location) prevents duplicate locations
--
-- Security & Tenant Isolation:
--   - ENABLE + FORCE ROW LEVEL SECURITY on all 5 tables.
--   - Zero privileges granted to PUBLIC or anon (protecting customer review
--     generation on /r/:businessSlug from ever reading marketing keywords).
--   - Strict owner-only SELECT, INSERT, UPDATE, DELETE policies verified against
--     public.businesses.owner_id = (select auth.uid()).
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE: public.business_knowledge_profiles
-- ============================================================================
create table if not exists public.business_knowledge_profiles (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  description text not null default '',
  primary_category text not null default 'restaurant',
  additional_info text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bkp_description_len_chk check (
    pg_catalog.char_length(description) <= 600
  ),
  constraint bkp_primary_category_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(primary_category)) between 1 and 80
  ),
  constraint bkp_additional_info_len_chk check (
    pg_catalog.char_length(additional_info) <= 400
  ),
  constraint bkp_safety_chk check (
    description !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
    and additional_info !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
  )
);

comment on table public.business_knowledge_profiles is
  'Per-business knowledge profile (description, category, additional info) for business-owned AI context.';

-- ============================================================================
-- 2. TABLE: public.business_target_keywords
-- ============================================================================
create table if not exists public.business_target_keywords (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  keyword text not null,
  normalized_keyword text generated always as (
    pg_catalog.lower(pg_catalog.btrim(keyword))
  ) stored,
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint btk_keyword_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(keyword)) between 2 and 80
  ),
  constraint btk_unique_per_business unique (business_id, normalized_keyword)
);

create index if not exists idx_business_target_keywords_biz_order
  on public.business_target_keywords (business_id, display_order);

-- ============================================================================
-- 3. TABLE: public.business_products
-- ============================================================================
create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (
    pg_catalog.lower(pg_catalog.btrim(name))
  ) stored,
  description text not null default '',
  category text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bp_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80
  ),
  constraint bp_desc_len_chk check (
    pg_catalog.char_length(description) <= 200
  ),
  constraint bp_category_len_chk check (
    pg_catalog.char_length(category) <= 60
  ),
  constraint bp_unique_per_business unique (business_id, normalized_name)
);

create index if not exists idx_business_products_biz_order
  on public.business_products (business_id, display_order);

-- ============================================================================
-- 4. TABLE: public.business_services
-- ============================================================================
create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (
    pg_catalog.lower(pg_catalog.btrim(name))
  ) stored,
  description text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bs_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80
  ),
  constraint bs_desc_len_chk check (
    pg_catalog.char_length(description) <= 200
  ),
  constraint bs_unique_per_business unique (business_id, normalized_name)
);

create index if not exists idx_business_services_biz_order
  on public.business_services (business_id, display_order);

-- ============================================================================
-- 5. TABLE: public.business_service_areas
-- ============================================================================
create table if not exists public.business_service_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  location_name text not null,
  normalized_location text generated always as (
    pg_catalog.lower(pg_catalog.btrim(location_name))
  ) stored,
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint bsa_location_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(location_name)) between 2 and 80
  ),
  constraint bsa_unique_per_business unique (business_id, normalized_location)
);

create index if not exists idx_business_service_areas_biz_order
  on public.business_service_areas (business_id, display_order);

-- ============================================================================
-- 6. GRANTS & ROW LEVEL SECURITY ACROSS ALL 5 TABLES
-- ============================================================================
alter table public.business_knowledge_profiles enable row level security;
alter table public.business_knowledge_profiles force row level security;

alter table public.business_target_keywords enable row level security;
alter table public.business_target_keywords force row level security;

alter table public.business_products enable row level security;
alter table public.business_products force row level security;

alter table public.business_services enable row level security;
alter table public.business_services force row level security;

alter table public.business_service_areas enable row level security;
alter table public.business_service_areas force row level security;

revoke all on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
from public, anon;

grant select, insert, update, delete on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
to authenticated;

grant all on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
to service_role;

-- Owner policies for business_knowledge_profiles
drop policy if exists bkp_owner_select on public.business_knowledge_profiles;
create policy bkp_owner_select on public.business_knowledge_profiles
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_insert on public.business_knowledge_profiles;
create policy bkp_owner_insert on public.business_knowledge_profiles
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_update on public.business_knowledge_profiles;
create policy bkp_owner_update on public.business_knowledge_profiles
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_delete on public.business_knowledge_profiles;
create policy bkp_owner_delete on public.business_knowledge_profiles
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_target_keywords
drop policy if exists btk_owner_select on public.business_target_keywords;
create policy btk_owner_select on public.business_target_keywords
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_insert on public.business_target_keywords;
create policy btk_owner_insert on public.business_target_keywords
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_update on public.business_target_keywords;
create policy btk_owner_update on public.business_target_keywords
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_delete on public.business_target_keywords;
create policy btk_owner_delete on public.business_target_keywords
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_products
drop policy if exists bp_owner_select on public.business_products;
create policy bp_owner_select on public.business_products
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_insert on public.business_products;
create policy bp_owner_insert on public.business_products
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_update on public.business_products;
create policy bp_owner_update on public.business_products
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_delete on public.business_products;
create policy bp_owner_delete on public.business_products
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_services
drop policy if exists bs_owner_select on public.business_services;
create policy bs_owner_select on public.business_services
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_insert on public.business_services;
create policy bs_owner_insert on public.business_services
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_update on public.business_services;
create policy bs_owner_update on public.business_services
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_delete on public.business_services;
create policy bs_owner_delete on public.business_services
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_service_areas
drop policy if exists bsa_owner_select on public.business_service_areas;
create policy bsa_owner_select on public.business_service_areas
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_insert on public.business_service_areas;
create policy bsa_owner_insert on public.business_service_areas
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_update on public.business_service_areas;
create policy bsa_owner_update on public.business_service_areas
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_delete on public.business_service_areas;
create policy bsa_owner_delete on public.business_service_areas
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

commit;


-- ============================================================================
-- ReviewAssist � Phase 5: Review Management System Schema & RLS Migration
-- File: supabase/migrations/006_review_management_system.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- 1. Extends `public.customer_drafts` (no duplicate review table created) so
--    each customer feedback & draft record supports the 4-state Business-Owner
--    Response Workflow:
--      - 'pending'
--      - 'draft_generated'
--      - 'approved'
--      - 'completed'
-- 2. Expands `customer_drafts_sentiment_chk` and `record_customer_draft_with_events`
--    to support 4-way estimated sentiment ('positive', 'neutral', 'negative', 'mixed').
-- 3. Enforces customer feedback immutability via trigger
--    `enforce_customer_drafts_owner_update_rules()` so business owners can ONLY
--    update response workflow columns (`owner_response_draft`, `response_status`,
--    `response_attempt`, `response_*_at`) and can NEVER alter or delete customer
--    `original_input`, `generated_review`, `sentiment`, `mode`, or `created_at`.
-- 4. Preserves the approved 90-day retention policy (`purge_expired_customer_drafts(90, 5000)`
--    in migration 002): because response columns live on `public.customer_drafts`,
--    expired records and their response drafts are purged together after 90 days.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXPAND SENTIMENT CONSTRAINT TO 4-WAY ESTIMATED SENTIMENT
-- ============================================================================
alter table public.customer_drafts
  drop constraint if exists customer_drafts_sentiment_chk;

alter table public.customer_drafts
  add constraint customer_drafts_sentiment_chk
    check (sentiment in ('positive', 'neutral', 'negative', 'mixed'));

-- ============================================================================
-- 2. ADD OWNER RESPONSE WORKFLOW COLUMNS TO public.customer_drafts
-- ============================================================================
alter table public.customer_drafts
  add column if not exists owner_response_draft text,
  add column if not exists response_status text not null default 'pending',
  add column if not exists response_attempt integer not null default 0,
  add column if not exists response_generated_at timestamptz,
  add column if not exists response_approved_at timestamptz,
  add column if not exists response_completed_at timestamptz,
  add column if not exists response_updated_at timestamptz;

alter table public.customer_drafts
  drop constraint if exists customer_drafts_response_status_chk,
  drop constraint if exists customer_drafts_response_draft_len_chk,
  drop constraint if exists customer_drafts_response_attempt_chk,
  drop constraint if exists customer_drafts_response_workflow_chk;

alter table public.customer_drafts
  add constraint customer_drafts_response_status_chk
    check (response_status in ('pending', 'draft_generated', 'approved', 'completed')),
  add constraint customer_drafts_response_draft_len_chk
    check (
      owner_response_draft is null
      or pg_catalog.char_length(pg_catalog.btrim(owner_response_draft)) between 1 and 4000
    ),
  add constraint customer_drafts_response_attempt_chk
    check (response_attempt between 0 and 50),
  add constraint customer_drafts_response_workflow_chk
    check (
      (
        response_status = 'pending'
        and response_approved_at is null
        and response_completed_at is null
      )
      or (
        response_status in ('draft_generated', 'approved', 'completed')
        and owner_response_draft is not null
        and pg_catalog.char_length(pg_catalog.btrim(owner_response_draft)) >= 1
      )
    );

create index if not exists idx_customer_drafts_business_status
  on public.customer_drafts (business_id, response_status, created_at desc);

create index if not exists idx_customer_drafts_business_sentiment
  on public.customer_drafts (business_id, sentiment, created_at desc);

-- ============================================================================
-- 3. IMMUTABILITY TRIGGER FOR CUSTOMER FEEDBACK FIELDS
--    Prevents any UPDATE from modifying customer-submitted feedback,
--    AI customer review draft, sentiment, mode, business_id, or created_at.
-- ============================================================================
create or replace function public.enforce_customer_drafts_owner_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if new.id is distinct from old.id then
    raise exception 'Cannot modify customer draft id' using errcode = '42501';
  end if;

  if new.business_id is distinct from old.business_id then
    raise exception 'Cannot transfer customer draft to another business' using errcode = '42501';
  end if;

  if new.original_input is distinct from old.original_input then
    raise exception 'Cannot modify customer original_input' using errcode = '42501';
  end if;

  if new.generated_review is distinct from old.generated_review then
    raise exception 'Cannot modify customer generated_review' using errcode = '42501';
  end if;

  if new.mode is distinct from old.mode then
    raise exception 'Cannot modify customer input mode' using errcode = '42501';
  end if;

  if new.sentiment is distinct from old.sentiment then
    raise exception 'Cannot modify estimated customer sentiment' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify customer draft created_at' using errcode = '42501';
  end if;

  new.response_updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$fn$;

revoke all on function public.enforce_customer_drafts_owner_update_rules()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_customer_drafts_owner_update_rules on public.customer_drafts;
create trigger trg_customer_drafts_owner_update_rules
  before update on public.customer_drafts
  for each row
  execute function public.enforce_customer_drafts_owner_update_rules();

-- ============================================================================
-- 4. COLUMN-SCOPED UPDATE PRIVILEGE & OWNER RLS POLICY
-- ============================================================================
grant update (
  owner_response_draft,
  response_status,
  response_attempt,
  response_generated_at,
  response_approved_at,
  response_completed_at,
  response_updated_at
) on table public.customer_drafts to authenticated;

drop policy if exists "customer_drafts_owner_update" on public.customer_drafts;
create policy "customer_drafts_owner_update"
  on public.customer_drafts
  as permissive
  for update
  to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 5. UPDATE record_customer_draft_with_events FOR 4-WAY SENTIMENT
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

  if p_sentiment is null or p_sentiment not in ('positive', 'neutral', 'negative', 'mixed') then
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

revoke all on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer)
  to service_role;

commit;


INSERT INTO public.platform_admins (user_id, note) SELECT id, 'Initial platform owner (' || coalesce(email, '') || ')' FROM auth.users ON CONFLICT (user_id) DO NOTHING;

