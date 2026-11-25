-- ============================================================================
-- Vitaran AI Reviews / ClinicOS — Module 9:
-- Healthcare, Dental, Skin, Physio & Diagnostic Clinic OS:
-- Multi-Doctor Live Token Queue, Vitals & Digital Rx Vault, Multi-Session
-- Packages, 3-Day Recall Radar & Doctor Commission Payouts
-- Migration: 032_clinic_os_queue_rx_recalls_and_payouts.sql
-- Depends on: 001..031
--
-- SQL Safety Rules Observed:
-- - Every substring extraction uses pg_catalog.substr(x, 1, N) (NEVER substring from/for)
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY + REVOKE ALL FROM public, anon
-- - Every SECURITY DEFINER RPC sets search_path = pg_catalog, public, pg_temp
-- ============================================================================

begin;

-- ============================================================================
-- 0. public.clinic_configs (White-Label Clinic Branding & Recall Window)
-- ============================================================================
create table if not exists public.clinic_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  clinic_tagline text not null default 'Multi-Specialty Care, Live OPD Queue & Digital Prescriptions',
  logo_url text,
  accent_color text not null default '#0D9488',
  is_queue_open boolean not null default true,
  recall_window_days integer not null default 3
    constraint cc_recall_window_days_chk check (recall_window_days between 1 and 30),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.clinic_configs enable row level security;
alter table public.clinic_configs force row level security;
revoke all on table public.clinic_configs from public, anon;
grant select, insert, update, delete on table public.clinic_configs to authenticated, service_role;

drop policy if exists clinic_configs_owner_all on public.clinic_configs;
create policy clinic_configs_owner_all on public.clinic_configs
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 1. public.clinic_doctors (Doctors, Specialists & Consultation Cabins)
-- ============================================================================
create table if not exists public.clinic_doctors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  doctor_name text not null,
  specialty text not null default 'General Physician',
  cabin_label text not null default 'Room 1',
  consultation_fee_paise integer not null default 50000
    constraint cd_consultation_fee_chk check (consultation_fee_paise >= 0),
  avg_consult_minutes integer not null default 15
    constraint cd_avg_consult_minutes_chk check (avg_consult_minutes between 5 and 120),
  extra_delay_minutes integer not null default 0,
  commission_percent numeric(5,2) not null default 50.00
    constraint cd_commission_percent_chk check (commission_percent between 0 and 100),
  is_available boolean not null default true,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists idx_clinic_doctors_biz on public.clinic_doctors(business_id, created_at asc);

alter table public.clinic_doctors enable row level security;
alter table public.clinic_doctors force row level security;
revoke all on table public.clinic_doctors from public, anon;
grant select, insert, update, delete on table public.clinic_doctors to authenticated, service_role;

drop policy if exists clinic_doctors_owner_all on public.clinic_doctors;
create policy clinic_doctors_owner_all on public.clinic_doctors
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 2. public.clinic_patients (Master Patient Directory, Allergies, Packs & Recalls)
-- ============================================================================
create table if not exists public.clinic_patients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  patient_code text not null,
  full_name text not null,
  phone text not null,
  age integer
    constraint cp_age_chk check (age is null or (age between 0 and 130)),
  gender text
    constraint cp_gender_chk check (gender is null or gender in ('male', 'female', 'other')),
  blood_group text,
  allergies text,
  active_package_name text,
  package_sessions_total integer not null default 0
    constraint cp_pkg_total_chk check (package_sessions_total >= 0),
  package_sessions_remaining integer not null default 0
    constraint cp_pkg_rem_chk check (package_sessions_remaining >= 0),
  total_billed_paise integer not null default 0,
  amount_paid_paise integer not null default 0,
  balance_due_paise integer not null default 0
    constraint cp_balance_due_chk check (balance_due_paise >= 0),
  next_followup_date date,
  followup_reason text,
  total_visits integer not null default 0,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cp_biz_patient_code_uniq unique (business_id, patient_code),
  constraint cp_biz_phone_uniq unique (business_id, phone)
);

create index if not exists idx_clinic_patients_biz_updated on public.clinic_patients(business_id, updated_at desc);
create index if not exists idx_clinic_patients_biz_followup on public.clinic_patients(business_id, next_followup_date asc);

alter table public.clinic_patients enable row level security;
alter table public.clinic_patients force row level security;
revoke all on table public.clinic_patients from public, anon;
grant select, insert, update, delete on table public.clinic_patients to authenticated, service_role;

drop policy if exists clinic_patients_owner_all on public.clinic_patients;
create policy clinic_patients_owner_all on public.clinic_patients
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 3. public.clinic_visits_and_queue (Live Waiting Room Tokens, Vitals, Rx & Billing)
-- ============================================================================
create table if not exists public.clinic_visits_and_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  patient_id uuid not null references public.clinic_patients(id) on delete cascade,
  doctor_id uuid references public.clinic_doctors(id) on delete set null,
  visit_date date not null default current_date,
  token_number text not null,
  visit_type text not null default 'walk_in'
    constraint cvq_visit_type_chk check (visit_type in ('walk_in', 'appointment', 'package_session', 'followup')),
  scheduled_slot text,
  chief_complaint text,
  status text not null default 'waiting'
    constraint cvq_status_chk check (status in ('waiting', 'vitals_done', 'in_consultation', 'completed', 'no_show')),
  vitals_json jsonb not null default '{}'::jsonb,
  diagnosis_notes text,
  prescription_items jsonb not null default '[]'::jsonb,
  rx_attachment_url text,
  fee_charged_paise integer not null default 0,
  amount_collected_paise integer not null default 0,
  payment_method text
    constraint cvq_payment_method_chk check (payment_method is null or payment_method in ('cash', 'upi', 'card', 'package_credit')),
  doctor_commission_paise integer not null default 0,
  checked_in_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz
);

create index if not exists idx_cvq_biz_date_checkin on public.clinic_visits_and_queue(business_id, visit_date, checked_in_at asc);
create index if not exists idx_cvq_patient_checkin on public.clinic_visits_and_queue(patient_id, checked_in_at desc);

alter table public.clinic_visits_and_queue enable row level security;
alter table public.clinic_visits_and_queue force row level security;
revoke all on table public.clinic_visits_and_queue from public, anon;
grant select, insert, update, delete on table public.clinic_visits_and_queue to authenticated, service_role;

drop policy if exists clinic_visits_owner_all on public.clinic_visits_and_queue;
create policy clinic_visits_owner_all on public.clinic_visits_and_queue
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- Helper: Canonical clinic phone normalizer (pg_catalog.substr strictly)
-- ============================================================================
create or replace function public.normalize_clinic_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_digits text := pg_catalog.regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  if pg_catalog.char_length(v_digits) = 12 and pg_catalog.substr(v_digits, 1, 2) = '91' then
    v_digits := pg_catalog.substr(v_digits, 3, 10);
  elsif pg_catalog.char_length(v_digits) = 11 and pg_catalog.substr(v_digits, 1, 1) = '0' then
    v_digits := pg_catalog.substr(v_digits, 2, 10);
  end if;
  return pg_catalog.substr(v_digits, 1, 20);
end;
$$;

-- ============================================================================
-- Helper: Ensure default clinic_configs row exists
-- ============================================================================
create or replace function public.ensure_clinic_config(p_business_id uuid)
returns public.clinic_configs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cfg public.clinic_configs%rowtype;
begin
  select * into v_cfg
    from public.clinic_configs
   where business_id = p_business_id
   limit 1;

  if not found then
    insert into public.clinic_configs (business_id)
    values (p_business_id)
    on conflict (business_id) do nothing;

    select * into v_cfg
      from public.clinic_configs
     where business_id = p_business_id
     limit 1;
  end if;

  return v_cfg;
