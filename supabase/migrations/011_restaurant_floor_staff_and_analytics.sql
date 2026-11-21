-- ============================================================================
-- ReviewAssist — Phase 4: Resto Daddy-Style Visual Table Floor Map,
--                         Staff Verification Mode & Owner Analytics
-- File: supabase/migrations/011_restaurant_floor_staff_and_analytics.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying in Supabase SQL Editor.
--
-- Purpose:
-- 1. Extends public.restaurant_profiles with:
--      - staff_pin_hash (SHA-256 hex digest of 4-6 digit Staff PIN)
--      - min_hours_between_visit_stars (integer default 4)
-- 2. Creates normalized tables with ENABLE + FORCE ROW LEVEL SECURITY and
--    REVOKE ALL FROM public, anon:
--      - public.restaurant_table_calls ("Call Waiter" & "Ready for Bill" alerts)
--      - public.restaurant_verified_visits (Auditable verified paid visits)
-- 3. Provides hardened SECURITY DEFINER RPC functions:
--      - public.create_restaurant_table_call(...)
--      - public.verify_staff_pin(...)
--      - public.update_restaurant_table_call_status(...)
--      - public.staff_award_visit_stars(...)
--      - public.staff_fulfill_reward_claim(...)
--      - public.get_restaurant_floor_and_analytics(...)
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.restaurant_profiles WITH STAFF PIN & VISIT COOLDOWN
-- ============================================================================
alter table public.restaurant_profiles
  add column if not exists staff_pin_hash text,
  add column if not exists min_hours_between_visit_stars integer not null default 4;

alter table public.restaurant_profiles
  drop constraint if exists restaurant_profiles_staff_pin_hash_chk,
  drop constraint if exists restaurant_profiles_visit_cooldown_chk;

alter table public.restaurant_profiles
  add constraint restaurant_profiles_staff_pin_hash_chk check (
    staff_pin_hash is null or staff_pin_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint restaurant_profiles_visit_cooldown_chk check (
    min_hours_between_visit_stars >= 0 and min_hours_between_visit_stars <= 168
  );

-- ============================================================================
-- 2. TABLE: public.restaurant_table_calls
-- ============================================================================
create table if not exists public.restaurant_table_calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_id uuid not null
    references public.restaurant_tables(id) on delete cascade,
  customer_id uuid
    references public.restaurant_customers(id) on delete set null,
  call_type text not null default 'assistance',
  status text not null default 'open',
  staff_note text,
  created_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,

  constraint rtc_call_type_chk check (
    call_type in ('assistance', 'ready_for_bill')
  ),
  constraint rtc_status_chk check (
    status in ('open', 'acknowledged', 'resolved')
  ),
  constraint rtc_note_len_chk check (
    staff_note is null or pg_catalog.char_length(pg_catalog.btrim(staff_note)) <= 240
  )
);

create index if not exists idx_restaurant_table_calls_biz_status
  on public.restaurant_table_calls (business_id, status, created_at desc);

create index if not exists idx_restaurant_table_calls_table_status
  on public.restaurant_table_calls (table_id, status, created_at desc);

-- ============================================================================
-- 3. TABLE: public.restaurant_verified_visits
-- ============================================================================
create table if not exists public.restaurant_verified_visits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_id uuid
    references public.restaurant_tables(id) on delete set null,
  customer_id uuid not null
    references public.restaurant_customers(id) on delete cascade,
  stars_awarded integer not null,
  verified_by_label text not null default 'Staff',
  idempotency_key text not null,
  created_at timestamptz not null default pg_catalog.now(),

  constraint rvv_stars_awarded_chk check (
    stars_awarded >= 1 and stars_awarded <= 50
  ),
  constraint rvv_verified_by_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(verified_by_label)) between 1 and 80
  ),
  constraint rvv_idempotency_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(idempotency_key)) between 4 and 160
  ),
  constraint rvv_unique_idempotency_per_business unique (business_id, idempotency_key)
);

