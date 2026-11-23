-- ============================================================================
-- Migration 022: Module 7 — Dedicated CafeOS
--   - Detaches Cafe (`category = 'cafe'`) into its own dedicated Operating System
--   - Digital Coffee Stamp Card & Automatic Birthday Free Coffee (`cafe_configs`, `cafe_stamp_passes`)
--   - Raw Ingredient & Packaging Inventory Tracker with Low-Stock Radar (`cafe_inventory_items`, `cafe_inventory_logs`)
--   - Fast Counter Pickup Token Queue (`cafe_counter_orders`, daily `#C-01` auto-reset)
--   - 5 Hardened SECURITY DEFINER RPCs with 30-second rotating anti-fraud counter QR validation
--
-- Security & SQL Guardrails:
--   - ENABLE + FORCE ROW LEVEL SECURITY on every new table
--   - REVOKE ALL FROM public, anon on every new table
--   - Uses pg_catalog.substr only (strict PostgreSQL compliance)
--   - set search_path = pg_catalog, public, pg_temp on every SECURITY DEFINER RPC
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. public.cafe_configs (1:1 per cafe business)
-- ============================================================================
create table if not exists public.cafe_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  stamps_required integer not null default 8
    constraint cc_stamps_required_chk check (stamps_required between 3 and 20),
  reward_drink_name text not null default 'Any Regular Cappuccino / Cold Coffee',
  birthday_free_coffee_enabled boolean not null default true,
  birthday_drink_name text not null default 'Free Birthday Signature Coffee',
  counter_qr_secret text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  upi_id text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.cafe_configs enable row level security;
alter table public.cafe_configs force row level security;
revoke all on table public.cafe_configs from public, anon;
grant select, insert, update, delete on table public.cafe_configs to authenticated, service_role;

drop policy if exists cc_owner_all on public.cafe_configs;
create policy cc_owner_all on public.cafe_configs
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 2. public.cafe_stamp_passes (Customer Digital Coffee Card & Birthday Tracker)
-- ============================================================================
create table if not exists public.cafe_stamp_passes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pass_code text not null,
  customer_name text not null,
  phone text not null,
  birth_month integer
    constraint csp_birth_month_chk check (birth_month is null or (birth_month between 1 and 12)),
  birth_day integer
    constraint csp_birth_day_chk check (birth_day is null or (birth_day between 1 and 31)),
  current_stamps integer not null default 0
    constraint csp_current_stamps_chk check (current_stamps >= 0),
  lifetime_stamps integer not null default 0
    constraint csp_lifetime_stamps_chk check (lifetime_stamps >= 0),
  free_drinks_available integer not null default 0
    constraint csp_free_drinks_chk check (free_drinks_available >= 0),
  last_birthday_redeemed_year integer,
  last_stamped_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (business_id, pass_code),
  unique (business_id, phone)
);

create index if not exists idx_cafe_stamp_passes_biz on public.cafe_stamp_passes(business_id, updated_at desc);

alter table public.cafe_stamp_passes enable row level security;
alter table public.cafe_stamp_passes force row level security;
revoke all on table public.cafe_stamp_passes from public, anon;
grant select, insert, update, delete on table public.cafe_stamp_passes to authenticated, service_role;

drop policy if exists csp_owner_all on public.cafe_stamp_passes;
create policy csp_owner_all on public.cafe_stamp_passes
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 3. public.cafe_inventory_items (Beans, Milk, Syrups, Cups & Bakery Stock)
-- ============================================================================
create table if not exists public.cafe_inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_name text not null,
  category text not null default 'beans'
    constraint cii_category_chk check (category in ('beans', 'milk_dairy', 'syrups_flavors', 'cups_packaging', 'bakery_food', 'other')),
  unit text not null default 'kg'
    constraint cii_unit_chk check (unit in ('kg', 'g', 'liters', 'ml', 'bottles', 'pcs', 'packs')),
  current_stock numeric(10,2) not null default 0
    constraint cii_current_stock_chk check (current_stock >= 0),
  low_stock_threshold numeric(10,2) not null default 2
    constraint cii_low_stock_chk check (low_stock_threshold >= 0),
  unit_cost_paise integer not null default 0
    constraint cii_unit_cost_chk check (unit_cost_paise >= 0),
  supplier_note text,
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists idx_cafe_inventory_items_biz on public.cafe_inventory_items(business_id, category, item_name);

