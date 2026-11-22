-- ============================================================================
-- ReviewAssist / BistroOS — Module 4:
--   Barber & Salon Live Queue Timer, Broadcast Delays & Loyalty Integration
-- File: supabase/migrations/014_barber_live_queue_timer.sql
--
-- Purpose:
-- 1. Expands public.businesses.category check constraint to include 'barber'
--    and public.restaurant_staff_members.role to include 'barber'.
-- 2. Creates normalized sidecar tables with ENABLE + FORCE ROW LEVEL SECURITY
--    and REVOKE ALL FROM public, anon:
--      - public.barber_queue_configs (1:1 per business)
--      - public.barber_queue_tickets (Daily live queue tokens)
-- 3. Upgrades staff PIN auth helpers so Salon/Barber shops authenticate
--    individual Barber PINs seamlessly without requiring restaurant_profiles.
-- 4. Provides hardened SECURITY DEFINER RPCs:
--      - public.get_public_barber_queue_status(p_slug)
--      - public.join_barber_queue(p_slug, p_guest_name, p_phone, p_service_name)
--      - public.barber_extend_queue_timer(p_slug, p_add_minutes, p_staff_pin_hash)
--      - public.barber_advance_queue_ticket(p_slug, p_ticket_id, p_new_status, p_staff_label, p_staff_pin_hash)
--      - public.leave_barber_queue_ticket(p_slug, p_ticket_id)
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXPAND BUSINESS CATEGORY & STAFF ROLE CONSTRAINTS TO INCLUDE 'barber'
-- ============================================================================
alter table public.businesses
  drop constraint if exists businesses_category_chk;

alter table public.businesses
  add constraint businesses_category_chk
    check (category in (
      'restaurant', 'cafe', 'hotel', 'pg',
      'salon', 'barber', 'clinic', 'gym', 'retail', 'services'
    ));

alter table public.restaurant_staff_members
  drop constraint if exists rsm_role_chk;

alter table public.restaurant_staff_members
  add constraint rsm_role_chk
    check (role in ('waiter', 'cashier', 'chef', 'manager', 'barber'));

-- ============================================================================
-- 2. TABLE: public.barber_queue_configs (1:1 per business)
-- ============================================================================
create table if not exists public.barber_queue_configs (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  is_queue_open boolean not null default true,
  avg_service_minutes integer not null default 20,
  max_queue_size integer not null default 25,
  award_star_on_completion boolean not null default true,
  services jsonb not null default '[
    {"id":"haircut","name":"Classic Haircut","durationMinutes":20,"pricePaise":20000},
    {"id":"beard","name":"Beard Trim & Styling","durationMinutes":15,"pricePaise":15000},
    {"id":"combo","name":"Haircut + Beard Combo","durationMinutes":35,"pricePaise":30000}
  ]'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bqc_avg_service_minutes_chk check (
    avg_service_minutes between 5 and 180
  ),
  constraint bqc_max_queue_size_chk check (
    max_queue_size between 1 and 200
  ),
  constraint bqc_services_is_array_chk check (
    pg_catalog.jsonb_typeof(services) = 'array'
    and pg_catalog.jsonb_array_length(services) between 1 and 30
  )
);

-- ============================================================================
-- 3. TABLE: public.barber_queue_tickets (Daily live queue tokens)
-- ============================================================================
create table if not exists public.barber_queue_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  customer_id uuid
    references public.restaurant_customers(id) on delete set null,
  queue_date date not null default current_date,
  token_number integer not null,
  guest_name text not null,
  phone text,
  service_name text not null default 'Classic Haircut',
  duration_minutes integer not null default 20,
  status text not null default 'waiting',
  extra_delay_minutes integer not null default 0,
  assigned_barber_label text,
  created_at timestamptz not null default pg_catalog.now(),
  started_at timestamptz,
  completed_at timestamptz,

  constraint bqt_unique_token_per_day unique (business_id, queue_date, token_number),
  constraint bqt_token_number_chk check (token_number >= 1),
  constraint bqt_guest_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(guest_name)) between 1 and 80
  ),
  constraint bqt_phone_len_chk check (
    phone is null or pg_catalog.char_length(pg_catalog.btrim(phone)) <= 40
  ),
  constraint bqt_service_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(service_name)) between 1 and 100
  ),
  constraint bqt_duration_minutes_chk check (
    duration_minutes between 5 and 240
  ),
  constraint bqt_status_chk check (
    status in ('waiting', 'in_chair', 'completed', 'no_show', 'cancelled')
  ),
  constraint bqt_extra_delay_chk check (
    extra_delay_minutes >= 0 and extra_delay_minutes <= 600
  ),
  constraint bqt_barber_label_len_chk check (
    assigned_barber_label is null or pg_catalog.char_length(pg_catalog.btrim(assigned_barber_label)) <= 80
  )
);