create index if not exists idx_restaurant_verified_visits_biz_customer_time
  on public.restaurant_verified_visits (business_id, customer_id, created_at desc);

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY
-- ============================================================================
alter table public.restaurant_table_calls enable row level security;
alter table public.restaurant_table_calls force row level security;

alter table public.restaurant_verified_visits enable row level security;
alter table public.restaurant_verified_visits force row level security;

revoke all on table
  public.restaurant_table_calls,
  public.restaurant_verified_visits
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.restaurant_table_calls
to authenticated;

grant select on table
  public.restaurant_verified_visits
to authenticated;

grant all on table
  public.restaurant_table_calls,
  public.restaurant_verified_visits
to service_role;

drop policy if exists rtc_owner_select on public.restaurant_table_calls;
create policy rtc_owner_select on public.restaurant_table_calls
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rtc_owner_update on public.restaurant_table_calls;
create policy rtc_owner_update on public.restaurant_table_calls
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rtc_owner_delete on public.restaurant_table_calls;
create policy rtc_owner_delete on public.restaurant_table_calls
  for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rvv_owner_select on public.restaurant_verified_visits;
create policy rvv_owner_select on public.restaurant_verified_visits
  for select to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 5. HELPER: public.is_owner_or_valid_staff_pin(p_business_id, p_staff_pin_hash)
-- ============================================================================
create or replace function public.is_owner_or_valid_staff_pin(
  p_business_id uuid,
  p_staff_pin_hash text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_hash text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_staff_pin_hash, ''))), '');
  v_stored_hash text;
begin
  if p_business_id is null then
    return false;
  end if;

  if auth.uid() is not null and exists (
    select 1
      from public.businesses b
     where b.id = p_business_id
       and b.owner_id = auth.uid()
  ) then
    return true;
  end if;

  if v_clean_hash is null then
    return false;
  end if;

  select rp.staff_pin_hash into v_stored_hash
    from public.restaurant_profiles rp
   where rp.business_id = p_business_id
     and rp.is_enabled = true
   limit 1;

  return (v_stored_hash is not null and v_stored_hash = v_clean_hash);
end;
$$;

revoke all on function public.is_owner_or_valid_staff_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.is_owner_or_valid_staff_pin(uuid, text) to service_role;

-- ============================================================================
-- 6. RPC 1: public.create_restaurant_table_call
--    Lets a guest at a table tap "Call Waiter" or "Ready for Bill" with
--    duplicate-spam protection.
-- ============================================================================
create or replace function public.create_restaurant_table_call(
  p_slug text,
  p_table_key text,
  p_customer_id uuid default null,
  p_call_type text default 'assistance'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_table_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_clean_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_call_type, 'assistance')));
  v_biz record;
  v_table record;
  v_existing public.restaurant_table_calls%rowtype;
begin
  if v_clean_type not in ('assistance', 'ready_for_bill') then
    raise exception 'Invalid table call type.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  select rt.* into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_table_key
     and rt.is_active = true
   limit 1;

  if not found then
    raise exception 'Table not found or inactive.' using errcode = 'P0002';
  end if;

  -- Spam protection: reuse open/acknowledged call of same type for this table within 15 minutes
  select * into v_existing
    from public.restaurant_table_calls tc
   where tc.business_id = v_biz.id
     and tc.table_id = v_table.id
     and tc.call_type = v_clean_type
     and tc.status in ('open', 'acknowledged')
     and tc.created_at >= (pg_catalog.clock_timestamp() - interval '15 minutes')
   order by tc.created_at desc
   limit 1;

  if not found then
    insert into public.restaurant_table_calls (
      business_id,
      table_id,
      customer_id,
      call_type,
      status
    )
    values (
      v_biz.id,
      v_table.id,
      p_customer_id,
      v_clean_type,
      'open'
    )
    returning * into v_existing;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_existing.id,
    'businessId', v_existing.business_id,
    'tableId', v_existing.table_id,
    'tableNumber', v_table.table_number,
    'tableKey', v_table.table_key,
    'customerId', v_existing.customer_id,
    'callType', v_existing.call_type,
    'status', v_existing.status,
    'createdAt', v_existing.created_at,
    'resolvedAt', v_existing.resolved_at
  );
