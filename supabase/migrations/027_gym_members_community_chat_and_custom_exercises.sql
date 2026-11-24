-- ============================================================================
-- Vitaran AI Reviews / GymOS — Members Directory, Live Gym Community Chat,
-- Member Custom Exercises & Automatic PR Celebrations
-- Migration: 027_gym_members_community_chat_and_custom_exercises.sql
-- Depends on: 001..026 (extends gym_community_messages, gym_exercises,
--             log_gym_member_workout_set)
--
-- Security Guardrails:
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY
-- - REVOKE ALL FROM public, anon, authenticated on every new table
-- - Every SECURITY DEFINER RPC locks search_path = pg_catalog, public, pg_temp
-- - Uses pg_catalog.substr exclusively (no SQL-standard substring syntax)
-- ============================================================================

begin;

-- ============================================================================
-- 1. NEW TABLE: public.gym_community_messages (Gym-Scoped Chat & PR Feed)
-- ============================================================================
create table if not exists public.gym_community_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid references public.gym_members(id) on delete set null,
  sender_name text not null,
  sender_code text,
  message_type text not null default 'chat'
    check (message_type in ('chat', 'pr_celebration', 'checkin_milestone', 'coach_announcement')),
  message_text text not null,
  created_at timestamptz not null default now(),
  constraint gym_comm_msg_text_len_chk
    check (pg_catalog.char_length(pg_catalog.btrim(message_text)) between 1 and 500),
  constraint gym_comm_sender_len_chk
    check (pg_catalog.char_length(pg_catalog.btrim(sender_name)) between 1 and 80)
);

create index if not exists idx_gym_community_messages_biz_created
  on public.gym_community_messages (business_id, created_at desc);

alter table public.gym_community_messages enable row level security;
alter table public.gym_community_messages force row level security;

revoke all on table public.gym_community_messages from public, anon, authenticated;
grant select, insert, delete on table public.gym_community_messages to authenticated;
grant all on table public.gym_community_messages to service_role;

drop policy if exists "gym_community_messages_owner_all" on public.gym_community_messages;
create policy "gym_community_messages_owner_all"
  on public.gym_community_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = gym_community_messages.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = gym_community_messages.business_id
        and b.owner_id = auth.uid()
    )
  );

-- Enable Realtime if supabase_realtime publication exists
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.gym_community_messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;

-- ============================================================================
-- 2. RPC: public.get_gym_members_community_hub
-- ============================================================================
create or replace function public.get_gym_members_community_hub(
  p_slug text,
  p_requester_member_id uuid
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
  v_requester record;
  v_members jsonb := '[]'::jsonb;
  v_messages jsonb := '[]'::jsonb;
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

  select m.id into v_requester
    from public.gym_members m
   where m.id = p_requester_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found then
    raise exception 'Unauthorized: requester does not belong to this gym.' using errcode = '42501';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', dir.id,
        'fullName', dir.full_name,
        'memberCode', dir.member_code,
        'fitnessGoal', dir.fitness_goal,
        'currentStreakDays', dir.current_streak_days,
        'workoutsThisMonth', dir.workouts_this_month,
        'isCheckedInToday', dir.is_checked_in_today,
        'todayWorkoutFocus', dir.today_focus,
        'isFrozen', dir.is_frozen
      )
      order by dir.is_checked_in_today desc, dir.workouts_this_month desc, dir.current_streak_days desc
    ),
    '[]'::jsonb
  )
  into v_members
  from (
    select
      m.id,
      pg_catalog.initcap(pg_catalog.btrim(m.full_name)) as full_name,
      m.member_code,
      m.fitness_goal,
      coalesce(m.current_streak_days, 0) as current_streak_days,
      coalesce((
        select count(*)
          from public.gym_check_ins ci
         where ci.business_id = v_biz.id
           and ci.member_id = m.id
           and ci.check_in_date >= date_trunc('month', current_date)::date
      ), 0)::integer as workouts_this_month,
      (m.last_check_in_date = current_date) as is_checked_in_today,
      (
        select ci2.workout_focus
          from public.gym_check_ins ci2
         where ci2.business_id = v_biz.id
           and ci2.member_id = m.id
           and ci2.check_in_date = current_date
         order by ci2.checked_in_at desc
         limit 1
      ) as today_focus,
      coalesce(m.is_frozen, false) as is_frozen
    from public.gym_members m
    where m.business_id = v_biz.id
      and m.status = 'active'
  ) dir;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', sub.id,
        'businessId', sub.business_id,
        'memberId', sub.member_id,
        'senderName', sub.sender_name,
        'senderCode', sub.sender_code,
        'messageType', sub.message_type,
        'messageText', sub.message_text,
        'createdAt', sub.created_at
      )
      order by sub.created_at asc
    ),
    '[]'::jsonb
  )
  into v_messages
  from (
    select msg.*
      from public.gym_community_messages msg
     where msg.business_id = v_biz.id
     order by msg.created_at desc
     limit 60
  ) sub;

  return pg_catalog.jsonb_build_object(
    'membersDirectory', v_members,
    'chatMessages', v_messages
  );
