-- ============================================================================
-- Vitaran AI Reviews / GymOS — Member Self-Plan Customization,
-- Morning / Evening Batch Shifts, Real-Person Exercise Video/GIF Overrides,
-- & Gym Custom Theme Color + Logo Branding
-- Migration: 028_gym_self_plan_shift_batches_and_media.sql
-- Depends on: 001..027
--
-- Security Guardrails:
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY
-- - REVOKE ALL FROM public, anon, authenticated on every new table
-- - Every SECURITY DEFINER RPC locks search_path = pg_catalog, public, pg_temp
-- - Uses pg_catalog.substr exclusively (no SQL-standard substring syntax)
-- ============================================================================

begin;

-- ============================================================================
-- 1. MORNING / EVENING BATCH COLUMNS & GYM BRANDING COLUMNS
-- ============================================================================
alter table public.gym_members
  add column if not exists preferred_shift text not null default 'morning',
  drop constraint if exists gym_members_preferred_shift_chk;

alter table public.gym_members
  add constraint gym_members_preferred_shift_chk
    check (preferred_shift in ('morning', 'evening', 'flexible'));

alter table public.gym_check_ins
  add column if not exists check_in_shift text not null default 'morning',
  drop constraint if exists gym_check_ins_shift_chk;

alter table public.gym_check_ins
  add constraint gym_check_ins_shift_chk
    check (check_in_shift in ('morning', 'evening'));

alter table public.gym_configs
  add column if not exists logo_url text,
  add column if not exists accent_color text not null default '#C8F135',
  add column if not exists theme_preset text not null default 'volt_obsidian',
  drop constraint if exists gym_configs_theme_preset_chk;

alter table public.gym_configs
  add constraint gym_configs_theme_preset_chk
    check (theme_preset in ('volt_obsidian', 'crimson_iron', 'cyber_cyan', 'solar_gold', 'emerald_pulse'));

-- ============================================================================
-- 2. NEW TABLE: public.gym_exercise_media_overrides
-- ============================================================================
create table if not exists public.gym_exercise_media_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  exercise_key text not null,
  media_url text not null,
  media_type text not null default 'video'
    check (media_type in ('video', 'gif')),
  updated_at timestamptz not null default now(),
  constraint gym_ex_media_unique_biz_key unique (business_id, exercise_key),
  constraint gym_ex_media_url_len_chk
    check (pg_catalog.char_length(pg_catalog.btrim(media_url)) between 8 and 1000)
);

create index if not exists idx_gym_ex_media_biz
  on public.gym_exercise_media_overrides (business_id);

alter table public.gym_exercise_media_overrides enable row level security;
alter table public.gym_exercise_media_overrides force row level security;

revoke all on table public.gym_exercise_media_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_exercise_media_overrides to authenticated;
grant all on table public.gym_exercise_media_overrides to service_role;

drop policy if exists "gym_exercise_media_overrides_owner_all" on public.gym_exercise_media_overrides;
create policy "gym_exercise_media_overrides_owner_all"
  on public.gym_exercise_media_overrides
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_exercise_media_overrides.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_exercise_media_overrides.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. RPC: public.owner_update_gym_branding
-- ============================================================================
create or replace function public.owner_update_gym_branding(
  p_business_id uuid,
  p_logo_url text default null,
  p_accent_color text default '#C8F135',
  p_theme_preset text default 'volt_obsidian'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_clean_logo text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_logo_url, '')), 1, 1000), '');
  v_clean_color text := pg_catalog.btrim(coalesce(p_accent_color, '#C8F135'));
  v_preset text := case
    when p_theme_preset in ('volt_obsidian', 'crimson_iron', 'cyber_cyan', 'solar_gold', 'emerald_pulse')
    then p_theme_preset
    else 'volt_obsidian'
  end;