end;
$$;

revoke all on function public.ensure_clinic_config(uuid) from public, anon;
grant execute on function public.ensure_clinic_config(uuid) to authenticated, service_role;

-- ============================================================================
-- RPC 1: public.get_public_clinic_hub(p_slug, p_phone)
-- Returns clinic branding, live doctor cards + wait times, patient profile,
-- active token tracker, and past Rx & vitals vault.
-- ============================================================================
create or replace function public.get_public_clinic_hub(
  p_slug text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_phone text := public.normalize_clinic_phone(p_phone);
  v_today date := current_date;
  v_biz record;
  v_cfg public.clinic_configs%rowtype;
  v_patient public.clinic_patients%rowtype;
  v_doctors jsonb := '[]'::jsonb;
  v_patient_json jsonb := null;
  v_active_visit jsonb := null;
  v_history jsonb := '[]'::jsonb;
begin
  select b.id, b.name, b.slug, b.city, b.category, b.google_review_url, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  v_cfg := public.ensure_clinic_config(v_biz.id);

  select coalesce(jsonb_agg(doc_row order by doc_created asc), '[]'::jsonb)
    into v_doctors
    from (
      select
        jsonb_build_object(
          'id', d.id,
          'businessId', d.business_id,
          'doctorName', d.doctor_name,
          'specialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'consultationFeePaise', d.consultation_fee_paise,
          'avgConsultMinutes', d.avg_consult_minutes,
          'extraDelayMinutes', d.extra_delay_minutes,
          'commissionPercent', d.commission_percent::numeric,
          'isAvailable', d.is_available,
          'createdAt', d.created_at,
          'waitingCount', coalesce(q_stats.active_cnt, 0),
          'inConsultationTokenNumber', q_stats.in_consult_token,
          'inConsultationPatientName', q_stats.in_consult_name,
          'estimatedWaitMinutes', greatest(
            0,
            coalesce(q_stats.active_cnt, 0) * d.avg_consult_minutes + d.extra_delay_minutes
          )
        ) as doc_row,
        d.created_at as doc_created
      from public.clinic_doctors d
      left join lateral (
        select
          count(*) filter (where v.status in ('waiting', 'vitals_done', 'in_consultation'))::integer as active_cnt,
          (
            select v2.token_number
              from public.clinic_visits_and_queue v2
             where v2.business_id = v_biz.id
               and v2.doctor_id = d.id
               and v2.visit_date = v_today
               and v2.status = 'in_consultation'
             order by v2.checked_in_at asc
             limit 1
          ) as in_consult_token,
          (
            select p2.full_name
              from public.clinic_visits_and_queue v2
              join public.clinic_patients p2 on p2.id = v2.patient_id
             where v2.business_id = v_biz.id
               and v2.doctor_id = d.id
               and v2.visit_date = v_today
               and v2.status = 'in_consultation'
             order by v2.checked_in_at asc
             limit 1
          ) as in_consult_name
        from public.clinic_visits_and_queue v
        where v.business_id = v_biz.id
          and v.doctor_id = d.id
          and v.visit_date = v_today
      ) q_stats on true
      where d.business_id = v_biz.id
    ) sub_docs;

  if pg_catalog.char_length(v_clean_phone) >= 7 then
    select * into v_patient
      from public.clinic_patients cp
     where cp.business_id = v_biz.id
       and cp.phone = v_clean_phone
     limit 1;

    if found then
      v_patient_json := jsonb_build_object(
        'id', v_patient.id,
        'businessId', v_patient.business_id,
        'patientCode', v_patient.patient_code,
        'fullName', v_patient.full_name,
        'phone', v_patient.phone,
        'age', v_patient.age,
        'gender', v_patient.gender,
        'bloodGroup', v_patient.blood_group,
        'allergies', v_patient.allergies,
        'activePackageName', v_patient.active_package_name,
        'packageSessionsTotal', v_patient.package_sessions_total,
        'packageSessionsRemaining', v_patient.package_sessions_remaining,
        'totalBilledPaise', v_patient.total_billed_paise,
        'amountPaidPaise', v_patient.amount_paid_paise,
        'balanceDuePaise', v_patient.balance_due_paise,
        'nextFollowupDate', v_patient.next_followup_date,
        'followupReason', v_patient.followup_reason,
        'totalVisits', v_patient.total_visits,
        'createdAt', v_patient.created_at,
        'updatedAt', v_patient.updated_at
      );

      select
        jsonb_build_object(
          'id', v.id,
          'businessId', v.business_id,
          'patientId', v.patient_id,
          'patientCode', v_patient.patient_code,
          'patientName', v_patient.full_name,
          'patientPhone', v_patient.phone,
          'patientAge', v_patient.age,
          'patientGender', v_patient.gender,
          'patientAllergies', v_patient.allergies,
          'patientPackageName', v_patient.active_package_name,
          'patientPackageRemaining', v_patient.package_sessions_remaining,
          'patientPackageTotal', v_patient.package_sessions_total,
          'doctorId', v.doctor_id,
          'doctorName', d.doctor_name,
          'doctorSpecialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'visitDate', v.visit_date,
          'tokenNumber', v.token_number,
          'visitType', v.visit_type,
          'scheduledSlot', v.scheduled_slot,
          'chiefComplaint', v.chief_complaint,
          'status', v.status,
          'vitalsJson', v.vitals_json,
          'diagnosisNotes', v.diagnosis_notes,
          'prescriptionItems', v.prescription_items,
          'rxAttachmentUrl', v.rx_attachment_url,
          'feeChargedPaise', v.fee_charged_paise,
          'amountCollectedPaise', v.amount_collected_paise,
          'paymentMethod', v.payment_method,
          'doctorCommissionPaise', v.doctor_commission_paise,
          'checkedInAt', v.checked_in_at,
          'completedAt', v.completed_at,
          'patientsAhead', case
            when v.status = 'in_consultation' then 0
            else (
              select count(*)::integer
                from public.clinic_visits_and_queue va
               where va.business_id = v_biz.id
                 and va.visit_date = v_today
                 and (
                   (v.doctor_id is null and va.doctor_id is null)
                   or va.doctor_id = v.doctor_id
                 )
                 and va.status in ('waiting', 'vitals_done', 'in_consultation')
                 and va.id <> v.id
                 and (
                   va.status = 'in_consultation'
                   or va.checked_in_at < v.checked_in_at
                 )
            )
          end,
          'estimatedWaitMinutes', case
            when v.status = 'in_consultation' then 0
            else greatest(
              0,
              (
                select count(*)::integer
                  from public.clinic_visits_and_queue va
                 where va.business_id = v_biz.id
                   and va.visit_date = v_today
                   and (
                     (v.doctor_id is null and va.doctor_id is null)
                     or va.doctor_id = v.doctor_id
                   )
                   and va.status in ('waiting', 'vitals_done', 'in_consultation')
                   and va.id <> v.id
                   and (
                     va.status = 'in_consultation'
                     or va.checked_in_at < v.checked_in_at
                   )
              ) * coalesce(d.avg_consult_minutes, 15) + coalesce(d.extra_delay_minutes, 0)
            )
          end
        )
        into v_active_visit
        from public.clinic_visits_and_queue v
        left join public.clinic_doctors d on d.id = v.doctor_id
       where v.business_id = v_biz.id
         and v.patient_id = v_patient.id
         and v.visit_date = v_today
         and v.status in ('waiting', 'vitals_done', 'in_consultation')
       order by
         case when v.status = 'in_consultation' then 0 else 1 end asc,
         v.checked_in_at desc
       limit 1;

      select coalesce(jsonb_agg(h_row order by h_checkin desc), '[]'::jsonb)
        into v_history
        from (
          select
            jsonb_build_object(
              'id', v.id,
              'businessId', v.business_id,
              'patientId', v.patient_id,
              'patientCode', v_patient.patient_code,
              'patientName', v_patient.full_name,
              'patientPhone', v_patient.phone,
              'patientAge', v_patient.age,
              'patientGender', v_patient.gender,
              'patientAllergies', v_patient.allergies,
              'patientPackageName', v_patient.active_package_name,
              'patientPackageRemaining', v_patient.package_sessions_remaining,
              'patientPackageTotal', v_patient.package_sessions_total,
              'doctorId', v.doctor_id,
              'doctorName', d.doctor_name,
              'doctorSpecialty', d.specialty,
              'cabinLabel', d.cabin_label,
              'visitDate', v.visit_date,
              'tokenNumber', v.token_number,
              'visitType', v.visit_type,
              'scheduledSlot', v.scheduled_slot,
              'chiefComplaint', v.chief_complaint,
              'status', v.status,
              'vitalsJson', v.vitals_json,
              'diagnosisNotes', v.diagnosis_notes,
              'prescriptionItems', v.prescription_items,
              'rxAttachmentUrl', v.rx_attachment_url,
              'feeChargedPaise', v.fee_charged_paise,
              'amountCollectedPaise', v.amount_collected_paise,
              'paymentMethod', v.payment_method,
              'doctorCommissionPaise', v.doctor_commission_paise,
              'checkedInAt', v.checked_in_at,
              'completedAt', v.completed_at
            ) as h_row,
            v.checked_in_at as h_checkin
          from public.clinic_visits_and_queue v
          left join public.clinic_doctors d on d.id = v.doctor_id
          where v.business_id = v_biz.id
            and v.patient_id = v_patient.id
          order by v.checked_in_at desc
          limit 25
        ) sub_hist;
    end if;
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_biz.id,
      'name', v_biz.name,
      'slug', v_biz.slug,
      'city', v_biz.city,
      'category', v_biz.category,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'config', jsonb_build_object(
      'businessId', v_cfg.business_id,
      'clinicTagline', v_cfg.clinic_tagline,
      'logoUrl', v_cfg.logo_url,
      'accentColor', v_cfg.accent_color,
      'isQueueOpen', v_cfg.is_queue_open,
      'recallWindowDays', v_cfg.recall_window_days,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    ),
    'doctors', v_doctors,
    'patient', v_patient_json,
    'activeVisit', v_active_visit,
    'visitHistory', v_history
  );
