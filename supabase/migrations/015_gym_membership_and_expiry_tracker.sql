-- ============================================================================
-- Vitaran AI Reviews / GymOS — Module 5: Gym Membership, Payment Approval &
-- 3-Day Automatic Expiry Tracker
-- Migration: 015_gym_membership_and_expiry_tracker.sql
-- Depends on: 001..014
--
-- Summary of Changes:
-- 1. Expands public.businesses.category check constraint to include 'gym'.
-- 2. Creates public.gym_configs (1:1 per gym business, customizable plans,
--    registration open toggle, configurable renewal_alert_days default 3).
-- 3. Creates public.gym_members (replaces paper gym registers with pending
--    payment approval, automatic start_date/end_date math, & renewal tracking).
-- 4. Creates public.gym_check_ins (daily 1-tap attendance log, max 1 per day).
-- 5. Enforces ENABLE + FORCE ROW LEVEL SECURITY + REVOKE ALL FROM public, anon.
-- 6. Adds 6 hardened SECURITY DEFINER RPCs:
--      - public.get_public_gym_portal(p_slug)
--      - public.submit_gym_member_registration(p_slug, p_full_name, p_phone, p_plan_id)
--      - public.lookup_gym_member_pass(p_slug, p_phone)
--      - public.gym_member_daily_check_in(p_slug, p_phone)
--      - public.get_gym_owner_dashboard(p_business_id)
--      - public.owner_approve_or_renew_gym_member(p_business_id, p_member_id, p_action, ...)
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXPAND businesses.category TO INCLUDE 'gym'
-- ============================================================================
alter table public.businesses
  drop constraint if exists businesses_category_chk;

alter table public.businesses
  add constraint businesses_category_chk
    check (
      category in (
        'restaurant',
        'cafe',
        'hotel',
        'pg',
        'salon',
        'barber',
        'clinic',
        'gym',
        'retail',
        'services',
        'other'
      )
    );

-- ============================================================================
-- 2. TABLE: public.gym_configs (1:1 per Gym Business)
-- ============================================================================
create table if not exists public.gym_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  is_registration_open boolean not null default true,
  renewal_alert_days integer not null default 3
    check (renewal_alert_days between 1 and 30),
  plans jsonb not null default '[
    {"id":"1_month","name":"1 Month Plan","durationDays":30,"pricePaise":150000,"badge":"Popular"},
    {"id":"3_months","name":"3 Months Plan","durationDays":90,"pricePaise":400000,"badge":"Save 11%"},
    {"id":"6_months","name":"6 Months Plan","durationDays":180,"pricePaise":720000,"badge":"Best Value"},
    {"id":"1_year","name":"1 Year Transformation","durationDays":365,"pricePaise":1250000,"badge":"Pro"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_configs_plans_is_array_chk check (jsonb_typeof(plans) = 'array')
);

alter table public.gym_configs enable row level security;
alter table public.gym_configs force row level security;

revoke all on table public.gym_configs from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_configs to authenticated;
grant all on table public.gym_configs to service_role;

drop policy if exists "gym_configs_owner_select" on public.gym_configs;
create policy "gym_configs_owner_select"
  on public.gym_configs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_configs.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_configs_owner_insert" on public.gym_configs;
create policy "gym_configs_owner_insert"
  on public.gym_configs
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_configs.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_configs_owner_update" on public.gym_configs;
create policy "gym_configs_owner_update"
  on public.gym_configs
  for update
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_configs.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_configs.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_configs_owner_delete" on public.gym_configs;
create policy "gym_configs_owner_delete"
  on public.gym_configs
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_configs.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. TABLE: public.gym_members
-- ============================================================================
create table if not exists public.gym_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_code text not null,
  full_name text not null,
  phone text not null,
  plan_id text not null default '1_month',
  plan_name text not null default '1 Month Plan',
  duration_days integer not null default 30 check (duration_days between 1 and 1095),
  fee_paise integer not null default 150000 check (fee_paise >= 0 and fee_paise <= 100000000),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'active', 'expired', 'suspended', 'rejected')),
  start_date date,
  end_date date,
  total_check_ins integer not null default 0 check (total_check_ins >= 0),
  last_check_in_date date,
  approved_by_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_members_unique_code unique (business_id, member_code),
  constraint gym_members_unique_phone unique (business_id, phone),
  constraint gym_members_name_len_chk check (pg_catalog.char_length(pg_catalog.btrim(full_name)) between 1 and 80),
  constraint gym_members_phone_len_chk check (pg_catalog.char_length(pg_catalog.btrim(phone)) between 6 and 40)
);

