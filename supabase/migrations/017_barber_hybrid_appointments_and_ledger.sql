-- ============================================================================
-- Vitaran AI Reviews / BarberOS — Upgrade:
--   1. Daily #1 Token Reset (W-01, W-02... & B-01, B-02... per queue_date)
--   2. Fair Hybrid Queue: Offline Walk-Ins + Online/Phone Time-Slot Appointments
--   3. Daily & Monthly Haircut & Service Revenue Ledger
--
-- Migration: 017_barber_hybrid_appointments_and_ledger.sql
-- Depends on: 014_barber_live_queue_timer.sql
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.barber_queue_tickets WITH HYBRID BOOKING & PRICE SNAPSHOT
-- ============================================================================
alter table public.barber_queue_tickets
  add column if not exists booking_type text not null default 'walk_in',
  add column if not exists display_code text,
  add column if not exists scheduled_time text,
  add column if not exists scheduled_at timestamptz not null default now(),
  add column if not exists price_paise integer not null default 0;

alter table public.barber_queue_tickets
  drop constraint if exists bqt_booking_type_chk,
  drop constraint if exists bqt_scheduled_time_chk,
  drop constraint if exists bqt_price_paise_chk;

alter table public.barber_queue_tickets
  add constraint bqt_booking_type_chk
    check (booking_type in ('walk_in', 'appointment')),
  add constraint bqt_scheduled_time_chk
    check (
      scheduled_time is null
      or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
  add constraint bqt_price_paise_chk
    check (price_paise >= 0 and price_paise <= 100000000);

-- Backfill display_code & scheduled_at for any pre-existing rows safely
update public.barber_queue_tickets
   set display_code = case
         when booking_type = 'appointment'
           then 'B-' || pg_catalog.lpad(token_number::text, 2, '0')
         else 'W-' || pg_catalog.lpad(token_number::text, 2, '0')
       end,
       scheduled_at = coalesce(scheduled_at, created_at)
 where display_code is null;

create index if not exists idx_barber_tickets_biz_date_sched
  on public.barber_queue_tickets (business_id, queue_date, status, scheduled_at asc, token_number asc);

create index if not exists idx_barber_tickets_biz_completed_date
  on public.barber_queue_tickets (business_id, status, queue_date desc);

-- ============================================================================
-- 2. UPGRADE RPC 1: public.get_public_barber_queue_status(p_slug)
--    Fair Chronological Merge of Walk-Ins (W-XX) + Reserved Appointments (B-XX)
--    with accurate slot-aware wait times & bookedSlotsToday list.
-- ============================================================================
create or replace function public.get_public_barber_queue_status(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_cfg public.barber_queue_configs%rowtype;
  v_default_services jsonb := '[
    {"id":"haircut","name":"Classic Haircut","durationMinutes":20,"pricePaise":20000},
    {"id":"beard","name":"Beard Trim & Styling","durationMinutes":15,"pricePaise":15000},
    {"id":"combo","name":"Haircut + Beard Combo","durationMinutes":35,"pricePaise":30000}
  ]'::jsonb;
  v_cfg_json jsonb;
  v_in_chair public.barber_queue_tickets%rowtype;
  v_now_serving jsonb := null;
  v_in_chair_remaining integer := 0;
  v_cursor integer := 0;
  v_pos integer := 0;
  v_walkins public.barber_queue_tickets[];
  v_appts public.barber_queue_tickets[];
  v_w_idx integer := 1;
  v_a_idx integer := 1;
  v_w_len integer := 0;
  v_a_len integer := 0;
  v_w public.barber_queue_tickets;
  v_a public.barber_queue_tickets;
  v_appt_offset integer;
  v_appt_start integer;
  v_waiting_json jsonb := '[]'::jsonb;
  v_booked_slots jsonb := '[]'::jsonb;
  v_completed_today integer := 0;
  v_rewards jsonb := '[]'::jsonb;
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
      'bookingType', v_in_chair.booking_type,
      'displayCode', coalesce(v_in_chair.display_code, case when v_in_chair.booking_type = 'appointment' then 'B-' else 'W-' end || pg_catalog.lpad(v_in_chair.token_number::text, 2, '0')),
      'scheduledTime', v_in_chair.scheduled_time,
      'scheduledAt', v_in_chair.scheduled_at,
      'pricePaise', v_in_chair.price_paise,
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

  -- Load waiting walk-ins (FIFO) and waiting appointments (chronological)
  select coalesce(array_agg(t order by t.token_number asc), array[]::public.barber_queue_tickets[])
    into v_walkins
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'waiting'
     and t.booking_type = 'walk_in';

  select coalesce(array_agg(t order by t.scheduled_at asc, t.token_number asc), array[]::public.barber_queue_tickets[])
    into v_appts
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.status = 'waiting'
     and t.booking_type = 'appointment';

  v_w_len := coalesce(array_length(v_walkins, 1), 0);
  v_a_len := coalesce(array_length(v_appts, 1), 0);
  v_cursor := v_in_chair_remaining;

  -- Fair Slot-Weaving Merge Algorithm:
  -- Walk-ins fill open gaps before reserved appointments; if a walk-in would collide
  -- with an upcoming appointment slot, the appointment is reserved first so wait times
  -- stay 100% honest and nobody gets unfairly bumped.
  while v_w_idx <= v_w_len or v_a_idx <= v_a_len loop
    if v_a_idx <= v_a_len then
      v_a := v_appts[v_a_idx];
      v_appt_offset := greatest(
        0,
        round(extract(epoch from (v_a.scheduled_at - pg_catalog.now())) / 60.0)::integer
      );
    end if;

    if v_w_idx <= v_w_len and (
      v_a_idx > v_a_len
      or (v_cursor + v_walkins[v_w_idx].duration_minutes) <= v_appt_offset
    ) then
      v_w := v_walkins[v_w_idx];
      v_pos := v_pos + 1;
      v_waiting_json := v_waiting_json || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', v_w.id,
          'businessId', v_w.business_id,
          'customerId', v_w.customer_id,
          'queueDate', v_w.queue_date,
          'tokenNumber', v_w.token_number,
          'bookingType', v_w.booking_type,
          'displayCode', coalesce(v_w.display_code, 'W-' || pg_catalog.lpad(v_w.token_number::text, 2, '0')),
          'scheduledTime', v_w.scheduled_time,
          'scheduledAt', v_w.scheduled_at,
          'pricePaise', v_w.price_paise,
          'guestName', v_w.guest_name,
          'serviceName', v_w.service_name,
          'durationMinutes', v_w.duration_minutes,
          'status', v_w.status,
          'extraDelayMinutes', v_w.extra_delay_minutes,
          'assignedBarberLabel', v_w.assigned_barber_label,
          'createdAt', v_w.created_at,
          'startedAt', v_w.started_at,
          'completedAt', v_w.completed_at,
          'position', v_pos,
          'estimatedWaitMinutes', greatest(0, v_cursor + v_w.extra_delay_minutes)
        )
      );
      v_cursor := v_cursor + v_w.duration_minutes;
      v_w_idx := v_w_idx + 1;
    else
      v_a := v_appts[v_a_idx];
      v_appt_start := greatest(v_cursor, v_appt_offset);
      v_pos := v_pos + 1;
      v_waiting_json := v_waiting_json || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', v_a.id,
          'businessId', v_a.business_id,
          'customerId', v_a.customer_id,
          'queueDate', v_a.queue_date,
          'tokenNumber', v_a.token_number,
          'bookingType', v_a.booking_type,
          'displayCode', coalesce(v_a.display_code, 'B-' || pg_catalog.lpad(v_a.token_number::text, 2, '0')),
          'scheduledTime', v_a.scheduled_time,
          'scheduledAt', v_a.scheduled_at,
          'pricePaise', v_a.price_paise,
          'guestName', v_a.guest_name,
          'serviceName', v_a.service_name,
          'durationMinutes', v_a.duration_minutes,
          'status', v_a.status,
          'extraDelayMinutes', v_a.extra_delay_minutes,
          'assignedBarberLabel', v_a.assigned_barber_label,
          'createdAt', v_a.created_at,
          'startedAt', v_a.started_at,
          'completedAt', v_a.completed_at,
          'position', v_pos,
          'estimatedWaitMinutes', greatest(0, v_appt_start + v_a.extra_delay_minutes)
        )
      );
      v_cursor := v_appt_start + v_a.duration_minutes;
      v_a_idx := v_a_idx + 1;
    end if;
  end loop;

  -- Active booked time slots today (to prevent double-booking on public picker)
  select coalesce(pg_catalog.jsonb_agg(distinct t.scheduled_time order by t.scheduled_time asc), '[]'::jsonb)
    into v_booked_slots
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.booking_type = 'appointment'
     and t.scheduled_time is not null
     and t.status in ('waiting', 'in_chair');

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
    'estimatedWaitForNewGuestMinutes', greatest(0, v_cursor),
    'completedTodayCount', v_completed_today,
    'bookedSlotsToday', v_booked_slots,
    'rewards', v_rewards
  );
