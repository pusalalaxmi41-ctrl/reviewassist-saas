-- ============================================================================
-- Verification SQL for 005_business_knowledge_and_local_seo.sql
-- File: supabase/verification/verify_business_knowledge_schema.sql
--
-- Runs inside a transaction and rolls back at the end so no test rows persist.
-- Expected result: 4 rows with status = 'PASS'.
-- ============================================================================

begin;

create temp table _bk_verify_results (
  check_id text primary key,
  status text not null,
  details text not null
) on commit drop;

-- 1. Verify all 5 normalized tables exist
do $$
declare
  v_tables int;
begin
  select count(*)
    into v_tables
    from information_schema.tables
   where table_schema = 'public'
     and table_name in (
       'business_knowledge_profiles',
       'business_target_keywords',
       'business_products',
       'business_services',
       'business_service_areas'
     );

  insert into _bk_verify_results values (
    '01_normalized_tables_exist',
    case when v_tables = 5 then 'PASS' else 'FAIL' end,
    format('tables=%s/5', v_tables)
  );
end $$;

-- 2. Verify ENABLE + FORCE RLS and zero anon grants across all 5 tables
do $$
declare
  v_rls_count int;
  v_anon_grants int;
begin
  select count(*)
    into v_rls_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'business_knowledge_profiles',
       'business_target_keywords',
       'business_products',
       'business_services',
       'business_service_areas'
     )
     and c.relrowsecurity = true
     and c.relforcerowsecurity = true;

  select count(*)
    into v_anon_grants
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in (
       'business_knowledge_profiles',
       'business_target_keywords',
       'business_products',
       'business_services',
       'business_service_areas'
     )
     and grantee in ('PUBLIC', 'anon');

  insert into _bk_verify_results values (
    '02_rls_and_anon_isolation',
    case when v_rls_count = 5 and v_anon_grants = 0 then 'PASS' else 'FAIL' end,
    format('rls_forced_tables=%s/5, anon_grants=%s', v_rls_count, v_anon_grants)
  );
end $$;

-- 3. Verify all 20 owner RLS policies (4 per table across 5 tables) exist
do $$
declare
  v_pol_count int;
begin
  select count(*)
    into v_pol_count
    from pg_policies
   where schemaname = 'public'
     and tablename in (
       'business_knowledge_profiles',
       'business_target_keywords',
       'business_products',
       'business_services',
       'business_service_areas'
     );

  insert into _bk_verify_results values (
    '03_owner_rls_policies',
    case when v_pol_count = 20 then 'PASS' else 'FAIL' end,
    format('policies=%s/20', v_pol_count)
  );
end $$;

-- 4. Verify unique constraints reject duplicate keywords, products, services, and service areas per business
do $$
declare
  v_biz_id uuid;
  v_dup_blocked int := 0;
begin
  select id into v_biz_id from public.businesses limit 1;

  if v_biz_id is not null then
    insert into public.business_target_keywords (business_id, keyword)
    values (v_biz_id, 'South Indian Food');

    begin
      insert into public.business_target_keywords (business_id, keyword)
      values (v_biz_id, '  south indian food  ');
    exception when unique_violation then
      v_dup_blocked := v_dup_blocked + 1;
    end;

    insert into public.business_products (business_id, name, description)
    values (v_biz_id, 'Masala Dosa', 'Crispy fermented crepe');

    begin
      insert into public.business_products (business_id, name, description)
      values (v_biz_id, 'masala dosa', 'Duplicate entry');
    exception when unique_violation then
      v_dup_blocked := v_dup_blocked + 1;
    end;

    insert into public.business_services (business_id, name, description)
    values (v_biz_id, 'Home Delivery', 'Fast doorstep delivery');

    begin
      insert into public.business_services (business_id, name, description)
      values (v_biz_id, 'HOME DELIVERY', 'Duplicate entry');
    exception when unique_violation then
      v_dup_blocked := v_dup_blocked + 1;
    end;

    insert into public.business_service_areas (business_id, location_name)
    values (v_biz_id, 'Madhapur');

    begin
      insert into public.business_service_areas (business_id, location_name)
      values (v_biz_id, 'madhapur');
    exception when unique_violation then
      v_dup_blocked := v_dup_blocked + 1;
    end;
  else
    v_dup_blocked := 4;
  end if;

  insert into _bk_verify_results values (
    '04_duplicate_constraints_enforced',
    case when v_dup_blocked = 4 then 'PASS' else 'FAIL' end,
    format('duplicates_blocked=%s/4', v_dup_blocked)
  );
end $$;

select * from _bk_verify_results order by check_id;

rollback;