end;
$$;

revoke all on function public.create_restaurant_table_call(text, text, uuid, text) from public;
grant execute on function public.create_restaurant_table_call(text, text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. RPC 2: public.verify_staff_pin
-- ============================================================================
create or replace function public.verify_staff_pin(
  p_slug text,
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
begin
  select b.id, b.slug, b.name into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Invalid Staff PIN.' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'verified', true,
    'businessId', v_biz.id,
    'businessSlug', v_biz.slug,
    'businessName', v_biz.name
  );
end;
$$;

revoke all on function public.verify_staff_pin(text, text) from public;
grant execute on function public.verify_staff_pin(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC 3: public.update_restaurant_table_call_status
-- ============================================================================
create or replace function public.update_restaurant_table_call_status(
  p_slug text,
  p_call_id uuid,
  p_new_status text,
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_new_status, '')));
  v_biz record;
  v_updated public.restaurant_table_calls%rowtype;
  v_table record;
begin
  if v_clean_status not in ('open', 'acknowledged', 'resolved') then
    raise exception 'Invalid table call status.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Restaurant not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required.' using errcode = '42501';
  end if;

  update public.restaurant_table_calls
     set status = v_clean_status,
         resolved_at = case when v_clean_status = 'resolved' then pg_catalog.clock_timestamp() else null end
   where id = p_call_id
     and business_id = v_biz.id
  returning * into v_updated;

  if not found then
    raise exception 'Table call alert not found.' using errcode = 'P0002';
  end if;

  select rt.table_number, rt.table_key into v_table
    from public.restaurant_tables rt
   where rt.id = v_updated.table_id;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'businessId', v_updated.business_id,
    'tableId', v_updated.table_id,
    'tableNumber', coalesce(v_table.table_number, 'Table'),
    'tableKey', coalesce(v_table.table_key, ''),
    'customerId', v_updated.customer_id,
    'callType', v_updated.call_type,
    'status', v_updated.status,
    'createdAt', v_updated.created_at,
    'resolvedAt', v_updated.resolved_at
  );
end;
$$;

revoke all on function public.update_restaurant_table_call_status(text, uuid, text, text) from public;
grant execute on function public.update_restaurant_table_call_status(text, uuid, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. RPC 4: public.staff_award_visit_stars
--    Explicit staff/owner verification of a paid dining visit.
--    Resolves diner by Loyalty QR token, customer ID, or phone/email,
--    enforces `min_hours_between_visit_stars` cooldown and idempotency,
--    records in `restaurant_verified_visits`, and credits Loyalty Stars.
-- ============================================================================
create or replace function public.staff_award_visit_stars(
  p_slug text,
  p_customer_lookup text,
  p_table_key text default null,
  p_staff_label text default 'Staff',
  p_idempotency_key text default '',
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_lookup text := pg_catalog.btrim(coalesce(p_customer_lookup, ''));
  v_clean_table_key text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, ''))), '');
  v_clean_label text := coalesce(nullif(pg_catalog.btrim(coalesce(p_staff_label, '')), ''), 'Staff');
  v_clean_idem text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_biz record;
  v_profile record;
  v_rules record;
  v_customer public.restaurant_customers%rowtype;
  v_existing_visit public.restaurant_verified_visits%rowtype;
  v_existing_tx public.restaurant_loyalty_star_transactions%rowtype;
  v_last_visit_at timestamptz;
  v_table_id uuid := null;
  v_current_stars integer := 0;
  v_new_stars integer := 0;
  v_extracted_id text;