begin
  if v_clean_color !~ '^#[0-9A-Fa-f]{6}$' then
    v_clean_color := '#C8F135';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  insert into public.gym_configs (
    business_id,
    logo_url,
    accent_color,
    theme_preset,
    updated_at
  )
  values (
    v_biz.id,
    v_clean_logo,
    v_clean_color,
    v_preset,
    now()
  )
  on conflict (business_id) do update set
    logo_url = excluded.logo_url,
    accent_color = excluded.accent_color,
    theme_preset = excluded.theme_preset,
    updated_at = now();

  return pg_catalog.jsonb_build_object(
    'businessId', v_biz.id,
    'logoUrl', v_clean_logo,
    'accentColor', v_clean_color,
    'themePreset', v_preset
  );
end;
$$;

revoke all on function public.owner_update_gym_branding(uuid, text, text, text) from public, anon;
grant execute on function public.owner_update_gym_branding(uuid, text, text, text) to authenticated, service_role;

-- ============================================================================
-- 4. UPGRADE public.get_public_gym_portal TO RETURN BRANDING & THEME
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
      'logoUrl', v_cfg.logo_url,
      'accentColor', coalesce(v_cfg.accent_color, '#C8F135'),
      'themePreset', coalesce(v_cfg.theme_preset, 'volt_obsidian'),
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    );
  else
    v_cfg_json := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'isRegistrationOpen', true,
      'renewalAlertDays', 3,
      'plans', v_default_plans,
      'logoUrl', null,
      'accentColor', '#C8F135',
      'themePreset', 'volt_obsidian',
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
-- 5. RPC: public.update_gym_member_self_plan
-- ============================================================================
create or replace function public.update_gym_member_self_plan(
  p_slug text,
  p_member_id uuid,
  p_schedule_mode text default 'fixed_week',
  p_weekly_schedule jsonb default '[]'::jsonb,
  p_plan_title text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_mode text := case when p_schedule_mode = 'rotation' then 'rotation' else 'fixed_week' end;
  v_clean_title text := pg_catalog.substr(
    coalesce(nullif(pg_catalog.btrim(p_plan_title), ''), 'My Custom Weekly Split'),
    1,
    120
  );
  v_biz record;
  v_member record;
  v_plan public.gym_member_coach_plans%rowtype;
  v_trainer_name text := null;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Gym portal is not active.' using errcode = 'P0002';
  end if;

  select m.* into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found or v_member.status <> 'active' then
    raise exception 'Active gym membership required to customize your workout plan.' using errcode = '42501';
  end if;

  insert into public.gym_member_coach_plans (
    business_id,
    member_id,
    trainer_id,
    plan_title,
    schedule_mode,
    weekly_schedule,
    approval_status,
    approved_by,
    approved_at,
    updated_at
  )
  values (
    v_biz.id,
    v_member.id,
    v_member.pt_trainer_id,
    v_clean_title,
    v_clean_mode,
    case when jsonb_typeof(coalesce(p_weekly_schedule, '[]'::jsonb)) = 'array' then coalesce(p_weekly_schedule, '[]'::jsonb) else '[]'::jsonb end,
    'approved',
    'Self Customized',
    now(),
    now()
  )
  on conflict (member_id) do update set
    schedule_mode = excluded.schedule_mode,
    weekly_schedule = excluded.weekly_schedule,
    plan_title = coalesce(nullif(pg_catalog.btrim(p_plan_title), ''), gym_member_coach_plans.plan_title),
    updated_at = now()
  returning * into v_plan;

  if v_plan.trainer_id is not null then
    select t.trainer_name into v_trainer_name
      from public.gym_trainers t
     where t.id = v_plan.trainer_id
     limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_plan.id,
    'businessId', v_plan.business_id,
    'memberId', v_plan.member_id,
    'trainerId', v_plan.trainer_id,
    'trainerName', v_trainer_name,
    'planTitle', v_plan.plan_title,
    'scheduleMode', v_plan.schedule_mode,
    'weeklySchedule', v_plan.weekly_schedule,
    'dailyCaloriesKcal', v_plan.daily_calories_kcal,
    'proteinGrams', v_plan.protein_grams,
    'carbsGrams', v_plan.carbs_grams,
    'fatsGrams', v_plan.fats_grams,
    'waterLiters', v_plan.water_liters,
    'nutritionMeals', v_plan.nutrition_meals,
    'supplementNotes', v_plan.supplement_notes,
    'coachNotes', v_plan.coach_notes,
    'approvalStatus', v_plan.approval_status,
    'approvedBy', v_plan.approved_by,
    'approvedAt', v_plan.approved_at,
    'updatedAt', v_plan.updated_at
  );