alter table public.cafe_inventory_items enable row level security;
alter table public.cafe_inventory_items force row level security;
revoke all on table public.cafe_inventory_items from public, anon;
grant select, insert, update, delete on table public.cafe_inventory_items to authenticated, service_role;

drop policy if exists cii_owner_all on public.cafe_inventory_items;
create policy cii_owner_all on public.cafe_inventory_items
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 4. public.cafe_inventory_logs (Auditable Restock, Usage & Wastage History)
-- ============================================================================
create table if not exists public.cafe_inventory_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_item_id uuid not null references public.cafe_inventory_items(id) on delete cascade,
  action_type text not null
    constraint cil_action_type_chk check (action_type in ('restock', 'usage', 'wastage')),
  quantity_delta numeric(10,2) not null,
  cost_paise integer not null default 0
    constraint cil_cost_chk check (cost_paise >= 0),
  note text,
  logged_by text,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists idx_cafe_inventory_logs_biz on public.cafe_inventory_logs(business_id, created_at desc);

alter table public.cafe_inventory_logs enable row level security;
alter table public.cafe_inventory_logs force row level security;
revoke all on table public.cafe_inventory_logs from public, anon;
grant select, insert, update, delete on table public.cafe_inventory_logs to authenticated, service_role;

drop policy if exists cil_owner_all on public.cafe_inventory_logs;
create policy cil_owner_all on public.cafe_inventory_logs
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 5. public.cafe_counter_orders (Fast Daily Counter Pickup Tokens #C-01...)
-- ============================================================================
create table if not exists public.cafe_counter_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_date date not null default current_date,
  token_code text not null,
  customer_name text not null,
  phone text,
  items jsonb not null default '[]'::jsonb,
  subtotal_paise integer not null default 0 check (subtotal_paise >= 0),
  status text not null default 'queued'
    constraint cco_status_chk check (status in ('queued', 'preparing', 'ready', 'picked_up', 'cancelled')),
  order_note text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists idx_cafe_counter_orders_biz_date on public.cafe_counter_orders(business_id, order_date desc, created_at desc);

alter table public.cafe_counter_orders enable row level security;
alter table public.cafe_counter_orders force row level security;
revoke all on table public.cafe_counter_orders from public, anon;
grant select, insert, update, delete on table public.cafe_counter_orders to authenticated, service_role;

drop policy if exists cco_owner_all on public.cafe_counter_orders;
create policy cco_owner_all on public.cafe_counter_orders
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- Idempotently register cafe tables in Supabase Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cafe_stamp_passes'
    ) then
      alter publication supabase_realtime add table public.cafe_stamp_passes;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cafe_counter_orders'
    ) then
      alter publication supabase_realtime add table public.cafe_counter_orders;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cafe_inventory_items'
    ) then
      alter publication supabase_realtime add table public.cafe_inventory_items;
    end if;
  end if;
exception when others then
  -- ignore publication restrictions in non-superuser environments
  null;
end;
$$;

