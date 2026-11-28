-- ============================================================================
-- Vitaran AI Reviews / CateringOS — Module 10:
-- CateringOS & Banquet Hall Management System:
-- Dual Intake (Public Link + Website Embed + Phone Desk), Mixed Veg/Non-Veg
-- Packages, Bulk Trays, Function Hall Add-Ons, Recipe-to-Grocery Calculator,
-- 3-Stage Payments, Vessel Tracker & Restricted Head Chef PIN Dashboard
--
-- Migration: 034_catering_and_banquet_hall_os.sql
-- (Indexed as 034 after 033_business_loyalty_feature_toggle.sql)
--
-- SQL Safety Rules Observed:
-- - Every substring extraction uses pg_catalog.substr(x, 1, N) (NEVER substring from/for)
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY + REVOKE ALL FROM public, anon
-- - Every SECURITY DEFINER RPC sets search_path = public, pg_temp
-- ============================================================================

begin;

-- ============================================================================
-- 0. EXPAND public.businesses.category CHECK CONSTRAINT TO INCLUDE 'catering'
-- ============================================================================
alter table public.businesses
  drop constraint if exists businesses_category_chk;

alter table public.businesses
  add constraint businesses_category_chk
    check (
      category in (
        'restaurant',
        'cafe',
        'hotel',
        'pg',
        'salon',
        'barber',
        'clinic',
        'catering',
        'gym',
        'loyalty',
        'retail',
        'services'
      )
    );

-- ============================================================================
-- 1. public.catering_configs (1:1 Business Rules, Hall Settings, Chef PIN & Branding)
-- ============================================================================
create table if not exists public.catering_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  min_headcount integer not null default 30
    constraint cat_cfg_min_headcount_chk check (min_headcount >= 1),
  max_capacity_per_event integer not null default 1000
    constraint cat_cfg_max_cap_chk check (max_capacity_per_event >= 1),
  min_advance_hours integer not null default 24
    constraint cat_cfg_min_adv_chk check (min_advance_hours >= 1),
  cutoff_hours_before_event integer not null default 24
    constraint cat_cfg_cutoff_chk check (cutoff_hours_before_event >= 0),
  service_zones jsonb not null default '["City Limits", "Up to 15 km", "Outstation / Venue"]'::jsonb,
  blackout_dates jsonb not null default '[]'::jsonb,
  banquet_hall_enabled boolean not null default true,
  hall_name text not null default 'Grand Banquet Hall',
  hall_slots jsonb not null default '["Morning (07:00 AM - 12:00 PM)", "Afternoon (12:30 PM - 05:00 PM)", "Evening (06:00 PM - 11:30 PM)"]'::jsonb,
  hall_addons_catalog jsonb not null default '[{"id":"hall_rent","label":"Banquet Hall Rental","pricePaise":2500000,"enabled":true},{"id":"ac_power","label":"Central AC & Generator Backup","pricePaise":800000,"enabled":true},{"id":"decor_sound","label":"Stage Decor & Sound / DJ","pricePaise":1500000,"enabled":true},{"id":"live_counter","label":"Live Chaat / Dosa Counter","pricePaise":600000,"enabled":true},{"id":"cleaning_extra","label":"Housekeeping & Extra Hours","pricePaise":350000,"enabled":true}]'::jsonb,
  service_rates_json jsonb not null default '{"waiterPerStaffPaise":120000,"chefOnsitePaise":350000,"transportPaise":200000,"setupTeardownPaise":250000,"equipmentRentalPaise":150000}'::jsonb,
  chef_station_pin text not null default '4321',
  default_wastage_percent numeric(5,2) not null default 5.00
    constraint cat_cfg_wastage_chk check (default_wastage_percent between 0 and 30),
  brand_logo_url text,
  primary_accent_hex text not null default '#D4AF37',
  secondary_surface_hex text not null default '#0F1115',
  whatsapp_quote_template text not null default 'Hello {{customer_name}}, here is your catering & event quote ({{order_code}}) for {{event_date}} ({{total_plates}} guests). Total: ₹{{total_amount}}. Confirm advance to lock your date!',
  updated_at timestamptz not null default now()
);

alter table public.catering_configs enable row level security;
alter table public.catering_configs force row level security;
revoke all on table public.catering_configs from public, anon;
grant select, insert, update, delete on table public.catering_configs to authenticated, service_role;

drop policy if exists catering_configs_owner_all on public.catering_configs;
create policy catering_configs_owner_all on public.catering_configs
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 2. public.catering_packages (Tiered Per-Plate Menu Packages)
-- ============================================================================
create table if not exists public.catering_packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  package_name text not null,
  tier_badge text not null default 'Silver',
  meal_session text not null default 'all_day'
    constraint cat_pkg_session_chk check (meal_session in ('breakfast', 'lunch', 'high_tea', 'dinner', 'all_day')),
  veg_price_paise integer not null default 30000
    constraint cat_pkg_veg_chk check (veg_price_paise >= 0),
  non_veg_price_paise integer not null default 42000
    constraint cat_pkg_nonveg_chk check (non_veg_price_paise >= 0),
  slot_rules jsonb not null default '[{"category":"starter","label":"Starters","maxSelect":2},{"category":"main_course","label":"Main Course Curries","maxSelect":2},{"category":"rice_bread","label":"Biryani / Rice & Breads","maxSelect":2},{"category":"dessert","label":"Desserts & Beverages","maxSelect":1}]'::jsonb,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_catering_packages_biz on public.catering_packages(business_id, created_at asc);

alter table public.catering_packages enable row level security;
alter table public.catering_packages force row level security;
revoke all on table public.catering_packages from public, anon;
grant select, insert, update, delete on table public.catering_packages to authenticated, service_role;

drop policy if exists catering_packages_owner_all on public.catering_packages;
create policy catering_packages_owner_all on public.catering_packages
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 3. public.catering_dishes_and_recipes (Dishes, Bulk Trays & Per-100-Plate Yields)
-- ============================================================================
create table if not exists public.catering_dishes_and_recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dish_name text not null,
  category text not null
    constraint cat_dish_cat_chk check (category in ('starter', 'main_course', 'rice_bread', 'dessert', 'beverage', 'live_counter')),
  diet_type text not null default 'veg'
    constraint cat_dish_diet_chk check (diet_type in ('veg', 'non_veg')),
  available_in_packages boolean not null default true,
  available_bulk_alacarte boolean not null default false,
  bulk_unit text not null default 'kg'
    constraint cat_dish_bulk_unit_chk check (bulk_unit in ('kg', 'litres', 'tray', 'pieces')),
  bulk_unit_price_paise integer not null default 0
    constraint cat_dish_bulk_price_chk check (bulk_unit_price_paise >= 0),
  ingredients_per_100_plates jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_catering_dishes_biz on public.catering_dishes_and_recipes(business_id, category, created_at asc);

