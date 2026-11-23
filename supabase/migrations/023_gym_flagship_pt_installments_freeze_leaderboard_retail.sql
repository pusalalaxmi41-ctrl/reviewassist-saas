-- ============================================================================
-- Vitaran AI Reviews / GymOS — Flagship Upgrade:
-- PT Commissions, Installment Balance Tracker, Membership Freeze/Resume,
-- 30-Day Body Transformation Journal, Monthly Streak Leaderboard &
-- Front-Desk Supplement / Protein Bar Counter (Single Static Entrance QR)
-- Migration: 023_gym_flagship_pt_installments_freeze_leaderboard_retail.sql
-- Depends on: 001..022 (extends gym_members, gym_check_ins, gym_payment_logs)
--
-- Security Guardrails:
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY
-- - REVOKE ALL FROM public, anon on every new table
-- - Every SECURITY DEFINER RPC locks search_path = pg_catalog, public, pg_temp
-- - Uses pg_catalog.substr exclusively (no SQL-standard substr/from syntax)
-- ============================================================================

begin;

-- ============================================================================
-- 1. NEW TABLE: public.gym_trainers (Personal Trainers & Commission Rates)
-- ============================================================================
create table if not exists public.gym_trainers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  trainer_name text not null,
  specialty text not null default 'Strength & Conditioning',
  commission_percent numeric(5,2) not null default 50.00
    check (commission_percent >= 0 and commission_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint gym_trainers_name_len_chk check (pg_catalog.char_length(pg_catalog.btrim(trainer_name)) between 2 and 80),
  constraint gym_trainers_specialty_len_chk check (pg_catalog.char_length(pg_catalog.btrim(specialty)) between 2 and 120)
);

create index if not exists idx_gym_trainers_biz_active
  on public.gym_trainers (business_id, is_active, created_at asc);

alter table public.gym_trainers enable row level security;
alter table public.gym_trainers force row level security;

revoke all on table public.gym_trainers from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_trainers to authenticated;
grant all on table public.gym_trainers to service_role;

drop policy if exists "gym_trainers_owner_all" on public.gym_trainers;
create policy "gym_trainers_owner_all"
  on public.gym_trainers
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_trainers.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_trainers.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. NEW TABLE: public.gym_body_measurements (30-Day Transformation Journal)
-- ============================================================================
create table if not exists public.gym_body_measurements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  recorded_date date not null default current_date,
  weight_kg numeric(5,1) not null check (weight_kg >= 20 and weight_kg <= 300),
  waist_inches numeric(4,1) check (waist_inches is null or (waist_inches >= 15 and waist_inches <= 80)),
  chest_inches numeric(4,1) check (chest_inches is null or (chest_inches >= 20 and chest_inches <= 80)),
  biceps_inches numeric(4,1) check (biceps_inches is null or (biceps_inches >= 6 and biceps_inches <= 35)),
  bmi numeric(4,1) check (bmi is null or (bmi >= 10 and bmi <= 70)),
  note text check (note is null or pg_catalog.char_length(note) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists idx_gym_body_measurements_member_date
  on public.gym_body_measurements (business_id, member_id, recorded_date desc, created_at desc);

alter table public.gym_body_measurements enable row level security;
alter table public.gym_body_measurements force row level security;

revoke all on table public.gym_body_measurements from public, anon, authenticated;
grant select, insert, delete on table public.gym_body_measurements to authenticated;
grant all on table public.gym_body_measurements to service_role;

drop policy if exists "gym_body_measurements_owner_all" on public.gym_body_measurements;
create policy "gym_body_measurements_owner_all"
  on public.gym_body_measurements
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_body_measurements.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_body_measurements.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. NEW TABLES: public.gym_retail_products & public.gym_retail_sales
--    (Front-Desk Supplement & Protein Bar Counter POS)
-- ============================================================================
create table if not exists public.gym_retail_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_name text not null,
  price_paise integer not null check (price_paise >= 0 and price_paise <= 10000000),
  stock_qty integer not null default 50 check (stock_qty >= 0 and stock_qty <= 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint gym_retail_products_name_len_chk check (pg_catalog.char_length(pg_catalog.btrim(product_name)) between 2 and 100)
);

create index if not exists idx_gym_retail_products_biz_active
  on public.gym_retail_products (business_id, is_active, created_at asc);

alter table public.gym_retail_products enable row level security;
alter table public.gym_retail_products force row level security;

revoke all on table public.gym_retail_products from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_retail_products to authenticated;
grant all on table public.gym_retail_products to service_role;

drop policy if exists "gym_retail_products_owner_all" on public.gym_retail_products;
create policy "gym_retail_products_owner_all"
  on public.gym_retail_products
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_retail_products.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_retail_products.business_id
        and b.owner_id = auth.uid()
    )
  );

create table if not exists public.gym_retail_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.gym_retail_products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 100),
  total_paise integer not null check (total_paise >= 0 and total_paise <= 100000000),
  payment_method text not null default 'upi' check (payment_method in ('cash', 'upi')),
  member_name text check (member_name is null or pg_catalog.char_length(member_name) <= 80),
  sold_at timestamptz not null default now()
);

create index if not exists idx_gym_retail_sales_biz_sold
  on public.gym_retail_sales (business_id, sold_at desc);

alter table public.gym_retail_sales enable row level security;
alter table public.gym_retail_sales force row level security;

revoke all on table public.gym_retail_sales from public, anon, authenticated;
grant select, insert, delete on table public.gym_retail_sales to authenticated;
grant all on table public.gym_retail_sales to service_role;

drop policy if exists "gym_retail_sales_owner_all" on public.gym_retail_sales;
create policy "gym_retail_sales_owner_all"
  on public.gym_retail_sales
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_retail_sales.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_retail_sales.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3B. NEW TABLE: public.gym_workout_sessions (OpenGym Guided Workout & PR Log)
-- ============================================================================
create table if not exists public.gym_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  session_date date not null default current_date,
  plan_id text not null default 'ppl',
  routine_name text not null default 'Custom Workout',
  workout_focus text not null default 'full_body',
  duration_minutes integer not null default 45 check (duration_minutes between 1 and 360),
  total_volume_kg numeric(10,1) not null default 0 check (total_volume_kg >= 0),
  total_sets integer not null default 0 check (total_sets >= 0),
  prs_hit_count integer not null default 0 check (prs_hit_count >= 0),
  muscles_trained jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint gym_workout_sessions_exercises_arr_chk check (jsonb_typeof(exercises) = 'array'),
  constraint gym_workout_sessions_muscles_arr_chk check (jsonb_typeof(muscles_trained) = 'array')
);

create index if not exists idx_gym_workout_sessions_member_date
  on public.gym_workout_sessions (business_id, member_id, session_date desc, created_at desc);

alter table public.gym_workout_sessions enable row level security;
alter table public.gym_workout_sessions force row level security;

revoke all on table public.gym_workout_sessions from public, anon, authenticated;
grant select, insert, delete on table public.gym_workout_sessions to authenticated;
grant all on table public.gym_workout_sessions to service_role;

drop policy if exists "gym_workout_sessions_owner_all" on public.gym_workout_sessions;
create policy "gym_workout_sessions_owner_all"
  on public.gym_workout_sessions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_sessions.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_sessions.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 3C. NEW TABLES: OpenGym Workout Engine (Catalog, Routines & Set/PR Logger)
--     public.gym_exercises, public.gym_workout_routines, public.gym_workout_set_logs
-- ============================================================================
create table if not exists public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  muscle_group text not null
    check (muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body')),
  equipment text not null default 'barbell'
    check (equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'cardio_machine')),
  default_sets integer not null default 3 check (default_sets between 1 and 10),
  default_reps text not null default '10-12',
  rest_seconds integer not null default 60 check (rest_seconds between 15 and 300),
  created_at timestamptz not null default now(),
  constraint gym_exercises_name_len_chk check (pg_catalog.char_length(pg_catalog.btrim(name)) between 2 and 100)
);

create index if not exists idx_gym_exercises_biz_muscle
  on public.gym_exercises (business_id, muscle_group, name);

alter table public.gym_exercises enable row level security;
alter table public.gym_exercises force row level security;

revoke all on table public.gym_exercises from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_exercises to authenticated;
grant all on table public.gym_exercises to service_role;