create index if not exists idx_gym_members_biz_status_end
  on public.gym_members (business_id, status, end_date asc nulls last);

create index if not exists idx_gym_members_biz_phone
  on public.gym_members (business_id, phone);

alter table public.gym_members enable row level security;
alter table public.gym_members force row level security;

revoke all on table public.gym_members from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_members to authenticated;
grant all on table public.gym_members to service_role;

drop policy if exists "gym_members_owner_all" on public.gym_members;
create policy "gym_members_owner_all"
  on public.gym_members
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_members.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_members.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. TABLE: public.gym_check_ins (Daily Attendance Log)
-- ============================================================================
create table if not exists public.gym_check_ins (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  check_in_date date not null default current_date,
  checked_in_at timestamptz not null default now(),
  constraint gym_check_ins_one_per_day unique (business_id, member_id, check_in_date)
);

create index if not exists idx_gym_check_ins_biz_date
  on public.gym_check_ins (business_id, check_in_date desc, checked_in_at desc);

alter table public.gym_check_ins enable row level security;
alter table public.gym_check_ins force row level security;

revoke all on table public.gym_check_ins from public, anon, authenticated;
grant select, insert, delete on table public.gym_check_ins to authenticated;
grant all on table public.gym_check_ins to service_role;

drop policy if exists "gym_check_ins_owner_select" on public.gym_check_ins;
create policy "gym_check_ins_owner_select"
  on public.gym_check_ins
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_check_ins.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. HELPER: Canonical Phone Normalization for Gym Members
-- ============================================================================
create or replace function public.normalize_gym_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_digits text;
begin
  v_digits := pg_catalog.regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
  -- Normalize 10+ digit Indian mobile numbers cleanly (keep last 10 if 12 digits starting with 91)
  if pg_catalog.char_length(v_digits) = 12 and pg_catalog.substr(v_digits, 1, 2) = '91' then
    v_digits := pg_catalog.substr(v_digits, 3, 10);
  elsif pg_catalog.char_length(v_digits) = 11 and pg_catalog.substr(v_digits, 1, 1) = '0' then
    v_digits := pg_catalog.substr(v_digits, 2, 10);
  end if;
  return pg_catalog.substr(v_digits, 1, 20);
end;
$$;

-- ============================================================================
-- 6. RPC 1: public.get_public_gym_portal(p_slug)
-- ============================================================================
create or replace function public.get_public_gym_portal(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_cfg public.gym_configs%rowtype;
  v_default_plans jsonb := '[
    {"id":"1_month","name":"1 Month Plan","durationDays":30,"pricePaise":150000,"badge":"Popular"},
    {"id":"3_months","name":"3 Months Plan","durationDays":90,"pricePaise":400000,"badge":"Save 11%"},
    {"id":"6_months","name":"6 Months Plan","durationDays":180,"pricePaise":720000,"badge":"Best Value"},
    {"id":"1_year","name":"1 Year Transformation","durationDays":365,"pricePaise":1250000,"badge":"Pro"}
  ]'::jsonb;
  v_cfg_json jsonb;
  v_active_count integer := 0;
  v_checked_in_today integer := 0;
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

  select * into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;

  if found then
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_cfg.business_id,
      'isRegistrationOpen', v_cfg.is_registration_open,
      'renewalAlertDays', v_cfg.renewal_alert_days,
      'plans', v_cfg.plans,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    );
  else
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'isRegistrationOpen', true,
      'renewalAlertDays', 3,
      'plans', v_default_plans,
      'createdAt', pg_catalog.now(),
      'updatedAt', pg_catalog.now()
    );
  end if;

  select count(*)::integer into v_active_count
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status = 'active'
     and (m.end_date is null or m.end_date >= current_date);

  select count(*)::integer into v_checked_in_today
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.check_in_date = current_date;

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'slug', v_biz.slug,
      'name', v_biz.name,
      'category', v_biz.category,
      'city', v_biz.city,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'config', v_cfg_json,
    'activeMembersCount', v_active_count,
    'checkedInTodayCount', v_checked_in_today
  );
