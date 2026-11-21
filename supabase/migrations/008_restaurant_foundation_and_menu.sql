-- ============================================================================
-- ReviewAssist — Phase 1: Restaurant Foundation, Tables, QR Standees & Digital Menu
-- File: supabase/migrations/008_restaurant_foundation_and_menu.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying in Supabase SQL Editor.
--
-- Purpose:
-- 1. Creates normalized multi-tenant restaurant tables:
--      - public.restaurant_profiles (1:1 with public.businesses)
--      - public.restaurant_tables (1:N with public.businesses)
--      - public.restaurant_menu_categories (1:N with public.businesses)
--      - public.restaurant_menu_items (1:N with public.businesses & categories)
-- 2. Enforces strict tenant isolation via ENABLE + FORCE ROW LEVEL SECURITY,
--    REVOKE ALL FROM public, anon, and owner policies using
--    public.is_business_owner(business_id).
-- 3. Creates hardened SECURITY DEFINER RPC function
--    public.get_public_restaurant_menu(p_slug text, p_table_key text DEFAULT NULL)
--    returning restaurant profile, validated table info, active categories, and
--    available menu items ONLY when businesses.status = 'active',
--    businesses.account_state = 'active', and restaurant_profiles.is_enabled = true.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE: public.restaurant_profiles (1:1 with public.businesses)
-- ============================================================================
create table if not exists public.restaurant_profiles (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  is_enabled boolean not null default false,
  currency_code text not null default 'INR',
  tagline text,
  games_enabled boolean not null default true,
  loyalty_enabled boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_profiles_currency_chk check (
    currency_code in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')
  ),
  constraint restaurant_profiles_tagline_len_chk check (
    tagline is null or pg_catalog.char_length(pg_catalog.btrim(tagline)) <= 160
  )
);

comment on table public.restaurant_profiles is
  'Per-business Restaurant Suite configuration (digital QR menu, table games toggle, loyalty stars toggle).';

-- ============================================================================
-- 2. TABLE: public.restaurant_tables (1:N with public.businesses)
-- ============================================================================
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_number text not null,
  table_label text,
  table_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_tables_number_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(table_number)) between 1 and 40
  ),
  constraint restaurant_tables_label_len_chk check (
    table_label is null or pg_catalog.char_length(pg_catalog.btrim(table_label)) <= 80
  ),
  constraint restaurant_tables_key_format_chk check (
    table_key ~ '^[a-z0-9][a-z0-9-]{0,39}$'
  ),
  constraint restaurant_tables_unique_key_per_business unique (business_id, table_key)
);

create index if not exists idx_restaurant_tables_business_active
  on public.restaurant_tables (business_id, is_active, created_at asc);

-- ============================================================================
-- 3. TABLE: public.restaurant_menu_categories (1:N with public.businesses)
-- ============================================================================
create table if not exists public.restaurant_menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_menu_categories_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80
  ),
  constraint restaurant_menu_categories_desc_len_chk check (
    description is null or pg_catalog.char_length(pg_catalog.btrim(description)) <= 240
  )
);

create index if not exists idx_restaurant_menu_categories_biz_order
  on public.restaurant_menu_categories (business_id, display_order asc, created_at asc);

-- ============================================================================
-- 4. TABLE: public.restaurant_menu_items (1:N with categories & businesses)
-- ============================================================================
create table if not exists public.restaurant_menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  category_id uuid not null
    references public.restaurant_menu_categories(id) on delete cascade,
  name text not null,
  description text,
  price_paise integer not null default 0,
  dietary_tag text not null default 'none',
  is_available boolean not null default true,
  is_featured boolean not null default false,
  image_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_menu_items_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 100
  ),
  constraint restaurant_menu_items_desc_len_chk check (
    description is null or pg_catalog.char_length(pg_catalog.btrim(description)) <= 300
  ),
  constraint restaurant_menu_items_price_chk check (
    price_paise >= 0 and price_paise <= 100000000
  ),
  constraint restaurant_menu_items_dietary_chk check (
    dietary_tag in ('veg', 'non_veg', 'egg', 'vegan', 'none')
  ),
  constraint restaurant_menu_items_image_url_chk check (
    image_url is null or (image_url ~ '^https?://' and pg_catalog.char_length(image_url) <= 2048)
  )
);