drop policy if exists "gym_exercises_read_global_or_owned" on public.gym_exercises;
create policy "gym_exercises_read_global_or_owned"
  on public.gym_exercises
  for select
  to authenticated
  using (
    business_id is null
    or exists (
      select 1 from public.businesses b
      where b.id = gym_exercises.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_exercises_owner_write" on public.gym_exercises;
create policy "gym_exercises_owner_write"
  on public.gym_exercises
  for insert
  to authenticated
  with check (
    business_id is not null
    and exists (
      select 1 from public.businesses b
      where b.id = gym_exercises.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_exercises_owner_update" on public.gym_exercises;
create policy "gym_exercises_owner_update"
  on public.gym_exercises
  for update
  to authenticated
  using (
    business_id is not null
    and exists (
      select 1 from public.businesses b
      where b.id = gym_exercises.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    business_id is not null
    and exists (
      select 1 from public.businesses b
      where b.id = gym_exercises.business_id
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "gym_exercises_owner_delete" on public.gym_exercises;
create policy "gym_exercises_owner_delete"
  on public.gym_exercises
  for delete
  to authenticated
  using (
    business_id is not null
    and exists (
      select 1 from public.businesses b
      where b.id = gym_exercises.business_id
        and b.owner_id = auth.uid()
    )
  );

-- Seed 24 essential Indian gym exercises globally (business_id IS NULL, idempotent)
insert into public.gym_exercises (business_id, name, muscle_group, equipment, default_sets, default_reps, rest_seconds)
select null, v.name, v.muscle_group, v.equipment, v.default_sets, v.default_reps, v.rest_seconds
from (
  values
    ('Barbell Bench Press', 'chest', 'barbell', 4, '8-10', 90),
    ('Incline Dumbbell Press', 'chest', 'dumbbell', 3, '10-12', 75),
    ('Cable Chest Fly', 'chest', 'cable', 3, '12-15', 60),
    ('Pec Deck Machine Fly', 'chest', 'machine', 3, '12-15', 60),
    ('Wide-Grip Lat Pulldown', 'back', 'cable', 4, '10-12', 75),
    ('Bent-Over Barbell Row', 'back', 'barbell', 4, '8-10', 90),
    ('Seated Cable Row', 'back', 'cable', 3, '10-12', 75),
    ('Barbell Deadlift', 'back', 'barbell', 3, '5-6', 150),
    ('Barbell Back Squat', 'legs', 'barbell', 4, '6-8', 120),
    ('45° Leg Press Machine', 'legs', 'machine', 4, '10-12', 90),
    ('Romanian Deadlift (RDL)', 'legs', 'barbell', 3, '10-12', 90),
    ('Seated Leg Curl', 'legs', 'machine', 3, '12-15', 60),
    ('Standing Calf Raise', 'legs', 'machine', 4, '15-20', 45),
    ('Overhead Barbell Press (OHP)', 'shoulders', 'barbell', 4, '6-8', 90),
    ('Seated Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 3, '10-12', 75),
    ('Dumbbell Lateral Raises', 'shoulders', 'dumbbell', 4, '12-15', 60),
    ('Cable Face Pulls', 'shoulders', 'cable', 3, '15', 60),
    ('EZ-Bar Bicep Curl', 'arms', 'barbell', 3, '10-12', 60),
    ('Dumbbell Hammer Curl', 'arms', 'dumbbell', 3, '12', 60),
    ('Tricep Rope Pushdown', 'arms', 'cable', 3, '12-15', 60),
    ('Hanging Leg Raises', 'core', 'bodyweight', 3, '12-15', 60),
    ('Kneeling Cable Crunch', 'core', 'cable', 3, '15', 60),
    ('Treadmill HIIT Intervals', 'cardio', 'cardio_machine', 1, '15 min', 60),
    ('Weighted / Classic Push-Ups', 'full_body', 'bodyweight', 3, '15', 60)
) as v(name, muscle_group, equipment, default_sets, default_reps, rest_seconds)
where not exists (
  select 1 from public.gym_exercises e
  where e.business_id is null and e.name = v.name
);

create table if not exists public.gym_workout_routines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  routine_name text not null,
  target_goal text not null default 'general_fitness',
  exercises jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint gym_workout_routines_name_len_chk check (pg_catalog.char_length(pg_catalog.btrim(routine_name)) between 2 and 100),
  constraint gym_workout_routines_ex_arr_chk check (jsonb_typeof(exercises) = 'array')
);

create index if not exists idx_gym_workout_routines_biz
  on public.gym_workout_routines (business_id, created_at desc);

alter table public.gym_workout_routines enable row level security;
alter table public.gym_workout_routines force row level security;

revoke all on table public.gym_workout_routines from public, anon, authenticated;
grant select, insert, update, delete on table public.gym_workout_routines to authenticated;
grant all on table public.gym_workout_routines to service_role;

drop policy if exists "gym_workout_routines_owner_all" on public.gym_workout_routines;
create policy "gym_workout_routines_owner_all"
  on public.gym_workout_routines
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_routines.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_routines.business_id
        and b.owner_id = auth.uid()
    )
  );

create table if not exists public.gym_workout_set_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  exercise_id uuid references public.gym_exercises(id) on delete set null,
  exercise_name text not null,
  muscle_group text not null,
  workout_date date not null default current_date,
  set_number integer not null default 1 check (set_number between 1 and 20),
  weight_kg numeric(6,2) not null default 0 check (weight_kg >= 0 and weight_kg <= 1000),
  reps integer not null default 1 check (reps between 1 and 200),
  estimated_1rm_kg numeric(6,2) not null default 0 check (estimated_1rm_kg >= 0),
  is_personal_record boolean not null default false,
  logged_at timestamptz not null default now()
);

create index if not exists idx_gym_workout_set_logs_member_date
  on public.gym_workout_set_logs (business_id, member_id, workout_date desc, logged_at desc);

create index if not exists idx_gym_workout_set_logs_member_ex
  on public.gym_workout_set_logs (business_id, member_id, exercise_name);

alter table public.gym_workout_set_logs enable row level security;
alter table public.gym_workout_set_logs force row level security;

revoke all on table public.gym_workout_set_logs from public, anon, authenticated;
grant select, insert, delete on table public.gym_workout_set_logs to authenticated;
grant all on table public.gym_workout_set_logs to service_role;

drop policy if exists "gym_workout_set_logs_owner_all" on public.gym_workout_set_logs;
create policy "gym_workout_set_logs_owner_all"
  on public.gym_workout_set_logs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_set_logs.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_workout_set_logs.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. EXTEND public.gym_members, public.gym_check_ins & public.gym_payment_logs
-- ============================================================================
alter table public.gym_members
  add column if not exists total_plan_amount_paise integer not null default 0,
  add column if not exists amount_paid_paise integer not null default 0,
  add column if not exists balance_due_paise integer not null default 0,
  add column if not exists balance_due_date date,
  add column if not exists pt_trainer_id uuid references public.gym_trainers(id) on delete set null,
  add column if not exists pt_package_name text,
  add column if not exists pt_package_fee_paise integer not null default 0,
  add column if not exists pt_total_sessions integer not null default 0,
  add column if not exists pt_remaining_sessions integer not null default 0,
  add column if not exists is_frozen boolean not null default false,
  add column if not exists frozen_started_at date,
  add column if not exists total_frozen_days integer not null default 0,
  add column if not exists current_streak_days integer not null default 0,
  add column if not exists best_streak_days integer not null default 0,
  add column if not exists assigned_routine_id uuid references public.gym_workout_routines(id) on delete set null;

alter table public.gym_members
  drop constraint if exists gym_members_balance_nonneg_chk;
alter table public.gym_members
  add constraint gym_members_balance_nonneg_chk
    check (
      total_plan_amount_paise >= 0
      and amount_paid_paise >= 0
      and balance_due_paise >= 0
      and pt_package_fee_paise >= 0
      and pt_total_sessions >= 0
      and pt_remaining_sessions >= 0
      and total_frozen_days >= 0
      and current_streak_days >= 0
      and best_streak_days >= 0
    );

-- Backfill existing active members so total_plan_amount_paise & amount_paid_paise reflect fee_paise
update public.gym_members
   set total_plan_amount_paise = fee_paise,
       amount_paid_paise = case when status in ('active', 'expired') then fee_paise else 0 end
 where total_plan_amount_paise = 0
   and fee_paise > 0;

alter table public.gym_check_ins
  add column if not exists is_pt_session boolean not null default false,
  add column if not exists trainer_id uuid references public.gym_trainers(id) on delete set null;

create index if not exists idx_gym_check_ins_trainer_date
  on public.gym_check_ins (business_id, trainer_id, check_in_date desc)
  where trainer_id is not null;

alter table public.gym_payment_logs
  add column if not exists payment_method text not null default 'upi',
  add column if not exists pt_trainer_id uuid references public.gym_trainers(id) on delete set null,
  add column if not exists pt_fee_paise integer not null default 0;

alter table public.gym_payment_logs
  drop constraint if exists gym_payment_logs_payment_type_check;
alter table public.gym_payment_logs
  add constraint gym_payment_logs_payment_type_check
    check (payment_type in ('approval', 'renewal', 'balance_due'));

alter table public.gym_payment_logs
  drop constraint if exists gym_payment_logs_payment_method_chk;
alter table public.gym_payment_logs
  add constraint gym_payment_logs_payment_method_chk
    check (payment_method in ('cash', 'upi'));

-- ============================================================================
-- 5. UPGRADE RPC 1: public.owner_approve_or_renew_gym_member
--    Supports Full OR Part-Payment / Installments + Optional PT Package
-- ============================================================================
drop function if exists public.owner_approve_or_renew_gym_member(uuid, uuid, text, text, integer, integer, text);

create or replace function public.owner_approve_or_renew_gym_member(
  p_business_id uuid,
  p_member_id uuid,
  p_action text,
  p_plan_id text default null,
  p_duration_days integer default null,
  p_fee_paise integer default null,
  p_staff_label text default 'Owner',
  p_amount_paid_paise integer default null,
  p_balance_due_date date default null,
  p_pt_trainer_id uuid default null,
  p_pt_package_name text default null,
  p_pt_sessions integer default 0,
  p_pt_fee_paise integer default 0,
  p_payment_method text default 'upi'
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
  v_pay_method text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payment_method, 'upi')));
  v_member public.gym_members%rowtype;
  v_cfg public.gym_configs%rowtype;
  v_plan jsonb;
  v_plan_id text;
  v_plan_name text;
  v_duration_days integer;
  v_fee_paise integer;
  v_pt_trainer_id uuid := null;
  v_pt_trainer_name text := null;
  v_pt_sessions integer := greatest(0, least(500, coalesce(p_pt_sessions, 0)));
  v_pt_fee_paise integer := greatest(0, least(100000000, coalesce(p_pt_fee_paise, 0)));
  v_pt_pkg_name text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_pt_package_name, '')), 1, 80), '');
  v_total_due integer := 0;
  v_paid_now integer := 0;
  v_balance_due integer := 0;
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

  if v_pay_method not in ('cash', 'upi') then
    v_pay_method := 'upi';
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

  if p_pt_trainer_id is not null then
    select t.id, t.trainer_name into v_pt_trainer_id, v_pt_trainer_name
      from public.gym_trainers t
     where t.id = p_pt_trainer_id
       and t.business_id = v_biz.id
     limit 1;
    if v_pt_trainer_id is null then
      raise exception 'Selected Personal Trainer not found for this gym.' using errcode = 'P0002';
    end if;
    if v_pt_pkg_name is null and v_pt_sessions > 0 then
      v_pt_pkg_name := v_pt_sessions::text || ' PT Sessions';
    end if;
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
  v_total_due := v_fee_paise + v_pt_fee_paise;
  if p_amount_paid_paise is null then
    v_paid_now := v_total_due;
  else
    v_paid_now := greatest(0, least(v_total_due, p_amount_paid_paise));
  end if;
  v_balance_due := greatest(0, v_total_due - v_paid_now);

  if v_action = 'approve' then
    v_new_start := current_date;
    v_new_end := current_date + v_duration_days;
    update public.gym_members
       set status = 'active',
           is_frozen = false,
           frozen_started_at = null,
           plan_id = v_plan_id,
           plan_name = pg_catalog.substr(v_plan_name, 1, 80),
           duration_days = v_duration_days,
           fee_paise = v_fee_paise,
           total_plan_amount_paise = v_total_due,
           amount_paid_paise = v_paid_now,
           balance_due_paise = v_balance_due,
           balance_due_date = case when v_balance_due > 0 then coalesce(p_balance_due_date, current_date + 14) else null end,
           pt_trainer_id = coalesce(v_pt_trainer_id, pt_trainer_id),
           pt_package_name = coalesce(v_pt_pkg_name, pt_package_name),
           pt_package_fee_paise = case when v_pt_fee_paise > 0 then v_pt_fee_paise else pt_package_fee_paise end,
           pt_total_sessions = case when v_pt_sessions > 0 then v_pt_sessions else pt_total_sessions end,
           pt_remaining_sessions = case when v_pt_sessions > 0 then v_pt_sessions else pt_remaining_sessions end,
           start_date = v_new_start,
           end_date = v_new_end,
           approved_by_label = v_clean_label,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;

    if v_paid_now > 0 then
      insert into public.gym_payment_logs (
        business_id, member_id, payment_type, payment_method, plan_id, plan_name,
        duration_days, amount_paise, pt_trainer_id, pt_fee_paise, paid_date, recorded_by_label
      ) values (
        v_biz.id, v_member.id, 'approval', v_pay_method, v_plan_id, pg_catalog.substr(v_plan_name, 1, 80),
        v_duration_days, v_paid_now, v_pt_trainer_id, v_pt_fee_paise, current_date, v_clean_label
      );
    end if;
  elsif v_action = 'renew' then
    v_base_date := greatest(coalesce(v_member.end_date, current_date), current_date);
    v_new_start := coalesce(v_member.start_date, current_date);
    v_new_end := v_base_date + v_duration_days;
    update public.gym_members
       set status = 'active',
           is_frozen = false,
           frozen_started_at = null,
           plan_id = v_plan_id,
           plan_name = pg_catalog.substr(v_plan_name, 1, 80),
           duration_days = v_duration_days,
           fee_paise = v_fee_paise,
           total_plan_amount_paise = v_total_due,
           amount_paid_paise = v_paid_now,
           balance_due_paise = v_member.balance_due_paise + v_balance_due,
           balance_due_date = case
             when (v_member.balance_due_paise + v_balance_due) > 0
               then coalesce(p_balance_due_date, v_member.balance_due_date, current_date + 14)
             else null
           end,
           pt_trainer_id = coalesce(v_pt_trainer_id, pt_trainer_id),
           pt_package_name = coalesce(v_pt_pkg_name, pt_package_name),
           pt_package_fee_paise = case when v_pt_fee_paise > 0 then v_pt_fee_paise else pt_package_fee_paise end,
           pt_total_sessions = case when v_pt_sessions > 0 then v_member.pt_total_sessions + v_pt_sessions else pt_total_sessions end,
           pt_remaining_sessions = case when v_pt_sessions > 0 then v_member.pt_remaining_sessions + v_pt_sessions else pt_remaining_sessions end,
           start_date = v_new_start,
           end_date = v_new_end,
           approved_by_label = v_clean_label,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;

    if v_paid_now > 0 then
      insert into public.gym_payment_logs (
        business_id, member_id, payment_type, payment_method, plan_id, plan_name,
        duration_days, amount_paise, pt_trainer_id, pt_fee_paise, paid_date, recorded_by_label
      ) values (
        v_biz.id, v_member.id, 'renewal', v_pay_method, v_plan_id, pg_catalog.substr(v_plan_name, 1, 80),
        v_duration_days, v_paid_now, v_pt_trainer_id, v_pt_fee_paise, current_date, v_clean_label
      );
    end if;
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

  if v_member.pt_trainer_id is not null and v_pt_trainer_name is null then
    select t.trainer_name into v_pt_trainer_name
      from public.gym_trainers t
     where t.id = v_member.pt_trainer_id
     limit 1;
  end if;

  if v_member.is_frozen and v_member.status = 'active' then
    v_eff_status := 'frozen';
    v_days_remaining := greatest(0, coalesce(v_member.end_date - current_date, 0));
  elsif v_member.status = 'active' and v_member.end_date is not null then
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
    'totalPlanAmountPaise', v_member.total_plan_amount_paise,
    'amountPaidPaise', v_member.amount_paid_paise,
    'balanceDuePaise', v_member.balance_due_paise,
    'balanceDueDate', v_member.balance_due_date,
    'ptTrainerId', v_member.pt_trainer_id,
    'ptTrainerName', v_pt_trainer_name,
    'ptPackageName', v_member.pt_package_name,
    'ptPackageFeePaise', v_member.pt_package_fee_paise,
    'ptTotalSessions', v_member.pt_total_sessions,
    'ptRemainingSessions', v_member.pt_remaining_sessions,
    'isFrozen', v_member.is_frozen,
    'frozenStartedAt', v_member.frozen_started_at,
    'totalFrozenDays', v_member.total_frozen_days,
    'currentStreakDays', v_member.current_streak_days,
    'bestStreakDays', v_member.best_streak_days,
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