-- ============================================================================
-- Helper: Canonical phone normalizer (10-digit Indian/global digits)
-- ============================================================================
create or replace function public.normalize_cafe_phone(p_raw text)
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
-- RPC 1: public.get_public_cafe_hub(p_slug, p_phone)
-- ============================================================================
create or replace function public.get_public_cafe_hub(
  p_slug text,
  p_phone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_phone text := public.normalize_cafe_phone(p_phone);
  v_biz record;
  v_cfg public.cafe_configs%rowtype;
  v_has_cfg boolean := false;
  v_pass public.cafe_stamp_passes%rowtype;
  v_pass_json jsonb := null;
  v_is_bday boolean := false;
  v_today_month integer := extract(month from current_date)::integer;
  v_today_day integer := extract(day from current_date)::integer;
  v_today_year integer := extract(year from current_date)::integer;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_my_orders jsonb := '[]'::jsonb;
  v_currency text := 'INR';
  v_tagline text := null;
begin
  select b.id, b.name, b.slug, b.city, b.category, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_cfg
    from public.cafe_configs cc
   where cc.business_id = v_biz.id
   limit 1;
  v_has_cfg := found;

  select coalesce(rp.currency_code, 'INR'), rp.tagline
    into v_currency, v_tagline
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  if v_clean_phone <> '' then
    select * into v_pass
      from public.cafe_stamp_passes csp
     where csp.business_id = v_biz.id
       and csp.phone = v_clean_phone
     limit 1;

    if found then
      v_is_bday := coalesce(case when v_has_cfg then v_cfg.birthday_free_coffee_enabled else true end, true)
        and v_pass.birth_month = v_today_month
        and v_pass.birth_day = v_today_day
        and coalesce(v_pass.last_birthday_redeemed_year, 0) < v_today_year;

      v_pass_json := pg_catalog.jsonb_build_object(
        'id', v_pass.id,
        'businessId', v_pass.business_id,
        'passCode', v_pass.pass_code,
        'customerName', v_pass.customer_name,
        'phone', v_pass.phone,
        'birthMonth', v_pass.birth_month,
        'birthDay', v_pass.birth_day,
        'currentStamps', v_pass.current_stamps,
        'lifetimeStamps', v_pass.lifetime_stamps,
        'freeDrinksAvailable', v_pass.free_drinks_available,
        'lastBirthdayRedeemedYear', v_pass.last_birthday_redeemed_year,
        'lastStampedAt', v_pass.last_stamped_at,
        'isBirthdayToday', v_is_bday,
        'createdAt', v_pass.created_at,
        'updatedAt', v_pass.updated_at
      );

      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', o.id,
            'businessId', o.business_id,
            'orderDate', o.order_date,
            'tokenCode', o.token_code,
            'customerName', o.customer_name,
            'phone', o.phone,
            'items', o.items,
            'subtotalPaise', o.subtotal_paise,
            'status', o.status,
            'orderNote', o.order_note,
            'createdAt', o.created_at,
            'updatedAt', o.updated_at
          )
          order by o.created_at desc
        ),
        '[]'::jsonb
      ) into v_my_orders
        from public.cafe_counter_orders o
       where o.business_id = v_biz.id
         and o.phone = v_clean_phone
         and o.order_date = current_date;
    end if;
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
  ) into v_categories
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
  ) into v_items
    from public.restaurant_menu_items i
    join public.restaurant_menu_categories c on c.id = i.category_id and c.is_active = true
   where i.business_id = v_biz.id
     and i.is_available = true;

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'name', v_biz.name,
      'slug', v_biz.slug,
      'city', v_biz.city,
      'category', v_biz.category
    ),
    'config', pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'stampsRequired', case when v_has_cfg then v_cfg.stamps_required else 8 end,
      'rewardDrinkName', case when v_has_cfg then v_cfg.reward_drink_name else 'Any Regular Cappuccino / Cold Coffee' end,
      'birthdayFreeCoffeeEnabled', case when v_has_cfg then v_cfg.birthday_free_coffee_enabled else true end,
      'birthdayDrinkName', case when v_has_cfg then v_cfg.birthday_drink_name else 'Free Birthday Signature Coffee' end,
      'upiId', case when v_has_cfg then v_cfg.upi_id else null end
    ),
    'currencyCode', coalesce(v_currency, 'INR'),
    'tagline', v_tagline,
    'pass', v_pass_json,
    'categories', v_categories,
    'items', v_items,
    'todayOrders', v_my_orders
  );
end;
$$;

