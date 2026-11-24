-- ============================================================================
-- Migration 029: Seed Studio Option-A Anatomical Bench Press GIF & Lift Upload Limit
-- Description:
--   1. Seeds built-in 'Barbell Bench Press' with bundled '/exercises/barbell-bench-press.gif'.
--   2. Upgrades owner_upsert_gym_exercise_media and create_custom_gym_exercise to
--      preserve both HTTPS/relative paths and uploaded compact GIF Data URLs cleanly.
-- SQL Safety:
--   - Uses pg_catalog.substr(x, 1, N) exclusively (never substring()).
--   - All SECURITY DEFINER functions pin search_path = pg_catalog, public, pg_temp.
-- ============================================================================

begin;

-- 1. Wire bundled Option-A white-background anatomical GIF on built-in Bench Press
update public.gym_exercises
   set animation_gif_url = '/exercises/barbell-bench-press.gif'
 where business_id is null
   and pg_catalog.lower(name) = 'barbell bench press';

-- 2. Upgrade owner_upsert_gym_exercise_media to allow compact uploaded GIF Data URLs
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
  v_raw_url text := pg_catalog.btrim(coalesce(p_media_url, ''));
  v_clean_url text := case
    when v_raw_url ~* '^data:image/(gif|webp|png|jpeg|jpg);base64,' then pg_catalog.substr(v_raw_url, 1, 650000)
    else pg_catalog.substr(v_raw_url, 1, 1200)
  end;
  v_type text := case when p_media_type in ('gif', 'image', 'video') then p_media_type else 'video' end;
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

-- 3. Upgrade create_custom_gym_exercise to accept compact uploaded GIF Data URLs as well
create or replace function public.create_custom_gym_exercise(
  p_slug text,
  p_member_id uuid,
  p_name text,
  p_muscle_group text default 'full_body',
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
  v_clean_muscle text := case
    when p_muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body') then p_muscle_group
    else 'full_body'
  end;
  v_clean_equip text := case
    when p_equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'cardio_machine') then p_equipment
    else 'dumbbell'
  end;
  v_raw_gif text := pg_catalog.btrim(coalesce(p_animation_gif_url, ''));
  v_clean_gif text := case
    when v_raw_gif = '' then null
    when v_raw_gif ~* '^data:image/(gif|webp|png|jpeg|jpg);base64,' then pg_catalog.substr(v_raw_gif, 1, 650000)
    else pg_catalog.substr(v_raw_gif, 1, 1200)
  end;
  v_anim_key text := case
    when v_clean_muscle = 'chest' then 'bench_press'
    when v_clean_muscle = 'back' then 'lat_pulldown'
    when v_clean_muscle = 'legs' then 'squat'
    when v_clean_muscle = 'shoulders' then 'shoulder_press'
    when v_clean_muscle = 'arms' then 'bicep_curl'
    when v_clean_muscle = 'core' then 'core_plank'
    when v_clean_muscle = 'cardio' then 'cardio_hiit'
    else 'bench_press'
  end;
  v_biz record;
  v_member record;
  v_ex public.gym_exercises%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Exercise name must be at least 2 characters.' using errcode = '22023';
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
    v_clean_muscle,
    v_clean_equip,
    greatest(1, least(10, coalesce(p_default_sets, 3))),
    pg_catalog.substr(coalesce(nullif(pg_catalog.btrim(p_default_reps), ''), '10-12'), 1, 20),
    75,
    v_anim_key,
    v_clean_gif,
    'Focus on smooth range of motion and controlled eccentric tempo.'
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

commit;