revoke all on function public.owner_approve_or_renew_gym_member(uuid, uuid, text, text, integer, integer, text, integer, date, uuid, text, integer, integer, text) from public;
grant execute on function public.owner_approve_or_renew_gym_member(uuid, uuid, text, text, integer, integer, text, integer, date, uuid, text, integer, integer, text) to authenticated, service_role;

-- ============================================================================
-- 6. NEW RPC 2: public.collect_gym_balance_due
-- ============================================================================
create or replace function public.collect_gym_balance_due(
  p_business_id uuid,
  p_member_id uuid,
  p_collected_paise integer,
  p_payment_method text default 'upi'
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
  v_pay_method text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payment_method, 'upi')));
  v_applied integer := 0;
  v_new_balance integer := 0;
  v_trainer_name text := null;
begin
  if p_collected_paise is null or p_collected_paise <= 0 then
    raise exception 'Collected amount must be greater than zero.' using errcode = '22023';
  end if;

  if v_pay_method not in ('cash', 'upi') then
    v_pay_method := 'upi';
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

  if v_member.balance_due_paise <= 0 then
    raise exception 'This member has no pending balance due.' using errcode = '22023';
  end if;

  v_applied := least(v_member.balance_due_paise, p_collected_paise);
  v_new_balance := greatest(0, v_member.balance_due_paise - v_applied);

  update public.gym_members
     set amount_paid_paise = amount_paid_paise + v_applied,
         balance_due_paise = v_new_balance,
         balance_due_date = case when v_new_balance = 0 then null else balance_due_date end,
         updated_at = pg_catalog.clock_timestamp()
   where id = v_member.id
   returning * into v_member;

  insert into public.gym_payment_logs (
    business_id, member_id, payment_type, payment_method, plan_id, plan_name,
    duration_days, amount_paise, paid_date, recorded_by_label
  ) values (
    v_biz.id, v_member.id, 'balance_due', v_pay_method, v_member.plan_id,
    v_member.plan_name || ' (Balance Due)', v_member.duration_days,
    v_applied, current_date, 'Owner'
  );

  if v_member.pt_trainer_id is not null then
    select t.trainer_name into v_trainer_name
      from public.gym_trainers t
     where t.id = v_member.pt_trainer_id
     limit 1;
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
    'totalPlanAmountPaise', v_member.total_plan_amount_paise,
    'amountPaidPaise', v_member.amount_paid_paise,
    'balanceDuePaise', v_member.balance_due_paise,
    'balanceDueDate', v_member.balance_due_date,
    'ptTrainerId', v_member.pt_trainer_id,
    'ptTrainerName', v_trainer_name,
    'ptPackageName', v_member.pt_package_name,
    'ptPackageFeePaise', v_member.pt_package_fee_paise,
    'ptTotalSessions', v_member.pt_total_sessions,
    'ptRemainingSessions', v_member.pt_remaining_sessions,
    'isFrozen', v_member.is_frozen,
    'frozenStartedAt', v_member.frozen_started_at,
    'totalFrozenDays', v_member.total_frozen_days,
    'currentStreakDays', v_member.current_streak_days,
    'bestStreakDays', v_member.best_streak_days,
    'status', v_member.status,
    'effectiveStatus', case
      when v_member.is_frozen and v_member.status = 'active' then 'frozen'
      when v_member.status = 'active' and v_member.end_date is not null and v_member.end_date < current_date then 'expired'
      else v_member.status
    end,
    'daysRemaining', case
      when v_member.status = 'active' and v_member.end_date is not null then greatest(0, v_member.end_date - current_date)
      else 0
    end,
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'lastCheckInDate', v_member.last_check_in_date,
    'checkedInToday', (v_member.last_check_in_date = current_date),
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.collect_gym_balance_due(uuid, uuid, integer, text) from public;
grant execute on function public.collect_gym_balance_due(uuid, uuid, integer, text) to authenticated, service_role;