revoke all on function public.get_public_cafe_hub(text, text) from public;
grant execute on function public.get_public_cafe_hub(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 2: public.claim_cafe_counter_stamp (30s Rotating QR + Cooldown + Auto Free Drink)
-- ============================================================================
create or replace function public.claim_cafe_counter_stamp(
  p_slug text,
  p_customer_name text,
  p_phone text,
  p_birth_month integer default null,
  p_birth_day integer default null,
  p_time_bucket bigint default 0,
  p_token_sig text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_customer_name, '')), 1, 80);
  v_clean_phone text := public.normalize_cafe_phone(p_phone);
  v_clean_sig text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_token_sig, '')));
  v_biz record;
  v_cfg public.cafe_configs%rowtype;
  v_now_bucket bigint := floor(extract(epoch from pg_catalog.clock_timestamp()) / 30.0)::bigint;
  v_expected_sig text;
  v_pass public.cafe_stamp_passes%rowtype;
  v_next_seq integer;
  v_new_code text;
  v_next_stamps integer;
  v_earned_free integer := 0;
  v_today_month integer := extract(month from current_date)::integer;
  v_today_day integer := extract(day from current_date)::integer;
  v_today_year integer := extract(year from current_date)::integer;
  v_is_bday boolean := false;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Please enter your name (at least 2 characters).' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_clean_phone) < 7 then
    raise exception 'Please enter a valid mobile number.' using errcode = '22023';
  end if;

  if (p_birth_month is not null and (p_birth_month < 1 or p_birth_month > 12))
     or (p_birth_day is not null and (p_birth_day < 1 or p_birth_day > 31)) then
    raise exception 'Please enter a valid birthday month and day.' using errcode = '22023';
  end if;

  select b.id, b.name, b.slug into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    raise exception 'Cafe not found or inactive.' using errcode = 'P0002';
  end if;

  -- Ensure cafe_configs row exists
  insert into public.cafe_configs (business_id)
  values (v_biz.id)
  on conflict (business_id) do nothing;

  select * into v_cfg
    from public.cafe_configs cc
   where cc.business_id = v_biz.id
   limit 1;

  -- Validate 30-second rotating anti-fraud counter QR token (+/- 1 bucket tolerance = 90s)
  if abs(v_now_bucket - coalesce(p_time_bucket, 0)) > 1 then
    raise exception 'Counter QR expired — please scan the live counter screen again.' using errcode = '42501';
  end if;

  v_expected_sig := pg_catalog.substr(
    encode(extensions.digest(v_cfg.counter_qr_secret || ':' || p_time_bucket::text, 'sha256'), 'hex'),
    1,
    16
  );

  if v_clean_sig = '' or v_clean_sig <> v_expected_sig then
    raise exception 'Invalid counter QR code — please scan the live QR at the counter.' using errcode = '42501';
  end if;

  select * into v_pass
    from public.cafe_stamp_passes csp
   where csp.business_id = v_biz.id
     and csp.phone = v_clean_phone
   limit 1;

  if found then
    -- Enforce 3-hour visit cooldown between counter stamps
    if v_pass.last_stamped_at is not null
       and v_pass.last_stamped_at > (pg_catalog.clock_timestamp() - interval '3 hours') then
      raise exception 'Stamp already collected! You can earn your next coffee stamp after 3 hours.' using errcode = 'P0001';
    end if;

    v_next_stamps := v_pass.current_stamps + 1;
    if v_next_stamps >= v_cfg.stamps_required then
      v_earned_free := floor(v_next_stamps / v_cfg.stamps_required)::integer;
      v_next_stamps := mod(v_next_stamps, v_cfg.stamps_required);
    end if;

    update public.cafe_stamp_passes
       set customer_name = v_clean_name,
           birth_month = coalesce(p_birth_month, birth_month),
           birth_day = coalesce(p_birth_day, birth_day),
           current_stamps = v_next_stamps,
           lifetime_stamps = lifetime_stamps + 1,
           free_drinks_available = free_drinks_available + v_earned_free,
           last_stamped_at = pg_catalog.clock_timestamp(),
           updated_at = pg_catalog.clock_timestamp()
     where id = v_pass.id
     returning * into v_pass;
  else
    select count(*)::integer + 1 into v_next_seq
      from public.cafe_stamp_passes
     where business_id = v_biz.id;

    v_new_code := 'BREW-' || lpad(v_next_seq::text, 3, '0');
    v_next_stamps := 1;
    if v_next_stamps >= v_cfg.stamps_required then
      v_earned_free := 1;
      v_next_stamps := 0;
    end if;

    insert into public.cafe_stamp_passes (
      business_id, pass_code, customer_name, phone,
      birth_month, birth_day, current_stamps, lifetime_stamps,
      free_drinks_available, last_stamped_at
    ) values (
      v_biz.id, v_new_code, v_clean_name, v_clean_phone,
      p_birth_month, p_birth_day, v_next_stamps, 1,
      v_earned_free, pg_catalog.clock_timestamp()
    )
    returning * into v_pass;
  end if;

  v_is_bday := v_cfg.birthday_free_coffee_enabled
    and v_pass.birth_month = v_today_month
    and v_pass.birth_day = v_today_day
    and coalesce(v_pass.last_birthday_redeemed_year, 0) < v_today_year;

  return pg_catalog.jsonb_build_object(
    'pass', pg_catalog.jsonb_build_object(
      'id', v_pass.id,
      'businessId', v_pass.business_id,
      'passCode', v_pass.pass_code,
      'customerName', v_pass.customer_name,
      'phone', v_pass.phone,
      'birthMonth', v_pass.birth_month,
      'birthDay', v_pass.birth_day,
      'currentStamps', v_pass.current_stamps,
      'lifetimeStamps', v_pass.lifetime_stamps,
      'freeDrinksAvailable', v_pass.free_drinks_available,
      'lastBirthdayRedeemedYear', v_pass.last_birthday_redeemed_year,
      'lastStampedAt', v_pass.last_stamped_at,
      'isBirthdayToday', v_is_bday,
      'createdAt', v_pass.created_at,
      'updatedAt', v_pass.updated_at
    ),
    'justUnlockedFreeDrink', (v_earned_free > 0),
    'stampsRequired', v_cfg.stamps_required
  );
