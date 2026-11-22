-- ============================================================================
-- Vitaran AI Reviews / GymOS — Module 5B Upgrade:
-- Daily QR Attendance Logs, Fitness Targets, Workout Split Tracking,
-- Trainer Progress History & Monthly Revenue Forecasting
-- Migration: 018_gym_attendance_goals_and_revenue.sql
-- Depends on: 001..015
--
-- Summary of Changes:
-- 1. Extends public.gym_members with fitness_goal, starting_weight_kg,
--    target_weight_kg, trainer_notes, and last_check_in_at.
-- 2. Extends public.gym_check_ins with workout_focus and member_note
--    (retaining 1 auditable row per member per calendar day with same-day
--    workout focus updates).
-- 3. Creates public.gym_payment_logs (FORCE RLS, owner-only) to accurately
--    log cash/UPI approvals & renewals for monthly revenue analytics, with
--    idempotent backfill for existing active members.
-- 4. Upgrades RPCs (dropping old signatures first to avoid PostgREST
--    overload ambiguity):
--      - public.submit_gym_member_registration (7 params w/ defaults)
--      - public.lookup_gym_member_pass (enriched with goal, monthly count,
--        today's log & recent 14-day attendance logs)
--      - public.gym_member_daily_check_in (4 params w/ workout_focus & note)
--      - public.owner_approve_or_renew_gym_member (logs payment revenue)
--      - public.get_gym_owner_dashboard (2 params w/ p_month_key, live
--        todaysAttendance feed, monthlyRevenuePaise,
--        projectedNextMonthRevenuePaise & inactiveAlertMembers >= 5d)
-- 5. Adds 2 new hardened owner RPCs:
--      - public.get_gym_member_progress_history(p_business_id, p_member_id, p_month_key)
--      - public.owner_update_gym_member_profile(p_business_id, p_member_id, ...)
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.gym_members (Fitness Goals, Weight Targets, Trainer Notes)
-- ============================================================================
alter table public.gym_members
  add column if not exists fitness_goal text not null default 'general_fitness',
  add column if not exists starting_weight_kg numeric(5,1),
  add column if not exists target_weight_kg numeric(5,1),
  add column if not exists trainer_notes text,
  add column if not exists last_check_in_at timestamptz;

alter table public.gym_members
  drop constraint if exists gym_members_fitness_goal_chk;

alter table public.gym_members
  add constraint gym_members_fitness_goal_chk
    check (
      fitness_goal in (
        'weight_loss',
        'muscle_gain',
        'weight_gain',
        'cardio_endurance',
        'general_fitness'
      )
    );

alter table public.gym_members
  drop constraint if exists gym_members_weights_chk;

alter table public.gym_members
  add constraint gym_members_weights_chk
    check (
      (starting_weight_kg is null or (starting_weight_kg >= 20 and starting_weight_kg <= 300))
      and (target_weight_kg is null or (target_weight_kg >= 20 and target_weight_kg <= 300))
    );

alter table public.gym_members
  drop constraint if exists gym_members_trainer_notes_len_chk;

alter table public.gym_members
  add constraint gym_members_trainer_notes_len_chk
    check (trainer_notes is null or pg_catalog.char_length(trainer_notes) <= 1000);

-- Backfill last_check_in_at from existing gym_check_ins if present
update public.gym_members m
   set last_check_in_at = sub.max_ts
  from (
    select c.member_id, max(c.checked_in_at) as max_ts
      from public.gym_check_ins c
     group by c.member_id
  ) sub
 where m.id = sub.member_id
   and m.last_check_in_at is null;

-- ============================================================================
-- 2. EXTEND public.gym_check_ins (Workout Focus & Member Note per Daily Scan)
-- ============================================================================
alter table public.gym_check_ins
  add column if not exists workout_focus text not null default 'full_body',
  add column if not exists member_note text;

alter table public.gym_check_ins
  drop constraint if exists gym_check_ins_workout_focus_chk;

alter table public.gym_check_ins
  add constraint gym_check_ins_workout_focus_chk
    check (
      workout_focus in (
        'chest',
        'back',
        'legs',
        'shoulders_arms',
        'cardio_hiit',
        'abs_core',
        'full_body'
      )
    );

alter table public.gym_check_ins
  drop constraint if exists gym_check_ins_member_note_len_chk;

alter table public.gym_check_ins
  add constraint gym_check_ins_member_note_len_chk
    check (member_note is null or pg_catalog.char_length(member_note) <= 280);

create index if not exists idx_gym_check_ins_member_date
  on public.gym_check_ins (member_id, check_in_date desc, checked_in_at desc);

-- ============================================================================
-- 3. NEW TABLE: public.gym_payment_logs (Auditable Monthly Revenue Ledger)
-- ============================================================================
create table if not exists public.gym_payment_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  payment_type text not null check (payment_type in ('approval', 'renewal')),
  plan_id text not null,
  plan_name text not null,
  duration_days integer not null check (duration_days between 1 and 1095),
  amount_paise integer not null check (amount_paise >= 0 and amount_paise <= 100000000),
  paid_date date not null default current_date,
  recorded_by_label text not null default 'Owner',
  created_at timestamptz not null default now()
);