-- ============================================================================
-- 7. NEW RPC 3: public.toggle_gym_membership_freeze
--    'freeze' pauses pass; 'resume' auto-extends end_date by exact paused days
-- ============================================================================
create or replace function public.toggle_gym_membership_freeze(
  p_business_id uuid,
  p_member_id uuid,
  p_action text
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
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_paused_days integer := 0;
  v_new_end date;
begin
  if v_action not in ('freeze', 'resume') then
    raise exception 'Freeze action must be "freeze" or "resume".' using errcode = '22023';
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

  if v_member.status <> 'active' then
    raise exception 'Only active memberships can be frozen or resumed.' using errcode = '22023';
  end if;

  if v_action = 'freeze' then
    if v_member.is_frozen then
      raise exception 'Membership is already frozen.' using errcode = '22023';
    end if;
    update public.gym_members
       set is_frozen = true,
           frozen_started_at = current_date,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
     returning * into v_member;
  else
    if not v_member.is_frozen then
      raise exception 'Membership is not currently frozen.' using errcode = '22023';
    end if;
    v_paused_days := greatest(1, current_date - coalesce(v_member.frozen_started_at, current_date));
    v_new_end := coalesce(v_member.end_date, current_date) + v_paused_days;
    update public.gym_members
       set is_frozen = false,
           frozen_started_at = null,
           end_date = v_new_end,
           total_frozen_days = total_frozen_days + v_paused_days,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_member.id
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
    'totalPlanAmountPaise', v_member.total_plan_amount_paise,
    'amountPaidPaise', v_member.amount_paid_paise,
    'balanceDuePaise', v_member.balance_due_paise,
    'balanceDueDate', v_member.balance_due_date,
    'isFrozen', v_member.is_frozen,
    'frozenStartedAt', v_member.frozen_started_at,
    'totalFrozenDays', v_member.total_frozen_days,
    'currentStreakDays', v_member.current_streak_days,
    'bestStreakDays', v_member.best_streak_days,
    'status', v_member.status,
    'effectiveStatus', case when v_member.is_frozen then 'frozen' else 'active' end,
    'daysRemaining', greatest(0, coalesce(v_member.end_date - current_date, 0)),
    'startDate', v_member.start_date,
    'endDate', v_member.end_date,
    'totalCheckIns', v_member.total_check_ins,
    'lastCheckInDate', v_member.last_check_in_date,
    'checkedInToday', (v_member.last_check_in_date = current_date),
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.toggle_gym_membership_freeze(uuid, uuid, text) from public;
grant execute on function public.toggle_gym_membership_freeze(uuid, uuid, text) to authenticated, service_role;

-- ============================================================================
-- 8. UPGRADE RPC 4: public.gym_member_daily_check_in (5 params w/ defaults)
--    Blocks frozen members, computes streaks, atomically decrements PT session
-- ============================================================================
drop function if exists public.gym_member_daily_check_in(text, text, text, text);

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
  v_month_count integer := 0;
  v_curr_month text := pg_catalog.to_char(current_date, 'YYYY-MM');
  v_next_streak integer := 1;
  v_use_pt boolean := false;
  v_used_trainer_id uuid := null;
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

  if v_member.is_frozen then
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
    'memberNote', v_log.member_note,
    'todayLog', pg_catalog.jsonb_build_object(
      'id', v_log.id,
      'businessId', v_log.business_id,
      'memberId', v_log.member_id,
      'checkInDate', v_log.check_in_date,
      'checkedInAt', v_log.checked_in_at,
      'workoutFocus', v_log.workout_focus,
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
-- 9. UPGRADE RPC 5: public.lookup_gym_member_pass(p_slug, p_phone)
--    Returns enriched member pass with PT, Balance Due, Freeze, Streak,
--    30-Day Body Measurements & Mon-Sun Weekly Activity
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
  v_trainer_name text := null;
  v_days_remaining integer := 0;
  v_eff_status text;
  v_today_log record;
  v_today_json jsonb := null;
  v_checked_in_today boolean := false;
  v_month_count integer := 0;
  v_recent_logs jsonb := '[]'::jsonb;
  v_measurements jsonb := '[]'::jsonb;
  v_recent_workouts jsonb := '[]'::jsonb;
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

  if v_member.pt_trainer_id is not null then
    select t.trainer_name into v_trainer_name
      from public.gym_trainers t
     where t.id = v_member.pt_trainer_id
     limit 1;
  end if;

  if v_member.is_frozen and v_member.status = 'active' then
    v_eff_status := 'frozen';
    v_days_remaining := greatest(0, coalesce(v_member.end_date - current_date, 0));
  elsif v_member.status = 'active' and v_member.end_date is not null then
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

  select c.id, c.check_in_date, c.checked_in_at, c.workout_focus, c.member_note, c.is_pt_session, c.trainer_id
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
      'memberNote', v_today_log.member_note,
      'isPtSession', v_today_log.is_pt_session,
      'trainerId', v_today_log.trainer_id
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
        'memberNote', r.member_note,
        'isPtSession', r.is_pt_session,
        'trainerId', r.trainer_id
      )
      order by r.check_in_date desc, r.checked_in_at desc
    ),
    '[]'::jsonb
  )
    into v_recent_logs
    from (
      select c.id, c.business_id, c.member_id, c.check_in_date, c.checked_in_at, c.workout_focus, c.member_note, c.is_pt_session, c.trainer_id
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.member_id = v_member.id
       order by c.check_in_date desc, c.checked_in_at desc
       limit 21
    ) r;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', bm.id,
        'businessId', bm.business_id,
        'memberId', bm.member_id,
        'recordedDate', bm.recorded_date,
        'weightKg', bm.weight_kg,
        'waistInches', bm.waist_inches,
        'chestInches', bm.chest_inches,
        'bicepsInches', bm.biceps_inches,
        'bmi', bm.bmi,
        'note', bm.note,
        'createdAt', bm.created_at
      )
      order by bm.recorded_date desc, bm.created_at desc
    ),
    '[]'::jsonb
  )
    into v_measurements
    from (
      select *
        from public.gym_body_measurements b
       where b.business_id = v_biz.id
         and b.member_id = v_member.id
       order by b.recorded_date desc, b.created_at desc
       limit 12
    ) bm;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', ws.id,
        'businessId', ws.business_id,
        'memberId', ws.member_id,
        'sessionDate', ws.session_date,
        'planId', ws.plan_id,
        'routineName', ws.routine_name,
        'workoutFocus', ws.workout_focus,
        'durationMinutes', ws.duration_minutes,
        'totalVolumeKg', ws.total_volume_kg,
        'totalSets', ws.total_sets,
        'prsHitCount', ws.prs_hit_count,
        'musclesTrained', ws.muscles_trained,
        'exercises', ws.exercises,
        'createdAt', ws.created_at
      )
      order by ws.session_date desc, ws.created_at desc
    ),
    '[]'::jsonb
  )
    into v_recent_workouts
    from (
      select *
        from public.gym_workout_sessions s
       where s.business_id = v_biz.id
         and s.member_id = v_member.id
       order by s.session_date desc, s.created_at desc
       limit 25
    ) ws;

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
    'totalPlanAmountPaise', v_member.total_plan_amount_paise,
    'amountPaidPaise', v_member.amount_paid_paise,
    'balanceDuePaise', v_member.balance_due_paise,
    'balanceDueDate', v_member.balance_due_date,
    'ptTrainerId', v_member.pt_trainer_id,
    'ptTrainerName', v_trainer_name,
    'ptPackageName', v_member.pt_package_name,
    'ptPackageFeePaise', v_member.pt_package_fee_paise,
    'ptTotalSessions', v_member.pt_total_sessions,
    'ptRemainingSessions', v_member.pt_remaining_sessions,
    'isFrozen', v_member.is_frozen,
    'frozenStartedAt', v_member.frozen_started_at,
    'totalFrozenDays', v_member.total_frozen_days,
    'currentStreakDays', v_member.current_streak_days,
    'bestStreakDays', v_member.best_streak_days,
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
    'bodyMeasurements', v_measurements,
    'recentWorkouts', v_recent_workouts,
    'approvedByLabel', v_member.approved_by_label,
    'createdAt', v_member.created_at,
    'updatedAt', v_member.updated_at
  );