end;
$$;

revoke all on function public.claim_cafe_counter_stamp(text, text, text, integer, integer, bigint, text) from public;
grant execute on function public.claim_cafe_counter_stamp(text, text, text, integer, integer, bigint, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 3: public.redeem_cafe_pass_reward (Owner-verified Stamp or Birthday Redemption)
-- ============================================================================
create or replace function public.redeem_cafe_pass_reward(
  p_business_id uuid,
  p_pass_id uuid,
  p_reward_type text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_reward_type, '')));
  v_pass public.cafe_stamp_passes%rowtype;
  v_today_month integer := extract(month from current_date)::integer;
  v_today_day integer := extract(day from current_date)::integer;
  v_today_year integer := extract(year from current_date)::integer;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: only the cafe owner can redeem customer rewards.' using errcode = '42501';
  end if;

  if v_clean_type not in ('stamp_free_drink', 'birthday_free_coffee') then
    raise exception 'Invalid reward type.' using errcode = '22023';
  end if;

  select * into v_pass
    from public.cafe_stamp_passes csp
   where csp.id = p_pass_id
     and csp.business_id = p_business_id
   limit 1;

  if not found then
    raise exception 'Customer coffee stamp pass not found.' using errcode = 'P0002';
  end if;

  if v_clean_type = 'stamp_free_drink' then
    if v_pass.free_drinks_available < 1 then
      raise exception 'No free stamp drinks available to redeem yet.' using errcode = 'P0001';
    end if;
    update public.cafe_stamp_passes
       set free_drinks_available = free_drinks_available - 1,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_pass.id
     returning * into v_pass;
  else
    if v_pass.birth_month is distinct from v_today_month or v_pass.birth_day is distinct from v_today_day then
      raise exception 'Birthday free coffee is only available on the guest birthday.' using errcode = 'P0001';
    end if;
    if coalesce(v_pass.last_birthday_redeemed_year, 0) >= v_today_year then
      raise exception 'Birthday free coffee has already been redeemed this year.' using errcode = 'P0001';
    end if;
    update public.cafe_stamp_passes
       set last_birthday_redeemed_year = v_today_year,
           updated_at = pg_catalog.clock_timestamp()
     where id = v_pass.id
     returning * into v_pass;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_pass.id,
    'businessId', v_pass.business_id,
    'passCode', v_pass.pass_code,
    'customerName', v_pass.customer_name,
    'phone', v_pass.phone,
    'birthMonth', v_pass.birth_month,
    'birthDay', v_pass.birth_day,
    'currentStamps', v_pass.current_stamps,
    'lifetimeStamps', v_pass.lifetime_stamps,
    'freeDrinksAvailable', v_pass.free_drinks_available,
    'lastBirthdayRedeemedYear', v_pass.last_birthday_redeemed_year,
    'lastStampedAt', v_pass.last_stamped_at,
    'isBirthdayToday', (
      v_pass.birth_month = v_today_month
      and v_pass.birth_day = v_today_day
      and coalesce(v_pass.last_birthday_redeemed_year, 0) < v_today_year
    ),
    'createdAt', v_pass.created_at,
    'updatedAt', v_pass.updated_at
  );