create index if not exists idx_gym_payment_logs_biz_date
  on public.gym_payment_logs (business_id, paid_date desc, created_at desc);

alter table public.gym_payment_logs enable row level security;
alter table public.gym_payment_logs force row level security;

revoke all on table public.gym_payment_logs from public, anon, authenticated;
grant select, insert on table public.gym_payment_logs to authenticated;
grant all on table public.gym_payment_logs to service_role;

drop policy if exists "gym_payment_logs_owner_select" on public.gym_payment_logs;
create policy "gym_payment_logs_owner_select"
  on public.gym_payment_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_payment_logs.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_payment_logs_owner_insert" on public.gym_payment_logs;
create policy "gym_payment_logs_owner_insert"
  on public.gym_payment_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_payment_logs.business_id
        and b.owner_id = auth.uid()
    )
  );

-- Idempotent backfill: record initial payment log for already-approved members
insert into public.gym_payment_logs (
  business_id,
  member_id,
  payment_type,
  plan_id,
  plan_name,
  duration_days,
  amount_paise,
  paid_date,
  recorded_by_label
)
select
  m.business_id,
  m.id,
  'approval',
  m.plan_id,
  m.plan_name,
  m.duration_days,
  m.fee_paise,
  coalesce(m.start_date, m.created_at::date),
  coalesce(m.approved_by_label, 'Owner')
from public.gym_members m
where m.start_date is not null
  and m.status in ('active', 'expired')
  and not exists (
    select 1 from public.gym_payment_logs p
    where p.member_id = m.id
  );

-- ============================================================================
-- 4. UPGRADE RPC 1: public.submit_gym_member_registration (7 params w/ defaults)
--    Drop old 4-arg signature first to avoid PostgREST overload ambiguity.
-- ============================================================================
drop function if exists public.submit_gym_member_registration(text, text, text, text);

create or replace function public.submit_gym_member_registration(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_plan_id text default '1_month',
  p_fitness_goal text default 'general_fitness',
  p_starting_weight_kg numeric default null,
  p_target_weight_kg numeric default null
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
  v_clean_goal text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_fitness_goal, 'general_fitness')));
  v_start_wt numeric(5,1) := null;
  v_target_wt numeric(5,1) := null;
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

  if v_clean_goal not in ('weight_loss', 'muscle_gain', 'weight_gain', 'cardio_endurance', 'general_fitness') then
    v_clean_goal := 'general_fitness';
  end if;

  if p_starting_weight_kg is not null then
    if p_starting_weight_kg < 20 or p_starting_weight_kg > 300 then
      raise exception 'Starting weight must be between 20 and 300 kg.' using errcode = '22023';
    end if;
    v_start_wt := round(p_starting_weight_kg::numeric, 1);
  end if;

  if p_target_weight_kg is not null then
    if p_target_weight_kg < 20 or p_target_weight_kg > 300 then
      raise exception 'Target weight must be between 20 and 300 kg.' using errcode = '22023';
    end if;
    v_target_wt := round(p_target_weight_kg::numeric, 1);
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
           fitness_goal = v_clean_goal,
           starting_weight_kg = coalesce(v_start_wt, starting_weight_kg),
           target_weight_kg = coalesce(v_target_wt, target_weight_kg),
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
      fitness_goal,
      starting_weight_kg,
      target_weight_kg,
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
      v_clean_goal,
      v_start_wt,
      v_target_wt,
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
    'fitnessGoal', v_member.fitness_goal,
    'startingWeightKg', v_member.starting_weight_kg,
    'targetWeightKg', v_member.target_weight_kg,
    'trainerNotes', v_member.trainer_notes,
    'status', v_member.status,
    'effectiveStatus', 'pending_approval',
    'daysRemaining', 0,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'daysAttendedThisMonth', 0,
    'lastCheckInDate', v_member.last_check_in_date,
    'lastCheckInAt', v_member.last_check_in_at,
    'checkedInToday', false,
    'todayCheckIn', null,
    'recentAttendanceLogs', '[]'::jsonb,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.submit_gym_member_registration(text, text, text, text, text, numeric, numeric) from public;