end;
$$;

revoke all on function public.get_public_barber_queue_status(text) from public;
grant execute on function public.get_public_barber_queue_status(text) to anon, authenticated, service_role;

-- ============================================================================
-- 3. UPGRADE RPC 2: public.join_barber_queue (6 params w/ defaults)
--    Drop old 4-arg signature first to avoid PostgREST overload ambiguity.
-- ============================================================================
drop function if exists public.join_barber_queue(text, text, text, text);

create or replace function public.join_barber_queue(
  p_slug text,
  p_guest_name text,
  p_phone text default null,
  p_service_name text default 'Classic Haircut',
  p_booking_type text default 'walk_in',
  p_scheduled_time text default null
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
  v_booking_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_booking_type, 'walk_in')));
  v_sched_time text := nullif(pg_catalog.btrim(coalesce(p_scheduled_time, '')), '');
  v_sched_at timestamptz := pg_catalog.now();
  v_biz record;
  v_cfg public.barber_queue_configs%rowtype;
  v_waiting_count integer := 0;
  v_next_token integer := 1;
  v_type_seq integer := 1;
  v_display_code text;
  v_duration integer := 20;
  v_price_paise integer := 20000;
  v_svc jsonb;
  v_customer_id uuid := null;
  v_norm_phone text := null;
  v_stars_balance integer := 0;
  v_inserted public.barber_queue_tickets%rowtype;
  v_snapshot jsonb;
  v_matched_ticket jsonb;
  v_est_wait integer := 0;
  v_position integer := 1;