end;
$$;

revoke all on function public.update_gym_member_self_plan(text, uuid, text, jsonb, text) from public;
grant execute on function public.update_gym_member_self_plan(text, uuid, text, jsonb, text) to anon, authenticated, service_role;

-- ============================================================================
-- 6. RPC: public.update_gym_member_preferred_shift
-- ============================================================================
create or replace function public.update_gym_member_preferred_shift(
  p_slug text,
  p_member_id uuid,
  p_preferred_shift text default 'morning'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_shift text := case
    when p_preferred_shift in ('morning', 'evening', 'flexible') then p_preferred_shift
    else 'morning'
  end;
  v_biz record;
  v_member public.gym_members%rowtype;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
   limit 1;

  if not found then
    raise exception 'Gym portal is not active.' using errcode = 'P0002';
  end if;

  update public.gym_members
     set preferred_shift = v_shift,
         updated_at = now()
   where id = p_member_id
     and business_id = v_biz.id
  returning * into v_member;

  if not found then
    raise exception 'Gym member not found.' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'memberId', v_member.id,
    'preferredShift', v_member.preferred_shift
  );
end;
$$;

revoke all on function public.update_gym_member_preferred_shift(text, uuid, text) from public;
grant execute on function public.update_gym_member_preferred_shift(text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. RPC: public.owner_upsert_gym_exercise_media
-- ============================================================================
create or replace function public.owner_upsert_gym_exercise_media(
  p_business_id uuid,
  p_exercise_key text,
  p_media_url text,
  p_media_type text default 'video'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_clean_key text := pg_catalog.lower(pg_catalog.substr(pg_catalog.btrim(coalesce(p_exercise_key, '')), 1, 100));
  v_clean_url text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_media_url, '')), 1, 1000);
  v_type text := case when p_media_type = 'gif' then 'gif' else 'video' end;
begin
  if pg_catalog.char_length(v_clean_key) < 2 then
    raise exception 'Exercise key is required.' using errcode = '22023';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  if pg_catalog.char_length(v_clean_url) = 0 then
    delete from public.gym_exercise_media_overrides
     where business_id = v_biz.id
       and exercise_key = v_clean_key;
    return pg_catalog.jsonb_build_object('exerciseKey', v_clean_key, 'mediaUrl', '');
  end if;

  insert into public.gym_exercise_media_overrides (
    business_id,
    exercise_key,
    media_url,
    media_type,
    updated_at
  )
  values (
    v_biz.id,
    v_clean_key,
    v_clean_url,
    v_type,
    now()
  )
  on conflict (business_id, exercise_key) do update set
    media_url = excluded.media_url,
    media_type = excluded.media_type,
    updated_at = now();

  return pg_catalog.jsonb_build_object(
    'exerciseKey', v_clean_key,
    'mediaUrl', v_clean_url,
    'mediaType', v_type
  );
end;
$$;

revoke all on function public.owner_upsert_gym_exercise_media(uuid, text, text, text) from public, anon;
grant execute on function public.owner_upsert_gym_exercise_media(uuid, text, text, text) to authenticated, service_role;