grant execute on function public.submit_gym_member_registration(text, text, text, text, text, numeric, numeric) to anon, authenticated, service_role;

-- ============================================================================
-- 5. UPGRADE RPC 2: public.lookup_gym_member_pass(p_slug, p_phone)
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
  v_today_log record;
  v_today_json jsonb := null;
  v_checked_in_today boolean := false;
  v_month_count integer := 0;
  v_recent_logs jsonb := '[]'::jsonb;
  v_curr_month text := pg_catalog.to_char(current_date, 'YYYY-MM');
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

  select c.id, c.check_in_date, c.checked_in_at, c.workout_focus, c.member_note
    into v_today_log
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and c.check_in_date = current_date
   limit 1;

  if found then
    v_checked_in_today := true;
    v_today_json := pg_catalog.jsonb_build_object(
      'id', v_today_log.id,
      'businessId', v_biz.id,
      'memberId', v_member.id,
      'checkInDate', v_today_log.check_in_date,
      'checkedInAt', v_today_log.checked_in_at,
      'workoutFocus', v_today_log.workout_focus,
      'memberNote', v_today_log.member_note
    );
  end if;

  select count(*)::integer into v_month_count
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_curr_month;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', r.id,
        'businessId', r.business_id,
        'memberId', r.member_id,
        'checkInDate', r.check_in_date,
        'checkedInAt', r.checked_in_at,
        'workoutFocus', r.workout_focus,
        'memberNote', r.member_note
      )
      order by r.check_in_date desc, r.checked_in_at desc
    ),
    '[]'::jsonb
  )
    into v_recent_logs
    from (
      select c.id, c.business_id, c.member_id, c.check_in_date, c.checked_in_at, c.workout_focus, c.member_note
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.member_id = v_member.id
       order by c.check_in_date desc, c.checked_in_at desc
       limit 14
    ) r;

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
    'fitnessGoal', v_member.fitness_goal,
    'startingWeightKg', v_member.starting_weight_kg,
    'targetWeightKg', v_member.target_weight_kg,
    'trainerNotes', v_member.trainer_notes,
    'status', v_member.status,
    'effectiveStatus', v_eff_status,
    'daysRemaining', v_days_remaining,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'daysAttendedThisMonth', v_month_count,
    'lastCheckInDate', v_member.last_check_in_date,
    'lastCheckInAt', v_member.last_check_in_at,
    'checkedInToday', v_checked_in_today,
    'todayCheckIn', v_today_json,
    'recentAttendanceLogs', v_recent_logs,
    'approvedByLabel', v_member.approved_by_label,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.lookup_gym_member_pass(text, text) from public;
grant execute on function public.lookup_gym_member_pass(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 6. UPGRADE RPC 3: public.gym_member_daily_check_in (4 params w/ defaults)
--    Drop old 2-arg signature first to avoid PostgREST overload ambiguity.
-- ============================================================================
drop function if exists public.gym_member_daily_check_in(text, text);

create or replace function public.gym_member_daily_check_in(
  p_slug text,
  p_phone text,
  p_workout_focus text default 'full_body',
  p_member_note text default null
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
  v_clean_focus text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_workout_focus, 'full_body')));
  v_clean_note text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_member_note, '')), 1, 280), '');
  v_biz record;
  v_member public.gym_members%rowtype;
  v_log public.gym_check_ins%rowtype;
  v_already boolean := false;
  v_month_count integer := 0;
  v_curr_month text := pg_catalog.to_char(current_date, 'YYYY-MM');
