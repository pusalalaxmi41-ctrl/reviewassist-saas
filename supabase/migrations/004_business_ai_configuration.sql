-- ============================================================================
-- ReviewAssist — Phase 3: Per-Business AI Configuration Schema & RLS Migration
-- File: supabase/migrations/004_business_ai_configuration.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- 1. Creates public.business_ai_settings (1:1 with public.businesses) to store
--    each business owner's independent AI configuration:
--      - business_id (PK, FK -> public.businesses(id) ON DELETE CASCADE)
--      - ai_tone ('friendly' | 'professional' | 'formal' | 'warm_and_welcoming'
--                 | 'conversational' | 'premium' | 'short_and_direct')
--      - ai_custom_instructions (text, max 500 chars, prompt-override check)
--      - ai_response_length ('short' | 'medium' | 'long')
--      - ai_language ('en' | 'hi' | 'te')
--      - created_at, updated_at
-- 2. Enforces strict tenant isolation via ENABLE + FORCE ROW LEVEL SECURITY:
--      - Only the authenticated owner of the parent business (b.owner_id = auth.uid())
--        can SELECT, INSERT, UPDATE, or DELETE their business_ai_settings row.
--      - Anonymous (anon) users have zero privileges on business_ai_settings,
--        ensuring customer review generation on /r/:businessSlug never reads
--        or applies business-owner tone/instruction settings.
-- 3. Does not delete or modify any existing data.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE DEFINITION: public.business_ai_settings
-- ============================================================================
create table if not exists public.business_ai_settings (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  ai_tone text not null default 'professional',
  ai_custom_instructions text not null default '',
  ai_response_length text not null default 'medium',
  ai_language text not null default 'en',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint business_ai_settings_tone_chk check (
    ai_tone in (
      'friendly',
      'professional',
      'formal',
      'warm_and_welcoming',
      'conversational',
      'premium',
      'short_and_direct'
    )
  ),
  constraint business_ai_settings_length_chk check (
    ai_response_length in ('short', 'medium', 'long')
  ),
  constraint business_ai_settings_language_chk check (
    ai_language in ('en', 'hi', 'te')
  ),
  constraint business_ai_settings_instructions_len_chk check (
    pg_catalog.char_length(ai_custom_instructions) <= 500
  ),
  constraint business_ai_settings_instructions_safety_chk check (
    ai_custom_instructions !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
    and ai_custom_instructions !~* '\m(turn|change|convert|rewrite)\s+(negative|bad|critical|poor)\s+(reviews?|feedback|comments?)\s+(into|to)\s+(positive|good|5[\s-]*star|five[\s-]*star)\M'
  )
);

comment on table public.business_ai_settings is
  'Per-business AI configuration for business-owner responses (strictly isolated from customer review generation).';

-- ============================================================================
-- 2. UPDATED_AT TRIGGER
-- ============================================================================
create or replace function public.touch_business_ai_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$fn$;

revoke all on function public.touch_business_ai_settings_updated_at() from public, anon;
grant execute on function public.touch_business_ai_settings_updated_at() to authenticated, service_role;

drop trigger if exists trg_business_ai_settings_updated_at on public.business_ai_settings;
create trigger trg_business_ai_settings_updated_at
  before update on public.business_ai_settings
  for each row
  execute function public.touch_business_ai_settings_updated_at();

-- ============================================================================
-- 3. GRANTS & ROW LEVEL SECURITY (STRICT TENANT ISOLATION)
-- ============================================================================
alter table public.business_ai_settings enable row level security;
alter table public.business_ai_settings force row level security;

revoke all on table public.business_ai_settings from public, anon;
grant select, insert, update, delete on table public.business_ai_settings to authenticated;
grant all on table public.business_ai_settings to service_role;

drop policy if exists business_ai_settings_owner_select on public.business_ai_settings;
create policy business_ai_settings_owner_select
  on public.business_ai_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_insert on public.business_ai_settings;
create policy business_ai_settings_owner_insert
  on public.business_ai_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_update on public.business_ai_settings;
create policy business_ai_settings_owner_update
  on public.business_ai_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists business_ai_settings_owner_delete on public.business_ai_settings;
create policy business_ai_settings_owner_delete
  on public.business_ai_settings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = business_ai_settings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

-- Backfill default AI settings row for any existing business that does not have one yet
insert into public.business_ai_settings (business_id)
select b.id
from public.businesses b
where not exists (
  select 1
  from public.business_ai_settings s
  where s.business_id = b.id
)
on conflict (business_id) do nothing;

commit;
