-- ============================================================================
-- ReviewAssist — Phase 5: Review Management System Schema & RLS Migration
-- File: supabase/migrations/006_review_management_system.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- 1. Extends `public.customer_drafts` (no duplicate review table created) so
--    each customer feedback & draft record supports the 4-state Business-Owner
--    Response Workflow:
--      - 'pending'
--      - 'draft_generated'
--      - 'approved'
--      - 'completed'
-- 2. Expands `customer_drafts_sentiment_chk` and `record_customer_draft_with_events`
--    to support 4-way estimated sentiment ('positive', 'neutral', 'negative', 'mixed').
-- 3. Enforces customer feedback immutability via trigger
--    `enforce_customer_drafts_owner_update_rules()` so business owners can ONLY
--    update response workflow columns (`owner_response_draft`, `response_status`,
--    `response_attempt`, `response_*_at`) and can NEVER alter or delete customer
--    `original_input`, `generated_review`, `sentiment`, `mode`, or `created_at`.
-- 4. Preserves the approved 90-day retention policy (`purge_expired_customer_drafts(90, 5000)`
--    in migration 002): because response columns live on `public.customer_drafts`,
--    expired records and their response drafts are purged together after 90 days.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXPAND SENTIMENT CONSTRAINT TO 4-WAY ESTIMATED SENTIMENT
-- ============================================================================
alter table public.customer_drafts
  drop constraint if exists customer_drafts_sentiment_chk;

alter table public.customer_drafts
  add constraint customer_drafts_sentiment_chk
    check (sentiment in ('positive', 'neutral', 'negative', 'mixed'));

-- ============================================================================
-- 2. ADD OWNER RESPONSE WORKFLOW COLUMNS TO public.customer_drafts
-- ============================================================================
alter table public.customer_drafts
  add column if not exists owner_response_draft text,
  add column if not exists response_status text not null default 'pending',
  add column if not exists response_attempt integer not null default 0,
  add column if not exists response_generated_at timestamptz,
  add column if not exists response_approved_at timestamptz,
  add column if not exists response_completed_at timestamptz,
  add column if not exists response_updated_at timestamptz;

alter table public.customer_drafts
  drop constraint if exists customer_drafts_response_status_chk,
  drop constraint if exists customer_drafts_response_draft_len_chk,
  drop constraint if exists customer_drafts_response_attempt_chk,
  drop constraint if exists customer_drafts_response_workflow_chk;

alter table public.customer_drafts
  add constraint customer_drafts_response_status_chk
    check (response_status in ('pending', 'draft_generated', 'approved', 'completed')),
  add constraint customer_drafts_response_draft_len_chk
    check (
      owner_response_draft is null
      or pg_catalog.char_length(pg_catalog.btrim(owner_response_draft)) between 1 and 4000
    ),
  add constraint customer_drafts_response_attempt_chk
    check (response_attempt between 0 and 50),
  add constraint customer_drafts_response_workflow_chk
    check (
      (
        response_status = 'pending'
        and response_approved_at is null
        and response_completed_at is null
      )
      or (
        response_status in ('draft_generated', 'approved', 'completed')
        and owner_response_draft is not null
        and pg_catalog.char_length(pg_catalog.btrim(owner_response_draft)) >= 1
      )
    );

create index if not exists idx_customer_drafts_business_status
  on public.customer_drafts (business_id, response_status, created_at desc);

create index if not exists idx_customer_drafts_business_sentiment
  on public.customer_drafts (business_id, sentiment, created_at desc);