begin
  if v_clean_focus not in ('chest', 'back', 'legs', 'shoulders_arms', 'cardio_hiit', 'abs_core', 'full_body') then
    v_clean_focus := 'full_body';
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

  select * into v_log
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and c.check_in_date = current_date
   for update;

  if found then
    v_already := true;
    -- Allow member to update today's workout focus / note without double-counting attendance
    update public.gym_check_ins
       set workout_focus = v_clean_focus,
           member_note = coalesce(v_clean_note, member_note)
     where id = v_log.id
     returning * into v_log;
  else
    insert into public.gym_check_ins (
      business_id,
      member_id,
      check_in_date,
      checked_in_at,
      workout_focus,
      member_note
    )
    values (
      v_biz.id,
      v_member.id,
      current_date,
      pg_catalog.clock_timestamp(),
      v_clean_focus,
      v_clean_note
    )
    returning * into v_log;

    update public.gym_members
       set total_check_ins = total_check_ins + 1,
           last_check_in_date = current_date,
           last_check_in_at = v_log.checked_in_at,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  end if;

  select count(*)::integer into v_month_count
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_curr_month;

  return pg_catalog.jsonb_build_object(
    'memberId', v_member.id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'alreadyCheckedInToday', v_already,
    'totalCheckIns', v_member.total_check_ins,
    'daysAttendedThisMonth', v_month_count,
    'daysRemaining', greatest(0, (v_member.end_date - current_date)),
    'checkedInDate', v_log.check_in_date,
    'checkedInAt', v_log.checked_in_at,
    'workoutFocus', v_log.workout_focus,
    'memberNote', v_log.member_note,
    'todayLog', pg_catalog.jsonb_build_object(
      'id', v_log.id,
      'businessId', v_log.business_id,
      'memberId', v_log.member_id,
      'checkInDate', v_log.check_in_date,
      'checkedInAt', v_log.checked_in_at,
      'workoutFocus', v_log.workout_focus,
      'memberNote', v_log.member_note
    )
  );
end;
$$;

revoke all on function public.gym_member_daily_check_in(text, text, text, text) from public;
grant execute on function public.gym_member_daily_check_in(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. UPGRADE RPC 4: public.owner_approve_or_renew_gym_member
--    Records payment into gym_payment_logs on every approve/renew for accurate
--    monthly revenue reporting.
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
  v_clean_label text;
  v_month_count integer := 0;
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
  v_clean_label := pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_staff_label), ''), 'Owner'), 1, 80);

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
           approved_by_label = v_clean_label,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;

    insert into public.gym_payment_logs (
      business_id, member_id, payment_type, plan_id, plan_name,
      duration_days, amount_paise, paid_date, recorded_by_label
    ) values (
      v_biz.id, v_member.id, 'approval', v_plan_id, pg_catalog.substr(v_plan_name, 1, 80),
      v_duration_days, v_fee_paise, current_date, v_clean_label
    );
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
           approved_by_label = v_clean_label,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;

    insert into public.gym_payment_logs (
      business_id, member_id, payment_type, plan_id, plan_name,
      duration_days, amount_paise, paid_date, recorded_by_label
    ) values (
      v_biz.id, v_member.id, 'renewal', v_plan_id, pg_catalog.substr(v_plan_name, 1, 80),
      v_duration_days, v_fee_paise, current_date, v_clean_label
    );
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

  select count(*)::integer into v_month_count
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = pg_catalog.to_char(current_date, 'YYYY-MM');

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
    'fitnessGoal', v_member.fitness_goal,
    'startingWeightKg', v_member.starting_weight_kg,
    'targetWeightKg', v_member.target_weight_kg,
    'trainerNotes', v_member.trainer_notes,
    'status', v_member.status,
    'effectiveStatus', v_eff_status,
    'daysRemaining', v_days_remaining,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'daysAttendedThisMonth', v_month_count,
    'lastCheckInDate', v_member.last_check_in_date,
    'lastCheckInAt', v_member.last_check_in_at,
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

-- ============================================================================
-- 8. UPGRADE RPC 5: public.get_gym_owner_dashboard(p_business_id, p_month_key)
--    Drop old 1-arg signature first to avoid PostgREST overload ambiguity.
-- ============================================================================
drop function if exists public.get_gym_owner_dashboard(uuid);