alter table public.catering_dishes_and_recipes enable row level security;
alter table public.catering_dishes_and_recipes force row level security;
revoke all on table public.catering_dishes_and_recipes from public, anon;
grant select, insert, update, delete on table public.catering_dishes_and_recipes to authenticated, service_role;

drop policy if exists catering_dishes_owner_all on public.catering_dishes_and_recipes;
create policy catering_dishes_owner_all on public.catering_dishes_and_recipes
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 4. public.catering_orders (Unified Online, Embed & Phone/Walk-In Orders)
-- ============================================================================
create table if not exists public.catering_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_code text not null,
  intake_channel text not null default 'online_link'
    constraint cat_ord_channel_chk check (intake_channel in ('online_link', 'website_embed', 'phone_desk', 'walk_in')),
  customer_name text not null,
  customer_phone text not null,
  occasion_type text not null default 'Corporate / Hospital Event',
  event_date date not null,
  delivery_time text not null,
  service_mode text not null default 'drop_off'
    constraint cat_ord_service_chk check (service_mode in ('self_pickup', 'drop_off', 'full_service')),
  service_zone text,
  venue_address text,
  uses_banquet_hall boolean not null default false,
  hall_slot text,
  package_id uuid references public.catering_packages(id) on delete set null,
  package_name_snapshot text,
  veg_plates integer not null default 0
    constraint cat_ord_veg_chk check (veg_plates >= 0),
  veg_rate_paise integer not null default 0,
  non_veg_plates integer not null default 0
    constraint cat_ord_nonveg_chk check (non_veg_plates >= 0),
  non_veg_rate_paise integer not null default 0,
  extra_plates_added integer not null default 0
    constraint cat_ord_extra_chk check (extra_plates_added >= 0),
  selected_package_dishes jsonb not null default '[]'::jsonb,
  bulk_alacarte_items jsonb not null default '[]'::jsonb,
  selected_hall_addons jsonb not null default '[]'::jsonb,
  service_staff_charges_paise integer not null default 0,
  subtotal_paise integer not null default 0,
  gst_paise integer not null default 0,
  total_amount_paise integer not null default 0,
  stage_1_advance_paise integer not null default 0,
  stage_2_preevent_paise integer not null default 0,
  stage_3_balance_paise integer not null default 0,
  amount_paid_paise integer not null default 0,
  balance_due_paise integer not null default 0
    constraint cat_ord_bal_chk check (balance_due_paise >= 0),
  payment_ledger jsonb not null default '[]'::jsonb,
  order_status text not null default 'quote_pending'
    constraint cat_ord_status_chk check (order_status in ('quote_pending', 'advance_confirmed', 'prep_started', 'cooking', 'dispatched', 'completed', 'cancelled')),
  kitchen_checklist jsonb not null default '{"ingredientsProcured":false,"prepCompleted":false,"cookingCompleted":false,"packedWithLabels":false,"dispatched":false}'::jsonb,
  vessels_dispatched jsonb not null default '[]'::jsonb,
  vessels_all_returned boolean not null default true,
  chef_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_catering_order_code unique (business_id, order_code)
);

create index if not exists idx_catering_orders_biz_date on public.catering_orders(business_id, event_date asc, created_at desc);

alter table public.catering_orders enable row level security;
alter table public.catering_orders force row level security;
revoke all on table public.catering_orders from public, anon;
grant select, insert, update, delete on table public.catering_orders to authenticated, service_role;

drop policy if exists catering_orders_owner_all on public.catering_orders;
create policy catering_orders_owner_all on public.catering_orders
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- Helper: Canonical phone normalizer (pg_catalog.substr ONLY)
-- ============================================================================
create or replace function public.normalize_catering_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
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
-- Helper: Ensure catering_configs row exists
-- ============================================================================
create or replace function public.ensure_catering_config(p_business_id uuid)
returns public.catering_configs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.catering_configs%rowtype;
begin
  select * into v_cfg
    from public.catering_configs
   where business_id = p_business_id
   limit 1;

  if not found then
    insert into public.catering_configs (business_id)
    values (p_business_id)
    on conflict (business_id) do nothing;

    select * into v_cfg
      from public.catering_configs
     where business_id = p_business_id
     limit 1;
  end if;

  -- Auto-seed starter packages & dishes on brand-new catering venues if empty
  if not exists (select 1 from public.catering_packages where business_id = p_business_id)
     and not exists (select 1 from public.catering_dishes_and_recipes where business_id = p_business_id) then
    insert into public.catering_packages (
      business_id, package_name, tier_badge, meal_session, veg_price_paise, non_veg_price_paise, description
    ) values
      (p_business_id, 'Silver Feast', 'Silver', 'all_day', 30000, 42000, 'Classic celebratory spread ideal for birthdays, poojas & corporate lunches.'),
      (p_business_id, 'Royal Gold Banquet', 'Gold', 'all_day', 45000, 58000, 'Signature wedding & reception buffet with Hyderabadi Dum Biryanis and Mughlai curries.'),
      (p_business_id, 'Imperial Wedding Platinum', 'Platinum', 'all_day', 65000, 82000, 'Grand luxury banquet experience with live counters & royal desserts.');

    insert into public.catering_dishes_and_recipes (
      business_id, dish_name, category, diet_type, available_in_packages, available_bulk_alacarte, bulk_unit, bulk_unit_price_paise, ingredients_per_100_plates
    ) values
      (p_business_id, 'Crispy Veg Manchurian', 'starter', 'veg', true, true, 'tray', 180000, '[{"ingredientName":"Cabbage & Carrots","unit":"kg","qtyPer100":10},{"ingredientName":"Cooking Oil","unit":"litres","qtyPer100":2.5}]'::jsonb),
      (p_business_id, 'Hyderabadi Chicken 65', 'starter', 'non_veg', true, true, 'kg', 65000, '[{"ingredientName":"Boneless Chicken","unit":"kg","qtyPer100":14},{"ingredientName":"Fresh Curd","unit":"kg","qtyPer100":3}]'::jsonb),
      (p_business_id, 'Shahi Paneer Butter Masala', 'main_course', 'veg', true, true, 'kg', 52000, '[{"ingredientName":"Malai Paneer","unit":"kg","qtyPer100":14},{"ingredientName":"Ripe Tomatoes","unit":"kg","qtyPer100":12}]'::jsonb),
      (p_business_id, 'Hyderabadi Chicken Dum Biryani', 'rice_bread', 'non_veg', true, true, 'kg', 48000, '[{"ingredientName":"Basmati Rice","unit":"kg","qtyPer100":15},{"ingredientName":"Chicken","unit":"kg","qtyPer100":18},{"ingredientName":"Pure Ghee","unit":"litres","qtyPer100":3}]'::jsonb),
      (p_business_id, 'Royal Double Ka Meetha', 'dessert', 'veg', true, true, 'tray', 220000, '[{"ingredientName":"Milk Bread","unit":"kg","qtyPer100":8},{"ingredientName":"Full Cream Milk","unit":"litres","qtyPer100":12}]'::jsonb);
  end if;

  return v_cfg;
