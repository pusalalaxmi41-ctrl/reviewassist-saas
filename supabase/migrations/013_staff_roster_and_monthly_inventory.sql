-- ============================================================================
-- ReviewAssist / BistroOS — Master Upgrade II:
--   Individual Staff Roster & Personal PINs, Cafe/Restaurant Business Mode,
--   Monthly Inventory & Expenses Ledger, and Per-Staff Audit Tracking
-- File: supabase/migrations/013_staff_roster_and_monthly_inventory.sql
--
-- Purpose:
-- 1. Extends public.restaurant_profiles with:
--      - business_mode ('restaurant' | 'cafe', default 'restaurant')
-- 2. Creates normalized tables with ENABLE + FORCE ROW LEVEL SECURITY and
--    REVOKE ALL FROM public, anon:
--      - public.restaurant_staff_members (Individual Waiter/Staff Directory)
--      - public.restaurant_monthly_inventory (Monthly Stock & Expense Ledger)
-- 3. Upgrades staff auth helpers & SECURITY DEFINER RPCs:
--      - public.is_owner_or_valid_staff_pin (accepts individual staff PINs + legacy PIN)
--      - public.resolve_staff_member_label (resolves "Full Name (WTR-01)" audit labels)
--      - public.get_public_staff_roster_for_login (safe public name/code dropdown, no PINs)
--      - public.verify_staff_member_pin (returns { verified, staffId, staffCode, fullName, role, staffLabel, ... })
--      - Upgrades staff_award_visit_stars, staff_fulfill_reward_claim, update_table_order_status
--      - Upgrades get_public_restaurant_menu & get_restaurant_floor_and_analytics
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.restaurant_profiles WITH business_mode
-- ============================================================================
alter table public.restaurant_profiles
  add column if not exists business_mode text not null default 'restaurant';

alter table public.restaurant_profiles
  drop constraint if exists restaurant_profiles_business_mode_chk;

alter table public.restaurant_profiles
  add constraint restaurant_profiles_business_mode_chk check (
    business_mode in ('restaurant', 'cafe')
  );

-- ============================================================================
-- 2. TABLE: public.restaurant_staff_members (Individual Waiter/Staff Roster)
-- ============================================================================
create table if not exists public.restaurant_staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  staff_code text not null,
  full_name text not null,
  role text not null default 'waiter',
  pin_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint rsm_staff_code_chk check (
    staff_code ~ '^[A-Z0-9-]{2,20}$'
  ),
  constraint rsm_full_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(full_name)) between 1 and 80
  ),
  constraint rsm_role_chk check (
    role in ('waiter', 'cashier', 'chef', 'manager')
  ),
  constraint rsm_pin_hash_chk check (
    pin_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint rsm_unique_staff_code_per_business unique (business_id, staff_code)
);

create index if not exists idx_restaurant_staff_members_biz_active
  on public.restaurant_staff_members (business_id, is_active, created_at asc);

create index if not exists idx_restaurant_staff_members_biz_pin
  on public.restaurant_staff_members (business_id, pin_hash)
  where is_active = true;

-- ============================================================================
-- 3. TABLE: public.restaurant_monthly_inventory (Monthly Stock & Expenses)
-- ============================================================================
create table if not exists public.restaurant_monthly_inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  month_key text not null,
  entry_type text not null,
  category text not null,
  item_name text not null,
  quantity_label text,
  amount_paise integer not null default 0,
  low_stock_alert boolean not null default false,
  notes text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint rmi_month_key_chk check (
    month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  constraint rmi_entry_type_chk check (
    entry_type in ('stock_purchase', 'monthly_expense')
  ),
  constraint rmi_category_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(category)) between 1 and 80
  ),
  constraint rmi_item_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(item_name)) between 1 and 120
  ),
  constraint rmi_quantity_label_len_chk check (
    quantity_label is null or pg_catalog.char_length(pg_catalog.btrim(quantity_label)) <= 60
  ),
  constraint rmi_amount_paise_chk check (
    amount_paise >= 0 and amount_paise <= 1000000000
  ),
  constraint rmi_notes_len_chk check (
    notes is null or pg_catalog.char_length(pg_catalog.btrim(notes)) <= 300
  )
);