begin
  if pg_catalog.char_length(v_clean_name) < 1 or pg_catalog.char_length(v_clean_name) > 80 then
    raise exception 'Please enter your name (1 to 80 characters).' using errcode = '22023';
  end if;

  if v_clean_phone is not null and pg_catalog.char_length(v_clean_phone) > 40 then
    raise exception 'Phone number must be 40 characters or fewer.' using errcode = '22023';
  end if;

  if v_booking_type not in ('walk_in', 'appointment') then
    raise exception 'Booking type must be walk_in or appointment.' using errcode = '22023';
  end if;

  if v_booking_type = 'appointment' then
    if v_sched_time is null or v_sched_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Please select a valid appointment time slot (HH:MM).' using errcode = '22023';
    end if;
    v_sched_at := (current_date + v_sched_time::time)::timestamptz;
  else
    v_sched_time := null;
    v_sched_at := pg_catalog.now();
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

  -- Serialize daily token assignment per business per day
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

  -- Prevent double-booking the exact same 15-minute appointment slot today
  if v_booking_type = 'appointment' then
    if exists (
      select 1
        from public.barber_queue_tickets t
       where t.business_id = v_biz.id
         and t.queue_date = current_date
         and t.booking_type = 'appointment'
         and t.status in ('waiting', 'in_chair')
         and abs(extract(epoch from (t.scheduled_at - v_sched_at))) < 900
    ) then
      raise exception 'That time slot (%) is already reserved. Please pick another available slot.', v_sched_time using errcode = '23505';
    end if;
  end if;

  -- Resolve canonical service duration & price snapshot from config.services JSONB
  v_duration := v_cfg.avg_service_minutes;
  v_price_paise := 20000;
  for v_svc in select * from pg_catalog.jsonb_array_elements(v_cfg.services) loop
    if pg_catalog.lower(coalesce(v_svc ->> 'name', '')) = pg_catalog.lower(v_clean_service)
       or pg_catalog.lower(coalesce(v_svc ->> 'id', '')) = pg_catalog.lower(v_clean_service)
    then
      v_clean_service := coalesce(nullif(v_svc ->> 'name', ''), v_clean_service);
      v_duration := greatest(5, least(240, coalesce((v_svc ->> 'durationMinutes')::integer, v_cfg.avg_service_minutes)));
      v_price_paise := greatest(0, least(100000000, coalesce((v_svc ->> 'pricePaise')::integer, 20000)));
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

  -- Daily #1 Reset: sequential token per business per queue_date
  select coalesce(max(t.token_number), 0) + 1 into v_next_token
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date;

  -- Per-type daily display code (W-01, W-02... vs B-01, B-02...)
  select count(*)::integer + 1 into v_type_seq
    from public.barber_queue_tickets t
   where t.business_id = v_biz.id
     and t.queue_date = current_date
     and t.booking_type = v_booking_type;

  v_display_code := (case when v_booking_type = 'appointment' then 'B-' else 'W-' end)
    || pg_catalog.lpad(v_type_seq::text, 2, '0');

  insert into public.barber_queue_tickets (
    business_id,
    customer_id,
    queue_date,
    token_number,
    booking_type,
    display_code,
    scheduled_time,
    scheduled_at,
    price_paise,
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
    v_booking_type,
    v_display_code,
    v_sched_time,
    v_sched_at,
    v_price_paise,
    pg_catalog.substr(v_clean_name, 1, 80),
    v_clean_phone,
    pg_catalog.substr(v_clean_service, 1, 100),
    v_duration,
    'waiting',
    0
  )
  returning * into v_inserted;

  -- Compute exact slot-merged position & estimated wait from canonical status RPC
  v_snapshot := public.get_public_barber_queue_status(v_clean_slug);
  select elem into v_matched_ticket
    from pg_catalog.jsonb_array_elements(coalesce(v_snapshot -> 'waitingTickets', '[]'::jsonb)) elem
   where elem ->> 'id' = v_inserted.id::text
   limit 1;

  v_est_wait := coalesce((v_matched_ticket ->> 'estimatedWaitMinutes')::integer, 0);
  v_position := coalesce((v_matched_ticket ->> 'position')::integer, v_waiting_count + 1);

  return pg_catalog.jsonb_build_object(
    'ticket', pg_catalog.jsonb_build_object(
      'id', v_inserted.id,
      'businessId', v_inserted.business_id,
      'customerId', v_inserted.customer_id,
      'queueDate', v_inserted.queue_date,
      'tokenNumber', v_inserted.token_number,
      'bookingType', v_inserted.booking_type,
      'displayCode', v_inserted.display_code,
      'scheduledTime', v_inserted.scheduled_time,
      'scheduledAt', v_inserted.scheduled_at,
      'pricePaise', v_inserted.price_paise,
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
      'position', v_position,
      'estimatedWaitMinutes', v_est_wait
    ),
    'estimatedWaitMinutes', v_est_wait,
    'position', v_position,
    'loyaltyStarsBalance', v_stars_balance
  );