end;
$$;

-- ============================================================================
-- Helper: Serialize catering_orders row to camelCase JSONB
-- ============================================================================
create or replace function public.serialize_catering_order_json(p_row public.catering_orders)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_row.id,
    'businessId', p_row.business_id,
    'orderCode', p_row.order_code,
    'intakeChannel', p_row.intake_channel,
    'customerName', p_row.customer_name,
    'customerPhone', p_row.customer_phone,
    'occasionType', p_row.occasion_type,
    'eventDate', pg_catalog.to_char(p_row.event_date, 'YYYY-MM-DD'),
    'deliveryTime', p_row.delivery_time,
    'serviceMode', p_row.service_mode,
    'serviceZone', p_row.service_zone,
    'venueAddress', p_row.venue_address,
    'usesBanquetHall', p_row.uses_banquet_hall,
    'hallSlot', p_row.hall_slot,
    'packageId', p_row.package_id,
    'packageNameSnapshot', p_row.package_name_snapshot,
    'vegPlates', p_row.veg_plates,
    'vegRatePaise', p_row.veg_rate_paise,
    'nonVegPlates', p_row.non_veg_plates,
    'nonVegRatePaise', p_row.non_veg_rate_paise,
    'extraPlatesAdded', p_row.extra_plates_added,
    'selectedPackageDishes', p_row.selected_package_dishes,
    'bulkAlacarteItems', p_row.bulk_alacarte_items,
    'selectedHallAddons', p_row.selected_hall_addons,
    'serviceStaffChargesPaise', p_row.service_staff_charges_paise,
    'subtotalPaise', p_row.subtotal_paise,
    'gstPaise', p_row.gst_paise,
    'totalAmountPaise', p_row.total_amount_paise,
    'stage1AdvancePaise', p_row.stage_1_advance_paise,
    'stage2PreeventPaise', p_row.stage_2_preevent_paise,
    'stage3BalancePaise', p_row.stage_3_balance_paise,
    'amountPaidPaise', p_row.amount_paid_paise,
    'balanceDuePaise', p_row.balance_due_paise,
    'paymentLedger', p_row.payment_ledger,
    'orderStatus', p_row.order_status,
    'kitchenChecklist', p_row.kitchen_checklist,
    'vesselsDispatched', p_row.vessels_dispatched,
    'vesselsAllReturned', p_row.vessels_all_returned,
    'chefNotes', p_row.chef_notes,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  );
$$;

-- ============================================================================
-- RPC 1: public.get_public_catering_portal(p_slug text)
-- Strips chef_station_pin so public callers NEVER see the kitchen PIN!
-- ============================================================================
create or replace function public.get_public_catering_portal(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_biz record;
  v_cfg public.catering_configs%rowtype;
  v_packages jsonb := '[]'::jsonb;
  v_dishes jsonb := '[]'::jsonb;
  v_booked_slots jsonb := '[]'::jsonb;
begin
  select b.id, b.name, b.slug, b.city, b.category, b.google_review_url
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and (
       (coalesce(b.status, 'active') = 'active' and coalesce(b.account_state, 'active') = 'active')
       or public.is_business_owner(b.id)
     )
   limit 1;

  if not found then
    return null;
  end if;

  v_cfg := public.ensure_catering_config(v_biz.id);

  select coalesce(pg_catalog.jsonb_agg(pkg_obj order by created_at asc), '[]'::jsonb)
    into v_packages
    from (
      select
        p.created_at,
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'businessId', p.business_id,
          'packageName', p.package_name,
          'tierBadge', p.tier_badge,
          'mealSession', p.meal_session,
          'vegPricePaise', p.veg_price_paise,
          'nonVegPricePaise', p.non_veg_price_paise,
          'slotRules', p.slot_rules,
          'description', p.description,
          'isActive', p.is_active,
          'createdAt', p.created_at
        ) as pkg_obj
      from public.catering_packages p
      where p.business_id = v_biz.id and p.is_active = true
    ) sub_pkg;

  select coalesce(pg_catalog.jsonb_agg(dish_obj order by created_at asc), '[]'::jsonb)
    into v_dishes
    from (
      select
        d.created_at,
        pg_catalog.jsonb_build_object(
          'id', d.id,
          'businessId', d.business_id,
          'dishName', d.dish_name,
          'category', d.category,
          'dietType', d.diet_type,
          'availableInPackages', d.available_in_packages,
          'availableBulkAlacarte', d.available_bulk_alacarte,
          'bulkUnit', d.bulk_unit,
          'bulkUnitPricePaise', d.bulk_unit_price_paise,
          'ingredientsPer100Plates', d.ingredients_per_100_plates,
          'isActive', d.is_active,
          'createdAt', d.created_at
        ) as dish_obj
      from public.catering_dishes_and_recipes d
      where d.business_id = v_biz.id and d.is_active = true
    ) sub_dish;

  select coalesce(pg_catalog.jsonb_agg(slot_obj), '[]'::jsonb)
    into v_booked_slots
    from (
      select pg_catalog.jsonb_build_object(
        'eventDate', pg_catalog.to_char(o.event_date, 'YYYY-MM-DD'),
        'hallSlot', o.hall_slot,
        'orderCode', o.order_code
      ) as slot_obj
      from public.catering_orders o
      where o.business_id = v_biz.id
        and o.uses_banquet_hall = true
        and o.hall_slot is not null
        and o.order_status <> 'cancelled'
        and o.event_date >= current_date
    ) sub_slots;

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'name', v_biz.name,
      'slug', v_biz.slug,
      'city', v_biz.city,
      'category', v_biz.category,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'config', pg_catalog.jsonb_build_object(
      'businessId', v_cfg.business_id,
      'minHeadcount', v_cfg.min_headcount,
      'maxCapacityPerEvent', v_cfg.max_capacity_per_event,
      'minAdvanceHours', v_cfg.min_advance_hours,
      'cutoffHoursBeforeEvent', v_cfg.cutoff_hours_before_event,
      'serviceZones', v_cfg.service_zones,
      'blackoutDates', v_cfg.blackout_dates,
      'banquetHallEnabled', v_cfg.banquet_hall_enabled,
      'hallName', v_cfg.hall_name,
      'hallSlots', v_cfg.hall_slots,
      'hallAddonsCatalog', v_cfg.hall_addons_catalog,
      'serviceRatesJson', v_cfg.service_rates_json,
      'defaultWastagePercent', v_cfg.default_wastage_percent,
      'brandLogoUrl', v_cfg.brand_logo_url,
      'primaryAccentHex', v_cfg.primary_accent_hex,
      'secondarySurfaceHex', v_cfg.secondary_surface_hex,
      'whatsappQuoteTemplate', v_cfg.whatsapp_quote_template,
      'updatedAt', v_cfg.updated_at
    ),
    'packages', v_packages,
    'dishes', v_dishes,
    'bookedHallSlots', v_booked_slots
  );
