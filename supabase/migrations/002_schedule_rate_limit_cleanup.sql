-- ============================================================================
-- ReviewAssist — Scheduled cleanup via Supabase Cron (pg_cron):
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
-- Customer draft retention — APPROVED DECISION: 90 days (2026-11-11).
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