create index if not exists idx_restaurant_monthly_inventory_biz_month
  on public.restaurant_monthly_inventory (business_id, month_key, created_at desc);

create index if not exists idx_restaurant_monthly_inventory_biz_low_stock
  on public.restaurant_monthly_inventory (business_id, low_stock_alert)
  where low_stock_alert = true;

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY
-- ============================================================================
alter table public.restaurant_staff_members enable row level security;
alter table public.restaurant_staff_members force row level security;

alter table public.restaurant_monthly_inventory enable row level security;
alter table public.restaurant_monthly_inventory force row level security;

revoke all on table
  public.restaurant_staff_members,
  public.restaurant_monthly_inventory
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.restaurant_staff_members,
  public.restaurant_monthly_inventory
to authenticated;

grant all on table
  public.restaurant_staff_members,
  public.restaurant_monthly_inventory
to service_role;

drop policy if exists rsm_owner_select on public.restaurant_staff_members;
create policy rsm_owner_select on public.restaurant_staff_members
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rsm_owner_insert on public.restaurant_staff_members;
create policy rsm_owner_insert on public.restaurant_staff_members
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists rsm_owner_update on public.restaurant_staff_members;
create policy rsm_owner_update on public.restaurant_staff_members
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rsm_owner_delete on public.restaurant_staff_members;
create policy rsm_owner_delete on public.restaurant_staff_members
  for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rmi_owner_select on public.restaurant_monthly_inventory;
create policy rmi_owner_select on public.restaurant_monthly_inventory
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rmi_owner_insert on public.restaurant_monthly_inventory;
create policy rmi_owner_insert on public.restaurant_monthly_inventory
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists rmi_owner_update on public.restaurant_monthly_inventory;
create policy rmi_owner_update on public.restaurant_monthly_inventory
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rmi_owner_delete on public.restaurant_monthly_inventory;
create policy rmi_owner_delete on public.restaurant_monthly_inventory
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 5. UPGRADE HELPER: public.is_owner_or_valid_staff_pin
--    Accepts:
--      1. Authenticated owner of p_business_id
--      2. Any active staff member's individual pin_hash in restaurant_staff_members
--      3. Legacy shared restaurant_profiles.staff_pin_hash (backwards compatible)
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
  v_enabled boolean := false;
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

  select rp.is_enabled, rp.staff_pin_hash
    into v_enabled, v_stored_hash
    from public.restaurant_profiles rp
   where rp.business_id = p_business_id
   limit 1;

  if not found or v_enabled = false then
    return false;
  end if;

  -- Check individual active staff member PINs first
  if exists (
    select 1
      from public.restaurant_staff_members sm
     where sm.business_id = p_business_id
       and sm.is_active = true
       and sm.pin_hash = v_clean_hash
  ) then
    return true;
  end if;

  -- Fallback to legacy shared restaurant-level staff PIN
  return (v_stored_hash is not null and v_stored_hash = v_clean_hash);
end;
$$;

revoke all on function public.is_owner_or_valid_staff_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.is_owner_or_valid_staff_pin(uuid, text) to service_role;

-- ============================================================================
-- 6. HELPER: public.resolve_staff_member_label
--    Maps a staff member's PIN hash to canonical "Full Name (WTR-01)" label
--    for tamper-resistant audit logs.
-- ============================================================================
create or replace function public.resolve_staff_member_label(
  p_business_id uuid,
  p_staff_pin_hash text default null,
  p_fallback_label text default 'Staff'
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_hash text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_staff_pin_hash, ''))), '');
  v_fallback text := coalesce(nullif(pg_catalog.btrim(coalesce(p_fallback_label, '')), ''), 'Staff');
  v_member record;