end;
$$;

revoke all on function public.get_public_catering_portal(text) from public;
grant execute on function public.get_public_catering_portal(text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 2: public.submit_catering_order(p_payload jsonb)
-- ============================================================================
create or replace function public.submit_catering_order(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payload->>'businessSlug', '')));
  v_channel text := coalesce(nullif(pg_catalog.btrim(p_payload->>'intakeChannel'), ''), 'online_link');
  v_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_payload->>'customerName', '')), 1, 90);
  v_phone text := public.normalize_catering_phone(p_payload->>'customerPhone');
  v_occasion text := coalesce(nullif(pg_catalog.btrim(p_payload->>'occasionType'), ''), 'Corporate / Hospital Event');
  v_event_date date := (p_payload->>'eventDate')::date;
  v_delivery_time text := coalesce(nullif(pg_catalog.btrim(p_payload->>'deliveryTime'), ''), '12:30 PM');
  v_service_mode text := coalesce(nullif(pg_catalog.btrim(p_payload->>'serviceMode'), ''), 'drop_off');
  v_zone text := nullif(pg_catalog.btrim(coalesce(p_payload->>'serviceZone', '')), '');
  v_address text := nullif(pg_catalog.btrim(coalesce(p_payload->>'venueAddress', '')), '');
  v_uses_hall boolean := coalesce((p_payload->>'usesBanquetHall')::boolean, false);
  v_hall_slot text := nullif(pg_catalog.btrim(coalesce(p_payload->>'hallSlot', '')), '');
  v_pkg_id uuid := nullif(pg_catalog.btrim(coalesce(p_payload->>'packageId', '')), '')::uuid;
  v_veg_plates integer := greatest(0, coalesce((p_payload->>'vegPlates')::integer, 0));
  v_nonveg_plates integer := greatest(0, coalesce((p_payload->>'nonVegPlates')::integer, 0));
  v_total_plates integer := v_veg_plates + v_nonveg_plates;
  v_waiters integer := greatest(0, coalesce((p_payload->>'waitersRequested')::integer, 0));
  v_onsite_chef boolean := coalesce((p_payload->>'onsiteChefRequested')::boolean, false);
  v_gst_pct numeric := greatest(0, least(28, coalesce((p_payload->>'gstRatePercent')::numeric, 5)));
  v_chef_notes text := nullif(pg_catalog.btrim(coalesce(p_payload->>'chefNotes', '')), '');

  v_biz record;
  v_is_owner boolean := false;
  v_cfg public.catering_configs%rowtype;
  v_pkg public.catering_packages%rowtype;
  v_veg_rate integer := 0;
  v_nonveg_rate integer := 0;
  v_pkg_name text := null;
  v_selected_dishes jsonb := '[]'::jsonb;
  v_bulk_items jsonb := '[]'::jsonb;
  v_bulk_total integer := 0;
  v_hall_addons jsonb := '[]'::jsonb;
  v_hall_addons_total integer := 0;
  v_service_charges integer := 0;
  v_subtotal integer := 0;
  v_gst integer := 0;
  v_total integer := 0;
  v_stage1 integer := 0;
  v_stage2 integer := 0;
  v_stage3 integer := 0;
  v_seq integer := 0;
  v_order_code text;
  v_saved public.catering_orders%rowtype;