end;
$$;

revoke all on function public.redeem_cafe_pass_reward(uuid, uuid, text) from public;
grant execute on function public.redeem_cafe_pass_reward(uuid, uuid, text) to authenticated, service_role;

-- ============================================================================
-- RPC 4: public.adjust_cafe_inventory_stock (Atomic Stock + Auditable Log)
-- ============================================================================
create or replace function public.adjust_cafe_inventory_stock(
  p_business_id uuid,
  p_item_id uuid,
  p_action_type text,
  p_quantity numeric,
  p_cost_paise integer default 0,
  p_note text default null,
  p_logged_by text default 'Owner'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action_type, '')));
  v_qty numeric(10,2) := round(coalesce(p_quantity, 0)::numeric, 2);
  v_delta numeric(10,2);
  v_cost integer := greatest(0, coalesce(p_cost_paise, 0));
  v_clean_note text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_note, '')), 1, 200), '');
  v_clean_by text := coalesce(nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_logged_by, '')), 1, 80), ''), 'Owner');
  v_item public.cafe_inventory_items%rowtype;
  v_log public.cafe_inventory_logs%rowtype;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: only the cafe owner can adjust inventory stock.' using errcode = '42501';
  end if;

  if v_action not in ('restock', 'usage', 'wastage') then
    raise exception 'Invalid inventory action type.' using errcode = '22023';
  end if;

  if v_qty <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = '22023';
  end if;

  v_delta := case when v_action = 'restock' then v_qty else -v_qty end;

  update public.cafe_inventory_items
     set current_stock = greatest(0, round((current_stock + v_delta)::numeric, 2)),
         updated_at = pg_catalog.clock_timestamp()
   where id = p_item_id
     and business_id = p_business_id
   returning * into v_item;

  if not found then
    raise exception 'Cafe inventory item not found.' using errcode = 'P0002';
  end if;

  insert into public.cafe_inventory_logs (
    business_id, inventory_item_id, action_type, quantity_delta, cost_paise, note, logged_by
  ) values (
    p_business_id, p_item_id, v_action, v_delta, v_cost, v_clean_note, v_clean_by
  )
  returning * into v_log;

  return pg_catalog.jsonb_build_object(
    'item', pg_catalog.jsonb_build_object(
      'id', v_item.id,
      'businessId', v_item.business_id,
      'itemName', v_item.item_name,
      'category', v_item.category,
      'unit', v_item.unit,
      'currentStock', v_item.current_stock,
      'lowStockThreshold', v_item.low_stock_threshold,
      'unitCostPaise', v_item.unit_cost_paise,
      'supplierNote', v_item.supplier_note,
      'updatedAt', v_item.updated_at
    ),
    'log', pg_catalog.jsonb_build_object(
      'id', v_log.id,
      'businessId', v_log.business_id,
      'inventoryItemId', v_log.inventory_item_id,
      'itemName', v_item.item_name,
      'unit', v_item.unit,
      'actionType', v_log.action_type,
      'quantityDelta', v_log.quantity_delta,
      'costPaise', v_log.cost_paise,
      'note', v_log.note,
      'loggedBy', v_log.logged_by,
      'createdAt', v_log.created_at
    )
  );