begin
  if p_business_id is not null and v_clean_hash is not null then
    select sm.full_name, sm.staff_code
      into v_member
      from public.restaurant_staff_members sm
     where sm.business_id = p_business_id
       and sm.is_active = true
       and sm.pin_hash = v_clean_hash
     order by sm.created_at asc
     limit 1;

    if found then
      return pg_catalog.substr(v_member.full_name || ' (' || v_member.staff_code || ')', 1, 80);
    end if;
  end if;

  return pg_catalog.substr(v_fallback, 1, 80);
end;
$$;

revoke all on function public.resolve_staff_member_label(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_staff_member_label(uuid, text, text) to service_role;

-- ============================================================================
-- 7. RPC: public.get_public_staff_roster_for_login
--    Returns safe login picker entries (NO pin_hash ever exposed!) for active staff.
-- ============================================================================
create or replace function public.get_public_staff_roster_for_login(
  p_slug text
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
  v_staff jsonb := '[]'::jsonb;
begin
  if v_clean_slug !~ '^[a-z0-9-]{3,80}$' then
    return '[]'::jsonb;
  end if;

  select b.id into v_biz
    from public.businesses b
    join public.restaurant_profiles rp on rp.business_id = b.id
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
     and rp.is_enabled = true
   limit 1;

  if not found then
    return '[]'::jsonb;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', sm.id,
        'staffCode', sm.staff_code,
        'fullName', sm.full_name,
        'role', sm.role
      )
      order by sm.staff_code asc, sm.created_at asc
    ),
    '[]'::jsonb
  )
    into v_staff
    from public.restaurant_staff_members sm
   where sm.business_id = v_biz.id
     and sm.is_active = true;

  return v_staff;
end;
$$;

revoke all on function public.get_public_staff_roster_for_login(text) from public;
grant execute on function public.get_public_staff_roster_for_login(text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC: public.verify_staff_member_pin
--    Authenticates an individual staff member by personal PIN (with optional
--    staff code) and returns { verified, staffId, staffCode, fullName, role,
--    staffLabel, businessId, businessSlug, businessName }.
--    Keeps backward compatibility with legacy restaurant_profiles.staff_pin_hash.
-- ============================================================================
create or replace function public.verify_staff_member_pin(
  p_slug text,
  p_staff_code_or_pin_hash text default null,
  p_pin_hash text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_arg1 text := nullif(pg_catalog.btrim(coalesce(p_staff_code_or_pin_hash, '')), '');
  v_arg2 text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_pin_hash, ''))), '');
  v_staff_code text := null;
  v_pin_hash text := null;
  v_biz record;
  v_profile record;
  v_member record;
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

  select rp.is_enabled, rp.staff_pin_hash, rp.business_mode into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  if not found or v_profile.is_enabled = false then
    raise exception 'Restaurant Suite is not enabled.' using errcode = '42501';
  end if;

  -- Interpret arguments cleanly:
  -- 1. If p_pin_hash is supplied, p_staff_code_or_pin_hash is an optional Staff Code.
  -- 2. Otherwise if p_staff_code_or_pin_hash is a 64-char SHA-256 hex digest, treat it as PIN hash.
  if v_arg2 is not null then
    v_pin_hash := v_arg2;
    if v_arg1 is not null then
      v_staff_code := pg_catalog.upper(v_arg1);
    end if;
  elsif v_arg1 is not null and pg_catalog.lower(v_arg1) ~ '^[0-9a-f]{64}$' then
    v_pin_hash := pg_catalog.lower(v_arg1);
  end if;

  -- Try individual staff member match first
  if v_pin_hash is not null then
    if v_staff_code is not null then
      select sm.id, sm.staff_code, sm.full_name, sm.role
        into v_member
        from public.restaurant_staff_members sm
       where sm.business_id = v_biz.id
         and sm.is_active = true
         and sm.staff_code = v_staff_code
         and sm.pin_hash = v_pin_hash
       limit 1;
    else
      select sm.id, sm.staff_code, sm.full_name, sm.role
        into v_member
        from public.restaurant_staff_members sm
       where sm.business_id = v_biz.id
         and sm.is_active = true
         and sm.pin_hash = v_pin_hash
       order by sm.created_at asc
       limit 1;
    end if;

    if found then
      return pg_catalog.jsonb_build_object(
        'verified', true,
        'staffId', v_member.id,
        'staffCode', v_member.staff_code,
        'fullName', v_member.full_name,
        'role', v_member.role,
        'staffLabel', pg_catalog.substr(v_member.full_name || ' (' || v_member.staff_code || ')', 1, 80),
        'businessId', v_biz.id,
        'businessSlug', v_biz.slug,
        'businessName', v_biz.name,
        'businessMode', coalesce(v_profile.business_mode, 'restaurant')
      );
    end if;

    -- Backward compatibility: legacy restaurant-level shared Staff PIN (when no specific mismatched staff code)
    if v_staff_code is null and v_profile.staff_pin_hash is not null and v_profile.staff_pin_hash = v_pin_hash then
      return pg_catalog.jsonb_build_object(
        'verified', true,
        'staffId', null,
        'staffCode', 'STAFF',
        'fullName', 'Floor Staff',
        'role', 'manager',
        'staffLabel', 'Floor Staff (STAFF)',
        'businessId', v_biz.id,
        'businessSlug', v_biz.slug,
        'businessName', v_biz.name,
        'businessMode', coalesce(v_profile.business_mode, 'restaurant')
      );
    end if;
  end if;

  -- Authenticated owner bypass
  if auth.uid() is not null and exists (
    select 1 from public.businesses b where b.id = v_biz.id and b.owner_id = auth.uid()
  ) then
    return pg_catalog.jsonb_build_object(
      'verified', true,
      'staffId', null,
      'staffCode', 'OWNER',
      'fullName', 'Owner',
      'role', 'manager',
      'staffLabel', 'Owner',
      'businessId', v_biz.id,
      'businessSlug', v_biz.slug,
      'businessName', v_biz.name,
      'businessMode', coalesce(v_profile.business_mode, 'restaurant')
    );
  end if;

  raise exception 'Invalid Staff ID or PIN.' using errcode = '42501';