end;
$$;

revoke all on function public.lookup_gym_member_pass(text, text) from public;
grant execute on function public.lookup_gym_member_pass(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. NEW RPC 6: public.log_gym_body_measurement (30-Day Body Journal)
-- ============================================================================
create or replace function public.log_gym_body_measurement(
  p_slug text,
  p_phone text,
  p_weight_kg numeric,
  p_waist_inches numeric default null,
  p_chest_inches numeric default null,
  p_biceps_inches numeric default null,
  p_bmi numeric default null,
  p_note text default null
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
  v_row public.gym_body_measurements%rowtype;
begin
  if p_weight_kg is null or p_weight_kg < 20 or p_weight_kg > 300 then
    raise exception 'Weight must be between 20 and 300 kg.' using errcode = '22023';
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
   limit 1;

  if not found then
    raise exception 'Member not found for this phone number.' using errcode = 'P0002';
  end if;

  insert into public.gym_body_measurements (
    business_id,
    member_id,
    recorded_date,
    weight_kg,
    waist_inches,
    chest_inches,
    biceps_inches,
    bmi,
    note
  )
  values (
    v_biz.id,
    v_member.id,
    current_date,
    round(p_weight_kg::numeric, 1),
    case when p_waist_inches is not null then round(p_waist_inches::numeric, 1) else null end,
    case when p_chest_inches is not null then round(p_chest_inches::numeric, 1) else null end,
    case when p_biceps_inches is not null then round(p_biceps_inches::numeric, 1) else null end,
    case when p_bmi is not null then round(p_bmi::numeric, 1) else null end,
    nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_note, '')), 1, 280), '')
  )
  returning * into v_row;

  return pg_catalog.jsonb_build_object(
    'id', v_row.id,
    'businessId', v_row.business_id,
    'memberId', v_row.member_id,
    'recordedDate', v_row.recorded_date,
    'weightKg', v_row.weight_kg,
    'waistInches', v_row.waist_inches,
    'chestInches', v_row.chest_inches,
    'bicepsInches', v_row.biceps_inches,
    'bmi', v_row.bmi,
    'note', v_row.note,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.log_gym_body_measurement(text, text, numeric, numeric, numeric, numeric, numeric, text) from public;
grant execute on function public.log_gym_body_measurement(text, text, numeric, numeric, numeric, numeric, numeric, text) to anon, authenticated, service_role;

-- ============================================================================
-- 11. NEW RPC 7: public.get_gym_monthly_leaderboard(p_slug)
--     Privacy-safe Top-10 Consistency Leaderboard (First Name + Last Initial)
-- ============================================================================
create or replace function public.get_gym_monthly_leaderboard(
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
  v_curr_month text := pg_catalog.to_char(current_date, 'YYYY-MM');
  v_rows jsonb := '[]'::jsonb;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    return '[]'::jsonb;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'rank', ranked.rn,
        'memberCode', ranked.member_code,
        'displayName', ranked.safe_name,
        'workoutsThisMonth', ranked.workouts_month,
        'currentStreakDays', ranked.current_streak_days,
        'bestStreakDays', ranked.best_streak_days
      )
      order by ranked.rn asc
    ),
    '[]'::jsonb
  )
    into v_rows
    from (
      select
        row_number() over (order by coalesce(mc.cnt, 0) desc, m.current_streak_days desc, m.total_check_ins desc, m.created_at asc) as rn,
        m.member_code,
        case
          when pg_catalog.strpos(pg_catalog.btrim(m.full_name), ' ') > 0 then
            pg_catalog.split_part(pg_catalog.btrim(m.full_name), ' ', 1) || ' ' ||
            pg_catalog.upper(pg_catalog.substr(pg_catalog.btrim(pg_catalog.split_part(pg_catalog.btrim(m.full_name), ' ', 2)), 1, 1)) || '.'
          else pg_catalog.btrim(m.full_name)
        end as safe_name,
        coalesce(mc.cnt, 0)::integer as workouts_month,
        m.current_streak_days,
        m.best_streak_days
      from public.gym_members m
      left join lateral (
        select count(*)::integer as cnt
          from public.gym_check_ins c
         where c.business_id = v_biz.id
           and c.member_id = m.id
           and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_curr_month
      ) mc on true
      where m.business_id = v_biz.id
        and m.status = 'active'
        and (coalesce(mc.cnt, 0) > 0 or m.current_streak_days > 0)
      limit 10
    ) ranked;

  return v_rows;
end;
$$;

revoke all on function public.get_gym_monthly_leaderboard(text) from public;
grant execute on function public.get_gym_monthly_leaderboard(text) to anon, authenticated, service_role;

-- ============================================================================
-- 12. NEW RPC 8: public.record_gym_retail_sale (Supplement & Protein Bar POS)
-- ============================================================================
create or replace function public.record_gym_retail_sale(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity integer default 1,
  p_payment_method text default 'upi',
  p_member_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_prod public.gym_retail_products%rowtype;
  v_sale public.gym_retail_sales%rowtype;
  v_qty integer := greatest(1, least(100, coalesce(p_quantity, 1)));
  v_pay_method text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payment_method, 'upi')));
  v_total integer := 0;
begin
  if v_pay_method not in ('cash', 'upi') then
    v_pay_method := 'upi';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  select * into v_prod
    from public.gym_retail_products p
   where p.id = p_product_id
     and p.business_id = v_biz.id
   for update;

  if not found then
    raise exception 'Supplement product not found for this gym.' using errcode = 'P0002';
  end if;

  v_total := v_prod.price_paise * v_qty;

  update public.gym_retail_products
     set stock_qty = greatest(0, stock_qty - v_qty)
   where id = v_prod.id
   returning * into v_prod;

  insert into public.gym_retail_sales (
    business_id,
    product_id,
    product_name,
    quantity,
    total_paise,
    payment_method,
    member_name
  )
  values (
    v_biz.id,
    v_prod.id,
    v_prod.product_name,
    v_qty,
    v_total,
    v_pay_method,
    nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_member_name, '')), 1, 80), '')
  )
  returning * into v_sale;

  return pg_catalog.jsonb_build_object(
    'sale', pg_catalog.jsonb_build_object(
      'id', v_sale.id,
      'businessId', v_sale.business_id,
      'productId', v_sale.product_id,
      'productName', v_sale.product_name,
      'quantity', v_sale.quantity,
      'totalPaise', v_sale.total_paise,
      'paymentMethod', v_sale.payment_method,
      'memberName', v_sale.member_name,
      'soldAt', v_sale.sold_at
    ),
    'product', pg_catalog.jsonb_build_object(
      'id', v_prod.id,
      'businessId', v_prod.business_id,
      'productName', v_prod.product_name,
      'pricePaise', v_prod.price_paise,
      'stockQty', v_prod.stock_qty,
      'isActive', v_prod.is_active
    )
  );
end;
$$;

revoke all on function public.record_gym_retail_sale(uuid, uuid, integer, text, text) from public;
grant execute on function public.record_gym_retail_sale(uuid, uuid, integer, text, text) to authenticated, service_role;

