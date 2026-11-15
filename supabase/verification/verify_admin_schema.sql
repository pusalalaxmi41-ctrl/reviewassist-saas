-- ============================================================================
-- ReviewAssist — Platform Admin & Account Lifecycle Verification SQL
-- Path: supabase/verification/verify_admin_schema.sql
-- Run in the Supabase SQL Editor AFTER 003_platform_admin_and_account_lifecycle.sql
-- is applied.
--
-- Expected result: EVERY row returns status = 'PASS'.
-- ============================================================================
with
-- 1. New columns on public.businesses
expected_business_cols(col, typ, nullable) as (
  values
    ('status', 'text', false),
    ('status_changed_at', 'timestamp with time zone', false),
    ('status_changed_by', 'uuid', true),
    ('status_reason', 'text', true),
    ('account_state', 'text', false),
    ('deletion_requested_at', 'timestamp with time zone', true),
    ('deletion_scheduled_for', 'timestamp with time zone', true),
    ('deleted_reason', 'text', true)
),
actual_business_cols as (
  select a.attname::text as col,
         format_type(a.atttypid, a.atttypmod) as typ,
         not a.attnotnull as nullable
    from pg_attribute a
   where a.attrelid = to_regclass('public.businesses')
     and a.attnum > 0
     and not a.attisdropped
),
business_col_problems as (
  select e.col || coalesce(' (found ' || a.typ || ', nullable=' || a.nullable || ')', ' (missing)') as item
    from expected_business_cols e
    left join actual_business_cols a on a.col = e.col
   where a.col is null or a.typ <> e.typ or a.nullable <> e.nullable
),
-- 2. New tables exist with ENABLE + FORCE RLS
expected_admin_tables(tbl) as (
  values ('platform_admins'), ('admin_audit_log')
),
admin_table_rls as (
  select et.tbl,
         c.oid is not null as present,
         coalesce(c.relrowsecurity, false) as rls,
         coalesce(c.relforcerowsecurity, false) as forced
    from expected_admin_tables et
    left join pg_class c
      on c.relname = et.tbl
     and c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
),
-- 3. admin_audit_log has NO foreign key to public.businesses (so audit rows survive deletion)
audit_fk_problems as (
  select con.conname as item
    from pg_constraint con
   where con.conrelid = to_regclass('public.admin_audit_log')
     and con.contype = 'f'
     and con.confrelid = to_regclass('public.businesses')
),
-- 4. Append-only trigger on admin_audit_log
audit_trigger_problems as (
  select 'trg_admin_audit_log_immutable missing' as item
   where not exists (
     select 1
       from pg_trigger t
      where t.tgrelid = to_regclass('public.admin_audit_log')
        and t.tgname = 'trg_admin_audit_log_immutable'
        and not t.tgisinternal
   )
),
-- 5. Function security & exact EXECUTE privilege matrix
expected_admin_functions(sig, secdef, expected_path, f_public, f_anon, f_auth, f_service) as (
  values
    ('public.is_platform_admin()', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_get_client_counts()', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_list_businesses(text,text,integer,integer)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_set_business_status(uuid,text,text)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_set_account_state(uuid,text,text)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_request_account_deletion(uuid,text,integer)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_restore_account(uuid,text)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_record_password_reset_audit(uuid)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.admin_list_audit_log(integer,integer)', true, 'search_path=pg_catalog, public, pg_temp', false, false, true, false),
    ('public.service_prepare_permanent_account_deletion(uuid,uuid,text,text)', false, 'search_path=pg_catalog, pg_temp', false, false, false, true),
    ('public.service_rollback_permanent_account_deletion(jsonb,text)', false, 'search_path=pg_catalog, pg_temp', false, false, false, true),
    ('public.purge_expired_pending_deletion_accounts(integer)', false, 'search_path=pg_catalog, pg_temp', false, false, false, true)
),
fn_problems as (
  select ef.sig ||
         case
           when to_regprocedure(ef.sig) is null then ' (missing)'
           else ' (secdef=' || p.prosecdef
                || ', config=' || coalesce(array_to_string(p.proconfig, ';'), '<none>')
                || ', exec='
                || has_function_privilege('public', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('anon', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/'
                || has_function_privilege('service_role', p.oid, 'EXECUTE') || ')'
         end as item
    from expected_admin_functions ef
    left join pg_proc p on p.oid = to_regprocedure(ef.sig)
   where p.oid is null
      or p.prosecdef <> ef.secdef
      or not (coalesce(p.proconfig, array[]::text[]) @> array[ef.expected_path])
      or has_function_privilege('public', p.oid, 'EXECUTE') <> ef.f_public
      or has_function_privilege('anon', p.oid, 'EXECUTE') <> ef.f_anon
      or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> ef.f_auth
      or has_function_privilege('service_role', p.oid, 'EXECUTE') <> ef.f_service
),
-- 6. customer_drafts privacy: admins must NOT get blanket RLS policy on customer_drafts
draft_privacy_problems as (
  select p.policyname as item
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename = 'customer_drafts'
     and p.policyname <> 'customer_drafts_owner_select'
),
-- 7. get_public_business_by_slug filters by status = 'active' and account_state = 'active'
public_lookup_problems as (
  select 'get_public_business_by_slug does not enforce status = active and account_state = active' as item
   where to_regprocedure('public.get_public_business_by_slug(text)') is null
      or pg_get_functiondef(to_regprocedure('public.get_public_business_by_slug(text)')) not ilike '%b.status = ''active''%'
      or pg_get_functiondef(to_regprocedure('public.get_public_business_by_slug(text)')) not ilike '%b.account_state = ''active''%'
),
-- 8. Daily scheduled account deletion cron job
cron_problems as (
  select 'reviewassist-purge-scheduled-account-deletions missing or inactive' as item
   where to_regclass('cron.job') is null
      or not exists (
        select 1
          from cron.job j
         where j.jobname = 'reviewassist-purge-scheduled-account-deletions'
           and j.active
           and j.schedule = '17 2 * * *'
           and j.command ilike '%public.purge_expired_pending_deletion_accounts(100)%'
      )
)
select
  check_name,
  case when failures = 0 then 'PASS' else 'FAIL' end as status,
  details
from (
  select '01 businesses status & lifecycle columns exist with exact types' as check_name,
         count(*) as failures,
         coalesce(string_agg(item, '; '), 'ok') as details
    from business_col_problems
  union all
  select '02 platform_admins & admin_audit_log exist with ENABLE + FORCE RLS',
         count(*) filter (where not (present and rls and forced)),
         coalesce(string_agg(tbl, ', ') filter (where not (present and rls and forced)), 'ok')
    from admin_table_rls
  union all
  select '03 admin_audit_log has NO foreign key to businesses (survives deletion)',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from audit_fk_problems
  union all
  select '04 admin_audit_log is append-only (UPDATE/DELETE blocked by trigger)',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from audit_trigger_problems
  union all
  select '05 All 12 admin/lifecycle RPCs match exact search_path, secdef & EXECUTE grants',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from fn_problems
  union all
  select '06 customer_drafts has zero blanket admin policies (raw text stays owner-only)',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from draft_privacy_problems
  union all
  select '07 get_public_business_by_slug serves ONLY status=active AND account_state=active',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from public_lookup_problems
  union all
  select '08 Daily cron job (reviewassist-purge-scheduled-account-deletions) is active',
         count(*),
         coalesce(string_agg(item, '; '), 'ok')
    from cron_problems
) checks
order by check_name;
