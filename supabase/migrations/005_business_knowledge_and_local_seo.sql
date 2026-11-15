-- ============================================================================
-- ReviewAssist — Phase 4: Business Knowledge & Local SEO Context Migration
-- File: supabase/migrations/005_business_knowledge_and_local_seo.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying.
--
-- Purpose:
-- Creates a normalized, multi-tenant schema for per-business knowledge:
--   1. public.business_knowledge_profiles (1:1 with public.businesses)
--        - business_id (PK, FK -> public.businesses(id) ON DELETE CASCADE)
--        - description (text, max 600 chars)
--        - primary_category (text, max 80 chars)
--        - additional_info (text, max 400 chars)
--   2. public.business_target_keywords (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), keyword (2..80 chars),
--          normalized_keyword (generated lower/trimmed), display_order
--        - UNIQUE (business_id, normalized_keyword) prevents duplicate keywords
--   3. public.business_products (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), name (1..80 chars),
--          normalized_name (generated lower/trimmed), description (<=200 chars),
--          category (<=60 chars), display_order
--        - UNIQUE (business_id, normalized_name) prevents duplicate products
--   4. public.business_services (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), name (1..80 chars),
--          normalized_name (generated lower/trimmed), description (<=200 chars),
--          display_order
--        - UNIQUE (business_id, normalized_name) prevents duplicate services
--   5. public.business_service_areas (1:N with public.businesses)
--        - id (UUID PK), business_id (FK), location_name (2..80 chars),
--          normalized_location (generated lower/trimmed), display_order
--        - UNIQUE (business_id, normalized_location) prevents duplicate locations
--
-- Security & Tenant Isolation:
--   - ENABLE + FORCE ROW LEVEL SECURITY on all 5 tables.
--   - Zero privileges granted to PUBLIC or anon (protecting customer review
--     generation on /r/:businessSlug from ever reading marketing keywords).
--   - Strict owner-only SELECT, INSERT, UPDATE, DELETE policies verified against
--     public.businesses.owner_id = (select auth.uid()).
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE: public.business_knowledge_profiles
-- ============================================================================
create table if not exists public.business_knowledge_profiles (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  description text not null default '',
  primary_category text not null default 'restaurant',
  additional_info text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bkp_description_len_chk check (
    pg_catalog.char_length(description) <= 600
  ),
  constraint bkp_primary_category_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(primary_category)) between 1 and 80
  ),
  constraint bkp_additional_info_len_chk check (
    pg_catalog.char_length(additional_info) <= 400
  ),
  constraint bkp_safety_chk check (
    description !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
    and additional_info !~* '\m(ignore|disregard|bypass|override|forget)\s+(all\s+)?(previous|prior|system|safety)\s+(instructions|rules|prompts|guardrails)\M'
  )
);

comment on table public.business_knowledge_profiles is
  'Per-business knowledge profile (description, category, additional info) for business-owned AI context.';

-- ============================================================================
-- 2. TABLE: public.business_target_keywords
-- ============================================================================
create table if not exists public.business_target_keywords (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  keyword text not null,
  normalized_keyword text generated always as (
    pg_catalog.lower(pg_catalog.btrim(keyword))
  ) stored,
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint btk_keyword_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(keyword)) between 2 and 80
  ),
  constraint btk_unique_per_business unique (business_id, normalized_keyword)
);

create index if not exists idx_business_target_keywords_biz_order
  on public.business_target_keywords (business_id, display_order);

-- ============================================================================
-- 3. TABLE: public.business_products
-- ============================================================================
create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (
    pg_catalog.lower(pg_catalog.btrim(name))
  ) stored,
  description text not null default '',
  category text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bp_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80
  ),
  constraint bp_desc_len_chk check (
    pg_catalog.char_length(description) <= 200
  ),
  constraint bp_category_len_chk check (
    pg_catalog.char_length(category) <= 60
  ),
  constraint bp_unique_per_business unique (business_id, normalized_name)
);

create index if not exists idx_business_products_biz_order
  on public.business_products (business_id, display_order);