end;
$$;

revoke all on function public.get_public_clinic_hub(text, text) from public;
grant execute on function public.get_public_clinic_hub(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 2: public.checkin_or_book_clinic_token(...)
-- Upserts clinic_patients (PT-001...), generates sequential daily token
-- (#C-01, #C-02...), calculates live ETA, and returns queue status.
-- ============================================================================
create or replace function public.checkin_or_book_clinic_token(
  p_slug text,
  p_full_name text,
  p_phone text,
  p_doctor_id uuid default null,
  p_visit_type text default 'walk_in',
  p_chief_complaint text default null,
  p_age integer default null,
  p_allergies text default null,
  p_gender text default null,
  p_blood_group text default null,
  p_scheduled_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_full_name, '')), 1, 80);
  v_clean_phone text := public.normalize_clinic_phone(p_phone);
  v_clean_complaint text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_chief_complaint, '')), 1, 240), '');
  v_clean_allergies text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_allergies, '')), 1, 200), '');
  v_clean_blood text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_blood_group, '')), 1, 12), '');
  v_clean_slot text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_scheduled_slot, '')), 1, 40), '');
  v_visit_type text := case
    when p_visit_type in ('walk_in', 'appointment', 'package_session', 'followup') then p_visit_type
    else 'walk_in'
  end;
  v_gender text := case
    when p_gender in ('male', 'female', 'other') then p_gender
    else null
  end;
  v_today date := current_date;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_biz record;
  v_cfg public.clinic_configs%rowtype;
  v_doc public.clinic_doctors%rowtype;
  v_has_doc boolean := false;
  v_patient public.clinic_patients%rowtype;
  v_existing_visit public.clinic_visits_and_queue%rowtype;
  v_patient_count integer := 0;
  v_daily_seq integer := 0;
  v_token_number text;
  v_patients_ahead integer := 0;
  v_eta_minutes integer := 0;
  v_visit public.clinic_visits_and_queue%rowtype;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Please enter patient full name (at least 2 characters).';
  end if;
  if pg_catalog.char_length(v_clean_phone) < 7 then
    raise exception 'Please enter a valid 10-digit mobile number.';
  end if;
  if p_age is not null and (p_age < 0 or p_age > 130) then
    raise exception 'Age must be between 0 and 130.';
  end if;

  select b.id, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and (
       (coalesce(b.status, 'active') = 'active' and coalesce(b.account_state, 'active') = 'active')
       or public.is_business_owner(b.id)
     )
   limit 1;

  if not found then
    raise exception 'Clinic not found or currently inactive.';
  end if;

  v_cfg := public.ensure_clinic_config(v_biz.id);
  if not v_cfg.is_queue_open and not public.is_business_owner(v_biz.id) then
    raise exception 'Live OPD queue check-in is temporarily paused by reception.';
  end if;

  if p_doctor_id is not null then
    select * into v_doc
      from public.clinic_doctors d
     where d.id = p_doctor_id
       and d.business_id = v_biz.id
     limit 1;
    if not found then
      raise exception 'Selected doctor does not belong to this clinic.';
    end if;
    if not v_doc.is_available and not public.is_business_owner(v_biz.id) then
      raise exception 'Selected doctor is currently unavailable for queue check-ins.';
    end if;
    v_has_doc := true;
  else
    select * into v_doc
      from public.clinic_doctors d
     where d.business_id = v_biz.id
       and d.is_available = true
     order by d.created_at asc
     limit 1;
    if found then
      v_has_doc := true;
    end if;
  end if;

  -- Upsert clinic_patients
  select * into v_patient
    from public.clinic_patients cp
   where cp.business_id = v_biz.id
     and cp.phone = v_clean_phone
   limit 1
   for update;

  if not found then
    select count(*)::integer into v_patient_count
      from public.clinic_patients cp
     where cp.business_id = v_biz.id;

    insert into public.clinic_patients (
      business_id,
      patient_code,
      full_name,
      phone,
      age,
      gender,
      blood_group,
      allergies,
      created_at,
      updated_at
    ) values (
      v_biz.id,
      'PT-' || pg_catalog.lpad((v_patient_count + 1)::text, 3, '0'),
      v_clean_name,
      v_clean_phone,
      p_age,
      v_gender,
      v_clean_blood,
      v_clean_allergies,
      v_now,
      v_now
    )
    returning * into v_patient;
  else
    update public.clinic_patients
       set full_name = v_clean_name,
           age = coalesce(p_age, age),
           gender = coalesce(v_gender, gender),
           blood_group = coalesce(v_clean_blood, blood_group),
           allergies = coalesce(v_clean_allergies, allergies),
           updated_at = v_now
     where id = v_patient.id
     returning * into v_patient;
  end if;

  -- Prevent duplicate active waiting token for the same patient on the same day
  select * into v_existing_visit
    from public.clinic_visits_and_queue v
   where v.business_id = v_biz.id
     and v.patient_id = v_patient.id
     and v.visit_date = v_today
     and v.status in ('waiting', 'vitals_done', 'in_consultation')
   order by v.checked_in_at desc
   limit 1;

  if found then
    select count(*)::integer into v_patients_ahead
      from public.clinic_visits_and_queue va
     where va.business_id = v_biz.id
       and va.visit_date = v_today
       and (
         (v_existing_visit.doctor_id is null and va.doctor_id is null)
         or va.doctor_id = v_existing_visit.doctor_id
       )
       and va.status in ('waiting', 'vitals_done', 'in_consultation')
       and va.id <> v_existing_visit.id
       and (
         va.status = 'in_consultation'
         or va.checked_in_at < v_existing_visit.checked_in_at
       );

    v_eta_minutes := case
      when v_existing_visit.status = 'in_consultation' then 0
      else greatest(
        0,
        v_patients_ahead * coalesce(v_doc.avg_consult_minutes, 15) + coalesce(v_doc.extra_delay_minutes, 0)
      )
    end;

    return jsonb_build_object(
      'tokenNumber', v_existing_visit.token_number,
      'patientsAhead', case when v_existing_visit.status = 'in_consultation' then 0 else v_patients_ahead end,
      'estimatedWaitMinutes', v_eta_minutes,
      'visitId', v_existing_visit.id,
      'patientId', v_patient.id,
      'patientCode', v_patient.patient_code,
      'doctorName', case when v_has_doc then v_doc.doctor_name else null end,
      'cabinLabel', case when v_has_doc then v_doc.cabin_label else null end,
      'status', v_existing_visit.status
    );
  end if;

  -- Compute active patients ahead for the chosen doctor today BEFORE inserting
  select count(*)::integer into v_patients_ahead
    from public.clinic_visits_and_queue va
   where va.business_id = v_biz.id
     and va.visit_date = v_today
     and (
       (not v_has_doc and va.doctor_id is null)
       or (v_has_doc and va.doctor_id = v_doc.id)
     )
     and va.status in ('waiting', 'vitals_done', 'in_consultation');

  -- Sequential daily token across the clinic (#C-01, #C-02...)
  select count(*)::integer into v_daily_seq
    from public.clinic_visits_and_queue v
   where v.business_id = v_biz.id
     and v.visit_date = v_today;

  v_token_number := '#C-' || pg_catalog.lpad((v_daily_seq + 1)::text, 2, '0');
  v_eta_minutes := greatest(
    0,
    v_patients_ahead * coalesce(v_doc.avg_consult_minutes, 15) + coalesce(v_doc.extra_delay_minutes, 0)
  );

  insert into public.clinic_visits_and_queue (
    business_id,
    patient_id,
    doctor_id,
    visit_date,
    token_number,
    visit_type,
    scheduled_slot,
    chief_complaint,
    status,
    fee_charged_paise,
    checked_in_at
  ) values (
    v_biz.id,
    v_patient.id,
    case when v_has_doc then v_doc.id else null end,
    v_today,
    v_token_number,
    v_visit_type,
    v_clean_slot,
    v_clean_complaint,
    'waiting',
    case when v_visit_type = 'package_session' then 0 else coalesce(v_doc.consultation_fee_paise, 50000) end,
    v_now
  )
  returning * into v_visit;

  return jsonb_build_object(
    'tokenNumber', v_visit.token_number,
    'patientsAhead', v_patients_ahead,
    'estimatedWaitMinutes', v_eta_minutes,
    'visitId', v_visit.id,
    'patientId', v_patient.id,
    'patientCode', v_patient.patient_code,
    'doctorName', case when v_has_doc then v_doc.doctor_name else null end,
    'cabinLabel', case when v_has_doc then v_doc.cabin_label else null end,
    'status', v_visit.status
  );
end;
$$;

revoke all on function public.checkin_or_book_clinic_token(text, text, text, uuid, text, text, integer, text, text, text, text) from public;
grant execute on function public.checkin_or_book_clinic_token(text, text, text, uuid, text, text, integer, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 3: public.update_clinic_visit_vitals_and_status(...)
-- Reception / Nurse records BP / Pulse / Temp / Weight and advances visit status.
-- ============================================================================
create or replace function public.update_clinic_visit_vitals_and_status(
  p_business_id uuid,
  p_visit_id uuid,
  p_status text,
  p_vitals_json jsonb default null,
  p_doctor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_visit public.clinic_visits_and_queue%rowtype;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can update queue vitals and status.';
  end if;

  if p_status not in ('waiting', 'vitals_done', 'in_consultation', 'completed', 'no_show') then
    raise exception 'Invalid clinic visit status.';
  end if;

  select * into v_visit
    from public.clinic_visits_and_queue v
   where v.id = p_visit_id
     and v.business_id = p_business_id
   limit 1
   for update;

  if not found then
    raise exception 'Clinic visit record not found.';
  end if;

  update public.clinic_visits_and_queue
     set status = p_status,
         vitals_json = coalesce(p_vitals_json, vitals_json),
         doctor_id = coalesce(p_doctor_id, doctor_id),
         completed_at = case
           when p_status in ('completed', 'no_show') then coalesce(completed_at, pg_catalog.clock_timestamp())
           else completed_at
         end
   where id = v_visit.id
   returning * into v_visit;

  return jsonb_build_object(
    'id', v_visit.id,
    'businessId', v_visit.business_id,
    'patientId', v_visit.patient_id,
    'doctorId', v_visit.doctor_id,
    'visitDate', v_visit.visit_date,
    'tokenNumber', v_visit.token_number,
    'visitType', v_visit.visit_type,
    'status', v_visit.status,
    'vitalsJson', v_visit.vitals_json,
    'checkedInAt', v_visit.checked_in_at,
    'completedAt', v_visit.completed_at
  );
end;
$$;

revoke all on function public.update_clinic_visit_vitals_and_status(uuid, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.update_clinic_visit_vitals_and_status(uuid, uuid, text, jsonb, uuid) to authenticated, service_role;

-- ============================================================================
-- RPC 4: public.adjust_clinic_doctor_delay(p_business_id, p_doctor_id, p_delta_minutes)
-- Updates extra_delay_minutes = GREATEST(-15, extra_delay_minutes + p_delta_minutes)
-- ============================================================================
create or replace function public.adjust_clinic_doctor_delay(
  p_business_id uuid,
  p_doctor_id uuid,
  p_delta_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_doc public.clinic_doctors%rowtype;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can adjust doctor wait delays.';
  end if;

  update public.clinic_doctors
     set extra_delay_minutes = least(180, greatest(-15, extra_delay_minutes + coalesce(p_delta_minutes, 0)))
   where id = p_doctor_id
     and business_id = p_business_id
   returning * into v_doc;

  if not found then
    raise exception 'Clinic doctor not found.';
  end if;

  return jsonb_build_object(
    'id', v_doc.id,
    'businessId', v_doc.business_id,
    'doctorName', v_doc.doctor_name,
    'specialty', v_doc.specialty,
    'cabinLabel', v_doc.cabin_label,
    'consultationFeePaise', v_doc.consultation_fee_paise,
    'avgConsultMinutes', v_doc.avg_consult_minutes,
    'extraDelayMinutes', v_doc.extra_delay_minutes,
    'commissionPercent', v_doc.commission_percent::numeric,
    'isAvailable', v_doc.is_available,
    'createdAt', v_doc.created_at
  );
end;
$$;

revoke all on function public.adjust_clinic_doctor_delay(uuid, uuid, integer) from public, anon;
grant execute on function public.adjust_clinic_doctor_delay(uuid, uuid, integer) to authenticated, service_role;

-- ============================================================================
-- RPC 5: public.complete_clinic_consultation_and_rx(...)
-- Saves diagnosis, Rx items, Rx/Lab photo, calculates doctor commission,
-- optionally deducts 1 package session, updates balance_due_paise & recall date.
-- ============================================================================
create or replace function public.complete_clinic_consultation_and_rx(
  p_business_id uuid,
  p_visit_id uuid,
  p_diagnosis_notes text,
  p_prescription_items jsonb,
  p_rx_attachment_url text,
  p_fee_charged_paise integer,
  p_amount_collected_paise integer,
  p_payment_method text,
  p_deduct_package_session boolean,
  p_next_followup_date date default null,
  p_followup_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_visit public.clinic_visits_and_queue%rowtype;
  v_patient public.clinic_patients%rowtype;
  v_doc public.clinic_doctors%rowtype;
  v_fee integer := greatest(0, coalesce(p_fee_charged_paise, 0));
  v_collected integer := greatest(0, coalesce(p_amount_collected_paise, 0));
  v_method text := case
    when p_payment_method in ('cash', 'upi', 'card', 'package_credit') then p_payment_method
    else 'upi'
  end;
  v_comm_pct numeric(5,2) := 0;
  v_comm_paise integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can complete consultations.';
  end if;

  select * into v_visit
    from public.clinic_visits_and_queue v
   where v.id = p_visit_id
     and v.business_id = p_business_id
   limit 1
   for update;

  if not found then
    raise exception 'Clinic visit record not found.';
  end if;

  select * into v_patient
    from public.clinic_patients cp
   where cp.id = v_visit.patient_id
     and cp.business_id = p_business_id
   limit 1
   for update;

  if not found then
    raise exception 'Patient record not found.';
  end if;

  if v_visit.doctor_id is not null then
    select * into v_doc
      from public.clinic_doctors d
     where d.id = v_visit.doctor_id
       and d.business_id = p_business_id
     limit 1;
    if found then
      v_comm_pct := coalesce(v_doc.commission_percent, 0);
    end if;
  end if;

  v_comm_paise := round((v_fee::numeric * v_comm_pct) / 100.0)::integer;

  update public.clinic_visits_and_queue
     set status = 'completed',
         diagnosis_notes = nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_diagnosis_notes, '')), 1, 2000), ''),
         prescription_items = coalesce(p_prescription_items, '[]'::jsonb),
         rx_attachment_url = nullif(pg_catalog.btrim(coalesce(p_rx_attachment_url, '')), ''),
         fee_charged_paise = v_fee,
         amount_collected_paise = v_collected,
         payment_method = v_method,
         doctor_commission_paise = v_comm_paise,
         completed_at = v_now
   where id = v_visit.id
   returning * into v_visit;

  update public.clinic_patients
     set package_sessions_remaining = case
           when coalesce(p_deduct_package_session, false) and package_sessions_remaining > 0
             then package_sessions_remaining - 1
           else package_sessions_remaining
         end,
         total_billed_paise = total_billed_paise + v_fee,
         amount_paid_paise = amount_paid_paise + v_collected,
         balance_due_paise = greatest(0, balance_due_paise + (v_fee - v_collected)),
         next_followup_date = coalesce(p_next_followup_date, next_followup_date),
         followup_reason = coalesce(
           nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_followup_reason, '')), 1, 160), ''),
           followup_reason
         ),
         total_visits = total_visits + 1,
         updated_at = v_now
   where id = v_patient.id
   returning * into v_patient;

  return jsonb_build_object(
    'visit', jsonb_build_object(
      'id', v_visit.id,
      'businessId', v_visit.business_id,
      'patientId', v_visit.patient_id,
      'doctorId', v_visit.doctor_id,
      'visitDate', v_visit.visit_date,
      'tokenNumber', v_visit.token_number,
      'visitType', v_visit.visit_type,
      'status', v_visit.status,
      'vitalsJson', v_visit.vitals_json,
      'diagnosisNotes', v_visit.diagnosis_notes,
      'prescriptionItems', v_visit.prescription_items,
      'rxAttachmentUrl', v_visit.rx_attachment_url,
      'feeChargedPaise', v_visit.fee_charged_paise,
      'amountCollectedPaise', v_visit.amount_collected_paise,
      'paymentMethod', v_visit.payment_method,
      'doctorCommissionPaise', v_visit.doctor_commission_paise,
      'checkedInAt', v_visit.checked_in_at,
      'completedAt', v_visit.completed_at
    ),
    'patient', jsonb_build_object(
      'id', v_patient.id,
      'businessId', v_patient.business_id,
      'patientCode', v_patient.patient_code,
      'fullName', v_patient.full_name,
      'phone', v_patient.phone,
      'age', v_patient.age,
      'gender', v_patient.gender,
      'bloodGroup', v_patient.blood_group,
      'allergies', v_patient.allergies,
      'activePackageName', v_patient.active_package_name,
      'packageSessionsTotal', v_patient.package_sessions_total,
      'packageSessionsRemaining', v_patient.package_sessions_remaining,
      'totalBilledPaise', v_patient.total_billed_paise,
      'amountPaidPaise', v_patient.amount_paid_paise,
      'balanceDuePaise', v_patient.balance_due_paise,
      'nextFollowupDate', v_patient.next_followup_date,
      'followupReason', v_patient.followup_reason,
      'totalVisits', v_patient.total_visits,
      'createdAt', v_patient.created_at,
      'updatedAt', v_patient.updated_at
    )
  );