-- ============================================================================
-- 8. RPC: public.get_gym_members_batch_stats (Morning vs Evening Split)
-- ============================================================================
create or replace function public.get_gym_members_batch_stats(
  p_business_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_morning_total integer := 0;
  v_evening_total integer := 0;
  v_flex_total integer := 0;
  v_morning_today integer := 0;
  v_evening_today integer := 0;
  v_shifts jsonb := '{}'::jsonb;
  v_today_shifts jsonb := '{}'::jsonb;
begin
  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  select
    count(*) filter (where m.preferred_shift = 'morning')::integer,
    count(*) filter (where m.preferred_shift = 'evening')::integer,
    count(*) filter (where m.preferred_shift = 'flexible')::integer,
    coalesce(jsonb_object_agg(m.id::text, m.preferred_shift), '{}'::jsonb)
    into v_morning_total, v_evening_total, v_flex_total, v_shifts
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status = 'active';

  select
    count(*) filter (where c.check_in_shift = 'morning')::integer,
    count(*) filter (where c.check_in_shift = 'evening')::integer,
    coalesce(jsonb_object_agg(c.member_id::text, c.check_in_shift), '{}'::jsonb)
    into v_morning_today, v_evening_today, v_today_shifts
    from public.gym_check_ins c
   where c.business_id = v_biz.id
     and c.check_in_date = current_date;

  return pg_catalog.jsonb_build_object(
    'morningTotal', coalesce(v_morning_total, 0),
    'eveningTotal', coalesce(v_evening_total, 0),
    'flexibleTotal', coalesce(v_flex_total, 0),
    'morningCheckedIn', coalesce(v_morning_today, 0),
    'eveningCheckedIn', coalesce(v_evening_today, 0),
    'memberShifts', coalesce(v_shifts, '{}'::jsonb),
    'todayCheckInShifts', coalesce(v_today_shifts, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_gym_members_batch_stats(uuid) from public, anon;
grant execute on function public.get_gym_members_batch_stats(uuid) to authenticated, service_role;

-- ============================================================================
-- 9. UPGRADE public.gym_member_daily_check_in TO RECORD check_in_shift
-- ============================================================================
create or replace function public.gym_member_daily_check_in(
  p_slug text,
  p_phone text,
  p_workout_focus text default 'full_body',
  p_member_note text default null,
  p_is_pt_session boolean default false
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
  v_next_streak integer := 1;
  v_use_pt boolean := false;
  v_used_trainer_id uuid := null;
  v_curr_month text := pg_catalog.to_char(current_date, 'YYYY-MM');
  v_month_count integer := 0;
  v_shift text := case
    when extract(hour from (pg_catalog.clock_timestamp() at time zone 'Asia/Kolkata')) < 14 then 'morning'
    else 'evening'
  end;
begin
  if pg_catalog.char_length(v_norm_phone) < 10 then
    raise exception 'Enter a valid 10-digit mobile number to check in.' using errcode = '22023';
  end if;

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
    raise exception 'This gym portal is not active.' using errcode = 'P0002';
  end if;

  select * into v_member
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.phone = v_norm_phone
   limit 1
   for update;

  if not found then
    raise exception 'No membership found for that mobile number.' using errcode = 'P0002';
  end if;

  if v_member.status = 'pending_approval' then
    raise exception 'Your membership is pending payment approval at the front desk.' using errcode = '42501';
  end if;

  if coalesce(v_member.is_frozen, false) then
    raise exception 'Membership is currently paused — ask front desk to resume.' using errcode = '42501';
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
    update public.gym_check_ins
       set workout_focus = v_clean_focus,
           member_note = coalesce(v_clean_note, member_note)
     where id = v_log.id
     returning * into v_log;
  else
    if v_member.last_check_in_date = (current_date - 1) then
      v_next_streak := greatest(1, v_member.current_streak_days + 1);
    else
      v_next_streak := 1;
    end if;

    if coalesce(p_is_pt_session, false) and v_member.pt_remaining_sessions > 0 then
      v_use_pt := true;
      v_used_trainer_id := v_member.pt_trainer_id;
    end if;

    insert into public.gym_check_ins (
      business_id,
      member_id,
      check_in_date,
      checked_in_at,
      workout_focus,
      check_in_shift,
      member_note,
      is_pt_session,
      trainer_id
    )
    values (
      v_biz.id,
      v_member.id,
      current_date,
      pg_catalog.clock_timestamp(),
      v_clean_focus,
      v_shift,
      v_clean_note,
      v_use_pt,
      v_used_trainer_id
    )
    returning * into v_log;

    update public.gym_members
       set total_check_ins = total_check_ins + 1,
           last_check_in_date = current_date,
           last_check_in_at = v_log.checked_in_at,
           current_streak_days = v_next_streak,
           best_streak_days = greatest(best_streak_days, v_next_streak),
           pt_remaining_sessions = case when v_use_pt then greatest(0, pt_remaining_sessions - 1) else pt_remaining_sessions end,
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
    'currentStreakDays', v_member.current_streak_days,
    'bestStreakDays', v_member.best_streak_days,
    'ptRemainingSessions', v_member.pt_remaining_sessions,
    'isPtSession', v_log.is_pt_session,
    'trainerId', v_log.trainer_id,
    'checkedInDate', v_log.check_in_date,
    'checkedInAt', v_log.checked_in_at,
    'workoutFocus', v_log.workout_focus,
    'checkInShift', coalesce(v_log.check_in_shift, v_shift),
    'memberNote', v_log.member_note,
    'todayLog', pg_catalog.jsonb_build_object(
      'id', v_log.id,
      'businessId', v_log.business_id,
      'memberId', v_log.member_id,
      'checkInDate', v_log.check_in_date,
      'checkedInAt', v_log.checked_in_at,
      'workoutFocus', v_log.workout_focus,
      'checkInShift', coalesce(v_log.check_in_shift, v_shift),
      'memberNote', v_log.member_note,
      'isPtSession', v_log.is_pt_session,
      'trainerId', v_log.trainer_id
    )
  );
end;
$$;

revoke all on function public.gym_member_daily_check_in(text, text, text, text, boolean) from public;
grant execute on function public.gym_member_daily_check_in(text, text, text, text, boolean) to anon, authenticated, service_role;

-- ============================================================================
-- 10. UPGRADE public.get_gym_member_full_athlete_hub
-- ============================================================================
create or replace function public.get_gym_member_full_athlete_hub(
  p_slug text,
  p_member_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_member record;
  v_coach_plan record;
  v_trainer_name text := null;
  v_trainer_specialty text := null;
  v_total_volume numeric := 0;
  v_month_volume numeric := 0;
  v_workouts_month integer := 0;
  v_weight_checkins_month integer := 0;
  v_last_back_days integer := null;
  v_last_legs_days integer := null;
  v_recovery_msg text := 'All major muscle groups are primed. Ready to push hard today!';
  v_recovery_muscle text := 'full_body';
  v_last_sessions jsonb := '{}'::jsonb;
  v_prs jsonb := '[]'::jsonb;
  v_catalog jsonb := '[]'::jsonb;
begin
  select b.id, b.slug, b.name, b.status into v_biz
    from public.businesses b
   where b.slug = pg_catalog.btrim(coalesce(p_slug, ''))
     and b.status = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  select m.* into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found then
    return null;
  end if;

  select cp.* into v_coach_plan
    from public.gym_member_coach_plans cp
   where cp.member_id = v_member.id
     and cp.business_id = v_biz.id
   limit 1;

  if found and v_coach_plan.trainer_id is not null then
    select t.trainer_name, t.specialty into v_trainer_name, v_trainer_specialty
      from public.gym_trainers t
     where t.id = v_coach_plan.trainer_id
     limit 1;
  elsif v_member.pt_trainer_id is not null then
    select t.trainer_name, t.specialty into v_trainer_name, v_trainer_specialty
      from public.gym_trainers t
     where t.id = v_member.pt_trainer_id
     limit 1;
  end if;

  select coalesce(sum(s.weight_kg * s.reps), 0) into v_total_volume
    from public.gym_workout_set_logs s
   where s.member_id = v_member.id
     and s.business_id = v_biz.id;

  select coalesce(sum(s.weight_kg * s.reps), 0) into v_month_volume
    from public.gym_workout_set_logs s
   where s.member_id = v_member.id
     and s.business_id = v_biz.id
     and s.workout_date >= date_trunc('month', current_date)::date;

  select count(*) into v_workouts_month
    from public.gym_check_ins c
   where c.member_id = v_member.id
     and c.business_id = v_biz.id
     and c.check_in_date >= date_trunc('month', current_date)::date;

  select count(*) into v_weight_checkins_month
    from public.gym_body_measurements bm
   where bm.member_id = v_member.id
     and bm.business_id = v_biz.id
     and bm.recorded_date >= date_trunc('month', current_date)::date;

  select (current_date - max(s.workout_date)) into v_last_back_days
    from public.gym_workout_set_logs s
   where s.member_id = v_member.id
     and s.business_id = v_biz.id
     and s.muscle_group = 'back';

  select (current_date - max(s.workout_date)) into v_last_legs_days
    from public.gym_workout_set_logs s
   where s.member_id = v_member.id
     and s.business_id = v_biz.id
     and s.muscle_group = 'legs';

  if v_last_back_days is null or v_last_back_days >= 5 then
    v_recovery_muscle := 'back';
    v_recovery_msg := case
      when v_last_back_days is null then 'Your back hasn''t had tracked work yet — today''s Pull session takes care of that.'
      else format('Your back hasn''t had any work in %s days. Today''s plan takes care of that.', v_last_back_days)
    end;
  elsif v_last_legs_days is null or v_last_legs_days >= 5 then
    v_recovery_muscle := 'legs';
    v_recovery_msg := case
      when v_last_legs_days is null then 'Your legs are fresh — great day for squats or leg press.'
      else format('Your legs haven''t had any work in %s days. Ready for heavy lower-body work.', v_last_legs_days)
    end;
  end if;

  select coalesce(
    jsonb_object_agg(ex_name, jsonb_build_object(
      'exerciseName', ex_name,
      'summary', sets_summary,
      'bestWeightKg', max_wt,
      'repsAtBest', best_reps,
      'lastDate', last_dt
    )),
    '{}'::jsonb
  ) into v_last_sessions
  from (
    select
      s.exercise_name as ex_name,
      max(s.workout_date) as last_dt,
      max(s.weight_kg) as max_wt,
      (array_agg(s.reps order by s.weight_kg desc, s.logged_at desc))[1] as best_reps,
      string_agg(s.weight_kg::text || '×' || s.reps::text, ', ' order by s.set_number asc) as sets_summary
    from public.gym_workout_set_logs s
    where s.member_id = v_member.id
      and s.business_id = v_biz.id
      and s.workout_date < current_date
      and s.workout_date = (
        select max(s2.workout_date)
          from public.gym_workout_set_logs s2
         where s2.member_id = v_member.id
           and s2.business_id = v_biz.id
           and s2.exercise_name = s.exercise_name
           and s2.workout_date < current_date
      )
    group by s.exercise_name
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exerciseName', pr.exercise_name,
        'muscleGroup', pr.muscle_group,
        'bestWeightKg', pr.best_weight_kg,
        'best1rmKg', pr.best_1rm_kg,
        'lastDate', pr.last_date
      ) order by pr.best_1rm_kg desc
    ),
    '[]'::jsonb
  ) into v_prs
  from (
    select
      s.exercise_name,
      max(s.muscle_group) as muscle_group,
      max(s.weight_kg) as best_weight_kg,
      max(s.estimated_1rm_kg) as best_1rm_kg,
      max(s.workout_date) as last_date
    from public.gym_workout_set_logs s
    where s.member_id = v_member.id
      and s.business_id = v_biz.id
    group by s.exercise_name
  ) pr;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'businessId', e.business_id,
        'name', e.name,
        'muscleGroup', e.muscle_group,
        'equipment', e.equipment,
        'defaultSets', e.default_sets,
        'defaultReps', e.default_reps,
        'restSeconds', e.rest_seconds,
        'animationKey', e.animation_key,
        'animationGifUrl', coalesce(mo.media_url, e.animation_gif_url),
        'formCues', e.form_cues
      ) order by e.muscle_group asc, e.name asc
    ),
    '[]'::jsonb
  ) into v_catalog
  from public.gym_exercises e
  left join public.gym_exercise_media_overrides mo
    on mo.business_id = v_biz.id
   and (mo.exercise_key = pg_catalog.lower(e.name) or mo.exercise_key = pg_catalog.lower(e.id::text))
  where e.business_id is null or e.business_id = v_biz.id;

  return jsonb_build_object(
    'memberId', v_member.id,
    'preferredShift', coalesce(v_member.preferred_shift, 'morning'),
    'ptTrainerName', v_trainer_name,
    'ptTrainerSpecialty', v_trainer_specialty,
    'ptRemainingSessions', coalesce(v_member.pt_remaining_sessions, 0),
    'ptTotalSessions', coalesce(v_member.pt_total_sessions, 0),
    'weekStreakCount', case when coalesce(v_member.current_streak_days, 0) > 0 then greatest(1, floor(v_member.current_streak_days / 7.0)::integer) else 0 end,
    'totalVolumeLiftedKg', round(v_total_volume)::integer,
    'totalWorkoutsCount', coalesce(v_member.total_check_ins, 0),
    'workoutsThisMonth', v_workouts_month,
    'monthlyWorkoutTarget', coalesce(v_member.monthly_workout_target, 16),
    'volumeThisMonthKg', round(v_month_volume)::integer,
    'monthlyVolumeTargetKg', coalesce(v_member.monthly_volume_target_kg, 25000),
    'weightCheckInsThisMonth', v_weight_checkins_month,
    'coachPlan', case when v_coach_plan.id is not null then jsonb_build_object(
      'id', v_coach_plan.id,
      'businessId', v_coach_plan.business_id,
      'memberId', v_coach_plan.member_id,
      'trainerId', v_coach_plan.trainer_id,
      'trainerName', v_trainer_name,
      'planTitle', v_coach_plan.plan_title,
      'scheduleMode', v_coach_plan.schedule_mode,
      'weeklySchedule', v_coach_plan.weekly_schedule,
      'dailyCaloriesKcal', v_coach_plan.daily_calories_kcal,
      'proteinGrams', v_coach_plan.protein_grams,
      'carbsGrams', v_coach_plan.carbs_grams,
      'fatsGrams', v_coach_plan.fats_grams,
      'waterLiters', v_coach_plan.water_liters,
      'nutritionMeals', v_coach_plan.nutrition_meals,
      'supplementNotes', v_coach_plan.supplement_notes,
      'coachNotes', v_coach_plan.coach_notes,
      'approvalStatus', v_coach_plan.approval_status,
      'approvedBy', v_coach_plan.approved_by,
      'approvedAt', v_coach_plan.approved_at,
      'updatedAt', v_coach_plan.updated_at
    ) else null end,
    'recoveryInsight', jsonb_build_object(
      'muscleGroup', v_recovery_muscle,
      'message', v_recovery_msg
    ),
    'lastSessionByExercise', v_last_sessions,
    'personalRecords', v_prs,
    'exerciseCatalog', v_catalog
  );
end;
$$;

commit;
