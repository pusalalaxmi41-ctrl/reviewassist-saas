-- ============================================================================
-- Vitaran AI Reviews / GymOS — Coach Personalization, Nutrition Plans,
-- Weekly Splits, Exercise Animations & Full Athlete Hub RPC
-- Migration: 026_gym_coach_nutrition_and_weekly_plans.sql
-- Depends on: 001..023 (extends gym_members, gym_exercises)
--
-- Security Guardrails:
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY
-- - REVOKE ALL FROM public, anon, authenticated on every new table
-- - Every SECURITY DEFINER RPC locks search_path = pg_catalog, public, pg_temp
-- - Uses pg_catalog.substr exclusively (no SQL-standard substring/from syntax)
-- ============================================================================

begin;

-- ============================================================================
-- 1. NEW TABLE: public.gym_member_coach_plans (1:1 Training + Nutrition)
-- ============================================================================
create table if not exists public.gym_member_coach_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null unique references public.gym_members(id) on delete cascade,
  trainer_id uuid references public.gym_trainers(id) on delete set null,
  plan_title text not null default 'Personalized Transformation Plan',
  schedule_mode text not null default 'fixed_week'
    check (schedule_mode in ('fixed_week', 'rotation')),
  weekly_schedule jsonb not null default '[]'::jsonb,
  daily_calories_kcal integer not null default 2200
    check (daily_calories_kcal between 800 and 8000),
  protein_grams integer not null default 140
    check (protein_grams between 20 and 500),
  carbs_grams integer not null default 230
    check (carbs_grams between 0 and 1000),
  fats_grams integer not null default 65
    check (fats_grams between 10 and 300),
  water_liters numeric(3,1) not null default 3.5
    check (water_liters >= 0.5 and water_liters <= 12.0),
  nutrition_meals jsonb not null default '[]'::jsonb,
  supplement_notes text,
  coach_notes text,
  approval_status text not null default 'approved'
    check (approval_status in ('draft', 'approved')),
  approved_by text,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gym_coach_plan_title_len_chk
    check (pg_catalog.char_length(pg_catalog.btrim(plan_title)) between 2 and 120)
);

create index if not exists idx_gym_coach_plans_biz_member
  on public.gym_member_coach_plans (business_id, member_id);

alter table public.gym_member_coach_plans enable row level security;
alter table public.gym_member_coach_plans force row level security;

revoke all on table public.gym_member_coach_plans from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_member_coach_plans to authenticated;
grant all on table public.gym_member_coach_plans to service_role;

drop policy if exists "gym_member_coach_plans_owner_all" on public.gym_member_coach_plans;
create policy "gym_member_coach_plans_owner_all"
  on public.gym_member_coach_plans
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_member_coach_plans.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_member_coach_plans.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. EXTEND public.gym_exercises & public.gym_members
-- ============================================================================
alter table public.gym_exercises
  add column if not exists animation_key text not null default 'bench_press',
  add column if not exists animation_gif_url text,
  add column if not exists form_cues text;

alter table public.gym_members
  add column if not exists monthly_workout_target integer not null default 16,
  add column if not exists monthly_volume_target_kg integer not null default 25000;

-- Backfill animation_key & form_cues for seeded global exercises
update public.gym_exercises
set
  animation_key = case
    when lower(name) like '%incline%' then 'incline_press'
    when lower(name) like '%bench%' or lower(name) like '%push-up%' or lower(name) like '%fly%' then 'bench_press'
    when lower(name) like '%pulldown%' or lower(name) like '%pull-up%' then 'lat_pulldown'
    when lower(name) like '%row%' or lower(name) like '%deadlift%' then 'cable_row'
    when lower(name) like '%leg press%' or lower(name) like '%extension%' or (lower(name) like '%curl%' and muscle_group = 'legs') then 'leg_press'
    when lower(name) like '%squat%' or lower(name) like '%lunge%' or lower(name) like '%calf%' then 'squat'
    when lower(name) like '%shoulder%' or lower(name) like '%raise%' or lower(name) like '%overhead%' then 'shoulder_press'
    when lower(name) like '%tricep%' or lower(name) like '%pushdown%' or lower(name) like '%dip%' then 'tricep_pushdown'
    when lower(name) like '%bicep%' or lower(name) like '%curl%' then 'bicep_curl'
    when muscle_group = 'core' then 'core_plank'
    when muscle_group = 'cardio' then 'cardio_hiit'
    else animation_key
  end,
  form_cues = coalesce(
    form_cues,
    case
      when muscle_group = 'chest' then 'Keep shoulder blades retracted, elbows at 45 degrees, control the descent for 2 seconds.'
      when muscle_group = 'back' then 'Lead the pull with your elbows, pause 1 second at peak contraction, avoid swinging torso.'
      when muscle_group = 'legs' then 'Brace your core, drive through mid-foot, keep knees tracking cleanly over toes.'
      when muscle_group = 'shoulders' then 'Keep ribs stacked over pelvis, avoid shrugging traps, control the lowering phase.'
      when muscle_group = 'arms' then 'Lock elbows close to your ribs and squeeze the target muscle without momentum.'
      when muscle_group = 'core' then 'Maintain neutral spine, exhale steadily, and keep pelvis slightly tucked.'
      else 'Maintain steady breathing cadence and controlled posture throughout each rep.'
    end
  )
where business_id is null;