-- ============================================================================
-- 3. IMMUTABILITY TRIGGER FOR CUSTOMER FEEDBACK FIELDS
--    Prevents any UPDATE from modifying customer-submitted feedback,
--    AI customer review draft, sentiment, mode, business_id, or created_at.
-- ============================================================================
create or replace function public.enforce_customer_drafts_owner_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if new.id is distinct from old.id then
    raise exception 'Cannot modify customer draft id' using errcode = '42501';
  end if;

  if new.business_id is distinct from old.business_id then
    raise exception 'Cannot transfer customer draft to another business' using errcode = '42501';
  end if;

  if new.original_input is distinct from old.original_input then
    raise exception 'Cannot modify customer original_input' using errcode = '42501';
  end if;

  if new.generated_review is distinct from old.generated_review then
    raise exception 'Cannot modify customer generated_review' using errcode = '42501';
  end if;

  if new.mode is distinct from old.mode then
    raise exception 'Cannot modify customer input mode' using errcode = '42501';
  end if;

  if new.sentiment is distinct from old.sentiment then
    raise exception 'Cannot modify estimated customer sentiment' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify customer draft created_at' using errcode = '42501';
  end if;

  new.response_updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$fn$;

revoke all on function public.enforce_customer_drafts_owner_update_rules()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_customer_drafts_owner_update_rules on public.customer_drafts;
create trigger trg_customer_drafts_owner_update_rules
  before update on public.customer_drafts
  for each row
  execute function public.enforce_customer_drafts_owner_update_rules();

-- ============================================================================
-- 4. COLUMN-SCOPED UPDATE PRIVILEGE & OWNER RLS POLICY
-- ============================================================================
grant update (
  owner_response_draft,
  response_status,
  response_attempt,
  response_generated_at,
  response_approved_at,
  response_completed_at,
  response_updated_at
) on table public.customer_drafts to authenticated;

drop policy if exists "customer_drafts_owner_update" on public.customer_drafts;
create policy "customer_drafts_owner_update"
  on public.customer_drafts
  as permissive
  for update
  to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 5. UPDATE record_customer_draft_with_events FOR 4-WAY SENTIMENT
-- ============================================================================
create or replace function public.record_customer_draft_with_events(
  p_business_id uuid,
  p_original_input text,
  p_generated_review text,
  p_mode text,
  p_sentiment text,
  p_attempt integer default 0
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_input text := pg_catalog.btrim(coalesce(p_original_input, ''));
  v_clean_review text := pg_catalog.btrim(coalesce(p_generated_review, ''));
  v_draft_id uuid;
begin
  if p_business_id is null then
    raise exception 'p_business_id is required' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_clean_input) < 20 or pg_catalog.char_length(v_clean_input) > 2000 then
    raise exception 'p_original_input must be 20..2000 characters' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_clean_review) < 1 or pg_catalog.char_length(v_clean_review) > 4000 then
    raise exception 'p_generated_review must be 1..4000 characters' using errcode = '22023';
  end if;

  if p_mode is null or p_mode not in ('text', 'voice') then
    raise exception 'Invalid p_mode' using errcode = '22023';
  end if;

  if p_sentiment is null or p_sentiment not in ('positive', 'neutral', 'negative', 'mixed') then
    raise exception 'Invalid p_sentiment' using errcode = '22023';
  end if;

  if p_attempt is null or p_attempt < 0 or p_attempt > 10 then
    raise exception 'Invalid p_attempt' using errcode = '22023';
  end if;

  insert into public.customer_drafts (business_id, original_input, generated_review, mode, sentiment)
  values (p_business_id, v_clean_input, v_clean_review, p_mode, p_sentiment)
  returning id into v_draft_id;

  if p_attempt = 0 then
    insert into public.analytics_events (business_id, event_type, metadata)
    values (
      p_business_id,
      'feedback_submitted',
      pg_catalog.jsonb_build_object('mode', p_mode, 'length', pg_catalog.char_length(v_clean_input))
    );
  end if;

  insert into public.analytics_events (business_id, event_type, metadata)
  values (
    p_business_id,
    'ai_generation',
    pg_catalog.jsonb_build_object('attempt', p_attempt, 'mode', p_mode, 'sentiment', p_sentiment)
  );

  return v_draft_id;
end;
$$;

revoke all on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.record_customer_draft_with_events(uuid, text, text, text, text, integer)
  to service_role;

commit;