create index if not exists idx_barber_queue_tickets_biz_date_status
  on public.barber_queue_tickets (business_id, queue_date, status, token_number asc);

create index if not exists idx_barber_queue_tickets_customer
  on public.barber_queue_tickets (business_id, customer_id, created_at desc)
  where customer_id is not null;

-- ============================================================================
-- 4. GRANTS & ROW LEVEL SECURITY
-- ============================================================================
alter table public.barber_queue_configs enable row level security;
alter table public.barber_queue_configs force row level security;

alter table public.barber_queue_tickets enable row level security;
alter table public.barber_queue_tickets force row level security;

revoke all on table
  public.barber_queue_configs,
  public.barber_queue_tickets
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.barber_queue_configs,
  public.barber_queue_tickets
to authenticated;

grant all on table
  public.barber_queue_configs,
  public.barber_queue_tickets
to service_role;

drop policy if exists bqc_owner_select on public.barber_queue_configs;
create policy bqc_owner_select on public.barber_queue_configs
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists bqc_owner_insert on public.barber_queue_configs;
create policy bqc_owner_insert on public.barber_queue_configs
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists bqc_owner_update on public.barber_queue_configs;
create policy bqc_owner_update on public.barber_queue_configs
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists bqc_owner_delete on public.barber_queue_configs;
create policy bqc_owner_delete on public.barber_queue_configs
  for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists bqt_owner_select on public.barber_queue_tickets;
create policy bqt_owner_select on public.barber_queue_tickets
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists bqt_owner_insert on public.barber_queue_tickets;
create policy bqt_owner_insert on public.barber_queue_tickets
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists bqt_owner_update on public.barber_queue_tickets;
create policy bqt_owner_update on public.barber_queue_tickets
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists bqt_owner_delete on public.barber_queue_tickets;
create policy bqt_owner_delete on public.barber_queue_tickets
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 5. UPGRADE STAFF PIN AUTH HELPERS FOR SALON & BARBER BUSINESSES
--    Allow active individual staff PINs for any business that has EITHER
--    restaurant_profiles.is_enabled = true OR barber_queue_configs OR
--    category in ('salon', 'barber').
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
  v_rest_enabled boolean := false;
  v_is_queue_biz boolean := false;
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
    into v_rest_enabled, v_stored_hash
    from public.restaurant_profiles rp
   where rp.business_id = p_business_id
   limit 1;

  select (
    exists (select 1 from public.barber_queue_configs bqc where bqc.business_id = p_business_id)
    or exists (
      select 1
        from public.businesses b
       where b.id = p_business_id
         and b.category in ('salon', 'barber')
    )
  ) into v_is_queue_biz;

  if not coalesce(v_rest_enabled, false) and not coalesce(v_is_queue_biz, false) then
    return false;
  end if;

  if exists (
    select 1
      from public.restaurant_staff_members sm
     where sm.business_id = p_business_id
       and sm.is_active = true
       and sm.pin_hash = v_clean_hash
  ) then
    return true;
  end if;

  return (v_stored_hash is not null and v_stored_hash = v_clean_hash);
end;
$$;

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
    left join public.restaurant_profiles rp on rp.business_id = b.id
    left join public.barber_queue_configs bqc on bqc.business_id = b.id
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
     and (
       coalesce(rp.is_enabled, false) = true
       or bqc.business_id is not null
       or b.category in ('salon', 'barber')
     )
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
  v_has_queue boolean := false;
  v_member record;
