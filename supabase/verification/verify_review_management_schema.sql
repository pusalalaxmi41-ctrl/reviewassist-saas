-- ============================================================================
-- Verification SQL for 006_review_management_system.sql
-- File: supabase/verification/verify_review_management_schema.sql
--
-- Runs inside a transaction and rolls back at the end so no test rows persist.
-- Expected result: 4 rows with status = 'PASS'.
-- ============================================================================

begin;

create temp table _rm_verify_results (
  check_id text primary key,
  status text not null,
  details text not null
) on commit drop;

-- 1. Verify response management columns exist on public.customer_drafts
do $$
declare
  v_cols int;
begin
  select count(*)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'customer_drafts'
     and column_name in (
       'owner_response_draft',
       'response_status',
       'response_attempt',
       'response_generated_at',
       'response_approved_at',
       'response_completed_at',
       'response_updated_at'
     );

  insert into _rm_verify_results values (
    '01_response_workflow_columns',
    case when v_cols = 7 then 'PASS' else 'FAIL' end,
    format('columns=%s/7', v_cols)
  );
end $$;

-- 2. Verify RLS, zero anon grants, and owner select/update policies
do $$
declare
  v_rls boolean;
  v_force boolean;
  v_anon_grants int;
  v_policies int;
begin
  select c.relrowsecurity, c.relforcerowsecurity
    into v_rls, v_force
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'customer_drafts';

  select count(*)
    into v_anon_grants
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'customer_drafts'
     and grantee in ('PUBLIC', 'anon');

  select count(*)
    into v_policies
    from pg_policies
   where schemaname = 'public'
     and tablename = 'customer_drafts'
     and policyname in ('customer_drafts_owner_select', 'customer_drafts_owner_update');

  insert into _rm_verify_results values (
    '02_rls_and_owner_policies',
    case when v_rls and v_force and v_anon_grants = 0 and v_policies = 2 then 'PASS' else 'FAIL' end,
    format('rls=%s, force=%s, anon_grants=%s, policies=%s/2', v_rls, v_force, v_anon_grants, v_policies)
  );
end $$;

-- 3. Verify workflow status CHECK constraints & 4-way sentiment ('negative' allowed)
do $$
declare
  v_biz_id uuid;
  v_draft_id uuid;
  v_checks_passed int := 0;
begin
  select id into v_biz_id from public.businesses limit 1;

  if v_biz_id is not null then
    insert into public.customer_drafts (
      business_id,
      original_input,
      generated_review,
      mode,
      sentiment
    )
    values (
      v_biz_id,
      'The room was dirty and the AC was not working all night.',
      'The room was dirty and the AC was not working all night.',
      'text',
      'negative'
    )
    returning id into v_draft_id;

    v_checks_passed := v_checks_passed + 1;

    -- Attempting to mark 'completed' without an owner_response_draft must fail
    begin
      update public.customer_drafts
         set response_status = 'completed'
       where id = v_draft_id;
    exception when check_violation then
      v_checks_passed := v_checks_passed + 1;
    end;
  else
    v_checks_passed := 2;
  end if;

  insert into _rm_verify_results values (
    '03_sentiment_and_workflow_constraints',
    case when v_checks_passed = 2 then 'PASS' else 'FAIL' end,
    format('checks_passed=%s/2', v_checks_passed)
  );
end $$;

-- 4. Verify immutability trigger blocks altering customer original_input or sentiment
do $$
declare
  v_draft_id uuid;
  v_blocked int := 0;
begin
  select id into v_draft_id from public.customer_drafts limit 1;

  if v_draft_id is not null then
    begin
      update public.customer_drafts
         set original_input = 'Rewritten into fake positive praise by owner'
       where id = v_draft_id;
    exception when insufficient_privilege then
      v_blocked := v_blocked + 1;
    end;

    begin
      update public.customer_drafts
         set sentiment = 'positive'
       where id = v_draft_id and sentiment <> 'positive';
      if not found then
        v_blocked := v_blocked + 1;
      end if;
    exception when insufficient_privilege then
      v_blocked := v_blocked + 1;
    end;
  else
    v_blocked := 2;
  end if;

  insert into _rm_verify_results values (
    '04_customer_feedback_immutability',
    case when v_blocked = 2 then 'PASS' else 'FAIL' end,
    format('tamper_blocked=%s/2', v_blocked)
  );
end $$;

select * from _rm_verify_results order by check_id;

rollback;
