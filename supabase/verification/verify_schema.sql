-- ============================================================================
-- ReviewAssist — Post-migration verification (READ-ONLY)
-- Run in the Supabase SQL editor (role: postgres) AFTER 001 + 002 are applied.
-- Not a migration: lives outside supabase/migrations so it is never pushed.
--
-- Expected result: EVERY row has status = 'PASS'.
-- Missing tables/functions/jobs produce FAIL rows (they are not skipped).
-- ============================================================================
with
-- ---------------------------------------------------------------- columns
expected_columns(tbl, col, typ, nullable, def) as (
  values
    ('businesses','id','uuid',false,'gen_random_uuid()'),
    ('businesses','owner_id','uuid',false,'auth.uid()'),
    ('businesses','slug','text',false,null),
    ('businesses','name','text',false,null),
    ('businesses','category','text',false,null),
    ('businesses','city','text',false,null),
    ('businesses','google_review_url','text',false,null),
    ('businesses','google_review_url_is_placeholder','boolean',false,'true'),
    ('businesses','created_at','timestamp with time zone',false,'now()'),
    ('businesses','updated_at','timestamp with time zone',false,'now()'),
    ('analytics_events','id','uuid',false,'gen_random_uuid()'),
    ('analytics_events','business_id','uuid',false,null),
    ('analytics_events','event_type','text',false,null),
    ('analytics_events','metadata','jsonb',false,'''{}''::jsonb'),
    ('analytics_events','created_at','timestamp with time zone',false,'now()'),
    ('customer_drafts','id','uuid',false,'gen_random_uuid()'),
    ('customer_drafts','business_id','uuid',false,null),
    ('customer_drafts','original_input','text',false,null),
    ('customer_drafts','generated_review','text',false,null),
    ('customer_drafts','mode','text',false,null),
    ('customer_drafts','sentiment','text',false,null),
    ('customer_drafts','created_at','timestamp with time zone',false,'now()'),
    ('submission_rate_limits','id','uuid',false,'gen_random_uuid()'),
    ('submission_rate_limits','business_id','uuid',true,null),
    ('submission_rate_limits','scope_key','text',false,null),
    ('submission_rate_limits','client_fingerprint_hash','text',false,null),
    ('submission_rate_limits','action_type','text',false,null),
    ('submission_rate_limits','created_at','timestamp with time zone',false,'now()')
),
actual_columns as (
  select c.relname::text as tbl, a.attname::text as col,
         format_type(a.atttypid, a.atttypmod) as typ,
         not a.attnotnull as nullable,
         pg_get_expr(d.adbin, d.adrelid) as def
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
),
column_mismatches as (
  select e.tbl || '.' || e.col ||
         case when a.col is null then ' (missing)'
              else ' (type=' || a.typ || ', nullable=' || a.nullable || ', default=' || coalesce(a.def,'<none>') || ')'
         end as item
    from expected_columns e
    left join actual_columns a on a.tbl = e.tbl and a.col = e.col
   where a.col is null
      or a.typ <> e.typ
      or a.nullable <> e.nullable
      or a.def is distinct from e.def
),
-- ---------------------------------------------------------------- tables / RLS
expected_tables(tbl) as (
  values ('businesses'),('analytics_events'),('customer_drafts'),('submission_rate_limits')
),
table_rls as (
  select et.tbl, c.oid is not null as present,
         coalesce(c.relrowsecurity,false) as rls, coalesce(c.relforcerowsecurity,false) as forced
    from expected_tables et
    left join pg_class c on c.relname = et.tbl and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
),
-- ---------------------------------------------------------------- constraints
expected_constraints(tbl, conname, contype, definition) as (
  values
    ('businesses','businesses_pkey','p','PRIMARY KEY (id)'),
    ('businesses','businesses_slug_key','u','UNIQUE (slug)'),
    ('businesses','businesses_owner_id_fkey','f','FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT'),
    ('analytics_events','analytics_events_pkey','p','PRIMARY KEY (id)'),
    ('analytics_events','analytics_events_business_id_fkey','f','FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE'),
    ('customer_drafts','customer_drafts_pkey','p','PRIMARY KEY (id)'),
    ('customer_drafts','customer_drafts_business_id_fkey','f','FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE'),
    ('submission_rate_limits','submission_rate_limits_pkey','p','PRIMARY KEY (id)'),
    ('submission_rate_limits','submission_rate_limits_business_id_fkey','f','FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE'),
    ('businesses','businesses_slug_format_chk','c',null),
    ('businesses','businesses_name_len_chk','c',null),
    ('businesses','businesses_category_chk','c',null),
    ('businesses','businesses_city_len_chk','c',null),
    ('businesses','businesses_google_url_chk','c',null),
    ('analytics_events','analytics_events_type_chk','c',null),
    ('analytics_events','analytics_events_metadata_obj_chk','c',null),
    ('customer_drafts','customer_drafts_input_len_chk','c',null),
    ('customer_drafts','customer_drafts_review_len_chk','c',null),
    ('customer_drafts','customer_drafts_mode_chk','c',null),
    ('customer_drafts','customer_drafts_sentiment_chk','c',null),
    ('submission_rate_limits','submission_rate_limits_action_chk','c',null),
    ('submission_rate_limits','submission_rate_limits_hash_chk','c',null),
    ('submission_rate_limits','submission_rate_limits_scope_chk','c',null)
),
constraint_problems as (
  select ec.tbl || '.' || ec.conname ||
         case when con.oid is null then ' (missing)'
              else ' (found: ' || pg_get_constraintdef(con.oid) || ')' end as item
    from expected_constraints ec
    left join pg_constraint con
      on con.conname = ec.conname
     and con.conrelid = to_regclass('public.' || ec.tbl)
     and con.contype = ec.contype::"char"
   where con.oid is null
      or (ec.definition is not null
          and replace(pg_get_constraintdef(con.oid), 'REFERENCES public.', 'REFERENCES ') <> ec.definition)
      or not con.convalidated
),
-- ---------------------------------------------------------------- policies
expected_policies(tbl, policyname, cmd) as (
  values
    ('businesses','businesses_owner_select','SELECT'),
    ('businesses','businesses_owner_insert','INSERT'),
    ('businesses','businesses_owner_update','UPDATE'),
    ('customer_drafts','customer_drafts_owner_select','SELECT'),
    ('analytics_events','analytics_events_owner_select','SELECT')
),
missing_policies as (
  select ep.tbl || '.' || ep.policyname as item
    from expected_policies ep
    left join pg_policies p
      on p.schemaname = 'public' and p.tablename = ep.tbl and p.policyname = ep.policyname
     and p.cmd = ep.cmd and p.roles = '{authenticated}'::name[] and p.permissive = 'PERMISSIVE'
   where p.policyname is null
),
unexpected_policies as (
  select p.tablename || '.' || p.policyname || ' roles=' || p.roles::text as item
    from pg_policies p
    left join expected_policies ep on ep.tbl = p.tablename and ep.policyname = p.policyname
   where p.schemaname = 'public'
     and p.tablename in (select tbl from expected_tables)
     and ep.policyname is null
),
-- ---------------------------------------------------------------- table grants
expected_client_grants(grantee, tbl, privilege_type) as (
  values
    ('authenticated','businesses','SELECT'),
    ('authenticated','businesses','INSERT'),
    ('authenticated','businesses','UPDATE'),
    ('authenticated','customer_drafts','SELECT'),
    ('authenticated','analytics_events','SELECT')
),
unexpected_client_grants as (
  select g.grantee || ':' || g.table_name || ':' || g.privilege_type as item
    from information_schema.role_table_grants g
    left join expected_client_grants e
      on e.grantee = g.grantee and e.tbl = g.table_name and e.privilege_type = g.privilege_type
   where g.table_schema = 'public'
     and g.table_name in (select tbl from expected_tables)
     and g.grantee in ('PUBLIC','anon','authenticated')
     and e.privilege_type is null
),
missing_client_grants as (
  select e.grantee || ':' || e.tbl || ':' || e.privilege_type as item
    from expected_client_grants e
   where case when to_regclass('public.' || e.tbl) is null then true
              else not has_table_privilege(e.grantee, to_regclass('public.' || e.tbl), e.privilege_type) end
),
service_role_table_access as (
  select et.tbl as item
    from expected_tables et
   where case when to_regclass('public.' || et.tbl) is null then true
              else not (has_table_privilege('service_role', to_regclass('public.' || et.tbl), 'SELECT')
                    and has_table_privilege('service_role', to_regclass('public.' || et.tbl), 'INSERT')
                    and has_table_privilege('service_role', to_regclass('public.' || et.tbl), 'DELETE')) end
),
-- ---------------------------------------------------------------- functions
expected_functions(sig, f_public, f_anon, f_auth, f_service) as (
  values
    ('public.enforce_businesses_update_rules()', false, false, false, false),
    ('public.is_business_owner(uuid)', false, false, true, false),
    ('public.get_business_metrics(uuid)', false, false, true, false),
    ('public.get_public_business_by_slug(text)', false, false, false, true),
    ('public.consume_rate_limit(text,text,text,uuid,integer,integer)', false, false, false, true),
    ('public.prune_expired_rate_limits(integer,integer)', false, false, false, true),
    ('public.record_customer_draft_with_events(uuid,text,text,text,text,integer)', false, false, false, true),
    ('public.purge_expired_customer_drafts(integer,integer)', false, false, false, true)
),
function_problems as (
  select ef.sig ||
         case
           when to_regprocedure(ef.sig) is null then ' (missing)'
           else ' (secdef=' || p.prosecdef
                || ', config=' || coalesce(array_to_string(p.proconfig, ';'), '<none>')
                || ', owner=' || pg_get_userbyid(p.proowner)
                || ', exec public/anon/auth/service='
                || has_function_privilege('public', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('anon', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('service_role', p.oid, 'EXECUTE') || ')'
         end as item
    from expected_functions ef
    left join pg_proc p on p.oid = to_regprocedure(ef.sig)
   where p.oid is null
      or p.prosecdef
      or not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=pg_catalog, pg_temp'])
      or pg_get_userbyid(p.proowner) in ('anon','authenticated','service_role','authenticator')
      or has_function_privilege('public', p.oid, 'EXECUTE') <> ef.f_public
      or has_function_privilege('anon', p.oid, 'EXECUTE') <> ef.f_anon
      or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> ef.f_auth
      or has_function_privilege('service_role', p.oid, 'EXECUTE') <> ef.f_service
),
-- ---------------------------------------------------------------- cron
cron_problems as (
  select 'cron schema missing (pg_cron not enabled)' as item
   where to_regclass('cron.job') is null
  union all
  select ej.jobname || ' missing, inactive, wrong schedule/command, or job role lacks BYPASSRLS'
    from (values
      ('reviewassist-prune-expired-rate-limits', '*/10 * * * *', '%public.prune_expired_rate_limits(86400, 5000)%'),
      ('reviewassist-purge-customer-drafts',     '23 * * * *',   '%public.purge_expired_customer_drafts(90, 5000)%')
    ) as ej(jobname, schedule, command_pattern)
   where to_regclass('cron.job') is not null
     and not exists (
       select 1 from cron.job j
        where j.jobname = ej.jobname
          and j.active
          and j.schedule = ej.schedule
          and j.command ilike ej.command_pattern
          and exists (select 1 from pg_roles r where r.rolname = j.username and (r.rolbypassrls or r.rolsuper))
     )
)
select check_name, case when failures = 0 then 'PASS' else 'FAIL' end as status, details
from (
  select '01 tables exist with ENABLE + FORCE RLS' as check_name,
         count(*) filter (where not (present and rls and forced)) as failures,
         coalesce(string_agg(tbl, ', ') filter (where not (present and rls and forced)), 'ok') as details
    from table_rls
  union all
  select '02 columns: type / nullability / default', count(*), coalesce(string_agg(item, '; '), 'ok') from column_mismatches
  union all
  select '03 PK / UNIQUE / FK / CHECK constraints present and validated', count(*), coalesce(string_agg(item, '; '), 'ok') from constraint_problems
  union all
  select '04 all 5 owner policies present', count(*), coalesce(string_agg(item, '; '), 'ok') from missing_policies
  union all
  select '05 no unexpected policies', count(*), coalesce(string_agg(item, '; '), 'ok') from unexpected_policies
  union all
  select '06 no unexpected PUBLIC/anon/authenticated table grants', count(*), coalesce(string_agg(item, '; '), 'ok') from unexpected_client_grants
  union all
  select '07 required authenticated table grants present', count(*), coalesce(string_agg(item, '; '), 'ok') from missing_client_grants
  union all
  select '08 service_role table access', count(*), coalesce(string_agg(item, '; '), 'ok') from service_role_table_access
  union all
  select '09 service_role has BYPASSRLS',
         case when exists (select 1 from pg_roles where rolname = 'service_role' and (rolbypassrls or rolsuper)) then 0 else 1 end,
         'required because all tables FORCE RLS'
  union all
  select '10 functions: invoker, hardened search_path, owner, exact EXECUTE matrix', count(*), coalesce(string_agg(item, '; '), 'ok') from function_problems
  union all
  select '11 API roles cannot CREATE in schema public',
         (has_schema_privilege('anon','public','CREATE'))::int + (has_schema_privilege('authenticated','public','CREATE'))::int,
         'anon/authenticated CREATE on schema public must be false'
  union all
  select '12 cron jobs (rate-limit prune + 90-day draft purge) scheduled and active', count(*), coalesce(string_agg(item, '; '), 'ok') from cron_problems
) s
order by check_name;


-- ============================================================================
-- Cron run history (run ~15 minutes after 002 is applied).
-- Expected: rows with status = 'succeeded' every 10 minutes; return_message
-- contains the deleted row count (e.g. '1 row').
-- ============================================================================
-- select d.runid, d.status, d.return_message, d.start_time, d.end_time
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--  where j.jobname = 'reviewassist-prune-expired-rate-limits'
--  order by d.start_time desc
--  limit 10;

-- Assertion form (expected: 'PASS'):
-- select case when exists (
--          select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--           where j.jobname = 'reviewassist-prune-expired-rate-limits'
--             and d.status = 'succeeded'
--             and d.start_time > now() - interval '30 minutes')
--        and not exists (
--          select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--           where j.jobname = 'reviewassist-prune-expired-rate-limits'
--             and d.status = 'failed'
--             and d.start_time > now() - interval '30 minutes')
--        then 'PASS' else 'FAIL' end as cron_recent_runs;

-- Backlog check (expected: 0 once the job has caught up):
-- select count(*) as stale_rate_limit_rows
--   from public.submission_rate_limits
--  where created_at < now() - interval '25 hours';