end;
$$;

revoke all on function public.get_gym_members_community_hub(text, uuid) from public;
grant execute on function public.get_gym_members_community_hub(text, uuid) to anon, authenticated, service_role;

-- ============================================================================
-- 3. RPC: public.send_gym_community_message
-- ============================================================================
create or replace function public.send_gym_community_message(
  p_slug text,
  p_member_id uuid,
  p_message_text text,
  p_message_type text default 'chat'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_text text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_message_text, '')), 1, 500);
  v_msg_type text := case
    when p_message_type in ('chat', 'pr_celebration', 'checkin_milestone', 'coach_announcement') then p_message_type
    else 'chat'
  end;
  v_biz record;
  v_member record;
  v_row public.gym_community_messages%rowtype;
begin
  if pg_catalog.char_length(v_clean_text) < 1 then
    raise exception 'Message cannot be empty.' using errcode = '22023';
  end if;

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
    raise exception 'Active gym membership required to post in community chat.' using errcode = '42501';
  end if;

  insert into public.gym_community_messages (
    business_id,
    member_id,
    sender_name,
    sender_code,
    message_type,
    message_text
  )
  values (
    v_biz.id,
    v_member.id,
    pg_catalog.initcap(pg_catalog.substr(pg_catalog.btrim(v_member.full_name), 1, 80)),
    v_member.member_code,
    v_msg_type,
    v_clean_text
  )
  returning * into v_row;

  return pg_catalog.jsonb_build_object(
    'id', v_row.id,
    'businessId', v_row.business_id,
    'memberId', v_row.member_id,
    'senderName', v_row.sender_name,
    'senderCode', v_row.sender_code,
    'messageType', v_row.message_type,
    'messageText', v_row.message_text,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.send_gym_community_message(text, uuid, text, text) from public;
grant execute on function public.send_gym_community_message(text, uuid, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 4. RPC: public.owner_post_or_delete_gym_community_message
-- ============================================================================
create or replace function public.owner_post_or_delete_gym_community_message(
  p_business_id uuid,
  p_action text default 'post',
  p_message_text text default null,
  p_message_id uuid default null,
  p_sender_name text default 'Head Coach'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_biz record;
  v_clean_text text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_message_text, '')), 1, 500);
  v_sender text := pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_sender_name), ''), 'Head Coach'), 1, 80);
  v_row public.gym_community_messages%rowtype;