end;
$$;

revoke all on function public.verify_staff_member_pin(text, text, text) from public;
grant execute on function public.verify_staff_member_pin(text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. UPGRADE STAFF ACTION RPCs TO RECORD EXACT PERSONAL STAFF LABEL
--    (staff_award_visit_stars, staff_fulfill_reward_claim, update_table_order_status)
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
  v_clean_label text;
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

  v_clean_label := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, p_staff_label);

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

  -- Resolve customer from Loyalty QR token, customer ID, or phone/email
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
  v_clean_label text;
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

  v_clean_label := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, p_staff_label);

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

create or replace function public.update_table_order_status(
  p_slug text,
  p_order_id uuid,
  p_new_status text,
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
  v_clean_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_new_status, '')));
  v_clean_staff text;
  v_biz record;
  v_updated public.restaurant_table_orders%rowtype;
  v_table record;
begin
  if v_clean_status not in ('pending_approval', 'approved_for_kitchen', 'preparing', 'served', 'cancelled') then
    raise exception 'Invalid table order status.' using errcode = '22023';
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

  v_clean_staff := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, p_staff_label);

  update public.restaurant_table_orders
     set status = v_clean_status,
         approved_by = case
           when v_clean_status in ('approved_for_kitchen', 'preparing', 'served')
             then coalesce(approved_by, v_clean_staff)
           else approved_by
         end,
         updated_at = pg_catalog.clock_timestamp()
   where id = p_order_id
     and business_id = v_biz.id
   returning * into v_updated;

  if not found then
    raise exception 'Table order not found for this restaurant.' using errcode = 'P0002';
  end if;

  if v_updated.table_id is not null then
    select rt.table_number, rt.table_key into v_table
      from public.restaurant_tables rt
     where rt.id = v_updated.table_id
     limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'businessId', v_updated.business_id,
    'tableId', v_updated.table_id,
    'tableNumber', v_table.table_number,
    'tableKey', v_table.table_key,
    'customerId', v_updated.customer_id,
    'guestName', v_updated.guest_name,
    'items', v_updated.items,
    'status', v_updated.status,
    'approvedBy', v_updated.approved_by,
    'createdAt', v_updated.created_at,
    'updatedAt', v_updated.updated_at
  );