-- ============================================================================
-- 13. NEW RPC 9: public.get_gym_trainer_commissions(p_business_id, p_month_key)
-- ============================================================================
create or replace function public.get_gym_trainer_commissions(
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
  v_rows jsonb := '[]'::jsonb;
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

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', t.id,
        'businessId', t.business_id,
        'trainerName', t.trainer_name,
        'specialty', t.specialty,
        'commissionPercent', t.commission_percent,
        'isActive', t.is_active,
        'activePtClients', coalesce(cl.cnt, 0),
        'ptSessionsDeliveredThisMonth', coalesce(sess.cnt, 0),
        'ptPackageRevenuePaise', coalesce(rev.total_pt_fee, 0),
        'commissionPayoutPaise', round((coalesce(rev.total_pt_fee, 0)::numeric * t.commission_percent) / 100.0)::bigint,
        'createdAt', t.created_at
      )
      order by t.created_at asc
    ),
    '[]'::jsonb
  )
    into v_rows
    from public.gym_trainers t
    left join lateral (
      select count(*)::integer as cnt
        from public.gym_members m
       where m.business_id = v_biz.id
         and m.pt_trainer_id = t.id
         and m.status = 'active'
         and m.pt_remaining_sessions > 0
    ) cl on true
    left join lateral (
      select count(*)::integer as cnt
        from public.gym_check_ins c
       where c.business_id = v_biz.id
         and c.trainer_id = t.id
         and c.is_pt_session = true
         and pg_catalog.to_char(c.check_in_date, 'YYYY-MM') = v_month_key
    ) sess on true
    left join lateral (
      select coalesce(sum(p.pt_fee_paise), 0)::bigint as total_pt_fee
        from public.gym_payment_logs p
       where p.business_id = v_biz.id
         and p.pt_trainer_id = t.id
         and pg_catalog.to_char(p.paid_date, 'YYYY-MM') = v_month_key
    ) rev on true
   where t.business_id = v_biz.id;

  return v_rows;
end;
$$;

revoke all on function public.get_gym_trainer_commissions(uuid, text) from public;
grant execute on function public.get_gym_trainer_commissions(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 14. UPGRADE RPC 10: public.get_gym_owner_dashboard(p_business_id, p_month_key)
--     Includes Combined Revenue (Membership + PT + Supplement Bar),
--     Pending Dues, Week 1-4 Comparison, Trainers, Retail & Leaderboard
-- ============================================================================
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
  v_month_start date;
  v_prev_month_key text;
  v_default_plans jsonb := '[
    {"id":"1_month","name":"1 Month Plan","durationDays":30,"pricePaise":150000,"badge":"Popular"},
    {"id":"3_months","name":"3 Months Plan","durationDays":90,"pricePaise":400000,"badge":"Most Popular"},
    {"id":"6_months","name":"6 Months Plan","durationDays":180,"pricePaise":720000,"badge":"Best Value"},
    {"id":"1_year","name":"1 Year Transformation","durationDays":365,"pricePaise":1250000,"badge":"Pro"}
  ]'::jsonb;
  v_cfg_json jsonb;
  v_members jsonb := '[]'::jsonb;
  v_todays_attendance jsonb := '[]'::jsonb;
  v_inactive_members jsonb := '[]'::jsonb;
  v_weekly_comparison jsonb := '[]'::jsonb;
  v_trainers jsonb := '[]'::jsonb;
  v_retail_products jsonb := '[]'::jsonb;
  v_retail_sales jsonb := '[]'::jsonb;
  v_leaderboard jsonb := '[]'::jsonb;
  v_routines jsonb := '[]'::jsonb;
  v_exercise_catalog jsonb := '[]'::jsonb;
  v_checked_in_today integer := 0;
  v_membership_rev_paise bigint := 0;
  v_retail_rev_paise bigint := 0;
  v_projected_next_rev_paise bigint := 0;
  v_total_balance_due_paise bigint := 0;
  v_balance_due_count integer := 0;
begin
  if v_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_month_key := pg_catalog.to_char(current_date, 'YYYY-MM');
  end if;
  v_month_start := to_date(v_month_key || '-01', 'YYYY-MM-DD');
  v_prev_month_key := pg_catalog.to_char((v_month_start - interval '1 month')::date, 'YYYY-MM');

  select b.id, b.owner_id, b.slug into v_biz
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

  -- Enriched member directory (Installments + PT + Freeze + Streaks)
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
        'totalPlanAmountPaise', m.total_plan_amount_paise,
        'amountPaidPaise', m.amount_paid_paise,
        'balanceDuePaise', m.balance_due_paise,
        'balanceDueDate', m.balance_due_date,
        'ptTrainerId', m.pt_trainer_id,
        'ptTrainerName', tr.trainer_name,
        'ptPackageName', m.pt_package_name,
        'ptPackageFeePaise', m.pt_package_fee_paise,
        'ptTotalSessions', m.pt_total_sessions,
        'ptRemainingSessions', m.pt_remaining_sessions,
        'isFrozen', m.is_frozen,
        'frozenStartedAt', m.frozen_started_at,
        'totalFrozenDays', m.total_frozen_days,
        'currentStreakDays', m.current_streak_days,
        'bestStreakDays', m.best_streak_days,
        'assignedRoutineId', m.assigned_routine_id,
        'assignedRoutineName', rt.routine_name,
        'fitnessGoal', m.fitness_goal,
        'startingWeightKg', m.starting_weight_kg,
        'targetWeightKg', m.target_weight_kg,
        'trainerNotes', m.trainer_notes,
        'status', m.status,
        'effectiveStatus', case
          when m.is_frozen and m.status = 'active' then 'frozen'
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
          when m.balance_due_paise > 0 then 2
          when m.status = 'active' and not m.is_frozen and m.end_date is not null and m.end_date >= current_date and (m.end_date - current_date) <= v_alert_days then 3
          when m.status = 'active' then 4
          else 5
        end asc,
        m.end_date asc nulls last,
        m.created_at desc
    ),
    '[]'::jsonb
  )
    into v_members
    from public.gym_members m
    left join public.gym_trainers tr on tr.id = m.pt_trainer_id
    left join public.gym_workout_routines rt on rt.id = m.assigned_routine_id
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

  -- Today's Attendance Feed
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
        'isPtSession', c.is_pt_session,
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

  select coalesce(sum(p.amount_paise), 0)::bigint into v_membership_rev_paise
    from public.gym_payment_logs p
   where p.business_id = v_biz.id
     and pg_catalog.to_char(p.paid_date, 'YYYY-MM') = v_month_key;

  select coalesce(sum(s.total_paise), 0)::bigint into v_retail_rev_paise
    from public.gym_retail_sales s
   where s.business_id = v_biz.id
     and pg_catalog.to_char(s.sold_at::date, 'YYYY-MM') = v_month_key;

  select coalesce(sum(m.fee_paise), 0)::bigint into v_projected_next_rev_paise
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status = 'active'
     and not m.is_frozen
     and m.end_date is not null
     and m.end_date >= current_date
     and m.end_date <= (current_date + 30);

  select coalesce(sum(m.balance_due_paise), 0)::bigint,
         count(*) filter (where m.balance_due_paise > 0)::integer
    into v_total_balance_due_paise, v_balance_due_count
    from public.gym_members m
   where m.business_id = v_biz.id
     and m.status in ('active', 'pending_approval')
     and m.balance_due_paise > 0;

  -- Week 1..4 Revenue Comparison (This Month vs Last Month)
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'weekIndex', w.wk,
        'label', 'Week ' || w.wk::text,
        'thisMonthPaise', coalesce(tm_p.amt, 0) + coalesce(tm_s.amt, 0),
        'lastMonthPaise', coalesce(lm_p.amt, 0) + coalesce(lm_s.amt, 0)
      )
      order by w.wk asc
    ),
    '[]'::jsonb
  )
    into v_weekly_comparison
    from generate_series(1, 4) as w(wk)
    left join lateral (
      select coalesce(sum(p.amount_paise), 0)::bigint as amt
        from public.gym_payment_logs p
       where p.business_id = v_biz.id
         and pg_catalog.to_char(p.paid_date, 'YYYY-MM') = v_month_key
         and least(4, ((extract(day from p.paid_date)::integer - 1) / 7) + 1) = w.wk
    ) tm_p on true
    left join lateral (
      select coalesce(sum(s.total_paise), 0)::bigint as amt
        from public.gym_retail_sales s
       where s.business_id = v_biz.id
         and pg_catalog.to_char(s.sold_at::date, 'YYYY-MM') = v_month_key
         and least(4, ((extract(day from s.sold_at::date)::integer - 1) / 7) + 1) = w.wk
    ) tm_s on true
    left join lateral (
      select coalesce(sum(p.amount_paise), 0)::bigint as amt
        from public.gym_payment_logs p
       where p.business_id = v_biz.id
         and pg_catalog.to_char(p.paid_date, 'YYYY-MM') = v_prev_month_key
         and least(4, ((extract(day from p.paid_date)::integer - 1) / 7) + 1) = w.wk
    ) lm_p on true
    left join lateral (
      select coalesce(sum(s.total_paise), 0)::bigint as amt
        from public.gym_retail_sales s
       where s.business_id = v_biz.id
         and pg_catalog.to_char(s.sold_at::date, 'YYYY-MM') = v_prev_month_key
         and least(4, ((extract(day from s.sold_at::date)::integer - 1) / 7) + 1) = w.wk
    ) lm_s on true;

  -- Inactive Alert Members (>= 5 days since last check-in, excluding frozen)
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
     and not m.is_frozen
     and m.end_date is not null
     and m.end_date >= current_date
     and (
       (m.last_check_in_date is not null and (current_date - m.last_check_in_date) >= 5)
       or (m.last_check_in_date is null and m.start_date is not null and (current_date - m.start_date) >= 5)
     );

  v_trainers := public.get_gym_trainer_commissions(v_biz.id, v_month_key);

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', p.id,
        'businessId', p.business_id,
        'productName', p.product_name,
        'pricePaise', p.price_paise,
        'stockQty', p.stock_qty,
        'isActive', p.is_active
      )
      order by p.created_at asc
    ),
    '[]'::jsonb
  )
    into v_retail_products
    from public.gym_retail_products p
   where p.business_id = v_biz.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', s.id,
        'businessId', s.business_id,
        'productId', s.product_id,
        'productName', s.product_name,
        'quantity', s.quantity,
        'totalPaise', s.total_paise,
        'paymentMethod', s.payment_method,
        'memberName', s.member_name,
        'soldAt', s.sold_at
      )
      order by s.sold_at desc
    ),
    '[]'::jsonb
  )
    into v_retail_sales
    from (
      select * from public.gym_retail_sales rs
       where rs.business_id = v_biz.id
       order by rs.sold_at desc
       limit 25
    ) s;

  v_leaderboard := public.get_gym_monthly_leaderboard(v_biz.slug);

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', r.id,
        'businessId', r.business_id,
        'routineName', r.routine_name,
        'targetGoal', r.target_goal,
        'exercises', r.exercises,
        'createdBy', r.created_by,
        'createdAt', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
    into v_routines
    from public.gym_workout_routines r
   where r.business_id = v_biz.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', e.id,
        'businessId', e.business_id,
        'name', e.name,
        'muscleGroup', e.muscle_group,
        'equipment', e.equipment,
        'defaultSets', e.default_sets,
        'defaultReps', e.default_reps,
        'restSeconds', e.rest_seconds
      )
      order by e.muscle_group asc, e.name asc
    ),
    '[]'::jsonb
  )
    into v_exercise_catalog
    from public.gym_exercises e
   where e.business_id is null or e.business_id = v_biz.id;

  return pg_catalog.jsonb_build_object(
    'config', v_cfg_json,
    'monthKey', v_month_key,
    'members', v_members,
    'checkedInTodayCount', v_checked_in_today,
    'todaysAttendance', v_todays_attendance,
    'monthlyRevenuePaise', (v_membership_rev_paise + v_retail_rev_paise),
    'membershipRevenuePaise', v_membership_rev_paise,
    'retailRevenuePaise', v_retail_rev_paise,
    'projectedNextMonthRevenuePaise', v_projected_next_rev_paise,
    'totalBalanceDuePaise', v_total_balance_due_paise,
    'balanceDueMembersCount', v_balance_due_count,
    'weeklyRevenueComparison', v_weekly_comparison,
    'inactiveAlertMembers', v_inactive_members,
    'trainers', v_trainers,
    'retailProducts', v_retail_products,
    'recentRetailSales', v_retail_sales,
    'monthlyLeaderboard', v_leaderboard,
    'routines', v_routines,
    'exerciseCatalog', v_exercise_catalog
  );