end;
$$;

revoke all on function public.get_public_gym_portal(text) from public;
grant execute on function public.get_public_gym_portal(text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. RPC 2: public.submit_gym_member_registration
-- ============================================================================
create or replace function public.submit_gym_member_registration(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_plan_id text default '1_month'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.btrim(coalesce(p_full_name, ''));
  v_norm_phone text := public.normalize_gym_phone(p_phone);
  v_clean_plan_id text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_plan_id, '1_month')));
  v_biz record;
  v_cfg public.gym_configs%rowtype;
  v_plan jsonb;
  v_plan_id text := '1_month';
  v_plan_name text := '1 Month Plan';
  v_duration_days integer := 30;
  v_fee_paise integer := 150000;
  v_existing public.gym_members%rowtype;
  v_next_seq integer := 1;
  v_code text;
  v_member public.gym_members%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 2 or pg_catalog.char_length(v_clean_name) > 80 then
    raise exception 'Please enter your full name (2 to 80 characters).' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_norm_phone) < 8 then
    raise exception 'Please enter a valid 10-digit phone number.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Gym is not active.' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('gym-member:' || v_biz.id::text)
  );

  insert into public.gym_configs (business_id)
  values (v_biz.id)
  on conflict (business_id) do nothing;

  select * into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;

  if not v_cfg.is_registration_open then
    raise exception 'New member registrations are currently paused. Please speak to the front desk.' using errcode = '42501';
  end if;

  -- Resolve canonical plan from gym_configs.plans
  for v_plan in select * from pg_catalog.jsonb_array_elements(v_cfg.plans) loop
    if pg_catalog.lower(coalesce(v_plan ->> 'id', '')) = v_clean_plan_id
       or pg_catalog.lower(coalesce(v_plan ->> 'name', '')) = v_clean_plan_id
    then
      v_plan_id := coalesce(nullif(v_plan ->> 'id', ''), '1_month');
      v_plan_name := coalesce(nullif(v_plan ->> 'name', ''), '1 Month Plan');
      v_duration_days := greatest(1, least(1095, coalesce((v_plan ->> 'durationDays')::integer, 30)));
      v_fee_paise := greatest(0, least(100000000, coalesce((v_plan ->> 'pricePaise')::integer, 150000)));
      exit;
    end if;
  end loop;

  select * into v_existing
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.phone = v_norm_phone
   limit 1;

  if found then
    if v_existing.status = 'active' and v_existing.end_date is not null and v_existing.end_date >= current_date then
      raise exception 'An active membership already exists for this phone number. Switch to "My Digital Pass" to view your pass.' using errcode = '23505';
    end if;

    update public.gym_members
       set full_name = pg_catalog.substr(v_clean_name, 1, 80),
           plan_id = v_plan_id,
           plan_name = pg_catalog.substr(v_plan_name, 1, 80),
           duration_days = v_duration_days,
           fee_paise = v_fee_paise,
           status = 'pending_approval',
           updated_at = pg_catalog.clock_timestamp()
     where id = v_existing.id
     returning * into v_member;
  else
    select count(*)::integer + 1 into v_next_seq
      from public.gym_members m
     where m.business_id = v_biz.id;

    v_code := 'GYM-' || pg_catalog.lpad(v_next_seq::text, 3, '0');
    while exists (
      select 1 from public.gym_members m
      where m.business_id = v_biz.id and m.member_code = v_code
    ) loop
      v_next_seq := v_next_seq + 1;
      v_code := 'GYM-' || pg_catalog.lpad(v_next_seq::text, 3, '0');
    end loop;

    insert into public.gym_members (
      business_id,
      member_code,
      full_name,
      phone,
      plan_id,
      plan_name,
      duration_days,
      fee_paise,
      status
    )
    values (
      v_biz.id,
      v_code,
      pg_catalog.substr(v_clean_name, 1, 80),
      v_norm_phone,
      v_plan_id,
      pg_catalog.substr(v_plan_name, 1, 80),
      v_duration_days,
      v_fee_paise,
      'pending_approval'
    )
    returning * into v_member;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_member.id,
    'businessId', v_member.business_id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'phone', v_member.phone,
    'planId', v_member.plan_id,
    'planName', v_member.plan_name,
    'durationDays', v_member.duration_days,
    'feePaise', v_member.fee_paise,
    'status', v_member.status,
    'effectiveStatus', 'pending_approval',
    'daysRemaining', 0,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'lastCheckInDate', v_member.last_check_in_date,
    'checkedInToday', false,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.submit_gym_member_registration(text, text, text, text) from public;