begin
  if pg_catalog.char_length(v_lookup) < 2 then
    raise exception 'Please enter a customer Loyalty QR token, phone/email, or customer ID.' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_clean_idem) < 4 or pg_catalog.char_length(v_clean_idem) > 160 then
    raise exception 'A valid idempotency key (4..160 chars) is required.' using errcode = '22023';
  end if;

  select b.id, b.slug into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required to award visit stars.' using errcode = '42501';
  end if;

  select rp.* into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
     and rp.is_enabled = true
     and rp.loyalty_enabled = true
   limit 1;

  if not found then
    raise exception 'Loyalty Stars are currently disabled for this restaurant.' using errcode = '42501';
  end if;

  -- Idempotency check first
  select * into v_existing_visit
    from public.restaurant_verified_visits vv
   where vv.business_id = v_biz.id
     and vv.idempotency_key = v_clean_idem
   limit 1;

  if found then
    select * into v_customer
      from public.restaurant_customers c
     where c.id = v_existing_visit.customer_id;

    select coalesce(st.balance_after, 0) into v_current_stars
      from public.restaurant_loyalty_star_transactions st
     where st.business_id = v_biz.id
       and st.customer_id = v_existing_visit.customer_id
     order by st.created_at desc
     limit 1;

    return pg_catalog.jsonb_build_object(
      'alreadyProcessed', true,
      'visitId', v_existing_visit.id,
      'customerId', v_existing_visit.customer_id,
      'customerName', coalesce(v_customer.display_name, 'Diner'),
      'starsAwarded', v_existing_visit.stars_awarded,
      'newLoyaltyStarsBalance', coalesce(v_current_stars, 0),
      'verifiedByLabel', v_existing_visit.verified_by_label,
      'createdAt', v_existing_visit.created_at
    );
  end if;

  -- Resolve customer from Loyalty QR token (vitaran-loyalty://<slug>/<customerId>), customer ID, or phone/email
  if pg_catalog.lower(v_lookup) like 'vitaran-loyalty://%' then
    v_extracted_id := pg_catalog.split_part(v_lookup, '/', 4);
    select * into v_customer
      from public.restaurant_customers c
     where c.id::text = v_extracted_id
     limit 1;
  else
    select * into v_customer
      from public.restaurant_customers c
     where c.id::text = v_lookup
        or c.phone_or_email = pg_catalog.lower(v_lookup)
     limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'Diner account not found for "%". Ask the guest to open their Loyalty QR pass or check their phone/email.', v_lookup
      using errcode = 'P0002';
  end if;

  -- Enforce cooldown between verified visit stars
  if v_profile.min_hours_between_visit_stars > 0 then
    select max(vv.created_at) into v_last_visit_at
      from public.restaurant_verified_visits vv
     where vv.business_id = v_biz.id
       and vv.customer_id = v_customer.id;

    if v_last_visit_at is not null
       and v_last_visit_at > (pg_catalog.clock_timestamp() - pg_catalog.make_interval(hours => v_profile.min_hours_between_visit_stars))
    then
      raise exception 'Visit Star cooldown active: this diner already received visit stars within the last % hour(s).',
        v_profile.min_hours_between_visit_stars
        using errcode = '42501';
    end if;
  end if;

  select lr.stars_per_verified_visit into v_rules
    from public.restaurant_loyalty_rules lr
   where lr.business_id = v_biz.id
   limit 1;

  if not found then
    select 1 as stars_per_verified_visit into v_rules;
  end if;

  if v_clean_table_key is not null then
    select rt.id into v_table_id
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
     limit 1;
  end if;

  select coalesce(st.balance_after, 0) into v_current_stars
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.customer_id = v_customer.id
   order by st.created_at desc
   limit 1;
  v_current_stars := coalesce(v_current_stars, 0);
  v_new_stars := v_current_stars + v_rules.stars_per_verified_visit;

  insert into public.restaurant_verified_visits (
    business_id,
    table_id,
    customer_id,
    stars_awarded,
    verified_by_label,
    idempotency_key
  )
  values (
    v_biz.id,
    v_table_id,
    v_customer.id,
    v_rules.stars_per_verified_visit,
    pg_catalog.substr(v_clean_label, 1, 80),
    v_clean_idem
  )
  returning * into v_existing_visit;

  insert into public.restaurant_loyalty_star_transactions (
    business_id,
    customer_id,
    tx_type,
    stars_delta,
    balance_after,
    idempotency_key,
    verified_by_staff_label,
    metadata
  )
  values (
    v_biz.id,
    v_customer.id,
    'verified_visit',
    v_rules.stars_per_verified_visit,
    v_new_stars,
    v_clean_idem,
    pg_catalog.substr(v_clean_label, 1, 80),
    pg_catalog.jsonb_build_object(
      'visitId', v_existing_visit.id,
      'tableId', v_table_id
    )
  )
  returning * into v_existing_tx;

  return pg_catalog.jsonb_build_object(
    'alreadyProcessed', false,
    'visitId', v_existing_visit.id,
    'customerId', v_customer.id,
    'customerName', v_customer.display_name,
    'starsAwarded', v_rules.stars_per_verified_visit,
    'newLoyaltyStarsBalance', v_new_stars,
    'verifiedByLabel', v_existing_visit.verified_by_label,
    'createdAt', v_existing_visit.created_at
  );
end;
$$;

revoke all on function public.staff_award_visit_stars(text, text, text, text, text, text) from public;
grant execute on function public.staff_award_visit_stars(text, text, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. RPC 5: public.staff_fulfill_reward_claim
--     Validates a 6-character reward claim code and marks it 'fulfilled'.
-- ============================================================================
create or replace function public.staff_fulfill_reward_claim(
  p_slug text,
  p_claim_code text,
  p_staff_label text default 'Staff',
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_claim_code, '')));
  v_clean_label text := coalesce(nullif(pg_catalog.btrim(coalesce(p_staff_label, '')), ''), 'Staff');
  v_biz record;
  v_claim public.restaurant_reward_claims%rowtype;
  v_reward public.restaurant_rewards%rowtype;
  v_customer public.restaurant_customers%rowtype;