end;
$$;

revoke all on function public.get_gym_owner_dashboard(uuid, text) from public;
grant execute on function public.get_gym_owner_dashboard(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 14B. NEW RPC 11: public.log_gym_workout_session (OpenGym Guided Logger)
-- ============================================================================
create or replace function public.log_gym_workout_session(
  p_slug text,
  p_phone text,
  p_plan_id text default 'ppl',
  p_routine_name text default 'Custom Workout',
  p_workout_focus text default 'full_body',
  p_duration_minutes integer default 45,
  p_total_volume_kg numeric default 0,
  p_total_sets integer default 0,
  p_prs_hit_count integer default 0,
  p_muscles_trained jsonb default '[]'::jsonb,
  p_exercises jsonb default '[]'::jsonb
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
  v_row public.gym_workout_sessions%rowtype;
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
   limit 1;

  if not found then
    raise exception 'Member not found for this phone number.' using errcode = 'P0002';
  end if;

  insert into public.gym_workout_sessions (
    business_id,
    member_id,
    session_date,
    plan_id,
    routine_name,
    workout_focus,
    duration_minutes,
    total_volume_kg,
    total_sets,
    prs_hit_count,
    muscles_trained,
    exercises
  )
  values (
    v_biz.id,
    v_member.id,
    current_date,
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_plan_id), ''), 'ppl'), 1, 40),
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_routine_name), ''), 'Custom Workout'), 1, 80),
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_workout_focus), ''), 'full_body'), 1, 30),
    greatest(1, least(360, coalesce(p_duration_minutes, 45))),
    greatest(0, round(coalesce(p_total_volume_kg, 0)::numeric, 1)),
    greatest(0, least(500, coalesce(p_total_sets, 0))),
    greatest(0, least(100, coalesce(p_prs_hit_count, 0))),
    case when jsonb_typeof(coalesce(p_muscles_trained, '[]'::jsonb)) = 'array' then coalesce(p_muscles_trained, '[]'::jsonb) else '[]'::jsonb end,
    case when jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) = 'array' then coalesce(p_exercises, '[]'::jsonb) else '[]'::jsonb end
  )
  returning * into v_row;

  return pg_catalog.jsonb_build_object(
    'id', v_row.id,
    'businessId', v_row.business_id,
    'memberId', v_row.member_id,
    'sessionDate', v_row.session_date,
    'planId', v_row.plan_id,
    'routineName', v_row.routine_name,
    'workoutFocus', v_row.workout_focus,
    'durationMinutes', v_row.duration_minutes,
    'totalVolumeKg', v_row.total_volume_kg,
    'totalSets', v_row.total_sets,
    'prsHitCount', v_row.prs_hit_count,
    'musclesTrained', v_row.muscles_trained,
    'exercises', v_row.exercises,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.log_gym_workout_session(text, text, text, text, text, integer, numeric, integer, integer, jsonb, jsonb) from public;
grant execute on function public.log_gym_workout_session(text, text, text, text, text, integer, numeric, integer, integer, jsonb, jsonb) to anon, authenticated, service_role;

-- ============================================================================
-- 14C. WORKOUT ENGINE RPCs (Exercise Catalog, Routines, Set/PR Logger)
-- ============================================================================
create or replace function public.get_gym_member_workout_plan(
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
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_member public.gym_members%rowtype;
  v_routine jsonb := null;
  v_catalog jsonb := '[]'::jsonb;
  v_today_sets jsonb := '[]'::jsonb;
  v_prs jsonb := '[]'::jsonb;
  v_weekly_vol numeric := 0;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found then
    return null;
  end if;

  if v_member.assigned_routine_id is not null then
    select pg_catalog.jsonb_build_object(
      'id', r.id,
      'businessId', r.business_id,
      'routineName', r.routine_name,
      'targetGoal', r.target_goal,
      'exercises', r.exercises,
      'createdBy', r.created_by,
      'createdAt', r.created_at
    )
      into v_routine
      from public.gym_workout_routines r
     where r.id = v_member.assigned_routine_id
       and r.business_id = v_biz.id
     limit 1;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', e.id,
        'businessId', e.business_id,
        'name', e.name,
        'muscleGroup', e.muscle_group,
        'equipment', e.equipment,
        'defaultSets', e.default_sets,
        'defaultReps', e.default_reps,
        'restSeconds', e.rest_seconds
      )
      order by e.muscle_group asc, e.name asc
    ),
    '[]'::jsonb
  )
    into v_catalog
    from public.gym_exercises e
   where e.business_id is null or e.business_id = v_biz.id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', l.id,
        'businessId', l.business_id,
        'memberId', l.member_id,
        'exerciseId', l.exercise_id,
        'exerciseName', l.exercise_name,
        'muscleGroup', l.muscle_group,
        'workoutDate', l.workout_date,
        'setNumber', l.set_number,
        'weightKg', l.weight_kg,
        'reps', l.reps,
        'estimated1rmKg', l.estimated_1rm_kg,
        'isPersonalRecord', l.is_personal_record,
        'loggedAt', l.logged_at
      )
      order by l.logged_at asc
    ),
    '[]'::jsonb
  )
    into v_today_sets
    from public.gym_workout_set_logs l
   where l.business_id = v_biz.id
     and l.member_id = v_member.id
     and l.workout_date = current_date;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'exerciseName', pr.exercise_name,
        'muscleGroup', pr.muscle_group,
        'bestWeightKg', pr.best_wt,
        'best1rmKg', pr.best_1rm,
        'lastDate', pr.last_dt
      )
      order by pr.best_1rm desc
    ),
    '[]'::jsonb
  )
    into v_prs
    from (
      select
        l.exercise_name,
        max(l.muscle_group) as muscle_group,
        max(l.weight_kg) as best_wt,
        max(l.estimated_1rm_kg) as best_1rm,
        max(l.workout_date) as last_dt
      from public.gym_workout_set_logs l
     where l.business_id = v_biz.id
       and l.member_id = v_member.id
     group by l.exercise_name
    ) pr;

  select coalesce(sum(l.weight_kg * l.reps), 0)::numeric
    into v_weekly_vol
    from public.gym_workout_set_logs l
   where l.business_id = v_biz.id
     and l.member_id = v_member.id
     and l.workout_date >= (current_date - 6);

  return pg_catalog.jsonb_build_object(
    'assignedRoutine', v_routine,
    'exerciseCatalog', v_catalog,
    'todaySets', v_today_sets,
    'personalRecords', v_prs,
    'weeklyVolumeKg', round(v_weekly_vol, 1)
  );