begin
  select b.id, b.slug, b.name, b.category into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Business is not active.' using errcode = 'P0002';
  end if;

  select rp.is_enabled, rp.staff_pin_hash, rp.business_mode into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  select (
    exists (select 1 from public.barber_queue_configs bqc where bqc.business_id = v_biz.id)
    or v_biz.category in ('salon', 'barber')
  ) into v_has_queue;

  if not coalesce(v_profile.is_enabled, false) and not coalesce(v_has_queue, false) then
    raise exception 'Staff floor mode is not enabled for this business.' using errcode = '42501';
  end if;

  if v_arg2 is not null then
    v_pin_hash := v_arg2;
    if v_arg1 is not null then
      v_staff_code := pg_catalog.upper(v_arg1);
    end if;
  elsif v_arg1 is not null and pg_catalog.lower(v_arg1) ~ '^[0-9a-f]{64}$' then
    v_pin_hash := pg_catalog.lower(v_arg1);
  end if;

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

-- ============================================================================
-- 6. RPC 1: public.get_public_barber_queue_status
--    Returns shop info, queue config, current in-chair ticket, ordered waiting
--    queue with live dynamically calculated estimatedWaitMinutes, and rewards.
-- ============================================================================
create or replace function public.get_public_barber_queue_status(
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
  v_cfg record;
  v_cfg_json jsonb;
  v_default_services jsonb := '[
    {"id":"haircut","name":"Classic Haircut","durationMinutes":20,"pricePaise":20000},
    {"id":"beard","name":"Beard Trim & Styling","durationMinutes":15,"pricePaise":15000},
    {"id":"combo","name":"Haircut + Beard Combo","durationMinutes":35,"pricePaise":30000}
  ]'::jsonb;
  v_in_chair record;
  v_now_serving jsonb := null;
  v_in_chair_remaining integer := 0;
  v_running_ahead integer := 0;
  v_pos integer := 0;
  v_row record;
  v_waiting_json jsonb := '[]'::jsonb;
  v_completed_today integer := 0;
  v_rewards jsonb := '[]'::jsonb;
  v_total_wait_for_new integer := 0;
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
    from public.barber_queue_configs bqc
   where bqc.business_id = v_biz.id
   limit 1;

  if found then
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_cfg.business_id,
      'isQueueOpen', v_cfg.is_queue_open,
      'avgServiceMinutes', v_cfg.avg_service_minutes,
      'maxQueueSize', v_cfg.max_queue_size,
      'awardStarOnCompletion', v_cfg.award_star_on_completion,
      'services', v_cfg.services,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    );
  else
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'isQueueOpen', true,
      'avgServiceMinutes', 20,
      'maxQueueSize', 25,
      'awardStarOnCompletion', true,
      'services', v_default_services,
      'createdAt', pg_catalog.now(),
      'updatedAt', pg_catalog.now()
    );
  end if;

  -- Current in-chair ticket (today)
  select * into v_in_chair
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'in_chair'
   order by t.started_at asc nulls last, t.token_number asc
   limit 1;

  if found then
    v_in_chair_remaining := greatest(
      1,
      v_in_chair.duration_minutes - greatest(
        0,
        floor(extract(epoch from (pg_catalog.now() - coalesce(v_in_chair.started_at, v_in_chair.created_at))) / 60)::integer
      )
    );
    v_now_serving := pg_catalog.jsonb_build_object(
      'id', v_in_chair.id,
      'businessId', v_in_chair.business_id,
      'customerId', v_in_chair.customer_id,
      'queueDate', v_in_chair.queue_date,
      'tokenNumber', v_in_chair.token_number,
      'guestName', v_in_chair.guest_name,
      'serviceName', v_in_chair.service_name,
      'durationMinutes', v_in_chair.duration_minutes,
      'status', v_in_chair.status,
      'extraDelayMinutes', v_in_chair.extra_delay_minutes,
      'assignedBarberLabel', v_in_chair.assigned_barber_label,
      'createdAt', v_in_chair.created_at,
      'startedAt', v_in_chair.started_at,
      'completedAt', v_in_chair.completed_at,
      'estimatedWaitMinutes', 0,
      'remainingMinutes', v_in_chair_remaining
    );
  end if;

  -- Waiting tickets ordered by token_number ASC with dynamic estimated wait calculation
  for v_row in
    select *
      from public.barber_queue_tickets t
     where t.business_id = v_biz.id
       and t.queue_date = current_date
       and t.status = 'waiting'
     order by t.token_number asc
  loop
    v_pos := v_pos + 1;
    v_waiting_json := v_waiting_json || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', v_row.id,
        'businessId', v_row.business_id,
        'customerId', v_row.customer_id,
        'queueDate', v_row.queue_date,
        'tokenNumber', v_row.token_number,
        'guestName', v_row.guest_name,
        'serviceName', v_row.service_name,
        'durationMinutes', v_row.duration_minutes,
        'status', v_row.status,
        'extraDelayMinutes', v_row.extra_delay_minutes,
        'assignedBarberLabel', v_row.assigned_barber_label,
        'createdAt', v_row.created_at,
        'startedAt', v_row.started_at,
        'completedAt', v_row.completed_at,
        'position', v_pos,
        'estimatedWaitMinutes', greatest(0, v_in_chair_remaining + v_running_ahead + v_row.extra_delay_minutes)
      )
    );
    v_running_ahead := v_running_ahead + v_row.duration_minutes;
  end loop;

  v_total_wait_for_new := greatest(0, v_in_chair_remaining + v_running_ahead);

  select count(*)::integer into v_completed_today
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'completed';

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
    'nowServing', v_now_serving,
    'waitingTickets', v_waiting_json,
    'waitingCount', v_pos,
    'estimatedWaitForNewGuestMinutes', v_total_wait_for_new,
    'completedTodayCount', v_completed_today,
    'rewards', v_rewards
  );