begin
  if v_clean_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Claim code must be a 6-character alphanumeric code.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required to fulfill rewards.' using errcode = '42501';
  end if;

  select * into v_claim
    from public.restaurant_reward_claims rc
   where rc.business_id = v_biz.id
     and rc.claim_code = v_clean_code
     for update;

  if not found then
    raise exception 'Reward claim code "%" not found for this restaurant.', v_clean_code using errcode = 'P0002';
  end if;

  if v_claim.status = 'fulfilled' then
    raise exception 'Reward claim code "%" has already been fulfilled.', v_clean_code using errcode = '42501';
  end if;

  if v_claim.status = 'cancelled' then
    raise exception 'Reward claim code "%" was cancelled.', v_clean_code using errcode = '42501';
  end if;

  update public.restaurant_reward_claims
     set status = 'fulfilled',
         fulfilled_at = pg_catalog.clock_timestamp(),
         fulfilled_by = pg_catalog.substr(v_clean_label, 1, 80)
   where id = v_claim.id
  returning * into v_claim;

  select * into v_reward from public.restaurant_rewards r where r.id = v_claim.reward_id;
  select * into v_customer from public.restaurant_customers c where c.id = v_claim.customer_id;

  return pg_catalog.jsonb_build_object(
    'id', v_claim.id,
    'businessId', v_claim.business_id,
    'customerId', v_claim.customer_id,
    'customerName', coalesce(v_customer.display_name, 'Diner'),
    'rewardId', v_claim.reward_id,
    'rewardTitle', coalesce(v_reward.title, 'Loyalty Reward'),
    'claimCode', v_claim.claim_code,
    'starsSpent', v_claim.stars_spent,
    'status', v_claim.status,
    'fulfilledAt', v_claim.fulfilled_at,
    'fulfilledBy', v_claim.fulfilled_by,
    'createdAt', v_claim.created_at
  );
end;
$$;