create or replace function public.get_gym_owner_dashboard(
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
  v_cfg public.gym_configs%rowtype;
  v_alert_days integer := 3;
  v_month_key text := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_month_key, '')), ''),
    pg_catalog.to_char(current_date, 'YYYY-MM')
  );
  v_default_plans jsonb := '[
    {"id":"1_month","name":"1 Month Plan","durationDays":30,"pricePaise":150000,"badge":"Popular"},
    {"id":"3_months","name":"3 Months Plan","durationDays":90,"pricePaise":400000,"badge":"Save 11%"},
    {"id":"6_months","name":"6 Months Plan","durationDays":180,"pricePaise":720000,"badge":"Best Value"},
    {"id":"1_year","name":"1 Year Transformation","durationDays":365,"pricePaise":1250000,"badge":"Pro"}
  ]'::jsonb;
  v_cfg_json jsonb;
  v_members jsonb := '[]'::jsonb;
  v_todays_attendance jsonb := '[]'::jsonb;
  v_inactive_members jsonb := '[]'::jsonb;
  v_checked_in_today integer := 0;
  v_monthly_rev_paise bigint := 0;
  v_projected_next_rev_paise bigint := 0;
begin
  if v_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_month_key := pg_catalog.to_char(current_date, 'YYYY-MM');
  end if;

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

  -- Enriched member directory with monthly attendance count & today's workout focus
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
        'fitnessGoal', m.fitness_goal,
        'startingWeightKg', m.starting_weight_kg,
        'targetWeightKg', m.target_weight_kg,
        'trainerNotes', m.trainer_notes,
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
        'daysAttendedThisMonth', coalesce(mc.month_days, 0),
        'lastCheckInDate', m.last_check_in_date,
        'lastCheckInAt', m.last_check_in_at,
        'checkedInToday', (tc.id is not null),
        'todayWorkoutFocus', tc.workout_focus,
        'todayCheckedInAt', tc.checked_in_at,
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
    left join lateral (
      select count(*)::integer as month_days
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.member_id = m.id
         and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_month_key
    ) mc on true
    left join public.gym_check_ins tc
      on tc.business_id = v_biz.id
     and tc.member_id = m.id
     and tc.check_in_date = current_date
   where m.business_id = v_biz.id;

  -- Live Today's Attendance Feed (exact timestamp + workout focus + monthly visits)
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', c.id,
        'memberId', m.id,
        'memberCode', m.member_code,
        'fullName', m.full_name,
        'phone', m.phone,
        'fitnessGoal', m.fitness_goal,
        'checkInDate', c.check_in_date,
        'checkedInAt', c.checked_in_at,
        'workoutFocus', c.workout_focus,
        'memberNote', c.member_note,
        'daysAttendedThisMonth', coalesce(mc.month_days, 1),
        'totalCheckIns', m.total_check_ins
      )
      order by c.checked_in_at desc
    ),
    '[]'::jsonb
  )
    into v_todays_attendance
    from public.gym_check_ins c
    join public.gym_members m on m.id = c.member_id
    left join lateral (
      select count(*)::integer as month_days
        from public.gym_check_ins c2
       where c2.business_id = v_biz.id
         and c2.member_id = m.id
         and pg_catalog.to_char(c2.check_in_date, 'YYYY-MM') = v_month_key
    ) mc on true
   where c.business_id = v_biz.id
     and c.check_in_date = current_date;

  select count(*)::integer into v_checked_in_today
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.check_in_date = current_date;

  -- Monthly Collected Revenue (approvals + renewals recorded in v_month_key)
  select coalesce(sum(p.amount_paise), 0)::bigint
    into v_monthly_rev_paise
    from public.gym_payment_logs p
   where p.business_id = v_biz.id
     and pg_catalog.to_char(p.paid_date, 'YYYY-MM') = v_month_key;

  -- Projected Next-30-Day Renewal Revenue (active plans expiring within next 30 days)
  select coalesce(sum(m.fee_paise), 0)::bigint
    into v_projected_next_rev_paise
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status = 'active'
     and m.end_date is not null
     and m.end_date >= current_date
     and m.end_date <= (current_date + 30);

  -- Inactive Alert Members (active members with >= 5 days since last check-in)
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'memberId', m.id,
        'memberCode', m.member_code,
        'fullName', m.full_name,
        'phone', m.phone,
        'fitnessGoal', m.fitness_goal,
        'daysSinceLastCheckIn', case
          when m.last_check_in_date is not null then (current_date - m.last_check_in_date)
          else (current_date - coalesce(m.start_date, current_date))
        end,
        'lastCheckInDate', m.last_check_in_date,
        'daysRemaining', greatest(0, (m.end_date - current_date))
      )
      order by coalesce(m.last_check_in_date, m.start_date, current_date) asc
    ),
    '[]'::jsonb
  )
    into v_inactive_members
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status = 'active'
     and m.end_date is not null
     and m.end_date >= current_date
     and (
       (m.last_check_in_date is not null and (current_date - m.last_check_in_date) >= 5)
       or (m.last_check_in_date is null and m.start_date is not null and (current_date - m.start_date) >= 5)
     );

  return pg_catalog.jsonb_build_object(
    'config', v_cfg_json,
    'monthKey', v_month_key,
    'members', v_members,
    'checkedInTodayCount', v_checked_in_today,
    'todaysAttendance', v_todays_attendance,
    'monthlyRevenuePaise', v_monthly_rev_paise,
    'projectedNextMonthRevenuePaise', v_projected_next_rev_paise,
    'inactiveAlertMembers', v_inactive_members
  );