begin
  if v_name = '' or pg_catalog.char_length(v_name) < 2 then
    raise exception 'Please enter customer full name.' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_phone) < 7 then
    raise exception 'Please enter a valid phone number.' using errcode = '22023';
  end if;
  if v_event_date is null then
    raise exception 'Please select an event date.' using errcode = '22023';
  end if;

  select b.id, b.name, b.slug, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_slug
   limit 1;

  if not found then
    raise exception 'Catering venue not found.' using errcode = 'P0002';
  end if;

  v_is_owner := public.is_business_owner(v_biz.id);
  if not v_is_owner and (coalesce(v_biz.status, 'active') <> 'active' or coalesce(v_biz.account_state, 'active') <> 'active') then
    raise exception 'Catering venue is currently inactive.' using errcode = '42501';
  end if;

  v_cfg := public.ensure_catering_config(v_biz.id);

  -- Enforce blackout dates
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements_text(v_cfg.blackout_dates) as bd(dt)
     where bd.dt = pg_catalog.to_char(v_event_date, 'YYYY-MM-DD')
  ) then
    raise exception 'Selected event date (%) is unavailable / blacked out.', pg_catalog.to_char(v_event_date, 'YYYY-MM-DD')
      using errcode = '22023';
  end if;

  -- Enforce advance notice hours for self-serve online / website embed bookings
  if not v_is_owner and v_channel in ('online_link', 'website_embed') and ((v_event_date - current_date) * 24) < v_cfg.min_advance_hours then
    raise exception 'Online bookings require at least % hours advance notice.', v_cfg.min_advance_hours
      using errcode = '22023';
  end if;

  -- Enforce headcount bounds whenever package plates are selected (or no bulk items)
  if v_pkg_id is not null or coalesce(pg_catalog.jsonb_array_length(coalesce(p_payload->'bulkItems', '[]'::jsonb)), 0) = 0 then
    if v_total_plates < v_cfg.min_headcount then
      raise exception 'Minimum headcount is % plates (requested % plates).', v_cfg.min_headcount, v_total_plates
        using errcode = '22023';
    end if;
  end if;
  if v_total_plates > v_cfg.max_capacity_per_event then
    raise exception 'Maximum capacity per event is % plates.', v_cfg.max_capacity_per_event
      using errcode = '22023';
  end if;

  -- Enforce Banquet Hall slot conflict check
  if v_uses_hall then
    if not v_cfg.banquet_hall_enabled then
      raise exception 'Banquet Hall bookings are disabled for this venue.' using errcode = '22023';
    end if;
    if v_hall_slot is null then
      raise exception 'Please select a Banquet Hall slot (Morning / Afternoon / Evening).' using errcode = '22023';
    end if;
    if exists (
      select 1
        from public.catering_orders o
       where o.business_id = v_biz.id
         and o.uses_banquet_hall = true
         and o.event_date = v_event_date
         and pg_catalog.lower(o.hall_slot) = pg_catalog.lower(v_hall_slot)
         and o.order_status <> 'cancelled'
    ) then
      raise exception 'Banquet Hall slot "%" on % is already booked.', v_hall_slot, pg_catalog.to_char(v_event_date, 'YYYY-MM-DD')
        using errcode = '23505';
    end if;
  end if;

  -- Resolve canonical package rates
  if v_pkg_id is not null then
    select * into v_pkg
      from public.catering_packages p
     where p.id = v_pkg_id and p.business_id = v_biz.id
     limit 1;
    if not found then
      raise exception 'Selected catering package not found.' using errcode = 'P0002';
    end if;
    v_veg_rate := v_pkg.veg_price_paise;
    v_nonveg_rate := v_pkg.non_veg_price_paise;
    v_pkg_name := v_pkg.package_name;
  end if;

  -- Resolve selected package dishes
  if pg_catalog.jsonb_typeof(p_payload->'selectedDishIds') = 'array' then
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'dishId', d.id,
        'dishName', d.dish_name,
        'dietType', d.diet_type,
        'category', d.category
      )
    ), '[]'::jsonb)
    into v_selected_dishes
    from public.catering_dishes_and_recipes d
    where d.business_id = v_biz.id
      and d.id::text in (
        select pg_catalog.jsonb_array_elements_text(p_payload->'selectedDishIds')
      );
  end if;

  -- Resolve bulk à la carte items
  if pg_catalog.jsonb_typeof(p_payload->'bulkItems') = 'array' then
    select
      coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'dishId', d.id,
          'dishName', d.dish_name,
          'dietType', d.diet_type,
          'unit', d.bulk_unit,
          'quantity', bi.qty,
          'unitPricePaise', d.bulk_unit_price_paise
        )
      ), '[]'::jsonb),
      coalesce(sum(round(bi.qty * d.bulk_unit_price_paise))::integer, 0)
    into v_bulk_items, v_bulk_total
    from (
      select
        (elem->>'dishId')::uuid as dish_id,
        greatest(0, coalesce((elem->>'quantity')::numeric, 0)) as qty
      from pg_catalog.jsonb_array_elements(p_payload->'bulkItems') as elem
    ) bi
    join public.catering_dishes_and_recipes d
      on d.id = bi.dish_id and d.business_id = v_biz.id
    where bi.qty > 0;
  end if;

  -- Resolve selected Banquet Hall add-ons from catalog
  if pg_catalog.jsonb_typeof(p_payload->'selectedHallAddonIds') = 'array' then
    select
      coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', cat_elem->>'id',
          'label', cat_elem->>'label',
          'pricePaise', coalesce((cat_elem->>'pricePaise')::integer, 0)
        )
      ), '[]'::jsonb),
      coalesce(sum(coalesce((cat_elem->>'pricePaise')::integer, 0))::integer, 0)
    into v_hall_addons, v_hall_addons_total
    from pg_catalog.jsonb_array_elements(v_cfg.hall_addons_catalog) as cat_elem
    where coalesce((cat_elem->>'enabled')::boolean, true) = true
      and (cat_elem->>'id') in (
        select pg_catalog.jsonb_array_elements_text(p_payload->'selectedHallAddonIds')
      );
  end if;

  -- Service & staffing charges
  if v_service_mode = 'drop_off' then
    v_service_charges := coalesce((v_cfg.service_rates_json->>'transportPaise')::integer, 0);
  elsif v_service_mode = 'full_service' then
    if v_waiters = 0 then
      v_waiters := greatest(2, ceil(greatest(1, v_total_plates)::numeric / 35.0)::integer);
    end if;
    v_service_charges :=
      coalesce((v_cfg.service_rates_json->>'transportPaise')::integer, 0) +
      coalesce((v_cfg.service_rates_json->>'setupTeardownPaise')::integer, 0) +
      coalesce((v_cfg.service_rates_json->>'equipmentRentalPaise')::integer, 0) +
      (v_waiters * coalesce((v_cfg.service_rates_json->>'waiterPerStaffPaise')::integer, 0)) +
      (case when v_onsite_chef then coalesce((v_cfg.service_rates_json->>'chefOnsitePaise')::integer, 0) else 0 end);
  end if;

  v_subtotal :=
    (v_veg_plates * v_veg_rate) +
    (v_nonveg_plates * v_nonveg_rate) +
    v_bulk_total +
    v_hall_addons_total +
    v_service_charges;

  v_gst := round((v_subtotal::numeric * v_gst_pct) / 100.0)::integer;
  v_total := v_subtotal + v_gst;
  v_stage1 := round(v_total::numeric * 0.30)::integer;
  v_stage2 := round(v_total::numeric * 0.50)::integer;
  v_stage3 := greatest(0, v_total - v_stage1 - v_stage2);

  select count(*) + 101 into v_seq
    from public.catering_orders
   where business_id = v_biz.id;
  v_order_code := 'CAT-' || v_seq::text;

  insert into public.catering_orders (
    business_id,
    order_code,
    intake_channel,
    customer_name,
    customer_phone,
    occasion_type,
    event_date,
    delivery_time,
    service_mode,
    service_zone,
    venue_address,
    uses_banquet_hall,
    hall_slot,
    package_id,
    package_name_snapshot,
    veg_plates,
    veg_rate_paise,
    non_veg_plates,
    non_veg_rate_paise,
    extra_plates_added,
    selected_package_dishes,
    bulk_alacarte_items,
    selected_hall_addons,
    service_staff_charges_paise,
    subtotal_paise,
    gst_paise,
    total_amount_paise,
    stage_1_advance_paise,
    stage_2_preevent_paise,
    stage_3_balance_paise,
    amount_paid_paise,
    balance_due_paise,
    chef_notes
  ) values (
    v_biz.id,
    v_order_code,
    v_channel,
    v_name,
    v_phone,
    v_occasion,
    v_event_date,
    v_delivery_time,
    v_service_mode,
    v_zone,
    v_address,
    v_uses_hall,
    v_hall_slot,
    v_pkg_id,
    v_pkg_name,
    v_veg_plates,
    v_veg_rate,
    v_nonveg_plates,
    v_nonveg_rate,
    0,
    v_selected_dishes,
    v_bulk_items,
    v_hall_addons,
    v_service_charges,
    v_subtotal,
    v_gst,
    v_total,
    v_stage1,
    v_stage2,
    v_stage3,
    0,
    v_total,
    v_chef_notes
  )
  returning * into v_saved;

  return public.serialize_catering_order_json(v_saved);