create index if not exists idx_restaurant_menu_items_biz_cat_order
  on public.restaurant_menu_items (business_id, category_id, display_order asc, created_at asc);

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================================
create or replace function public.touch_restaurant_updated_at()
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

revoke all on function public.touch_restaurant_updated_at() from public, anon;
grant execute on function public.touch_restaurant_updated_at() to authenticated, service_role;

drop trigger if exists trg_restaurant_profiles_updated_at on public.restaurant_profiles;
create trigger trg_restaurant_profiles_updated_at
  before update on public.restaurant_profiles
  for each row
  execute function public.touch_restaurant_updated_at();

drop trigger if exists trg_restaurant_tables_updated_at on public.restaurant_tables;
create trigger trg_restaurant_tables_updated_at
  before update on public.restaurant_tables
  for each row
  execute function public.touch_restaurant_updated_at();

drop trigger if exists trg_restaurant_menu_categories_updated_at on public.restaurant_menu_categories;
create trigger trg_restaurant_menu_categories_updated_at
  before update on public.restaurant_menu_categories
  for each row
  execute function public.touch_restaurant_updated_at();

drop trigger if exists trg_restaurant_menu_items_updated_at on public.restaurant_menu_items;
create trigger trg_restaurant_menu_items_updated_at
  before update on public.restaurant_menu_items
  for each row
  execute function public.touch_restaurant_updated_at();

-- ============================================================================
-- 6. GRANTS & ROW LEVEL SECURITY (STRICT TENANT ISOLATION)
-- ============================================================================
alter table public.restaurant_profiles enable row level security;
alter table public.restaurant_profiles force row level security;

alter table public.restaurant_tables enable row level security;
alter table public.restaurant_tables force row level security;

alter table public.restaurant_menu_categories enable row level security;
alter table public.restaurant_menu_categories force row level security;

alter table public.restaurant_menu_items enable row level security;
alter table public.restaurant_menu_items force row level security;

revoke all on table
  public.restaurant_profiles,
  public.restaurant_tables,
  public.restaurant_menu_categories,
  public.restaurant_menu_items
from public, anon;

grant select, insert, update, delete on table
  public.restaurant_profiles,
  public.restaurant_tables,
  public.restaurant_menu_categories,
  public.restaurant_menu_items
to authenticated;

grant all on table
  public.restaurant_profiles,
  public.restaurant_tables,
  public.restaurant_menu_categories,
  public.restaurant_menu_items
to service_role;

-- 6a. Owner RLS Policies for public.restaurant_profiles
drop policy if exists restaurant_profiles_owner_select on public.restaurant_profiles;
create policy restaurant_profiles_owner_select on public.restaurant_profiles
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists restaurant_profiles_owner_insert on public.restaurant_profiles;
create policy restaurant_profiles_owner_insert on public.restaurant_profiles
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_profiles_owner_update on public.restaurant_profiles;
create policy restaurant_profiles_owner_update on public.restaurant_profiles
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_profiles_owner_delete on public.restaurant_profiles;
create policy restaurant_profiles_owner_delete on public.restaurant_profiles
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- 6b. Owner RLS Policies for public.restaurant_tables
drop policy if exists restaurant_tables_owner_select on public.restaurant_tables;
create policy restaurant_tables_owner_select on public.restaurant_tables
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists restaurant_tables_owner_insert on public.restaurant_tables;
create policy restaurant_tables_owner_insert on public.restaurant_tables
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_tables_owner_update on public.restaurant_tables;
create policy restaurant_tables_owner_update on public.restaurant_tables
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_tables_owner_delete on public.restaurant_tables;
create policy restaurant_tables_owner_delete on public.restaurant_tables
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- 6c. Owner RLS Policies for public.restaurant_menu_categories
drop policy if exists restaurant_menu_categories_owner_select on public.restaurant_menu_categories;
create policy restaurant_menu_categories_owner_select on public.restaurant_menu_categories
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists restaurant_menu_categories_owner_insert on public.restaurant_menu_categories;
create policy restaurant_menu_categories_owner_insert on public.restaurant_menu_categories
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_menu_categories_owner_update on public.restaurant_menu_categories;
create policy restaurant_menu_categories_owner_update on public.restaurant_menu_categories
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_menu_categories_owner_delete on public.restaurant_menu_categories;
create policy restaurant_menu_categories_owner_delete on public.restaurant_menu_categories
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- 6d. Owner RLS Policies for public.restaurant_menu_items
drop policy if exists restaurant_menu_items_owner_select on public.restaurant_menu_items;
create policy restaurant_menu_items_owner_select on public.restaurant_menu_items
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists restaurant_menu_items_owner_insert on public.restaurant_menu_items;
create policy restaurant_menu_items_owner_insert on public.restaurant_menu_items
  for insert to authenticated
  with check (
    public.is_business_owner(business_id)
    and exists (
      select 1
      from public.restaurant_menu_categories c
      where c.id = restaurant_menu_items.category_id
        and c.business_id = restaurant_menu_items.business_id
    )
  );