end;
$$;

revoke all on function public.complete_clinic_consultation_and_rx(uuid, uuid, text, jsonb, text, integer, integer, text, boolean, date, text) from public, anon;
grant execute on function public.complete_clinic_consultation_and_rx(uuid, uuid, text, jsonb, text, integer, integer, text, boolean, date, text) to authenticated, service_role;

-- ============================================================================
-- RPC 6: public.assign_clinic_treatment_package(...)
-- Assigns multi-session treatment packages with full or installment payment.
-- ============================================================================
create or replace function public.assign_clinic_treatment_package(
  p_business_id uuid,
  p_patient_id uuid,
  p_package_name text,
  p_sessions_total integer,
  p_package_fee_paise integer,
  p_amount_paid_now_paise integer,
  p_next_followup_date date default null,
  p_followup_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_pkg text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_package_name, '')), 1, 120);
  v_sessions integer := greatest(1, least(100, coalesce(p_sessions_total, 1)));
  v_fee integer := greatest(0, coalesce(p_package_fee_paise, 0));
  v_paid integer := greatest(0, coalesce(p_amount_paid_now_paise, 0));
  v_patient public.clinic_patients%rowtype;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can assign treatment packages.';
  end if;
  if pg_catalog.char_length(v_clean_pkg) < 2 then
    raise exception 'Please provide a valid treatment package name.';
  end if;

  update public.clinic_patients
     set active_package_name = v_clean_pkg,
         package_sessions_total = v_sessions,
         package_sessions_remaining = v_sessions,
         total_billed_paise = total_billed_paise + v_fee,
         amount_paid_paise = amount_paid_paise + v_paid,
         balance_due_paise = greatest(0, balance_due_paise + (v_fee - v_paid)),
         next_followup_date = coalesce(p_next_followup_date, next_followup_date),
         followup_reason = coalesce(
           nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_followup_reason, '')), 1, 160), ''),
           followup_reason
         ),
         updated_at = pg_catalog.clock_timestamp()
   where id = p_patient_id
     and business_id = p_business_id
   returning * into v_patient;

  if not found then
    raise exception 'Clinic patient not found.';
  end if;

  return jsonb_build_object(
    'id', v_patient.id,
    'businessId', v_patient.business_id,
    'patientCode', v_patient.patient_code,
    'fullName', v_patient.full_name,
    'phone', v_patient.phone,
    'age', v_patient.age,
    'gender', v_patient.gender,
    'bloodGroup', v_patient.blood_group,
    'allergies', v_patient.allergies,
    'activePackageName', v_patient.active_package_name,
    'packageSessionsTotal', v_patient.package_sessions_total,
    'packageSessionsRemaining', v_patient.package_sessions_remaining,
    'totalBilledPaise', v_patient.total_billed_paise,
    'amountPaidPaise', v_patient.amount_paid_paise,
    'balanceDuePaise', v_patient.balance_due_paise,
    'nextFollowupDate', v_patient.next_followup_date,
    'followupReason', v_patient.followup_reason,
    'totalVisits', v_patient.total_visits,
    'createdAt', v_patient.created_at,
    'updatedAt', v_patient.updated_at
  );