end;
$$;

-- ============================================================================
-- 10. UPGRADE get_public_restaurant_menu & get_restaurant_floor_and_analytics
--     to expose businessMode and per-staff verified QR counts today.
-- ============================================================================
create or replace function public.get_public_restaurant_menu(
  p_slug text,
  p_table_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_table_key text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, ''))), '');
  v_biz record;
  v_profile record;
  v_table jsonb := null;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_games jsonb := '[]'::jsonb;
  v_loyalty_rules jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_rules_row record;
begin
  if v_clean_slug !~ '^[a-z0-9-]{3,80}$' then
    return null;
  end if;

  select b.id, b.slug, b.name, b.category, b.city, b.google_review_url
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  select rp.business_id, rp.is_enabled, rp.currency_code, rp.tagline,
         rp.games_enabled, rp.loyalty_enabled, rp.table_ordering_enabled,
         rp.menu_theme_template, rp.custom_logo_url, rp.custom_accent_color,
         rp.business_mode, rp.updated_at
    into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
     and rp.is_enabled = true
   limit 1;

  if not found then
    return null;
  end if;

  if v_clean_table_key is not null then
    select pg_catalog.jsonb_build_object(
      'id', rt.id,
      'businessId', rt.business_id,
      'tableNumber', rt.table_number,
      'tableLabel', rt.table_label,
      'tableKey', rt.table_key,
      'isActive', rt.is_active
    )
      into v_table
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
       and rt.is_active = true
     limit 1;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', c.id,
        'businessId', c.business_id,
        'name', c.name,
        'description', c.description,
        'displayOrder', c.display_order,
        'isActive', c.is_active
      )
      order by c.display_order asc, c.created_at asc
    ),
    '[]'::jsonb
  )
    into v_categories
    from public.restaurant_menu_categories c
   where c.business_id = v_biz.id
     and c.is_active = true;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', i.id,
        'businessId', i.business_id,
        'categoryId', i.category_id,
        'name', i.name,
        'description', i.description,
        'pricePaise', i.price_paise,
        'dietaryTag', i.dietary_tag,
        'isAvailable', i.is_available,
        'isFeatured', i.is_featured,
        'imageUrl', i.image_url,
        'displayOrder', i.display_order
      )
      order by i.display_order asc, i.created_at asc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.restaurant_menu_items i
    join public.restaurant_menu_categories c
      on c.id = i.category_id
     and c.business_id = i.business_id
   where i.business_id = v_biz.id
     and c.is_active = true
     and i.is_available = true;

  if v_profile.games_enabled then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', g.id,
          'businessId', g.business_id,
          'gameSlug', g.game_slug,
          'title', g.title,
          'category', g.category,
          'isEnabled', g.is_enabled,
          'pointsPerWin', g.points_per_win,
          'maxPointsPerDayPerCustomer', g.max_points_per_day_per_customer,
          'cooldownMinutes', g.cooldown_minutes
        )
        order by g.created_at asc
      ),
      '[]'::jsonb
    )
      into v_games
      from public.restaurant_game_configs g
     where g.business_id = v_biz.id
       and g.is_enabled = true;
  end if;

  select lr.* into v_rules_row
    from public.restaurant_loyalty_rules lr
   where lr.business_id = v_biz.id
   limit 1;

  if found then
    v_loyalty_rules := pg_catalog.jsonb_build_object(
      'businessId', v_rules_row.business_id,
      'starsPerVerifiedVisit', v_rules_row.stars_per_verified_visit,
      'pointsPerStarExchange', v_rules_row.points_per_star_exchange,
      'allowPointExchange', v_rules_row.allow_point_exchange,
      'maxStarsViaExchangePerWeek', v_rules_row.max_stars_via_exchange_per_week,
      'wifiNetworkName', v_rules_row.wifi_network_name,
      'wifiPassword', v_rules_row.wifi_password,
      'suggestionBoxEnabled', v_rules_row.suggestion_box_enabled,
      'updatedAt', v_rules_row.updated_at
    );
  else
    v_loyalty_rules := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'starsPerVerifiedVisit', 1,
      'pointsPerStarExchange', 100,
      'allowPointExchange', true,
      'maxStarsViaExchangePerWeek', 2,
      'wifiNetworkName', null,
      'wifiPassword', null,
      'suggestionBoxEnabled', true,
      'updatedAt', v_profile.updated_at
    );
  end if;

  if v_profile.loyalty_enabled then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', r.id,
          'businessId', r.business_id,
          'title', r.title,
          'description', r.description,
          'starsRequired', r.stars_required,
          'isActive', r.is_active,
          'maxRedemptionsTotal', r.max_redemptions_total,
          'redemptionsCount', r.redemptions_count,
          'displayOrder', r.display_order
        )
        order by r.display_order asc, r.stars_required asc, r.created_at asc
      ),
      '[]'::jsonb
    )
      into v_rewards
      from public.restaurant_rewards r
     where r.business_id = v_biz.id
       and r.is_active = true;
  end if;

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'slug', v_biz.slug,
      'name', v_biz.name,
      'category', v_biz.category,
      'city', v_biz.city,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'profile', pg_catalog.jsonb_build_object(
      'businessId', v_profile.business_id,
      'isEnabled', v_profile.is_enabled,
      'currencyCode', v_profile.currency_code,
      'tagline', v_profile.tagline,
      'gamesEnabled', v_profile.games_enabled,
      'loyaltyEnabled', v_profile.loyalty_enabled,
      'tableOrderingEnabled', coalesce(v_profile.table_ordering_enabled, false),
      'menuThemeTemplate', coalesce(v_profile.menu_theme_template, 'default'),
      'businessMode', coalesce(v_profile.business_mode, 'restaurant'),
      'customLogoUrl', v_profile.custom_logo_url,
      'customAccentColor', v_profile.custom_accent_color,
      'updatedAt', v_profile.updated_at
    ),
    'table', v_table,
    'categories', v_categories,
    'items', v_items,
    'games', v_games,
    'loyaltyRules', v_loyalty_rules,
    'rewards', v_rewards
  );