grant execute on function public.submit_gym_member_registration(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC 3: public.lookup_gym_member_pass(p_slug, p_phone)
-- ============================================================================
create or replace function public.lookup_gym_member_pass(
  p_slug text,
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_norm_phone text := public.normalize_gym_phone(p_phone);
  v_biz record;
  v_cfg record;
  v_alert_days integer := 3;
  v_member public.gym_members%rowtype;
  v_days_remaining integer := 0;
  v_eff_status text;
  v_checked_in_today boolean := false;
begin
  if pg_catalog.char_length(v_norm_phone) < 8 then
    raise exception 'Please enter a valid 10-digit phone number.' using errcode = '22023';
  end if;

  select b.id, b.name, b.slug, b.city into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  select gc.renewal_alert_days into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;
  v_alert_days := coalesce(v_cfg.renewal_alert_days, 3);

  select * into v_member
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.phone = v_norm_phone
   limit 1;

  if not found then
    return null;
  end if;

  if v_member.status = 'active' and v_member.end_date is not null then
    v_days_remaining := (v_member.end_date - current_date);
    if v_days_remaining < 0 then
      v_eff_status := 'expired';
      v_days_remaining := 0;
    elsif v_days_remaining <= v_alert_days then
      v_eff_status := 'expiring_soon';
    else
      v_eff_status := 'active';
    end if;
  else
    v_eff_status := v_member.status;
    v_days_remaining := 0;
  end if;

  select exists (
    select 1 from public.gym_check_ins c
    where c.business_id = v_biz.id
      and c.member_id = v_member.id
      and c.check_in_date = current_date
  ) into v_checked_in_today;

  return pg_catalog.jsonb_build_object(
    'id', v_member.id,
    'businessId', v_member.business_id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'phone', v_member.phone,
    'planId', v_member.plan_id,
    'planName', v_member.plan_name,
    'durationDays', v_member.duration_days,
    'feePaise', v_member.fee_paise,
    'status', v_member.status,
    'effectiveStatus', v_eff_status,
    'daysRemaining', v_days_remaining,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'lastCheckInDate', v_member.last_check_in_date,
    'checkedInToday', v_checked_in_today,
    'approvedByLabel', v_member.approved_by_label,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.lookup_gym_member_pass(text, text) from public;
grant execute on function public.lookup_gym_member_pass(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. RPC 4: public.gym_member_daily_check_in(p_slug, p_phone)
-- ============================================================================
create or replace function public.gym_member_daily_check_in(
  p_slug text,
  p_phone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_norm_phone text := public.normalize_gym_phone(p_phone);
  v_biz record;
  v_member public.gym_members%rowtype;
  v_already boolean := false;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Gym is not active.' using errcode = 'P0002';
  end if;

  select * into v_member
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.phone = v_norm_phone
   for update;

  if not found then
    raise exception 'Member not found for this phone number.' using errcode = 'P0002';
  end if;

  if v_member.status = 'pending_approval' then
    raise exception 'Your membership is pending payment approval at the front desk.' using errcode = '42501';
  end if;

  if v_member.status <> 'active' or v_member.end_date is null or v_member.end_date < current_date then
    raise exception 'Your membership plan has expired. Please renew at the front desk to check in.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.gym_check_ins c
    where c.business_id = v_biz.id
      and c.member_id = v_member.id
      and c.check_in_date = current_date
  ) then
    v_already := true;
  else
    insert into public.gym_check_ins (business_id, member_id, check_in_date)
    values (v_biz.id, v_member.id, current_date)
    on conflict (business_id, member_id, check_in_date) do nothing;

    update public.gym_members
       set total_check_ins = total_check_ins + 1,
           last_check_in_date = current_date,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  end if;

  return pg_catalog.jsonb_build_object(
    'memberId', v_member.id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'alreadyCheckedInToday', v_already,
    'totalCheckIns', v_member.total_check_ins,
    'daysRemaining', greatest(0, (v_member.end_date - current_date)),
    'checkedInDate', current_date
  );
end;
$$;

revoke all on function public.gym_member_daily_check_in(text, text) from public;
grant execute on function public.gym_member_daily_check_in(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. RPC 5: public.get_gym_owner_dashboard(p_business_id)
-- ============================================================================
create or replace function public.get_gym_owner_dashboard(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_cfg public.gym_configs%rowtype;
  v_alert_days integer := 3;
  v_default_plans jsonb := '[
    {"id":"1_month","name":"1 Month Plan","durationDays":30,"pricePaise":150000,"badge":"Popular"},
    {"id":"3_months","name":"3 Months Plan","durationDays":90,"pricePaise":400000,"badge":"Save 11%"},
    {"id":"6_months","name":"6 Months Plan","durationDays":180,"pricePaise":720000,"badge":"Best Value"},
    {"id":"1_year","name":"1 Year Transformation","durationDays":365,"pricePaise":1250000,"badge":"Pro"}
  ]'::jsonb;
  v_cfg_json jsonb;
  v_members jsonb := '[]'::jsonb;
  v_checked_in_today integer := 0;
begin
  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  select * into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;

  if found then
    v_alert_days := v_cfg.renewal_alert_days;
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_cfg.business_id,
      'isRegistrationOpen', v_cfg.is_registration_open,
      'renewalAlertDays', v_cfg.renewal_alert_days,
      'plans', v_cfg.plans,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    );
  else
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'isRegistrationOpen', true,
      'renewalAlertDays', 3,
      'plans', v_default_plans,
      'createdAt', pg_catalog.now(),
      'updatedAt', pg_catalog.now()
    );
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', m.id,
        'businessId', m.business_id,
        'memberCode', m.member_code,
        'fullName', m.full_name,
        'phone', m.phone,
        'planId', m.plan_id,
        'planName', m.plan_name,
        'durationDays', m.duration_days,
        'feePaise', m.fee_paise,
        'status', m.status,
        'effectiveStatus', case
          when m.status = 'active' and m.end_date is not null and m.end_date < current_date then 'expired'
          when m.status = 'active' and m.end_date is not null and (m.end_date - current_date) <= v_alert_days then 'expiring_soon'
          else m.status
        end,
        'daysRemaining', case
          when m.status = 'active' and m.end_date is not null then greatest(0, (m.end_date - current_date))
          else 0
        end,
        'startDate', m.start_date,
        'endDate', m.end_date,
        'totalCheckIns', m.total_check_ins,
        'lastCheckInDate', m.last_check_in_date,
        'checkedInToday', (m.last_check_in_date = current_date),
        'approvedByLabel', m.approved_by_label,
        'notes', m.notes,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at
      )
      order by
        case
          when m.status = 'pending_approval' then 1
          when m.status = 'active' and m.end_date is not null and m.end_date >= current_date and (m.end_date - current_date) <= v_alert_days then 2
          when m.status = 'active' and m.end_date is not null and m.end_date >= current_date then 3
          else 4
        end asc,
        m.end_date asc nulls last,
        m.created_at desc
    ),
    '[]'::jsonb
  )
    into v_members
    from public.gym_members m
   where m.business_id = v_biz.id;

  select count(*)::integer into v_checked_in_today
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.check_in_date = current_date;

  return pg_catalog.jsonb_build_object(
    'config', v_cfg_json,
    'members', v_members,
    'checkedInTodayCount', v_checked_in_today
  );