-- ============================================================================
-- 3. RPC: public.upsert_and_approve_gym_coach_plan
-- ============================================================================
create or replace function public.upsert_and_approve_gym_coach_plan(
  p_business_id uuid,
  p_member_id uuid,
  p_trainer_id uuid default null,
  p_plan_title text default 'Personalized Transformation Plan',
  p_schedule_mode text default 'fixed_week',
  p_weekly_schedule jsonb default '[]'::jsonb,
  p_daily_calories_kcal integer default 2200,
  p_protein_grams integer default 140,
  p_carbs_grams integer default 230,
  p_fats_grams integer default 65,
  p_water_liters numeric default 3.5,
  p_nutrition_meals jsonb default '[]'::jsonb,
  p_supplement_notes text default null,
  p_coach_notes text default null,
  p_approved_by text default 'Coach'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_member record;
  v_trainer_name text := null;
  v_clean_title text := pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_plan_title), ''), 'Personalized Transformation Plan'), 1, 120);
  v_clean_mode text := case when p_schedule_mode = 'rotation' then 'rotation' else 'fixed_week' end;
  v_plan public.gym_member_coach_plans%rowtype;
begin
  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  select m.id, m.business_id into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found then
    raise exception 'Gym member not found in this business.' using errcode = '22023';
  end if;

  if p_trainer_id is not null then
    select t.trainer_name into v_trainer_name
      from public.gym_trainers t
     where t.id = p_trainer_id
       and t.business_id = v_biz.id
     limit 1;
  end if;

  insert into public.gym_member_coach_plans (
    business_id,
    member_id,
    trainer_id,
    plan_title,
    schedule_mode,
    weekly_schedule,
    daily_calories_kcal,
    protein_grams,
    carbs_grams,
    fats_grams,
    water_liters,
    nutrition_meals,
    supplement_notes,
    coach_notes,
    approval_status,
    approved_by,
    approved_at,
    updated_at
  )
  values (
    v_biz.id,
    v_member.id,
    case when v_trainer_name is not null then p_trainer_id else null end,
    v_clean_title,
    v_clean_mode,
    case when jsonb_typeof(coalesce(p_weekly_schedule, '[]'::jsonb)) = 'array' then coalesce(p_weekly_schedule, '[]'::jsonb) else '[]'::jsonb end,
    greatest(800, least(8000, coalesce(p_daily_calories_kcal, 2200))),
    greatest(20, least(500, coalesce(p_protein_grams, 140))),
    greatest(0, least(1000, coalesce(p_carbs_grams, 230))),
    greatest(10, least(300, coalesce(p_fats_grams, 65))),
    greatest(0.5, least(12.0, coalesce(p_water_liters, 3.5))),
    case when jsonb_typeof(coalesce(p_nutrition_meals, '[]'::jsonb)) = 'array' then coalesce(p_nutrition_meals, '[]'::jsonb) else '[]'::jsonb end,
    nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_supplement_notes, '')), 1, 500), ''),
    nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_coach_notes, '')), 1, 600), ''),
    'approved',
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_approved_by), ''), coalesce(v_trainer_name, 'Coach')), 1, 80),
    now(),
    now()
  )
  on conflict (member_id) do update set
    trainer_id = excluded.trainer_id,
    plan_title = excluded.plan_title,
    schedule_mode = excluded.schedule_mode,
    weekly_schedule = excluded.weekly_schedule,
    daily_calories_kcal = excluded.daily_calories_kcal,
    protein_grams = excluded.protein_grams,
    carbs_grams = excluded.carbs_grams,
    fats_grams = excluded.fats_grams,
    water_liters = excluded.water_liters,
    nutrition_meals = excluded.nutrition_meals,
    supplement_notes = excluded.supplement_notes,
    coach_notes = excluded.coach_notes,
    approval_status = 'approved',
    approved_by = excluded.approved_by,
    approved_at = now(),
    updated_at = now()
  returning * into v_plan;

  if p_trainer_id is not null and v_trainer_name is not null then
    update public.gym_members
       set pt_trainer_id = p_trainer_id,
           trainer_notes = coalesce(nullif(pg_catalog.btrim(coalesce(p_coach_notes, '')), ''), trainer_notes),
           updated_at = now()
     where id = v_member.id;
  end if;

  return jsonb_build_object(
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

revoke all on function public.upsert_and_approve_gym_coach_plan(
  uuid, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, numeric, jsonb, text, text, text
) from public, anon;
grant execute on function public.upsert_and_approve_gym_coach_plan(
  uuid, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, numeric, jsonb, text, text, text
) to authenticated, service_role;

-- ============================================================================
-- 4. RPC: public.get_gym_member_full_athlete_hub
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
    select t.trainer_name into v_trainer_name
      from public.gym_trainers t
     where t.id = v_coach_plan.trainer_id
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

  -- Recovery insight from set logs
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

  -- Previous session summary per exercise (excluding today)
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

  -- Personal records
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

  -- Exercise catalog with animation metadata
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
        'animationGifUrl', e.animation_gif_url,
        'formCues', e.form_cues
      ) order by e.muscle_group asc, e.name asc
    ),
    '[]'::jsonb
  ) into v_catalog
  from public.gym_exercises e
  where e.business_id is null or e.business_id = v_biz.id;

  return jsonb_build_object(
    'memberId', v_member.id,
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

revoke all on function public.get_gym_member_full_athlete_hub(text, uuid) from public;
grant execute on function public.get_gym_member_full_athlete_hub(text, uuid) to anon, authenticated, service_role;

commit;