end;
$$;

revoke all on function public.adjust_cafe_inventory_stock(uuid, uuid, text, numeric, integer, text, text) from public;
grant execute on function public.adjust_cafe_inventory_stock(uuid, uuid, text, numeric, integer, text, text) to authenticated, service_role;

-- ============================================================================
-- RPC 5: public.submit_cafe_counter_order (Generates Daily Pickup Token #C-01)
-- ============================================================================
create or replace function public.submit_cafe_counter_order(
  p_slug text,
  p_customer_name text,
  p_phone text default null,
  p_items jsonb default '[]'::jsonb,
  p_order_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := coalesce(nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_customer_name, '')), 1, 80), ''), 'Counter Guest');
  v_clean_phone text := nullif(public.normalize_cafe_phone(p_phone), '');
  v_clean_note text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_order_note, '')), 1, 200), '');
  v_biz record;
  v_elem jsonb;
  v_item_id uuid;
  v_qty integer;
  v_menu_item record;
  v_validated_items jsonb := '[]'::jsonb;
  v_subtotal integer := 0;
  v_today_count integer;
  v_token text;
  v_inserted public.cafe_counter_orders%rowtype;
begin
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception 'Please add at least one drink or snack.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    raise exception 'Cafe not found or inactive.' using errcode = 'P0002';
  end if;

  for v_elem in select * from pg_catalog.jsonb_array_elements(p_items) loop
    v_item_id := (v_elem ->> 'itemId')::uuid;
    v_qty := greatest(1, least(20, coalesce((v_elem ->> 'quantity')::integer, 1)));

    select i.id, i.name, i.price_paise into v_menu_item
      from public.restaurant_menu_items i
     where i.id = v_item_id
       and i.business_id = v_biz.id
       and i.is_available = true
     limit 1;

    if not found then
      raise exception 'One or more selected menu items are currently unavailable.' using errcode = 'P0002';
    end if;

    v_subtotal := v_subtotal + (v_menu_item.price_paise * v_qty);
    v_validated_items := v_validated_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'itemId', v_menu_item.id,
        'name', v_menu_item.name,
        'quantity', v_qty,
        'pricePaise', v_menu_item.price_paise
      )
    );
  end loop;

  select count(*)::integer + 1 into v_today_count
    from public.cafe_counter_orders
   where business_id = v_biz.id
     and order_date = current_date;

  v_token := '#C-' || lpad(v_today_count::text, 2, '0');

  insert into public.cafe_counter_orders (
    business_id, order_date, token_code, customer_name, phone, items, subtotal_paise, status, order_note
  ) values (
    v_biz.id, current_date, v_token, v_clean_name, v_clean_phone, v_validated_items, v_subtotal, 'queued', v_clean_note
  )
  returning * into v_inserted;

  return pg_catalog.jsonb_build_object(
    'id', v_inserted.id,
    'businessId', v_inserted.business_id,
    'orderDate', v_inserted.order_date,
    'tokenCode', v_inserted.token_code,
    'customerName', v_inserted.customer_name,
    'phone', v_inserted.phone,
    'items', v_inserted.items,
    'subtotalPaise', v_inserted.subtotal_paise,
    'status', v_inserted.status,
    'orderNote', v_inserted.order_note,
    'createdAt', v_inserted.created_at,
    'updatedAt', v_inserted.updated_at
  );
end;
$$;

revoke all on function public.submit_cafe_counter_order(text, text, text, jsonb, text) from public;
grant execute on function public.submit_cafe_counter_order(text, text, text, jsonb, text) to anon, authenticated, service_role;

commit;