end;
$$;

revoke all on function public.assign_clinic_treatment_package(uuid, uuid, text, integer, integer, integer, date, text) from public, anon;
grant execute on function public.assign_clinic_treatment_package(uuid, uuid, text, integer, integer, integer, date, text) to authenticated, service_role;

-- ============================================================================
-- RPC 7: public.collect_clinic_patient_balance(...)
-- Collects pending installment / procedure balance due in 1 tap.
-- ============================================================================
create or replace function public.collect_clinic_patient_balance(
  p_business_id uuid,
  p_patient_id uuid,
  p_amount_collected_paise integer,
  p_payment_method text default 'upi'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_patient public.clinic_patients%rowtype;
  v_collect integer := greatest(0, coalesce(p_amount_collected_paise, 0));
  v_applied integer := 0;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can collect patient balances.';
  end if;
  if v_collect <= 0 then
    raise exception 'Collection amount must be greater than zero.';
  end if;

  select * into v_patient
    from public.clinic_patients cp
   where cp.id = p_patient_id
     and cp.business_id = p_business_id
   limit 1
   for update;

  if not found then
    raise exception 'Clinic patient not found.';
  end if;
  if v_patient.balance_due_paise <= 0 then
    raise exception 'This patient has no pending balance due.';
  end if;

  v_applied := least(v_patient.balance_due_paise, v_collect);

  update public.clinic_patients
     set amount_paid_paise = amount_paid_paise + v_applied,
         balance_due_paise = greatest(0, balance_due_paise - v_applied),
         updated_at = pg_catalog.clock_timestamp()
   where id = v_patient.id
   returning * into v_patient;

  return jsonb_build_object(
    'id', v_patient.id,
    'businessId', v_patient.business_id,
    'patientCode', v_patient.patient_code,
    'fullName', v_patient.full_name,
    'phone', v_patient.phone,
    'age', v_patient.age,
    'gender', v_patient.gender,
    'bloodGroup', v_patient.blood_group,
    'allergies', v_patient.allergies,
    'activePackageName', v_patient.active_package_name,
    'packageSessionsTotal', v_patient.package_sessions_total,
    'packageSessionsRemaining', v_patient.package_sessions_remaining,
    'totalBilledPaise', v_patient.total_billed_paise,
    'amountPaidPaise', v_patient.amount_paid_paise,
    'balanceDuePaise', v_patient.balance_due_paise,
    'nextFollowupDate', v_patient.next_followup_date,
    'followupReason', v_patient.followup_reason,
    'totalVisits', v_patient.total_visits,
    'createdAt', v_patient.created_at,
    'updatedAt', v_patient.updated_at
  );
end;
$$;

revoke all on function public.collect_clinic_patient_balance(uuid, uuid, integer, text) from public, anon;
grant execute on function public.collect_clinic_patient_balance(uuid, uuid, integer, text) to authenticated, service_role;

-- ============================================================================
-- RPC 8: public.get_clinic_owner_dashboard(p_business_id)
-- Returns full Reception & Doctor Command Center payload: KPIs, Doctor Cabins,
-- Active Waiting Room Queue, 3-Day Recall & Balance Due Radar, Patient Directory,
-- Recent Prescriptions, and Doctor Commission Payouts.
-- ============================================================================
create or replace function public.get_clinic_owner_dashboard(
  p_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cfg public.clinic_configs%rowtype;
  v_today date := current_date;
  v_month_start date := date_trunc('month', current_date)::date;
  v_in_queue_now integer := 0;
  v_today_total integer := 0;
  v_completed_today integer := 0;
  v_today_rev integer := 0;
  v_today_consult_rev integer := 0;
  v_today_proc_rev integer := 0;
  v_recalls_due integer := 0;
  v_pending_dues integer := 0;
  v_comm_today integer := 0;
  v_doctors jsonb := '[]'::jsonb;
  v_active_queue jsonb := '[]'::jsonb;
  v_completed_visits jsonb := '[]'::jsonb;
  v_recalls jsonb := '[]'::jsonb;
  v_dues jsonb := '[]'::jsonb;
  v_patients jsonb := '[]'::jsonb;
  v_recent_rx jsonb := '[]'::jsonb;
  v_commissions jsonb := '[]'::jsonb;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the clinic owner can view the clinic dashboard.';
  end if;

  v_cfg := public.ensure_clinic_config(p_business_id);

  select
    count(*) filter (where status in ('waiting', 'vitals_done', 'in_consultation'))::integer,
    count(*) filter (where status <> 'no_show')::integer,
    count(*) filter (where status = 'completed')::integer,
    coalesce(sum(amount_collected_paise) filter (where status = 'completed'), 0)::integer,
    coalesce(sum(amount_collected_paise) filter (where status = 'completed' and visit_type in ('walk_in', 'appointment', 'followup') and fee_charged_paise <= 100000), 0)::integer,
    coalesce(sum(amount_collected_paise) filter (where status = 'completed' and (visit_type = 'package_session' or fee_charged_paise > 100000)), 0)::integer,
    coalesce(sum(doctor_commission_paise) filter (where status = 'completed'), 0)::integer
    into v_in_queue_now, v_today_total, v_completed_today, v_today_rev, v_today_consult_rev, v_today_proc_rev, v_comm_today
    from public.clinic_visits_and_queue
   where business_id = p_business_id
     and visit_date = v_today;

  select
    count(*) filter (where next_followup_date is not null and next_followup_date <= (v_today + v_cfg.recall_window_days))::integer,
    coalesce(sum(balance_due_paise), 0)::integer
    into v_recalls_due, v_pending_dues
    from public.clinic_patients
   where business_id = p_business_id;

  -- Doctor cabins with live stats
  select coalesce(jsonb_agg(doc_row order by doc_created asc), '[]'::jsonb)
    into v_doctors
    from (
      select
        jsonb_build_object(
          'id', d.id,
          'businessId', d.business_id,
          'doctorName', d.doctor_name,
          'specialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'consultationFeePaise', d.consultation_fee_paise,
          'avgConsultMinutes', d.avg_consult_minutes,
          'extraDelayMinutes', d.extra_delay_minutes,
          'commissionPercent', d.commission_percent::numeric,
          'isAvailable', d.is_available,
          'createdAt', d.created_at,
          'waitingCount', coalesce(qs.active_cnt, 0),
          'inConsultationTokenNumber', qs.in_consult_token,
          'inConsultationPatientName', qs.in_consult_name,
          'estimatedWaitMinutes', greatest(
            0,
            coalesce(qs.active_cnt, 0) * d.avg_consult_minutes + d.extra_delay_minutes
          )
        ) as doc_row,
        d.created_at as doc_created
      from public.clinic_doctors d
      left join lateral (
        select
          count(*) filter (where v.status in ('waiting', 'vitals_done', 'in_consultation'))::integer as active_cnt,
          (
            select v2.token_number
              from public.clinic_visits_and_queue v2
             where v2.business_id = p_business_id
               and v2.doctor_id = d.id
               and v2.visit_date = v_today
               and v2.status = 'in_consultation'
             order by v2.checked_in_at asc
             limit 1
          ) as in_consult_token,
          (
            select p2.full_name
              from public.clinic_visits_and_queue v2
              join public.clinic_patients p2 on p2.id = v2.patient_id
             where v2.business_id = p_business_id
               and v2.doctor_id = d.id
               and v2.visit_date = v_today
               and v2.status = 'in_consultation'
             order by v2.checked_in_at asc
             limit 1
          ) as in_consult_name
        from public.clinic_visits_and_queue v
        where v.business_id = p_business_id
          and v.doctor_id = d.id
          and v.visit_date = v_today
      ) qs on true
      where d.business_id = p_business_id
    ) sub_docs;

  -- Active waiting room queue today
  select coalesce(jsonb_agg(q_row order by q_rank asc, q_checkin asc), '[]'::jsonb)
    into v_active_queue
    from (
      select
        jsonb_build_object(
          'id', v.id,
          'businessId', v.business_id,
          'patientId', v.patient_id,
          'patientCode', cp.patient_code,
          'patientName', cp.full_name,
          'patientPhone', cp.phone,
          'patientAge', cp.age,
          'patientGender', cp.gender,
          'patientAllergies', cp.allergies,
          'patientPackageName', cp.active_package_name,
          'patientPackageRemaining', cp.package_sessions_remaining,
          'patientPackageTotal', cp.package_sessions_total,
          'doctorId', v.doctor_id,
          'doctorName', d.doctor_name,
          'doctorSpecialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'visitDate', v.visit_date,
          'tokenNumber', v.token_number,
          'visitType', v.visit_type,
          'scheduledSlot', v.scheduled_slot,
          'chiefComplaint', v.chief_complaint,
          'status', v.status,
          'vitalsJson', v.vitals_json,
          'diagnosisNotes', v.diagnosis_notes,
          'prescriptionItems', v.prescription_items,
          'rxAttachmentUrl', v.rx_attachment_url,
          'feeChargedPaise', v.fee_charged_paise,
          'amountCollectedPaise', v.amount_collected_paise,
          'paymentMethod', v.payment_method,
          'doctorCommissionPaise', v.doctor_commission_paise,
          'checkedInAt', v.checked_in_at,
          'completedAt', v.completed_at
        ) as q_row,
        case
          when v.status = 'in_consultation' then 0
          when v.status = 'vitals_done' then 1
          else 2
        end as q_rank,
        v.checked_in_at as q_checkin
      from public.clinic_visits_and_queue v
      join public.clinic_patients cp on cp.id = v.patient_id
      left join public.clinic_doctors d on d.id = v.doctor_id
      where v.business_id = p_business_id
        and v.visit_date = v_today
        and v.status in ('waiting', 'vitals_done', 'in_consultation')
    ) sub_q;

  -- Today's completed / no_show visits
  select coalesce(jsonb_agg(c_row order by c_done desc), '[]'::jsonb)
    into v_completed_visits
    from (
      select
        jsonb_build_object(
          'id', v.id,
          'businessId', v.business_id,
          'patientId', v.patient_id,
          'patientCode', cp.patient_code,
          'patientName', cp.full_name,
          'patientPhone', cp.phone,
          'patientAge', cp.age,
          'patientGender', cp.gender,
          'patientAllergies', cp.allergies,
          'patientPackageName', cp.active_package_name,
          'patientPackageRemaining', cp.package_sessions_remaining,
          'patientPackageTotal', cp.package_sessions_total,
          'doctorId', v.doctor_id,
          'doctorName', d.doctor_name,
          'doctorSpecialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'visitDate', v.visit_date,
          'tokenNumber', v.token_number,
          'visitType', v.visit_type,
          'scheduledSlot', v.scheduled_slot,
          'chiefComplaint', v.chief_complaint,
          'status', v.status,
          'vitalsJson', v.vitals_json,
          'diagnosisNotes', v.diagnosis_notes,
          'prescriptionItems', v.prescription_items,
          'rxAttachmentUrl', v.rx_attachment_url,
          'feeChargedPaise', v.fee_charged_paise,
          'amountCollectedPaise', v.amount_collected_paise,
          'paymentMethod', v.payment_method,
          'doctorCommissionPaise', v.doctor_commission_paise,
          'checkedInAt', v.checked_in_at,
          'completedAt', v.completed_at
        ) as c_row,
        coalesce(v.completed_at, v.checked_in_at) as c_done
      from public.clinic_visits_and_queue v
      join public.clinic_patients cp on cp.id = v.patient_id
      left join public.clinic_doctors d on d.id = v.doctor_id
      where v.business_id = p_business_id
        and v.visit_date = v_today
        and v.status in ('completed', 'no_show')
      order by coalesce(v.completed_at, v.checked_in_at) desc
      limit 50
    ) sub_c;

  -- 3-Day Recall & Follow-Up Radar
  select coalesce(jsonb_agg(r_row order by r_date asc), '[]'::jsonb)
    into v_recalls
    from (
      select
        jsonb_build_object(
          'id', cp.id,
          'businessId', cp.business_id,
          'patientCode', cp.patient_code,
          'fullName', cp.full_name,
          'phone', cp.phone,
          'age', cp.age,
          'gender', cp.gender,
          'bloodGroup', cp.blood_group,
          'allergies', cp.allergies,
          'activePackageName', cp.active_package_name,
          'packageSessionsTotal', cp.package_sessions_total,
          'packageSessionsRemaining', cp.package_sessions_remaining,
          'totalBilledPaise', cp.total_billed_paise,
          'amountPaidPaise', cp.amount_paid_paise,
          'balanceDuePaise', cp.balance_due_paise,
          'nextFollowupDate', cp.next_followup_date,
          'followupReason', cp.followup_reason,
          'daysUntilFollowup', (cp.next_followup_date - v_today)::integer,
          'totalVisits', cp.total_visits,
          'createdAt', cp.created_at,
          'updatedAt', cp.updated_at
        ) as r_row,
        cp.next_followup_date as r_date
      from public.clinic_patients cp
      where cp.business_id = p_business_id
        and cp.next_followup_date is not null
        and cp.next_followup_date <= (v_today + v_cfg.recall_window_days)
      order by cp.next_followup_date asc
      limit 60
    ) sub_r;

  -- Balance Due Radar
  select coalesce(jsonb_agg(b_row order by b_due desc), '[]'::jsonb)
    into v_dues
    from (
      select
        jsonb_build_object(
          'id', cp.id,
          'businessId', cp.business_id,
          'patientCode', cp.patient_code,
          'fullName', cp.full_name,
          'phone', cp.phone,
          'age', cp.age,
          'gender', cp.gender,
          'bloodGroup', cp.blood_group,
          'allergies', cp.allergies,
          'activePackageName', cp.active_package_name,
          'packageSessionsTotal', cp.package_sessions_total,
          'packageSessionsRemaining', cp.package_sessions_remaining,
          'totalBilledPaise', cp.total_billed_paise,
          'amountPaidPaise', cp.amount_paid_paise,
          'balanceDuePaise', cp.balance_due_paise,
          'nextFollowupDate', cp.next_followup_date,
          'followupReason', cp.followup_reason,
          'totalVisits', cp.total_visits,
          'createdAt', cp.created_at,
          'updatedAt', cp.updated_at
        ) as b_row,
        cp.balance_due_paise as b_due
      from public.clinic_patients cp
      where cp.business_id = p_business_id
        and cp.balance_due_paise > 0
      order by cp.balance_due_paise desc
      limit 60
    ) sub_b;

  -- Master Patient Directory
  select coalesce(jsonb_agg(p_row order by p_updated desc), '[]'::jsonb)
    into v_patients
    from (
      select
        jsonb_build_object(
          'id', cp.id,
          'businessId', cp.business_id,
          'patientCode', cp.patient_code,
          'fullName', cp.full_name,
          'phone', cp.phone,
          'age', cp.age,
          'gender', cp.gender,
          'bloodGroup', cp.blood_group,
          'allergies', cp.allergies,
          'activePackageName', cp.active_package_name,
          'packageSessionsTotal', cp.package_sessions_total,
          'packageSessionsRemaining', cp.package_sessions_remaining,
          'totalBilledPaise', cp.total_billed_paise,
          'amountPaidPaise', cp.amount_paid_paise,
          'balanceDuePaise', cp.balance_due_paise,
          'nextFollowupDate', cp.next_followup_date,
          'followupReason', cp.followup_reason,
          'totalVisits', cp.total_visits,
          'createdAt', cp.created_at,
          'updatedAt', cp.updated_at
        ) as p_row,
        cp.updated_at as p_updated
      from public.clinic_patients cp
      where cp.business_id = p_business_id
      order by cp.updated_at desc
      limit 200
    ) sub_p;

  -- Recent Prescriptions & Consultations Vault
  select coalesce(jsonb_agg(rx_row order by rx_done desc), '[]'::jsonb)
    into v_recent_rx
    from (
      select
        jsonb_build_object(
          'id', v.id,
          'businessId', v.business_id,
          'patientId', v.patient_id,
          'patientCode', cp.patient_code,
          'patientName', cp.full_name,
          'patientPhone', cp.phone,
          'patientAge', cp.age,
          'patientGender', cp.gender,
          'patientAllergies', cp.allergies,
          'patientPackageName', cp.active_package_name,
          'patientPackageRemaining', cp.package_sessions_remaining,
          'patientPackageTotal', cp.package_sessions_total,
          'doctorId', v.doctor_id,
          'doctorName', d.doctor_name,
          'doctorSpecialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'visitDate', v.visit_date,
          'tokenNumber', v.token_number,
          'visitType', v.visit_type,
          'scheduledSlot', v.scheduled_slot,
          'chiefComplaint', v.chief_complaint,
          'status', v.status,
          'vitalsJson', v.vitals_json,
          'diagnosisNotes', v.diagnosis_notes,
          'prescriptionItems', v.prescription_items,
          'rxAttachmentUrl', v.rx_attachment_url,
          'feeChargedPaise', v.fee_charged_paise,
          'amountCollectedPaise', v.amount_collected_paise,
          'paymentMethod', v.payment_method,
          'doctorCommissionPaise', v.doctor_commission_paise,
          'checkedInAt', v.checked_in_at,
          'completedAt', v.completed_at
        ) as rx_row,
        coalesce(v.completed_at, v.checked_in_at) as rx_done
      from public.clinic_visits_and_queue v
      join public.clinic_patients cp on cp.id = v.patient_id
      left join public.clinic_doctors d on d.id = v.doctor_id
      where v.business_id = p_business_id
        and v.status = 'completed'
      order by coalesce(v.completed_at, v.checked_in_at) desc
      limit 80
    ) sub_rx;

  -- Doctor Commission Payout Summary (Today & Current Month)
  select coalesce(jsonb_agg(cm_row order by cm_month_payout desc, cm_name asc), '[]'::jsonb)
    into v_commissions
    from (
      select
        jsonb_build_object(
          'doctorId', d.id,
          'doctorName', d.doctor_name,
          'specialty', d.specialty,
          'cabinLabel', d.cabin_label,
          'commissionPercent', d.commission_percent::numeric,
          'consultationsToday', coalesce(cs.today_cnt, 0),
          'grossFeesTodayPaise', coalesce(cs.today_fees, 0),
          'commissionTodayPaise', coalesce(cs.today_comm, 0),
          'consultationsThisMonth', coalesce(cs.month_cnt, 0),
          'grossFeesThisMonthPaise', coalesce(cs.month_fees, 0),
          'commissionThisMonthPaise', coalesce(cs.month_comm, 0)
        ) as cm_row,
        coalesce(cs.month_comm, 0) as cm_month_payout,
        d.doctor_name as cm_name
      from public.clinic_doctors d
      left join lateral (
        select
          count(*) filter (where v.visit_date = v_today)::integer as today_cnt,
          coalesce(sum(v.fee_charged_paise) filter (where v.visit_date = v_today), 0)::integer as today_fees,
          coalesce(sum(v.doctor_commission_paise) filter (where v.visit_date = v_today), 0)::integer as today_comm,
          count(*) filter (where v.visit_date >= v_month_start)::integer as month_cnt,
          coalesce(sum(v.fee_charged_paise) filter (where v.visit_date >= v_month_start), 0)::integer as month_fees,
          coalesce(sum(v.doctor_commission_paise) filter (where v.visit_date >= v_month_start), 0)::integer as month_comm
        from public.clinic_visits_and_queue v
        where v.business_id = p_business_id
          and v.doctor_id = d.id
          and v.status = 'completed'
      ) cs on true
      where d.business_id = p_business_id
    ) sub_cm;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'businessId', v_cfg.business_id,
      'clinicTagline', v_cfg.clinic_tagline,
      'logoUrl', v_cfg.logo_url,
      'accentColor', v_cfg.accent_color,
      'isQueueOpen', v_cfg.is_queue_open,
      'recallWindowDays', v_cfg.recall_window_days,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    ),
    'kpis', jsonb_build_object(
      'patientsInQueueNow', v_in_queue_now,
      'patientsTodayTotal', v_today_total,
      'completedTodayCount', v_completed_today,
      'todayRevenuePaise', v_today_rev,
      'todayConsultationRevenuePaise', v_today_consult_rev,
      'todayProceduresRevenuePaise', v_today_proc_rev,
      'recallsDueCount', v_recalls_due,
      'pendingBalanceDuePaise', v_pending_dues,
      'totalDoctorCommissionsTodayPaise', v_comm_today
    ),
    'doctors', v_doctors,
    'activeQueue', v_active_queue,
    'todayCompletedVisits', v_completed_visits,
    'recallRadarPatients', v_recalls,
    'balanceDuePatients', v_dues,
    'patients', v_patients,
    'recentPrescriptions', v_recent_rx,
    'doctorCommissionSummary', v_commissions
  );
end;
$$;

revoke all on function public.get_clinic_owner_dashboard(uuid) from public, anon;
grant execute on function public.get_clinic_owner_dashboard(uuid) to authenticated, service_role;

commit;