end;
$$;

revoke all on function public.get_gym_owner_dashboard(uuid) from public;
grant execute on function public.get_gym_owner_dashboard(uuid) to authenticated, service_role;

-- ============================================================================
-- 11. RPC 6: public.owner_approve_or_renew_gym_member
-- ============================================================================
create or replace function public.owner_approve_or_renew_gym_member(
  p_business_id uuid,
  p_member_id uuid,
  p_action text,
  p_plan_id text default null,
  p_duration_days integer default null,
  p_fee_paise integer default null,
  p_staff_label text default 'Owner'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_member public.gym_members%rowtype;
  v_cfg public.gym_configs%rowtype;
  v_plan jsonb;
  v_plan_id text;
  v_plan_name text;
  v_duration_days integer;
  v_fee_paise integer;
  v_alert_days integer := 3;
  v_base_date date;
  v_new_start date;
  v_new_end date;
  v_eff_status text;
  v_days_remaining integer := 0;
begin
  if v_action not in ('approve', 'renew', 'reject', 'suspend') then
    raise exception 'Invalid gym member action.' using errcode = '22023';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  select * into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   for update;

  if not found then
    raise exception 'Gym member not found for this business.' using errcode = 'P0002';
  end if;

  select * into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;
  v_alert_days := coalesce(v_cfg.renewal_alert_days, 3);

  v_plan_id := coalesce(nullif(pg_catalog.btrim(coalesce(p_plan_id, '')), ''), v_member.plan_id);
  v_plan_name := v_member.plan_name;
  v_duration_days := coalesce(p_duration_days, v_member.duration_days, 30);
  v_fee_paise := coalesce(p_fee_paise, v_member.fee_paise, 150000);

  if p_plan_id is not null and v_cfg.plans is not null then
    for v_plan in select * from pg_catalog.jsonb_array_elements(v_cfg.plans) loop
      if pg_catalog.lower(coalesce(v_plan ->> 'id', '')) = pg_catalog.lower(v_plan_id) then
        v_plan_name := coalesce(nullif(v_plan ->> 'name', ''), v_plan_name);
        if p_duration_days is null then
          v_duration_days := greatest(1, least(1095, coalesce((v_plan ->> 'durationDays')::integer, v_duration_days)));
        end if;
        if p_fee_paise is null then
          v_fee_paise := greatest(0, least(100000000, coalesce((v_plan ->> 'pricePaise')::integer, v_fee_paise)));
        end if;
        exit;
      end if;
    end loop;
  end if;

  v_duration_days := greatest(1, least(1095, v_duration_days));
  v_fee_paise := greatest(0, least(100000000, v_fee_paise));

  if v_action = 'approve' then
    v_new_start := current_date;
    v_new_end := current_date + v_duration_days;
    update public.gym_members
       set status = 'active',
           plan_id = v_plan_id,
           plan_name = pg_catalog.substr(v_plan_name, 1, 80),
           duration_days = v_duration_days,
           fee_paise = v_fee_paise,
           start_date = v_new_start,
           end_date = v_new_end,
           approved_by_label = pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_staff_label), ''), 'Owner'), 1, 80),
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  elsif v_action = 'renew' then
    v_base_date := greatest(coalesce(v_member.end_date, current_date), current_date);
    v_new_start := coalesce(v_member.start_date, current_date);
    v_new_end := v_base_date + v_duration_days;
    update public.gym_members
       set status = 'active',
           plan_id = v_plan_id,
           plan_name = pg_catalog.substr(v_plan_name, 1, 80),
           duration_days = v_duration_days,
           fee_paise = v_fee_paise,
           start_date = v_new_start,
           end_date = v_new_end,
           approved_by_label = pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_staff_label), ''), 'Owner'), 1, 80),
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  elsif v_action = 'reject' then
    update public.gym_members
       set status = 'rejected',
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  elsif v_action = 'suspend' then
    update public.gym_members
       set status = 'suspended',
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  end if;

  if v_member.status = 'active' and v_member.end_date is not null then
    v_days_remaining := greatest(0, (v_member.end_date - current_date));
    if v_member.end_date < current_date then
      v_eff_status := 'expired';
    elsif v_days_remaining <= v_alert_days then
      v_eff_status := 'expiring_soon';
    else
      v_eff_status := 'active';
    end if;
  else
    v_eff_status := v_member.status;
    v_days_remaining := 0;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_member.id,
    'businessId', v_member.business_id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'phone', v_member.phone,
    'planId', v_member.plan_id,
    'planName', v_member.plan_name,
    'durationDays', v_member.duration_days,
    'feePaise', v_member.fee_paise,
    'status', v_member.status,
    'effectiveStatus', v_eff_status,
    'daysRemaining', v_days_remaining,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'lastCheckInDate', v_member.last_check_in_date,
    'checkedInToday', (v_member.last_check_in_date = current_date),
    'approvedByLabel', v_member.approved_by_label,
    'notes', v_member.notes,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.owner_approve_or_renew_gym_member(uuid, uuid, text, text, integer, integer, text) from public;
grant execute on function public.owner_approve_or_renew_gym_member(uuid, uuid, text, text, integer, integer, text) to authenticated, service_role;

commit;