drop policy if exists restaurant_menu_items_owner_update on public.restaurant_menu_items;
create policy restaurant_menu_items_owner_update on public.restaurant_menu_items
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (
    public.is_business_owner(business_id)
    and exists (
      select 1
      from public.restaurant_menu_categories c
      where c.id = restaurant_menu_items.category_id
        and c.business_id = restaurant_menu_items.business_id
    )
  );

drop policy if exists restaurant_menu_items_owner_delete on public.restaurant_menu_items;
create policy restaurant_menu_items_owner_delete on public.restaurant_menu_items
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 7. PUBLIC RPC: public.get_public_restaurant_menu(p_slug, p_table_key)
--    Hardened SECURITY DEFINER RPC returning the active digital menu,
--    restaurant profile, and validated table badge ONLY when:
--      - businesses.status = 'active'
--      - businesses.account_state = 'active'
--      - restaurant_profiles.is_enabled = true
-- ============================================================================
create or replace function public.get_public_restaurant_menu(
  p_slug text,
  p_table_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_table_key text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, ''))), '');
  v_biz record;
  v_profile record;
  v_table jsonb := null;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
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

  select rp.business_id, rp.is_enabled, rp.currency_code, rp.tagline,
         rp.games_enabled, rp.loyalty_enabled, rp.updated_at
    into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
     and rp.is_enabled = true
   limit 1;

  if not found then
    return null;
  end if;

  if v_clean_table_key is not null then
    select pg_catalog.jsonb_build_object(
      'id', rt.id,
      'businessId', rt.business_id,
      'tableNumber', rt.table_number,
      'tableLabel', rt.table_label,
      'tableKey', rt.table_key,
      'isActive', rt.is_active
    )
      into v_table
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
       and rt.is_active = true
     limit 1;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', c.id,
        'businessId', c.business_id,
        'name', c.name,
        'description', c.description,
        'displayOrder', c.display_order,
        'isActive', c.is_active
      )
      order by c.display_order asc, c.created_at asc
    ),
    '[]'::jsonb
  )
    into v_categories
    from public.restaurant_menu_categories c
   where c.business_id = v_biz.id
     and c.is_active = true;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', i.id,
        'businessId', i.business_id,
        'categoryId', i.category_id,
        'name', i.name,
        'description', i.description,
        'pricePaise', i.price_paise,
        'dietaryTag', i.dietary_tag,
        'isAvailable', i.is_available,
        'isFeatured', i.is_featured,
        'imageUrl', i.image_url,
        'displayOrder', i.display_order
      )
      order by i.display_order asc, i.created_at asc
    ),
    '[]'::jsonb
  )
    into v_items
    from public.restaurant_menu_items i
    join public.restaurant_menu_categories c
      on c.id = i.category_id
     and c.business_id = i.business_id
   where i.business_id = v_biz.id
     and c.is_active = true
     and i.is_available = true;

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'slug', v_biz.slug,
      'name', v_biz.name,
      'category', v_biz.category,
      'city', v_biz.city,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'profile', pg_catalog.jsonb_build_object(
      'businessId', v_profile.business_id,
      'isEnabled', v_profile.is_enabled,
      'currencyCode', v_profile.currency_code,
      'tagline', v_profile.tagline,
      'gamesEnabled', v_profile.games_enabled,
      'loyaltyEnabled', v_profile.loyalty_enabled,
      'updatedAt', v_profile.updated_at
    ),
    'table', v_table,
    'categories', v_categories,
    'items', v_items
  );
end;
$$;

revoke all on function public.get_public_restaurant_menu(text, text) from public;
grant execute on function public.get_public_restaurant_menu(text, text) to anon, authenticated, service_role;

commit;