end;
$$;

revoke all on function public.get_public_barber_queue_status(text) from public;
grant execute on function public.get_public_barber_queue_status(text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. RPC 2: public.join_barber_queue
--    Joins today's queue atomically, links/creates shared Loyalty customer
--    profile when phone is provided, assigns sequential daily token_number.
-- ============================================================================
create or replace function public.join_barber_queue(
  p_slug text,
  p_guest_name text,
  p_phone text default null,
  p_service_name text default 'Classic Haircut'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.btrim(coalesce(p_guest_name, ''));
  v_clean_phone text := nullif(pg_catalog.btrim(coalesce(p_phone, '')), '');
  v_clean_service text := coalesce(nullif(pg_catalog.btrim(coalesce(p_service_name, '')), ''), 'Classic Haircut');
  v_biz record;
  v_cfg public.barber_queue_configs%rowtype;
  v_waiting_count integer := 0;
  v_next_token integer := 1;
  v_duration integer := 20;
  v_svc jsonb;
  v_customer_id uuid := null;
  v_norm_phone text := null;
  v_in_chair record;
  v_in_chair_remaining integer := 0;
  v_ahead_duration integer := 0;
  v_est_wait integer := 0;
  v_stars_balance integer := 0;
  v_inserted public.barber_queue_tickets%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 1 or pg_catalog.char_length(v_clean_name) > 80 then
    raise exception 'Please enter your name (1 to 80 characters).' using errcode = '22023';
  end if;

  if v_clean_phone is not null and pg_catalog.char_length(v_clean_phone) > 40 then
    raise exception 'Phone number must be 40 characters or fewer.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Shop is not active.' using errcode = 'P0002';
  end if;

  -- Serialize daily token assignment per business
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('barber-queue:' || v_biz.id::text || ':' || current_date::text)
  );

  insert into public.barber_queue_configs (business_id)
  values (v_biz.id)
  on conflict (business_id) do nothing;

  select * into v_cfg
    from public.barber_queue_configs bqc
   where bqc.business_id = v_biz.id
   limit 1;

  if not v_cfg.is_queue_open then
    raise exception 'Walk-in queue is currently paused. Please check with the barber.' using errcode = '42501';
  end if;

  select count(*)::integer into v_waiting_count
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'waiting';

  if v_waiting_count >= v_cfg.max_queue_size then
    raise exception 'Walk-in queue is currently full (% people waiting). Please try again shortly.', v_cfg.max_queue_size using errcode = '42501';
  end if;

  -- Resolve canonical service duration from config.services JSONB
  v_duration := v_cfg.avg_service_minutes;
  for v_svc in select * from pg_catalog.jsonb_array_elements(v_cfg.services) loop
    if pg_catalog.lower(coalesce(v_svc ->> 'name', '')) = pg_catalog.lower(v_clean_service)
       or pg_catalog.lower(coalesce(v_svc ->> 'id', '')) = pg_catalog.lower(v_clean_service)
    then
      v_clean_service := coalesce(nullif(v_svc ->> 'name', ''), v_clean_service);
      v_duration := greatest(5, least(240, coalesce((v_svc ->> 'durationMinutes')::integer, v_cfg.avg_service_minutes)));
      exit;
    end if;
  end loop;

  -- Link or create shared Loyalty customer profile when phone is provided
  if v_clean_phone is not null then
    v_norm_phone := pg_catalog.lower(v_clean_phone);
    select c.id into v_customer_id
      from public.restaurant_customers c
     where c.phone_or_email = v_norm_phone
     limit 1;

    if v_customer_id is null then
      insert into public.restaurant_customers (display_name, phone_or_email)
      values (pg_catalog.substr(v_clean_name, 1, 80), v_norm_phone)
      returning id into v_customer_id;
    end if;

    select coalesce(st.balance_after, 0) into v_stars_balance
      from public.restaurant_loyalty_star_transactions st
     where st.business_id = v_biz.id
       and st.customer_id = v_customer_id
     order by st.created_at desc
     limit 1;
    v_stars_balance := coalesce(v_stars_balance, 0);
  end if;

  -- Compute current wait ahead of this new ticket
  select * into v_in_chair
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'in_chair'
   order by t.started_at asc nulls last, t.token_number asc
   limit 1;

  if found then
    v_in_chair_remaining := greatest(
      1,
      v_in_chair.duration_minutes - greatest(
        0,
        floor(extract(epoch from (pg_catalog.now() - coalesce(v_in_chair.started_at, v_in_chair.created_at))) / 60)::integer
      )
    );
  end if;

  select coalesce(sum(t.duration_minutes), 0)::integer into v_ahead_duration
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'waiting';

  v_est_wait := greatest(0, v_in_chair_remaining + v_ahead_duration);

  select coalesce(max(t.token_number), 0) + 1 into v_next_token
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date;

  insert into public.barber_queue_tickets (
    business_id,
    customer_id,
    queue_date,
    token_number,
    guest_name,
    phone,
    service_name,
    duration_minutes,
    status,
    extra_delay_minutes
  )
  values (
    v_biz.id,
    v_customer_id,
    current_date,
    v_next_token,
    pg_catalog.substr(v_clean_name, 1, 80),
    v_clean_phone,
    pg_catalog.substr(v_clean_service, 1, 100),
    v_duration,
    'waiting',
    0
  )
  returning * into v_inserted;

  return pg_catalog.jsonb_build_object(
    'ticket', pg_catalog.jsonb_build_object(
      'id', v_inserted.id,
      'businessId', v_inserted.business_id,
      'customerId', v_inserted.customer_id,
      'queueDate', v_inserted.queue_date,
      'tokenNumber', v_inserted.token_number,
      'guestName', v_inserted.guest_name,
      'phone', v_inserted.phone,
      'serviceName', v_inserted.service_name,
      'durationMinutes', v_inserted.duration_minutes,
      'status', v_inserted.status,
      'extraDelayMinutes', v_inserted.extra_delay_minutes,
      'assignedBarberLabel', v_inserted.assigned_barber_label,
      'createdAt', v_inserted.created_at,
      'startedAt', v_inserted.started_at,
      'completedAt', v_inserted.completed_at,
      'position', v_waiting_count + 1,
      'estimatedWaitMinutes', v_est_wait
    ),
    'estimatedWaitMinutes', v_est_wait,
    'position', v_waiting_count + 1,
    'loyaltyStarsBalance', v_stars_balance
  );
end;
$$;

revoke all on function public.join_barber_queue(text, text, text, text) from public;
grant execute on function public.join_barber_queue(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC 3: public.barber_extend_queue_timer
--    Broadcasts +5 / +10 / +15 / +20 / +30 mins delay to all today's waiting tickets.
-- ============================================================================
create or replace function public.barber_extend_queue_timer(
  p_slug text,
  p_add_minutes integer,
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
  v_biz record;
  v_updated_count integer := 0;
  v_staff_label text;
begin
  if p_add_minutes is null or p_add_minutes not in (5, 10, 15, 20, 30) then
    raise exception 'Extension minutes must be one of: 5, 10, 15, 20, 30.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Shop not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Barber PIN or owner session required.' using errcode = '42501';
  end if;

  v_staff_label := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, 'Owner');

  update public.barber_queue_tickets
     set extra_delay_minutes = least(600, extra_delay_minutes + p_add_minutes)
   where business_id = v_biz.id
     and queue_date = current_date
     and status = 'waiting';

  get diagnostics v_updated_count = row_count;

  return pg_catalog.jsonb_build_object(
    'updatedCount', v_updated_count,
    'addedMinutes', p_add_minutes,
    'staffLabel', v_staff_label,
    'updatedAt', pg_catalog.clock_timestamp()
  );
end;
$$;

revoke all on function public.barber_extend_queue_timer(text, integer, text) from public;
grant execute on function public.barber_extend_queue_timer(text, integer, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. RPC 4: public.barber_advance_queue_ticket
--    Moves ticket waiting -> in_chair -> completed (or no_show / cancelled).
--    When completed with award_star_on_completion = true & customer_id != null,
--    atomically & idempotently credits Loyalty Stars into the shared ledger!
-- ============================================================================
create or replace function public.barber_advance_queue_ticket(
  p_slug text,
  p_ticket_id uuid,
  p_new_status text,
  p_staff_label text default 'Barber',
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
  v_resolved_label text;
  v_cfg record;
  v_ticket public.barber_queue_tickets%rowtype;
  v_idem_key text;
  v_existing_tx public.restaurant_loyalty_star_transactions%rowtype;
  v_stars_per_visit integer := 1;
  v_current_stars integer := 0;
  v_new_stars integer := 0;
  v_star_awarded boolean := false;
  v_stars_awarded integer := 0;
  v_already_awarded boolean := false;
  v_award_enabled boolean := true;
begin
  if v_clean_status not in ('waiting', 'in_chair', 'completed', 'no_show', 'cancelled') then
    raise exception 'Invalid queue ticket status.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Shop not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Barber PIN or owner session required.' using errcode = '42501';
  end if;

  v_resolved_label := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, p_staff_label);

  select * into v_ticket
    from public.barber_queue_tickets t
   where t.id = p_ticket_id
     and t.business_id = v_biz.id
   for update;

  if not found then
    raise exception 'Queue ticket not found for this shop.' using errcode = 'P0002';
  end if;

  update public.barber_queue_tickets
     set status = v_clean_status,
         assigned_barber_label = case
           when v_clean_status in ('in_chair', 'completed')
             then pg_catalog.substr(v_resolved_label, 1, 80)
           else assigned_barber_label
         end,
         started_at = case
           when v_clean_status = 'in_chair' then coalesce(started_at, pg_catalog.clock_timestamp())
           else started_at
         end,
         completed_at = case
           when v_clean_status = 'completed' then coalesce(completed_at, pg_catalog.clock_timestamp())
           else completed_at
         end
   where id = v_ticket.id
   returning * into v_ticket;

  if v_clean_status = 'completed' and v_ticket.customer_id is not null then
    select bqc.award_star_on_completion into v_cfg
      from public.barber_queue_configs bqc
     where bqc.business_id = v_biz.id
     limit 1;

    v_award_enabled := coalesce(v_cfg.award_star_on_completion, true);

    if v_award_enabled then
      v_idem_key := 'barber-ticket-' || v_ticket.id::text;

      select * into v_existing_tx
        from public.restaurant_loyalty_star_transactions st
       where st.business_id = v_biz.id
         and st.idempotency_key = v_idem_key
       limit 1;

      if found then
        v_already_awarded := true;
        v_stars_awarded := v_existing_tx.stars_delta;
        select coalesce(st.balance_after, v_existing_tx.balance_after) into v_new_stars
          from public.restaurant_loyalty_star_transactions st
         where st.business_id = v_biz.id
           and st.customer_id = v_ticket.customer_id
         order by st.created_at desc
         limit 1;
      else
        select coalesce(lr.stars_per_verified_visit, 1) into v_stars_per_visit
          from public.restaurant_loyalty_rules lr
         where lr.business_id = v_biz.id
         limit 1;
        v_stars_per_visit := coalesce(v_stars_per_visit, 1);

        select coalesce(st.balance_after, 0) into v_current_stars
          from public.restaurant_loyalty_star_transactions st
         where st.business_id = v_biz.id
           and st.customer_id = v_ticket.customer_id
         order by st.created_at desc
         limit 1;
        v_current_stars := coalesce(v_current_stars, 0);
        v_new_stars := v_current_stars + v_stars_per_visit;

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
          null,
          v_ticket.customer_id,
          v_stars_per_visit,
          pg_catalog.substr(v_resolved_label, 1, 80),
          v_idem_key
        )
        on conflict (business_id, idempotency_key) do nothing;

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
          v_ticket.customer_id,
          'verified_visit',
          v_stars_per_visit,
          v_new_stars,
          v_idem_key,
          pg_catalog.substr(v_resolved_label, 1, 80),
          pg_catalog.jsonb_build_object(
            'source', 'barber_queue_completion',
            'ticketId', v_ticket.id,
            'tokenNumber', v_ticket.token_number,
            'serviceName', v_ticket.service_name
          )
        );

        v_star_awarded := true;
        v_stars_awarded := v_stars_per_visit;
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'ticket', pg_catalog.jsonb_build_object(
      'id', v_ticket.id,
      'businessId', v_ticket.business_id,
      'customerId', v_ticket.customer_id,
      'queueDate', v_ticket.queue_date,
      'tokenNumber', v_ticket.token_number,
      'guestName', v_ticket.guest_name,
      'phone', v_ticket.phone,
      'serviceName', v_ticket.service_name,
      'durationMinutes', v_ticket.duration_minutes,
      'status', v_ticket.status,
      'extraDelayMinutes', v_ticket.extra_delay_minutes,
      'assignedBarberLabel', v_ticket.assigned_barber_label,
      'createdAt', v_ticket.created_at,
      'startedAt', v_ticket.started_at,
      'completedAt', v_ticket.completed_at
    ),
    'starAwarded', v_star_awarded,
    'starsAwarded', v_stars_awarded,
    'newLoyaltyStarsBalance', v_new_stars,
    'alreadyAwarded', v_already_awarded
  );
end;
$$;

revoke all on function public.barber_advance_queue_ticket(text, uuid, text, text, text) from public;
grant execute on function public.barber_advance_queue_ticket(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. RPC 5: public.leave_barber_queue_ticket
--     Lets a waiting guest voluntarily leave the queue from their countdown pass.
-- ============================================================================
create or replace function public.leave_barber_queue_ticket(
  p_slug text,
  p_ticket_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_updated public.barber_queue_tickets%rowtype;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Shop not found.' using errcode = 'P0002';
  end if;

  update public.barber_queue_tickets
     set status = 'cancelled'
   where id = p_ticket_id
     and business_id = v_biz.id
     and queue_date = current_date
     and status = 'waiting'
   returning * into v_updated;

  if not found then
    raise exception 'Waiting ticket not found or already in chair.' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'status', v_updated.status,
    'tokenNumber', v_updated.token_number
  );
end;
$$;

revoke all on function public.leave_barber_queue_ticket(text, uuid) from public;
grant execute on function public.leave_barber_queue_ticket(text, uuid) to anon, authenticated, service_role;

commit;