end;
$$;

revoke all on function public.join_barber_queue(text, text, text, text, text, text) from public;
grant execute on function public.join_barber_queue(text, text, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 4. NEW RPC: public.get_barber_revenue_and_service_summary(p_business_id, p_month_key)
--    Returns Today vs. This Month haircut counts, total ₹ revenue,
--    walk-ins vs. appointments split, and per-service breakdown.
-- ============================================================================
create or replace function public.get_barber_revenue_and_service_summary(
  p_business_id uuid,
  p_month_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_month_key text := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_month_key, '')), ''),
    pg_catalog.to_char(current_date, 'YYYY-MM')
  );
  v_today_cuts integer := 0;
  v_today_rev integer := 0;
  v_today_walkins integer := 0;
  v_today_appts integer := 0;
  v_month_cuts integer := 0;
  v_month_rev integer := 0;
  v_month_walkins integer := 0;
  v_month_appts integer := 0;
  v_breakdown jsonb := '[]'::jsonb;
begin
  if v_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid month key format (expected YYYY-MM).' using errcode = '22023';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for barber revenue ledger.' using errcode = '42501';
  end if;

  select
    count(*) filter (where t.queue_date = current_date)::integer,
    coalesce(sum(t.price_paise) filter (where t.queue_date = current_date), 0)::integer,
    count(*) filter (where t.queue_date = current_date and t.booking_type = 'walk_in')::integer,
    count(*) filter (where t.queue_date = current_date and t.booking_type = 'appointment')::integer,
    count(*) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key)::integer,
    coalesce(sum(t.price_paise) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key), 0)::integer,
    count(*) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key and t.booking_type = 'walk_in')::integer,
    count(*) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key and t.booking_type = 'appointment')::integer
  into
    v_today_cuts,
    v_today_rev,
    v_today_walkins,
    v_today_appts,
    v_month_cuts,
    v_month_rev,
    v_month_walkins,
    v_month_appts
  from public.barber_queue_tickets t
  where t.business_id = v_biz.id
    and t.status = 'completed'
    and (
      pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key
      or t.queue_date = current_date
    );

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'serviceName', s.service_name,
        'countToday', s.count_today,
        'revenueTodayPaise', s.rev_today,
        'countMonth', s.count_month,
        'revenueMonthPaise', s.rev_month
      )
      order by s.rev_month desc, s.count_month desc, s.service_name asc
    ),
    '[]'::jsonb
  )
    into v_breakdown
    from (
      select
        t.service_name,
        count(*) filter (where t.queue_date = current_date)::integer as count_today,
        coalesce(sum(t.price_paise) filter (where t.queue_date = current_date), 0)::integer as rev_today,
        count(*) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key)::integer as count_month,
        coalesce(sum(t.price_paise) filter (where pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key), 0)::integer as rev_month
      from public.barber_queue_tickets t
      where t.business_id = v_biz.id
        and t.status = 'completed'
        and (
          pg_catalog.to_char(t.queue_date, 'YYYY-MM') = v_month_key
          or t.queue_date = current_date
        )
      group by t.service_name
    ) s;

  return pg_catalog.jsonb_build_object(
    'businessId', v_biz.id,
    'monthKey', v_month_key,
    'todayDate', current_date,
    'todayTotalCuts', v_today_cuts,
    'todayRevenuePaise', v_today_rev,
    'todayWalkIns', v_today_walkins,
    'todayAppointments', v_today_appts,
    'monthTotalCuts', v_month_cuts,
    'monthRevenuePaise', v_month_rev,
    'monthWalkIns', v_month_walkins,
    'monthAppointments', v_month_appts,
    'serviceBreakdown', v_breakdown
  );
end;
$$;

revoke all on function public.get_barber_revenue_and_service_summary(uuid, text) from public;
grant execute on function public.get_barber_revenue_and_service_summary(uuid, text) to authenticated, service_role;

commit;