end;
$$;

revoke all on function public.get_gym_owner_dashboard(uuid, text) from public;
grant execute on function public.get_gym_owner_dashboard(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 9. NEW RPC 6: public.get_gym_member_progress_history
--    Owner-only individual member attendance timeline + workout split chart
-- ============================================================================
create or replace function public.get_gym_member_progress_history(
  p_business_id uuid,
  p_member_id uuid,
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
  v_cfg record;
  v_alert_days integer := 3;
  v_member public.gym_members%rowtype;
  v_month_key text := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_month_key, '')), ''),
    pg_catalog.to_char(current_date, 'YYYY-MM')
  );
  v_eff_status text;
  v_days_remaining integer := 0;
  v_month_days integer := 0;
  v_logs jsonb := '[]'::jsonb;
  v_split_counts jsonb := '{}'::jsonb;
begin
  if v_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_month_key := pg_catalog.to_char(current_date, 'YYYY-MM');
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
   limit 1;

  if not found then
    raise exception 'Gym member not found for this business.' using errcode = 'P0002';
  end if;

  select gc.renewal_alert_days into v_cfg
    from public.gym_configs gc
   where gc.business_id = v_biz.id
   limit 1;
  v_alert_days := coalesce(v_cfg.renewal_alert_days, 3);

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

  select count(*)::integer into v_month_days
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.member_id = v_member.id
     and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_month_key;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', c.id,
        'businessId', c.business_id,
        'memberId', c.member_id,
        'checkInDate', c.check_in_date,
        'checkedInAt', c.checked_in_at,
        'workoutFocus', c.workout_focus,
        'memberNote', c.member_note
      )
      order by c.check_in_date desc, c.checked_in_at desc
    ),
    '[]'::jsonb
  )
    into v_logs
    from (
      select c.id, c.business_id, c.member_id, c.check_in_date, c.checked_in_at, c.workout_focus, c.member_note
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.member_id = v_member.id
       order by c.check_in_date desc, c.checked_in_at desc
       limit 90
    ) c;

  select coalesce(
    pg_catalog.jsonb_object_agg(s.workout_focus, s.cnt),
    '{}'::jsonb
  )
    into v_split_counts
    from (
      select c.workout_focus, count(*)::integer as cnt
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.member_id = v_member.id
       group by c.workout_focus
    ) s;

  return pg_catalog.jsonb_build_object(
    'member', pg_catalog.jsonb_build_object(
      'id', v_member.id,
      'businessId', v_member.business_id,
      'memberCode', v_member.member_code,
      'fullName', v_member.full_name,
      'phone', v_member.phone,
      'planId', v_member.plan_id,
      'planName', v_member.plan_name,
      'durationDays', v_member.duration_days,
      'feePaise', v_member.fee_paise,
      'fitnessGoal', v_member.fitness_goal,
      'startingWeightKg', v_member.starting_weight_kg,
      'targetWeightKg', v_member.target_weight_kg,
      'trainerNotes', v_member.trainer_notes,
      'status', v_member.status,
      'effectiveStatus', v_eff_status,
      'daysRemaining', v_days_remaining,
      'startDate', v_member.start_date,
      'endDate', v_member.end_date,
      'totalCheckIns', v_member.total_check_ins,
      'daysAttendedThisMonth', v_month_days,
      'lastCheckInDate', v_member.last_check_in_date,
      'lastCheckInAt', v_member.last_check_in_at,
      'checkedInToday', (v_member.last_check_in_date = current_date),
      'approvedByLabel', v_member.approved_by_label,
      'createdAt', v_member.created_at,
      'updatedAt', v_member.updated_at
    ),
    'monthKey', v_month_key,
    'daysAttendedThisMonth', v_month_days,
    'attendanceLogs', v_logs,
    'workoutSplitCounts', v_split_counts
  );