end;
$$;

revoke all on function public.submit_catering_order(jsonb) from public;
grant execute on function public.submit_catering_order(jsonb) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 3: public.record_catering_stage_payment(...)
-- ============================================================================
create or replace function public.record_catering_stage_payment(
  p_business_id uuid,
  p_order_id uuid,
  p_stage text,
  p_amount_paise integer,
  p_method text default 'upi',
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ord public.catering_orders%rowtype;
  v_next_paid integer;
  v_next_due integer;
  v_next_status text;
  v_entry jsonb;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the business owner can record catering stage payments.'
      using errcode = '42501';
  end if;
  if coalesce(p_amount_paise, 0) <= 0 then
    raise exception 'Payment amount must be greater than zero.' using errcode = '22023';
  end if;

  select * into v_ord
    from public.catering_orders o
   where o.id = p_order_id and o.business_id = p_business_id
     for update;

  if not found then
    raise exception 'Catering order not found.' using errcode = 'P0002';
  end if;

  v_next_paid := least(v_ord.total_amount_paise, v_ord.amount_paid_paise + p_amount_paise);
  v_next_due := greatest(0, v_ord.total_amount_paise - v_next_paid);
  v_next_status := case
    when v_ord.order_status = 'quote_pending' then 'advance_confirmed'
    else v_ord.order_status
  end;

  v_entry := pg_catalog.jsonb_build_object(
    'stage', coalesce(p_stage, 'stage_1'),
    'amountPaise', p_amount_paise,
    'method', coalesce(p_method, 'upi'),
    'paidAt', pg_catalog.now(),
    'note', nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
  );

  update public.catering_orders
     set amount_paid_paise = v_next_paid,
         balance_due_paise = v_next_due,
         order_status = v_next_status,
         payment_ledger = v_ord.payment_ledger || pg_catalog.jsonb_build_array(v_entry),
         updated_at = pg_catalog.now()
   where id = p_order_id
  returning * into v_ord;

  return public.serialize_catering_order_json(v_ord);
end;
$$;

revoke all on function public.record_catering_stage_payment(uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function public.record_catering_stage_payment(uuid, uuid, text, integer, text, text) to authenticated, service_role;

-- ============================================================================
-- RPC 4: public.add_catering_extra_plates(...)
-- ============================================================================
create or replace function public.add_catering_extra_plates(
  p_business_id uuid,
  p_order_id uuid,
  p_extra_plates integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ord public.catering_orders%rowtype;
  v_base_plates integer;
  v_blended_rate integer;
  v_added_food integer;
  v_gst_ratio numeric;
  v_new_subtotal integer;
  v_new_gst integer;
  v_new_total integer;
  v_new_due integer;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the business owner can adjust extra plates.'
      using errcode = '42501';
  end if;
  if coalesce(p_extra_plates, 0) <= 0 then
    raise exception 'Extra plates must be at least 1.' using errcode = '22023';
  end if;

  select * into v_ord
    from public.catering_orders o
   where o.id = p_order_id and o.business_id = p_business_id
     for update;

  if not found then
    raise exception 'Catering order not found.' using errcode = 'P0002';
  end if;

  v_base_plates := v_ord.veg_plates + v_ord.non_veg_plates;
  if v_base_plates > 0 then
    v_blended_rate := round(
      ((v_ord.veg_plates * v_ord.veg_rate_paise) + (v_ord.non_veg_plates * v_ord.non_veg_rate_paise))::numeric
      / v_base_plates::numeric
    )::integer;
  else
    v_blended_rate := greatest(v_ord.veg_rate_paise, v_ord.non_veg_rate_paise);
  end if;

  v_added_food := p_extra_plates * v_blended_rate;
  v_gst_ratio := case when v_ord.subtotal_paise > 0 then (v_ord.gst_paise::numeric / v_ord.subtotal_paise::numeric) else 0.05 end;
  v_new_subtotal := v_ord.subtotal_paise + v_added_food;
  v_new_gst := round(v_new_subtotal::numeric * v_gst_ratio)::integer;
  v_new_total := v_new_subtotal + v_new_gst;
  v_new_due := greatest(0, v_new_total - v_ord.amount_paid_paise);

  update public.catering_orders
     set extra_plates_added = v_ord.extra_plates_added + p_extra_plates,
         subtotal_paise = v_new_subtotal,
         gst_paise = v_new_gst,
         total_amount_paise = v_new_total,
         stage_3_balance_paise = greatest(0, v_new_total - v_ord.stage_1_advance_paise - v_ord.stage_2_preevent_paise),
         balance_due_paise = v_new_due,
         updated_at = pg_catalog.now()
   where id = p_order_id
  returning * into v_ord;

  return public.serialize_catering_order_json(v_ord);
end;
$$;

revoke all on function public.add_catering_extra_plates(uuid, uuid, integer) from public, anon;
grant execute on function public.add_catering_extra_plates(uuid, uuid, integer) to authenticated, service_role;

-- ============================================================================
-- RPC 5: public.update_catering_kitchen_and_vessels(...)
-- Verified by is_business_owner OR valid chef_station_pin!
-- ============================================================================
create or replace function public.update_catering_kitchen_and_vessels(
  p_business_id uuid,
  p_order_id uuid,
  p_chef_pin text default null,
  p_order_status text default null,
  p_kitchen_checklist jsonb default null,
  p_vessels_dispatched jsonb default null,
  p_chef_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.catering_configs%rowtype;
  v_ord public.catering_orders%rowtype;
  v_is_owner boolean := public.is_business_owner(p_business_id);
  v_next_vessels jsonb;
  v_all_returned boolean := true;
begin
  v_cfg := public.ensure_catering_config(p_business_id);
  if not v_is_owner and coalesce(pg_catalog.btrim(p_chef_pin), '') <> v_cfg.chef_station_pin then
    raise exception 'Invalid Head Chef PIN or unauthorized access.' using errcode = '42501';
  end if;

  select * into v_ord
    from public.catering_orders o
   where o.id = p_order_id and o.business_id = p_business_id
     for update;

  if not found then
    raise exception 'Catering order not found.' using errcode = 'P0002';
  end if;

  v_next_vessels := coalesce(p_vessels_dispatched, v_ord.vessels_dispatched);
  if pg_catalog.jsonb_typeof(v_next_vessels) = 'array' and pg_catalog.jsonb_array_length(v_next_vessels) > 0 then
    select bool_and(
      coalesce((elem->>'qtyReturned')::integer, 0) >= coalesce((elem->>'qtySent')::integer, 0)
    )
    into v_all_returned
    from pg_catalog.jsonb_array_elements(v_next_vessels) as elem;
  end if;

  update public.catering_orders
     set order_status = coalesce(nullif(pg_catalog.btrim(p_order_status), ''), v_ord.order_status),
         kitchen_checklist = coalesce(p_kitchen_checklist, v_ord.kitchen_checklist),
         vessels_dispatched = v_next_vessels,
         vessels_all_returned = coalesce(v_all_returned, true),
         chef_notes = coalesce(p_chef_notes, v_ord.chef_notes),
         updated_at = pg_catalog.now()
   where id = p_order_id
  returning * into v_ord;

  if v_is_owner then
    return public.serialize_catering_order_json(v_ord);
  end if;

  -- Sanitized response for Chef PIN callers (zero prices / customer phone)
  return pg_catalog.jsonb_build_object(
    'id', v_ord.id,
    'orderCode', v_ord.order_code,
    'orderStatus', v_ord.order_status,
    'kitchenChecklist', v_ord.kitchen_checklist,
    'vesselsDispatched', v_ord.vessels_dispatched,
    'vesselsAllReturned', v_ord.vessels_all_returned,
    'chefNotes', v_ord.chef_notes
  );
end;
$$;

revoke all on function public.update_catering_kitchen_and_vessels(uuid, uuid, text, text, jsonb, jsonb, text) from public;
grant execute on function public.update_catering_kitchen_and_vessels(uuid, uuid, text, text, jsonb, jsonb, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 6: public.get_catering_chef_kitchen_portal(...)
-- STRICTLY SANITIZED: Zero customer phone, zero ₹ rates/totals, zero margins!
-- ============================================================================
create or replace function public.get_catering_chef_kitchen_portal(
  p_business_id uuid,
  p_chef_pin text,
  p_date_from date default current_date,
  p_date_to date default (current_date + 14)
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_biz record;
  v_cfg public.catering_configs%rowtype;
  v_events jsonb := '[]'::jsonb;
  v_grocery jsonb := '[]'::jsonb;
begin
  select b.id, b.name into v_biz from public.businesses b where b.id = p_business_id limit 1;
  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  v_cfg := public.ensure_catering_config(p_business_id);
  if coalesce(pg_catalog.btrim(p_chef_pin), '') <> v_cfg.chef_station_pin then
    raise exception 'Invalid Head Chef PIN.' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(ev_obj order by event_date asc, created_at asc), '[]'::jsonb)
    into v_events
    from (
      select
        o.event_date,
        o.created_at,
        pg_catalog.jsonb_build_object(
          'id', o.id,
          'orderCode', o.order_code,
          'occasionType', o.occasion_type,
          'eventDate', pg_catalog.to_char(o.event_date, 'YYYY-MM-DD'),
          'deliveryTime', o.delivery_time,
          'serviceMode', o.service_mode,
          'usesBanquetHall', o.uses_banquet_hall,
          'hallSlot', o.hall_slot,
          'packageNameSnapshot', o.package_name_snapshot,
          'vegPlates', o.veg_plates,
          'nonVegPlates', o.non_veg_plates,
          'extraPlatesAdded', o.extra_plates_added,
          'totalPlates', (o.veg_plates + o.non_veg_plates + o.extra_plates_added),
          'selectedPackageDishes', o.selected_package_dishes,
          'bulkAlacarteItems', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'dishId', bi->>'dishId',
                'dishName', bi->>'dishName',
                'dietType', bi->>'dietType',
                'unit', bi->>'unit',
                'quantity', coalesce((bi->>'quantity')::numeric, 0)
              )
            )
            from pg_catalog.jsonb_array_elements(o.bulk_alacarte_items) as bi
          ), '[]'::jsonb),
          'orderStatus', o.order_status,
          'kitchenChecklist', o.kitchen_checklist,
          'vesselsDispatched', o.vessels_dispatched,
          'vesselsAllReturned', o.vessels_all_returned,
          'chefNotes', o.chef_notes
        ) as ev_obj
      from public.catering_orders o
      where o.business_id = p_business_id
        and o.order_status <> 'cancelled'
        and o.event_date between p_date_from and p_date_to
    ) sub_ev;

  -- Aggregated Recipe-to-Grocery Shopping List across date window
  select coalesce(pg_catalog.jsonb_agg(g_obj order by ing_name asc), '[]'::jsonb)
    into v_grocery
    from (
      select
        agg.ing_name,
        pg_catalog.jsonb_build_object(
          'ingredientName', agg.ing_name,
          'unit', agg.ing_unit,
          'baseQty', round(agg.base_qty::numeric, 2),
          'wastagePercent', v_cfg.default_wastage_percent,
          'totalQtyWithWastage', round((agg.base_qty * (1.0 + (v_cfg.default_wastage_percent / 100.0)))::numeric, 2),
          'sourceDishes', agg.source_dishes
        ) as g_obj
      from (
        select
          max(ing->>'ingredientName') as ing_name,
          pg_catalog.lower(coalesce(ing->>'unit', 'kg')) as ing_unit,
          sum(
            ((o.veg_plates + o.non_veg_plates + o.extra_plates_added)::numeric / 100.0)
            * coalesce((ing->>'qtyPer100')::numeric, 0)
          ) as base_qty,
          pg_catalog.jsonb_agg(distinct d.dish_name) as source_dishes
        from public.catering_orders o
        cross join lateral pg_catalog.jsonb_array_elements(o.selected_package_dishes) as sel
        join public.catering_dishes_and_recipes d
          on d.id::text = (sel->>'dishId') and d.business_id = p_business_id
        cross join lateral pg_catalog.jsonb_array_elements(d.ingredients_per_100_plates) as ing
        where o.business_id = p_business_id
          and o.order_status <> 'cancelled'
          and o.event_date between p_date_from and p_date_to
        group by pg_catalog.lower(ing->>'ingredientName'), pg_catalog.lower(coalesce(ing->>'unit', 'kg'))
      ) agg
      where agg.base_qty > 0
    ) sub_g;

  return pg_catalog.jsonb_build_object(
    'businessName', v_biz.name,
    'hallName', v_cfg.hall_name,
    'defaultWastagePercent', v_cfg.default_wastage_percent,
    'dateFrom', pg_catalog.to_char(p_date_from, 'YYYY-MM-DD'),
    'dateTo', pg_catalog.to_char(p_date_to, 'YYYY-MM-DD'),
    'events', v_events,
    'groceryList', v_grocery
  );
end;
$$;

revoke all on function public.get_catering_chef_kitchen_portal(uuid, text, date, date) from public;
grant execute on function public.get_catering_chef_kitchen_portal(uuid, text, date, date) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 7: public.get_catering_owner_dashboard(p_business_id uuid)
-- ============================================================================
create or replace function public.get_catering_owner_dashboard(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.catering_configs%rowtype;
  v_upcoming_cnt integer := 0;
  v_confirmed_rev bigint := 0;
  v_pending_bal bigint := 0;
  v_vessel_alerts integer := 0;
  v_orders jsonb := '[]'::jsonb;
  v_packages jsonb := '[]'::jsonb;
  v_dishes jsonb := '[]'::jsonb;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the business owner can view the CateringOS dashboard.'
      using errcode = '42501';
  end if;

  v_cfg := public.ensure_catering_config(p_business_id);

  select
    count(*) filter (where o.order_status <> 'cancelled' and o.event_date >= current_date)::integer,
    coalesce(sum(o.total_amount_paise) filter (where o.order_status not in ('quote_pending', 'cancelled')), 0)::bigint,
    coalesce(sum(o.balance_due_paise) filter (where o.order_status <> 'cancelled'), 0)::bigint,
    count(*) filter (where o.order_status <> 'cancelled' and o.vessels_all_returned = false)::integer
  into v_upcoming_cnt, v_confirmed_rev, v_pending_bal, v_vessel_alerts
  from public.catering_orders o
  where o.business_id = p_business_id;

  select coalesce(pg_catalog.jsonb_agg(public.serialize_catering_order_json(o) order by o.event_date asc, o.created_at desc), '[]'::jsonb)
    into v_orders
    from public.catering_orders o
   where o.business_id = p_business_id;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', p.id,
      'businessId', p.business_id,
      'packageName', p.package_name,
      'tierBadge', p.tier_badge,
      'mealSession', p.meal_session,
      'vegPricePaise', p.veg_price_paise,
      'nonVegPricePaise', p.non_veg_price_paise,
      'slotRules', p.slot_rules,
      'description', p.description,
      'isActive', p.is_active,
      'createdAt', p.created_at
    ) order by p.created_at asc
  ), '[]'::jsonb)
  into v_packages
  from public.catering_packages p
  where p.business_id = p_business_id;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', d.id,
      'businessId', d.business_id,
      'dishName', d.dish_name,
      'category', d.category,
      'dietType', d.diet_type,
      'availableInPackages', d.available_in_packages,
      'availableBulkAlacarte', d.available_bulk_alacarte,
      'bulkUnit', d.bulk_unit,
      'bulkUnitPricePaise', d.bulk_unit_price_paise,
      'ingredientsPer100Plates', d.ingredients_per_100_plates,
      'isActive', d.is_active,
      'createdAt', d.created_at
    ) order by d.created_at asc
  ), '[]'::jsonb)
  into v_dishes
  from public.catering_dishes_and_recipes d
  where d.business_id = p_business_id;

  return pg_catalog.jsonb_build_object(
    'config', pg_catalog.jsonb_build_object(
      'businessId', v_cfg.business_id,
      'minHeadcount', v_cfg.min_headcount,
      'maxCapacityPerEvent', v_cfg.max_capacity_per_event,
      'minAdvanceHours', v_cfg.min_advance_hours,
      'cutoffHoursBeforeEvent', v_cfg.cutoff_hours_before_event,
      'serviceZones', v_cfg.service_zones,
      'blackoutDates', v_cfg.blackout_dates,
      'banquetHallEnabled', v_cfg.banquet_hall_enabled,
      'hallName', v_cfg.hall_name,
      'hallSlots', v_cfg.hall_slots,
      'hallAddonsCatalog', v_cfg.hall_addons_catalog,
      'serviceRatesJson', v_cfg.service_rates_json,
      'chefStationPin', v_cfg.chef_station_pin,
      'defaultWastagePercent', v_cfg.default_wastage_percent,
      'brandLogoUrl', v_cfg.brand_logo_url,
      'primaryAccentHex', v_cfg.primary_accent_hex,
      'secondarySurfaceHex', v_cfg.secondary_surface_hex,
      'whatsappQuoteTemplate', v_cfg.whatsapp_quote_template,
      'updatedAt', v_cfg.updated_at
    ),
    'kpis', pg_catalog.jsonb_build_object(
      'upcomingEventsCount', v_upcoming_cnt,
      'confirmedRevenuePaise', v_confirmed_rev,
      'pendingStageBalancesPaise', v_pending_bal,
      'unreturnedVesselAlertsCount', v_vessel_alerts
    ),
    'orders', v_orders,
    'packages', v_packages,
    'dishes', v_dishes,
    'groceryList', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_catering_owner_dashboard(uuid) from public, anon;
grant execute on function public.get_catering_owner_dashboard(uuid) to authenticated, service_role;

commit;