end;
$$;

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
  v_ordering_enabled boolean := false;
  v_business_mode text := 'restaurant';
  v_calls jsonb := '[]'::jsonb;
  v_pending_claims jsonb := '[]'::jsonb;
  v_table_orders jsonb := '[]'::jsonb;
  v_staff_counts_today jsonb := '{}'::jsonb;
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

  select coalesce(rp.table_ordering_enabled, false),
         coalesce(rp.business_mode, 'restaurant')
    into v_ordering_enabled, v_business_mode
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

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

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'businessId', o.business_id,
        'tableId', o.table_id,
        'tableNumber', rt.table_number,
        'tableKey', rt.table_key,
        'customerId', o.customer_id,
        'guestName', o.guest_name,
        'items', o.items,
        'status', o.status,
        'approvedBy', o.approved_by,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
    into v_table_orders
    from (
      select *
        from public.restaurant_table_orders rto
       where rto.business_id = v_biz.id
         and rto.status in ('pending_approval', 'approved_for_kitchen', 'preparing')
       order by rto.created_at desc
       limit 50
    ) o
    left join public.restaurant_tables rt on rt.id = o.table_id;

  select coalesce(
    pg_catalog.jsonb_object_agg(agg.verified_by_label, agg.cnt),
    '{}'::jsonb
  )
    into v_staff_counts_today
    from (
      select vv.verified_by_label, count(*)::integer as cnt
        from public.restaurant_verified_visits vv
       where vv.business_id = v_biz.id
         and vv.created_at >= date_trunc('day', pg_catalog.now() at time zone 'UTC')
       group by vv.verified_by_label
    ) agg;

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
    'tableOrderingEnabled', v_ordering_enabled,
    'businessMode', v_business_mode,
    'tableOrders', v_table_orders,
    'staffVerificationCountsToday', v_staff_counts_today,
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

commit;