end;
$$;

revoke all on function public.get_gym_member_workout_plan(text, uuid) from public;
grant execute on function public.get_gym_member_workout_plan(text, uuid) to anon, authenticated, service_role;

create or replace function public.log_gym_member_workout_set(
  p_slug text,
  p_member_id uuid,
  p_exercise_id uuid default null,
  p_exercise_name text default '',
  p_muscle_group text default 'full_body',
  p_set_number integer default 1,
  p_weight_kg numeric default 0,
  p_reps integer default 10
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_ex_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_exercise_name, '')), 1, 100);
  v_muscle text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_muscle_group, 'full_body')));
  v_set_num integer := greatest(1, least(20, coalesce(p_set_number, 1)));
  v_weight numeric(6,2) := greatest(0, least(1000, round(coalesce(p_weight_kg, 0)::numeric, 2)));
  v_reps integer := greatest(1, least(200, coalesce(p_reps, 10)));
  v_est_1rm numeric(6,2) := 0;
  v_prev_best_wt numeric(6,2) := 0;
  v_prev_best_1rm numeric(6,2) := 0;
  v_has_prior boolean := false;
  v_is_pr boolean := false;
  v_biz record;
  v_member public.gym_members%rowtype;
  v_row public.gym_workout_set_logs%rowtype;
  v_today_vol numeric := 0;
begin
  if pg_catalog.char_length(v_ex_name) < 2 then
    raise exception 'Exercise name is required.' using errcode = '22023';
  end if;

  if v_muscle not in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body') then
    v_muscle := 'full_body';
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
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found then
    raise exception 'Gym member not found.' using errcode = 'P0002';
  end if;

  if v_member.is_frozen then
    raise exception 'Membership is currently paused — ask front desk to resume.' using errcode = '42501';
  end if;

  if v_member.status <> 'active' or (v_member.end_date is not null and v_member.end_date < current_date) then
    raise exception 'Active membership is required to log workout sets.' using errcode = '42501';
  end if;

  v_est_1rm := round(v_weight * (1 + (v_reps::numeric / 30.0)), 2);

  select
    count(*) > 0,
    coalesce(max(l.weight_kg), 0),
    coalesce(max(l.estimated_1rm_kg), 0)
    into v_has_prior, v_prev_best_wt, v_prev_best_1rm
    from public.gym_workout_set_logs l
   where l.business_id = v_biz.id
     and l.member_id = v_member.id
     and pg_catalog.lower(l.exercise_name) = pg_catalog.lower(v_ex_name);

  if v_weight > 0 and (not v_has_prior or v_weight > v_prev_best_wt or v_est_1rm > v_prev_best_1rm) then
    v_is_pr := true;
  end if;

  insert into public.gym_workout_set_logs (
    business_id,
    member_id,
    exercise_id,
    exercise_name,
    muscle_group,
    workout_date,
    set_number,
    weight_kg,
    reps,
    estimated_1rm_kg,
    is_personal_record
  )
  values (
    v_biz.id,
    v_member.id,
    p_exercise_id,
    v_ex_name,
    v_muscle,
    current_date,
    v_set_num,
    v_weight,
    v_reps,
    v_est_1rm,
    v_is_pr
  )
  returning * into v_row;

  select coalesce(sum(l.weight_kg * l.reps), 0)::numeric
    into v_today_vol
    from public.gym_workout_set_logs l
   where l.business_id = v_biz.id
     and l.member_id = v_member.id
     and l.workout_date = current_date;

  return pg_catalog.jsonb_build_object(
    'setLog', pg_catalog.jsonb_build_object(
      'id', v_row.id,
      'businessId', v_row.business_id,
      'memberId', v_row.member_id,
      'exerciseId', v_row.exercise_id,
      'exerciseName', v_row.exercise_name,
      'muscleGroup', v_row.muscle_group,
      'workoutDate', v_row.workout_date,
      'setNumber', v_row.set_number,
      'weightKg', v_row.weight_kg,
      'reps', v_row.reps,
      'estimated1rmKg', v_row.estimated_1rm_kg,
      'isPersonalRecord', v_row.is_personal_record,
      'loggedAt', v_row.logged_at
    ),
    'isPersonalRecord', v_is_pr,
    'totalVolumeTodayKg', round(v_today_vol, 1)
  );
end;
$$;

revoke all on function public.log_gym_member_workout_set(text, uuid, uuid, text, text, integer, numeric, integer) from public;
grant execute on function public.log_gym_member_workout_set(text, uuid, uuid, text, text, integer, numeric, integer) to anon, authenticated, service_role;

create or replace function public.create_or_assign_gym_routine(
  p_business_id uuid,
  p_routine_name text,
  p_target_goal text default 'general_fitness',
  p_exercises jsonb default '[]'::jsonb,
  p_assign_to_member_id uuid default null,
  p_created_by text default 'Owner'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_routine_name, '')), 1, 100);
  v_routine public.gym_workout_routines%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Routine name must be at least 2 characters.' using errcode = '22023';
  end if;

  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  insert into public.gym_workout_routines (
    business_id,
    routine_name,
    target_goal,
    exercises,
    created_by
  )
  values (
    v_biz.id,
    v_clean_name,
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_target_goal), ''), 'general_fitness'), 1, 40),
    case when jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) = 'array' then coalesce(p_exercises, '[]'::jsonb) else '[]'::jsonb end,
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_created_by), ''), 'Owner'), 1, 80)
  )
  returning * into v_routine;

  if p_assign_to_member_id is not null then
    update public.gym_members
       set assigned_routine_id = v_routine.id,
           updated_at = pg_catalog.clock_timestamp()
     where id = p_assign_to_member_id
       and business_id = v_biz.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_routine.id,
    'businessId', v_routine.business_id,
    'routineName', v_routine.routine_name,
    'targetGoal', v_routine.target_goal,
    'exercises', v_routine.exercises,
    'createdBy', v_routine.created_by,
    'createdAt', v_routine.created_at
  );
end;
$$;

revoke all on function public.create_or_assign_gym_routine(uuid, text, text, jsonb, uuid, text) from public;
grant execute on function public.create_or_assign_gym_routine(uuid, text, text, jsonb, uuid, text) to authenticated, service_role;

create or replace function public.get_gym_member_workout_summary(
  p_business_id uuid,
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
  v_member public.gym_members%rowtype;
  v_recent_sets jsonb := '[]'::jsonb;
  v_prs jsonb := '[]'::jsonb;
  v_total_vol numeric := 0;
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
   limit 1;

  if not found then
    raise exception 'Gym member not found for this business.' using errcode = 'P0002';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', l.id,
        'businessId', l.business_id,
        'memberId', l.member_id,
        'exerciseId', l.exercise_id,
        'exerciseName', l.exercise_name,
        'muscleGroup', l.muscle_group,
        'workoutDate', l.workout_date,
        'setNumber', l.set_number,
        'weightKg', l.weight_kg,
        'reps', l.reps,
        'estimated1rmKg', l.estimated_1rm_kg,
        'isPersonalRecord', l.is_personal_record,
        'loggedAt', l.logged_at
      )
      order by l.logged_at desc
    ),
    '[]'::jsonb
  )
    into v_recent_sets
    from (
      select * from public.gym_workout_set_logs sl
       where sl.business_id = v_biz.id
         and sl.member_id = v_member.id
       order by sl.logged_at desc
       limit 80
    ) l;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'exerciseName', pr.exercise_name,
        'muscleGroup', pr.muscle_group,
        'bestWeightKg', pr.best_wt,
        'best1rmKg', pr.best_1rm,
        'lastDate', pr.last_dt
      )
      order by pr.best_1rm desc
    ),
    '[]'::jsonb
  )
    into v_prs
    from (
      select
        l.exercise_name,
        max(l.muscle_group) as muscle_group,
        max(l.weight_kg) as best_wt,
        max(l.estimated_1rm_kg) as best_1rm,
        max(l.workout_date) as last_dt
      from public.gym_workout_set_logs l
     where l.business_id = v_biz.id
       and l.member_id = v_member.id
     group by l.exercise_name
    ) pr;

  select coalesce(sum(l.weight_kg * l.reps), 0)::numeric
    into v_total_vol
    from public.gym_workout_set_logs l
   where l.business_id = v_biz.id
     and l.member_id = v_member.id;

  return pg_catalog.jsonb_build_object(
    'memberId', v_member.id,
    'assignedRoutineId', v_member.assigned_routine_id,
    'totalVolumeKg', round(v_total_vol, 1),
    'personalRecords', v_prs,
    'recentSets', v_recent_sets
  );
end;
$$;

revoke all on function public.get_gym_member_workout_summary(uuid, uuid) from public;
grant execute on function public.get_gym_member_workout_summary(uuid, uuid) to authenticated, service_role;

-- ============================================================================
-- 15. REALTIME PUBLICATION REGISTRATION (Idempotent)
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.gym_members;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.gym_check_ins;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.gym_retail_sales;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