-- ============================================================================
-- 4. TABLE: public.business_services
-- ============================================================================
create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (
    pg_catalog.lower(pg_catalog.btrim(name))
  ) stored,
  description text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint bs_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80
  ),
  constraint bs_desc_len_chk check (
    pg_catalog.char_length(description) <= 200
  ),
  constraint bs_unique_per_business unique (business_id, normalized_name)
);

create index if not exists idx_business_services_biz_order
  on public.business_services (business_id, display_order);

-- ============================================================================
-- 5. TABLE: public.business_service_areas
-- ============================================================================
create table if not exists public.business_service_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  location_name text not null,
  normalized_location text generated always as (
    pg_catalog.lower(pg_catalog.btrim(location_name))
  ) stored,
  display_order int not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint bsa_location_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(location_name)) between 2 and 80
  ),
  constraint bsa_unique_per_business unique (business_id, normalized_location)
);

create index if not exists idx_business_service_areas_biz_order
  on public.business_service_areas (business_id, display_order);

-- ============================================================================
-- 6. GRANTS & ROW LEVEL SECURITY ACROSS ALL 5 TABLES
-- ============================================================================
alter table public.business_knowledge_profiles enable row level security;
alter table public.business_knowledge_profiles force row level security;

alter table public.business_target_keywords enable row level security;
alter table public.business_target_keywords force row level security;

alter table public.business_products enable row level security;
alter table public.business_products force row level security;

alter table public.business_services enable row level security;
alter table public.business_services force row level security;

alter table public.business_service_areas enable row level security;
alter table public.business_service_areas force row level security;

revoke all on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
from public, anon;

grant select, insert, update, delete on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
to authenticated;

grant all on table
  public.business_knowledge_profiles,
  public.business_target_keywords,
  public.business_products,
  public.business_services,
  public.business_service_areas
to service_role;

-- Owner policies for business_knowledge_profiles
drop policy if exists bkp_owner_select on public.business_knowledge_profiles;
create policy bkp_owner_select on public.business_knowledge_profiles
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_insert on public.business_knowledge_profiles;
create policy bkp_owner_insert on public.business_knowledge_profiles
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_update on public.business_knowledge_profiles;
create policy bkp_owner_update on public.business_knowledge_profiles
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bkp_owner_delete on public.business_knowledge_profiles;
create policy bkp_owner_delete on public.business_knowledge_profiles
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_knowledge_profiles.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_target_keywords
drop policy if exists btk_owner_select on public.business_target_keywords;
create policy btk_owner_select on public.business_target_keywords
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_insert on public.business_target_keywords;
create policy btk_owner_insert on public.business_target_keywords
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_update on public.business_target_keywords;
create policy btk_owner_update on public.business_target_keywords
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

drop policy if exists btk_owner_delete on public.business_target_keywords;
create policy btk_owner_delete on public.business_target_keywords
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_target_keywords.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_products
drop policy if exists bp_owner_select on public.business_products;
create policy bp_owner_select on public.business_products
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_insert on public.business_products;
create policy bp_owner_insert on public.business_products
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_update on public.business_products;
create policy bp_owner_update on public.business_products
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bp_owner_delete on public.business_products;
create policy bp_owner_delete on public.business_products
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_products.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_services
drop policy if exists bs_owner_select on public.business_services;
create policy bs_owner_select on public.business_services
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_insert on public.business_services;
create policy bs_owner_insert on public.business_services
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_update on public.business_services;
create policy bs_owner_update on public.business_services
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bs_owner_delete on public.business_services;
create policy bs_owner_delete on public.business_services
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_services.business_id and b.owner_id = (select auth.uid())));

-- Owner policies for business_service_areas
drop policy if exists bsa_owner_select on public.business_service_areas;
create policy bsa_owner_select on public.business_service_areas
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_insert on public.business_service_areas;
create policy bsa_owner_insert on public.business_service_areas
  for insert to authenticated
  with check (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_update on public.business_service_areas;
create policy bsa_owner_update on public.business_service_areas
  for update to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

drop policy if exists bsa_owner_delete on public.business_service_areas;
create policy bsa_owner_delete on public.business_service_areas
  for delete to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_service_areas.business_id and b.owner_id = (select auth.uid())));

commit;