revoke all on function public.staff_fulfill_reward_claim(text, text, text, text) from public;
grant execute on function public.staff_fulfill_reward_claim(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 11. RPC 6: public.get_restaurant_floor_and_analytics
--     Returns live table status grid, active table calls, pending reward claims,
--     and engagement funnel metrics (explicitly separating QR scans from
--     verified paid dining visits).
-- ============================================================================
create or replace function public.get_restaurant_floor_and_analytics(
  p_slug text,
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_calls jsonb := '[]'::jsonb;
  v_pending_claims jsonb := '[]'::jsonb;
  v_qr_scans bigint := 0;
  v_checked_in_diners bigint := 0;
  v_games_played bigint := 0;
  v_game_points_issued bigint := 0;
  v_verified_visits bigint := 0;
  v_stars_issued bigint := 0;
  v_rewards_claimed bigint := 0;
  v_rewards_fulfilled bigint := 0;
begin
  select b.id, b.slug, b.name into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Restaurant not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required.' using errcode = '42501';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', tc.id,
        'businessId', tc.business_id,
        'tableId', tc.table_id,
        'tableNumber', coalesce(rt.table_number, 'Table'),
        'tableKey', coalesce(rt.table_key, ''),
        'customerId', tc.customer_id,
        'callType', tc.call_type,
        'status', tc.status,
        'createdAt', tc.created_at,
        'resolvedAt', tc.resolved_at
      )
      order by tc.created_at desc
    ),
    '[]'::jsonb
  )
    into v_calls
    from public.restaurant_table_calls tc
    left join public.restaurant_tables rt on rt.id = tc.table_id
   where tc.business_id = v_biz.id
     and tc.status in ('open', 'acknowledged');

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', rc.id,
        'businessId', rc.business_id,
        'customerId', rc.customer_id,
        'customerName', coalesce(c.display_name, 'Diner'),
        'rewardId', rc.reward_id,
        'rewardTitle', coalesce(r.title, 'Reward'),
        'claimCode', rc.claim_code,
        'starsSpent', rc.stars_spent,
        'status', rc.status,
        'createdAt', rc.created_at
      )
      order by rc.created_at desc
    ),
    '[]'::jsonb
  )
    into v_pending_claims
    from public.restaurant_reward_claims rc
    left join public.restaurant_rewards r on r.id = rc.reward_id
    left join public.restaurant_customers c on c.id = rc.customer_id
   where rc.business_id = v_biz.id
     and rc.status = 'pending_staff_verification';

  select count(*)::bigint into v_qr_scans
    from public.analytics_events ae
   where ae.business_id = v_biz.id
     and ae.event_type = 'qr_scan';

  select count(distinct x.customer_id)::bigint into v_checked_in_diners
    from (
      select gs.customer_id from public.restaurant_game_sessions gs where gs.business_id = v_biz.id
      union
      select st.customer_id from public.restaurant_loyalty_star_transactions st where st.business_id = v_biz.id
    ) x;

  select count(*)::bigint into v_games_played
    from public.restaurant_game_sessions gs
   where gs.business_id = v_biz.id
     and gs.status = 'completed';

  select coalesce(sum(pt.points_delta), 0)::bigint into v_game_points_issued
    from public.restaurant_game_point_transactions pt
   where pt.business_id = v_biz.id
     and pt.points_delta > 0;

  select count(*)::bigint into v_verified_visits
    from public.restaurant_verified_visits vv
   where vv.business_id = v_biz.id;

  select coalesce(sum(st.stars_delta), 0)::bigint into v_stars_issued
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.stars_delta > 0;

  select count(*)::bigint into v_rewards_claimed
    from public.restaurant_reward_claims rc
   where rc.business_id = v_biz.id;

  select count(*)::bigint into v_rewards_fulfilled
    from public.restaurant_reward_claims rc
   where rc.business_id = v_biz.id
     and rc.status = 'fulfilled';

  return pg_catalog.jsonb_build_object(
    'activeTableCalls', v_calls,
    'pendingRewardClaims', v_pending_claims,
    'analytics', pg_catalog.jsonb_build_object(
      'qrScans', v_qr_scans,
      'checkedInDiners', v_checked_in_diners,
      'gamesPlayed', v_games_played,
      'gamePointsIssued', v_game_points_issued,
      'verifiedPaidVisits', v_verified_visits,
      'loyaltyStarsIssued', v_stars_issued,
      'rewardsClaimed', v_rewards_claimed,
      'rewardsFulfilled', v_rewards_fulfilled
    )
  );
end;
$$;

revoke all on function public.get_restaurant_floor_and_analytics(text, text) from public;
grant execute on function public.get_restaurant_floor_and_analytics(text, text) to anon, authenticated, service_role;

commit;