begin
  select b.id, b.owner_id into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found or v_biz.owner_id <> auth.uid() then
    raise exception 'Unauthorized: owner access required for this gym.' using errcode = '42501';
  end if;

  if p_action = 'delete' then
    if p_message_id is null then
      raise exception 'Message ID required to delete.' using errcode = '22023';
    end if;
    delete from public.gym_community_messages
     where id = p_message_id
       and business_id = v_biz.id;
    return pg_catalog.jsonb_build_object('deletedId', p_message_id);
  end if;

  if pg_catalog.char_length(v_clean_text) < 1 then
    raise exception 'Announcement message cannot be empty.' using errcode = '22023';
  end if;

  insert into public.gym_community_messages (
    business_id,
    member_id,
    sender_name,
    sender_code,
    message_type,
    message_text
  )
  values (
    v_biz.id,
    null,
    v_sender,
    'COACH',
    'coach_announcement',
    v_clean_text
  )
  returning * into v_row;

  return pg_catalog.jsonb_build_object(
    'id', v_row.id,
    'businessId', v_row.business_id,
    'memberId', v_row.member_id,
    'senderName', v_row.sender_name,
    'senderCode', v_row.sender_code,
    'messageType', v_row.message_type,
    'messageText', v_row.message_text,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.owner_post_or_delete_gym_community_message(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.owner_post_or_delete_gym_community_message(uuid, text, text, uuid, text) to authenticated, service_role;

-- ============================================================================
-- 5. RPC: public.create_custom_gym_exercise (Member or Coach Exercise Creator)
-- ============================================================================
create or replace function public.create_custom_gym_exercise(
  p_slug text,
  p_member_id uuid,
  p_name text,
  p_muscle_group text default 'chest',
  p_equipment text default 'dumbbell',
  p_default_sets integer default 3,
  p_default_reps text default '10-12',
  p_animation_gif_url text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_name, '')), 1, 80);
  v_muscle text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_muscle_group, 'chest')));
  v_equip text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_equipment, 'dumbbell')));
  v_sets integer := greatest(1, least(10, coalesce(p_default_sets, 3)));
  v_reps text := pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_default_reps), ''), '10-12'), 1, 20);
  v_anim_key text := 'bench_press';
  v_biz record;
  v_member record;
  v_ex public.gym_exercises%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Exercise name must be at least 2 characters.' using errcode = '22023';
  end if;

  if v_muscle not in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body') then
    v_muscle := 'full_body';
  end if;

  if v_equip not in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'cardio_machine') then
    v_equip := 'dumbbell';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Gym portal is not active.' using errcode = 'P0002';
  end if;

  select m.id, m.status into v_member
    from public.gym_members m
   where m.id = p_member_id
     and m.business_id = v_biz.id
   limit 1;

  if not found or v_member.status <> 'active' then
    raise exception 'Active gym membership required to add custom exercises.' using errcode = '42501';
  end if;

  v_anim_key := case
    when v_muscle = 'chest' then 'bench_press'
    when v_muscle = 'back' then 'lat_pulldown'
    when v_muscle = 'legs' then 'squat'
    when v_muscle = 'shoulders' then 'shoulder_press'
    when v_muscle = 'arms' then 'bicep_curl'
    when v_muscle = 'core' then 'core_plank'
    when v_muscle = 'cardio' then 'cardio_hiit'
    else 'bench_press'
  end;

  insert into public.gym_exercises (
    business_id,
    name,
    muscle_group,
    equipment,
    default_sets,
    default_reps,
    rest_seconds,
    animation_key,
    animation_gif_url,
    form_cues
  )
  values (
    v_biz.id,
    v_clean_name,
    v_muscle,
    v_equip,
    v_sets,
    v_reps,
    75,
    v_anim_key,
    nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_animation_gif_url, '')), 1, 500), ''),
    'Keep steady tempo, brace core, and focus on controlled eccentric contraction.'
  )
  returning * into v_ex;

  return pg_catalog.jsonb_build_object(
    'id', v_ex.id,
    'businessId', v_ex.business_id,
    'name', v_ex.name,
    'muscleGroup', v_ex.muscle_group,
    'equipment', v_ex.equipment,
    'defaultSets', v_ex.default_sets,
    'defaultReps', v_ex.default_reps,
    'restSeconds', v_ex.rest_seconds,
    'animationKey', v_ex.animation_key,
    'animationGifUrl', v_ex.animation_gif_url,
    'formCues', v_ex.form_cues
  );
end;
$$;

revoke all on function public.create_custom_gym_exercise(text, uuid, text, text, text, integer, text, text) from public;
grant execute on function public.create_custom_gym_exercise(text, uuid, text, text, text, integer, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 6. UPGRADE public.log_gym_member_workout_set TO AUTO-POST PR CELEBRATIONS
-- ============================================================================
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
  v_sender_display text := '';
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

  -- Auto-post PR celebration into Gym Community Chat when a new Personal Record is achieved
  if v_is_pr then
    v_sender_display := pg_catalog.initcap(pg_catalog.substr(pg_catalog.btrim(v_member.full_name), 1, 60));
    insert into public.gym_community_messages (
      business_id,
      member_id,
      sender_name,
      sender_code,
      message_type,
      message_text
    )
    values (
      v_biz.id,
      v_member.id,
      v_sender_display,
      v_member.member_code,
      'pr_celebration',
      format('🏆 %s hit a new Personal Record: %s — %s kg × %s!', v_sender_display, v_ex_name, v_weight, v_reps)
    );
  end if;

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

commit;