end;
$$;

revoke all on function public.get_gym_member_progress_history(uuid, uuid, text) from public;
grant execute on function public.get_gym_member_progress_history(uuid, uuid, text) to authenticated, service_role;

-- ============================================================================
-- 10. NEW RPC 7: public.owner_update_gym_member_profile
--     Lets the owner/trainer save trainer_notes, fitness_goal, and weights.
-- ============================================================================
create or replace function public.owner_update_gym_member_profile(
  p_business_id uuid,
  p_member_id uuid,
  p_trainer_notes text default null,
  p_fitness_goal text default null,
  p_starting_weight_kg numeric default null,
  p_target_weight_kg numeric default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_member public.gym_members%rowtype;
  v_goal text;
  v_notes text;
  v_start_wt numeric(5,1);
  v_target_wt numeric(5,1);
begin
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

  v_goal := v_member.fitness_goal;
  if p_fitness_goal is not null and pg_catalog.btrim(p_fitness_goal) <> '' then
    if pg_catalog.lower(pg_catalog.btrim(p_fitness_goal)) in (
      'weight_loss', 'muscle_gain', 'weight_gain', 'cardio_endurance', 'general_fitness'
    ) then
      v_goal := pg_catalog.lower(pg_catalog.btrim(p_fitness_goal));
    else
      raise exception 'Invalid fitness goal value.' using errcode = '22023';
    end if;
  end if;

  if p_trainer_notes is null then
    v_notes := v_member.trainer_notes;
  else
    v_notes := nullif(pg_catalog.substr(pg_catalog.btrim(p_trainer_notes), 1, 1000), '');
  end if;

  v_start_wt := v_member.starting_weight_kg;
  if p_starting_weight_kg is not null then
    if p_starting_weight_kg < 20 or p_starting_weight_kg > 300 then
      raise exception 'Starting weight must be between 20 and 300 kg.' using errcode = '22023';
    end if;
    v_start_wt := round(p_starting_weight_kg::numeric, 1);
  end if;

  v_target_wt := v_member.target_weight_kg;
  if p_target_weight_kg is not null then
    if p_target_weight_kg < 20 or p_target_weight_kg > 300 then
      raise exception 'Target weight must be between 20 and 300 kg.' using errcode = '22023';
    end if;
    v_target_wt := round(p_target_weight_kg::numeric, 1);
  end if;

  update public.gym_members
     set fitness_goal = v_goal,
         trainer_notes = v_notes,
         starting_weight_kg = v_start_wt,
         target_weight_kg = v_target_wt,
         updated_at = pg_catalog.clock_timestamp()
   where id = v_member.id
   returning * into v_member;

  return pg_catalog.jsonb_build_object(
    'id', v_member.id,
    'businessId', v_member.business_id,
    'memberCode', v_member.member_code,
    'fullName', v_member.full_name,
    'fitnessGoal', v_member.fitness_goal,
    'startingWeightKg', v_member.starting_weight_kg,
    'targetWeightKg', v_member.target_weight_kg,
    'trainerNotes', v_member.trainer_notes,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.owner_update_gym_member_profile(uuid, uuid, text, text, numeric, numeric) from public;
grant execute on function public.owner_update_gym_member_profile(uuid, uuid, text, text, numeric, numeric) to authenticated, service_role;

commit;
