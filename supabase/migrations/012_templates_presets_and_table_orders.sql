-- ============================================================================
-- ReviewAssist / BistroOS — Master Upgrade:
--   5 Cultural Menu Templates, 1-Tap Preset Menus & Optional Table Ordering
-- File: supabase/migrations/012_templates_presets_and_table_orders.sql
--
-- Purpose:
-- 1. Extends public.restaurant_profiles with:
--      - table_ordering_enabled (boolean NOT NULL DEFAULT false)
--      - menu_theme_template (text NOT NULL DEFAULT 'default' CHECK IN (...))
--      - custom_logo_url (text nullable)
--      - custom_accent_color (text nullable)
-- 2. Creates normalized table public.restaurant_table_orders with
--    ENABLE + FORCE ROW LEVEL SECURITY and REVOKE ALL FROM public, anon.
-- 3. Provides hardened SECURITY DEFINER RPCs:
--      - public.submit_customer_table_order(...)
--      - public.update_table_order_status(...)
--      - public.apply_restaurant_menu_preset(...)
-- 4. Upgrades public.get_public_restaurant_menu and
--    public.get_restaurant_floor_and_analytics to expose template & order data.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.restaurant_profiles
-- ============================================================================
alter table public.restaurant_profiles
  add column if not exists table_ordering_enabled boolean not null default false,
  add column if not exists menu_theme_template text not null default 'default',
  add column if not exists custom_logo_url text,
  add column if not exists custom_accent_color text;

alter table public.restaurant_profiles
  drop constraint if exists restaurant_profiles_menu_theme_chk,
  drop constraint if exists restaurant_profiles_custom_accent_chk,
  drop constraint if exists restaurant_profiles_custom_logo_chk;

alter table public.restaurant_profiles
  add constraint restaurant_profiles_menu_theme_chk check (
    menu_theme_template in ('default', 'masala', 'prakriti', 'bistro', 'samudra', 'sizzler')
  ),
  add constraint restaurant_profiles_custom_accent_chk check (
    custom_accent_color is null or custom_accent_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  add constraint restaurant_profiles_custom_logo_chk check (
    custom_logo_url is null or (
      pg_catalog.char_length(pg_catalog.btrim(custom_logo_url)) <= 2048
      and custom_logo_url ~* '^https?://.+'
    )
  );

-- ============================================================================
-- 2. TABLE: public.restaurant_table_orders
-- ============================================================================
create table if not exists public.restaurant_table_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_id uuid
    references public.restaurant_tables(id) on delete set null,
  customer_id uuid
    references public.restaurant_customers(id) on delete set null,
  guest_name text,
  items jsonb not null,
  status text not null default 'pending_approval',
  approved_by text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint rto_status_chk check (
    status in ('pending_approval', 'approved_for_kitchen', 'preparing', 'served', 'cancelled')
  ),
  constraint rto_items_is_array_chk check (
    pg_catalog.jsonb_typeof(items) = 'array'
    and pg_catalog.jsonb_array_length(items) between 1 and 40
  ),
  constraint rto_guest_name_len_chk check (
    guest_name is null or pg_catalog.char_length(pg_catalog.btrim(guest_name)) <= 80
  ),
  constraint rto_approved_by_len_chk check (
    approved_by is null or pg_catalog.char_length(pg_catalog.btrim(approved_by)) <= 80
  )
);

create index if not exists idx_restaurant_table_orders_biz_status_time
  on public.restaurant_table_orders (business_id, status, created_at desc);

create index if not exists idx_restaurant_table_orders_table_time
  on public.restaurant_table_orders (table_id, created_at desc);

-- ============================================================================
-- 3. GRANTS & ROW LEVEL SECURITY FOR public.restaurant_table_orders
-- ============================================================================
alter table public.restaurant_table_orders enable row level security;
alter table public.restaurant_table_orders force row level security;

revoke all on table public.restaurant_table_orders from public, anon, authenticated;

grant select, update, delete on table public.restaurant_table_orders to authenticated;
grant all on table public.restaurant_table_orders to service_role;

drop policy if exists rto_owner_select on public.restaurant_table_orders;
create policy rto_owner_select on public.restaurant_table_orders
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rto_owner_update on public.restaurant_table_orders;
create policy rto_owner_update on public.restaurant_table_orders
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rto_owner_delete on public.restaurant_table_orders;
create policy rto_owner_delete on public.restaurant_table_orders
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 4. RPC 1: public.submit_customer_table_order
--    Verifies table_ordering_enabled = true, validates every item exists and
--    is available, resolves canonical dish names & prices from the DB, and
--    inserts a 'pending_approval' order (zero payment / zero tax).
-- ============================================================================
create or replace function public.submit_customer_table_order(
  p_slug text,
  p_table_key text default null,
  p_customer_id uuid default null,
  p_guest_name text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_table_key text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, ''))), '');
  v_clean_guest text := nullif(pg_catalog.btrim(coalesce(p_guest_name, '')), '');
  v_biz record;
  v_profile record;
  v_table record;
  v_table_id uuid := null;
  v_table_number text := null;
  v_table_key_resolved text := null;
  v_elem jsonb;
  v_item_id uuid;
  v_qty integer;
  v_notes text;
  v_menu_item record;
  v_validated_items jsonb := '[]'::jsonb;
  v_inserted public.restaurant_table_orders%rowtype;
begin
  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 40
  then
    raise exception 'Please select between 1 and 40 menu items to submit a table order.' using errcode = '22023';
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  select rp.is_enabled, rp.table_ordering_enabled into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  if not found or v_profile.is_enabled = false then
    raise exception 'Digital menu is not enabled for this restaurant.' using errcode = '42501';
  end if;

  if v_profile.table_ordering_enabled = false then
    raise exception 'Customer phone ordering is currently turned off. Please place your order with your server.' using errcode = '42501';
  end if;

  if v_clean_table_key is not null then
    select rt.id, rt.table_number, rt.table_key into v_table
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
       and rt.is_active = true
     limit 1;

    if found then
      v_table_id := v_table.id;
      v_table_number := v_table.table_number;
      v_table_key_resolved := v_table.table_key;
    end if;
  end if;

  for v_elem in select * from pg_catalog.jsonb_array_elements(p_items) loop
    begin
      v_item_id := (v_elem ->> 'itemId')::uuid;
    exception when others then
      raise exception 'Invalid menu item ID in table order.' using errcode = '22023';
    end;

    v_qty := coalesce((v_elem ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 25 then
      raise exception 'Item quantity must be between 1 and 25.' using errcode = '22023';
    end if;

    v_notes := nullif(pg_catalog.btrim(coalesce(v_elem ->> 'notes', '')), '');
    if v_notes is not null then
      v_notes := pg_catalog.substr(v_notes, 1, 160);
    end if;

    select i.id, i.name, i.price_paise into v_menu_item
      from public.restaurant_menu_items i
      join public.restaurant_menu_categories c
        on c.id = i.category_id
       and c.business_id = i.business_id
     where i.id = v_item_id
       and i.business_id = v_biz.id
       and i.is_available = true
       and c.is_active = true
     limit 1;

    if not found then
      raise exception 'One or more selected menu items are currently unavailable.' using errcode = 'P0002';
    end if;

    v_validated_items := v_validated_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'itemId', v_menu_item.id,
        'name', v_menu_item.name,
        'quantity', v_qty,
        'pricePaise', v_menu_item.price_paise,
        'notes', v_notes
      )
    );
  end loop;

  insert into public.restaurant_table_orders (
    business_id,
    table_id,
    customer_id,
    guest_name,
    items,
    status
  )
  values (
    v_biz.id,
    v_table_id,
    p_customer_id,
    case when v_clean_guest is not null then pg_catalog.substr(v_clean_guest, 1, 80) else null end,
    v_validated_items,
    'pending_approval'
  )
  returning * into v_inserted;

  return pg_catalog.jsonb_build_object(
    'id', v_inserted.id,
    'businessId', v_inserted.business_id,
    'tableId', v_inserted.table_id,
    'tableNumber', v_table_number,
    'tableKey', v_table_key_resolved,
    'customerId', v_inserted.customer_id,
    'guestName', v_inserted.guest_name,
    'items', v_inserted.items,
    'status', v_inserted.status,
    'approvedBy', v_inserted.approved_by,
    'createdAt', v_inserted.created_at,
    'updatedAt', v_inserted.updated_at
  );
end;
$$;

revoke all on function public.submit_customer_table_order(text, text, uuid, text, jsonb) from public;
grant execute on function public.submit_customer_table_order(text, text, uuid, text, jsonb) to anon, authenticated, service_role;

-- ============================================================================
-- 5. RPC 2: public.update_table_order_status
--    Allows Owner or Staff (via Staff PIN) to move orders through:
--    pending_approval -> approved_for_kitchen -> preparing -> served / cancelled
-- ============================================================================
create or replace function public.update_table_order_status(
  p_slug text,
  p_order_id uuid,
  p_new_status text,
  p_staff_label text default 'Staff',
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_new_status, '')));
  v_clean_staff text := nullif(pg_catalog.btrim(coalesce(p_staff_label, 'Staff')), '');
  v_biz record;
  v_updated public.restaurant_table_orders%rowtype;
  v_table record;
begin
  if v_clean_status not in ('pending_approval', 'approved_for_kitchen', 'preparing', 'served', 'cancelled') then
    raise exception 'Invalid table order status.' using errcode = '22023';
  end if;

  if v_clean_staff is null then
    v_clean_staff := 'Staff';
  else
    v_clean_staff := pg_catalog.substr(v_clean_staff, 1, 80);
  end if;

  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Restaurant not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required.' using errcode = '42501';
  end if;

  update public.restaurant_table_orders
     set status = v_clean_status,
         approved_by = case
           when v_clean_status in ('approved_for_kitchen', 'preparing', 'served')
             then coalesce(approved_by, v_clean_staff)
           else approved_by
         end,
         updated_at = pg_catalog.clock_timestamp()
   where id = p_order_id
     and business_id = v_biz.id
   returning * into v_updated;

  if not found then
    raise exception 'Table order not found for this restaurant.' using errcode = 'P0002';
  end if;

  if v_updated.table_id is not null then
    select rt.table_number, rt.table_key into v_table
      from public.restaurant_tables rt
     where rt.id = v_updated.table_id
     limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'businessId', v_updated.business_id,
    'tableId', v_updated.table_id,
    'tableNumber', v_table.table_number,
    'tableKey', v_table.table_key,
    'customerId', v_updated.customer_id,
    'guestName', v_updated.guest_name,
    'items', v_updated.items,
    'status', v_updated.status,
    'approvedBy', v_updated.approved_by,
    'createdAt', v_updated.created_at,
    'updatedAt', v_updated.updated_at
  );
end;
$$;

revoke all on function public.update_table_order_status(text, uuid, text, text, text) from public;
grant execute on function public.update_table_order_status(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 6. RPC 3: public.apply_restaurant_menu_preset
--    One-tap menu injector supporting 5 complete preset packs:
--    masala_indian, prakriti_organic, bistro_modern, samudra_coastal, sizzler_diner
-- ============================================================================
create or replace function public.apply_restaurant_menu_preset(
  p_business_id uuid,
  p_preset_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_preset text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_preset_key, '')));
  v_theme text;
  v_tagline text;
  v_cat1_id uuid;
  v_cat2_id uuid;
  v_cat3_id uuid;
  v_existing_cat_count integer := 0;
  v_existing_reward_count integer := 0;
  v_items_inserted integer := 0;
  v_rewards_inserted integer := 0;
begin
  if v_clean_preset not in (
    'masala_indian',
    'prakriti_organic',
    'bistro_modern',
    'samudra_coastal',
    'sizzler_diner'
  ) then
    raise exception 'Invalid menu preset key.' using errcode = '22023';
  end if;

  if p_business_id is null or not exists (
    select 1 from public.businesses b where b.id = p_business_id
  ) then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  if auth.uid() is not null and not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: only the business owner can apply a menu preset.' using errcode = '42501';
  end if;

  select count(*)::integer into v_existing_cat_count
    from public.restaurant_menu_categories c
   where c.business_id = p_business_id;

  select count(*)::integer into v_existing_reward_count
    from public.restaurant_rewards r
   where r.business_id = p_business_id;

  if v_clean_preset = 'masala_indian' then
    v_theme := 'masala';
    v_tagline := 'Royal Tandoor, Slow-Cooked Dum Curries & Heritage Spices';

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Tandoori Starters', 'Charcoal-grilled kebabs & house spiced appetizers', v_existing_cat_count, true)
    returning id into v_cat1_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Royal Curries & Biryani', 'Slow-simmered handi gravies & saffron dum biryani', v_existing_cat_count + 1, true)
    returning id into v_cat2_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Traditional Drinks & Sweets', 'Cooling heritage drinks & warm mithai', v_existing_cat_count + 2, true)
    returning id into v_cat3_id;

    insert into public.restaurant_menu_items (business_id, category_id, name, description, price_paise, dietary_tag, is_available, is_featured, display_order)
    values
      (p_business_id, v_cat1_id, 'Paneer Tikka Angara', 'Smoky cottage cheese marinated in Kashmiri chilli yogurt, roasted in clay tandoor with bell peppers', 29500, 'veg', true, true, 0),
      (p_business_id, v_cat1_id, 'Crispy Paneer 65', 'Golden spiced cottage cheese tossed with crackling curry leaves and green chillies', 26500, 'veg', true, false, 1),
      (p_business_id, v_cat1_id, 'Murgh Malai Kebab', 'Velvety cardamom and cashew-cream marinated chicken morsels grilled to perfection', 34500, 'non_veg', true, true, 2),
      (p_business_id, v_cat2_id, 'Hyderabadi Dum Biryani', 'Long-grain aged basmati steamed under dough seal with saffron, caramelized onions & raita', 38500, 'non_veg', true, true, 0),
      (p_business_id, v_cat2_id, 'Dal Makhani Royal', 'Black lentils slow-simmered 18 hours over glowing charcoal with cultured white butter', 27500, 'veg', true, true, 1),
      (p_business_id, v_cat2_id, 'Butter Chicken Masala', 'Tandoor-charred chicken simmered in rich heirloom tomato & fenugreek makhani gravy', 36500, 'non_veg', true, false, 2),
      (p_business_id, v_cat2_id, 'Garlic Butter Naan', 'Hand-stretched tandoor flatbread brushed with roasted garlic and golden ghee', 9500, 'veg', true, false, 3),
      (p_business_id, v_cat3_id, 'Mango Kesar Lassi', 'Chilled hand-churned Alphonso mango yogurt topped with Kashmiri saffron strands', 14500, 'veg', true, false, 0),
      (p_business_id, v_cat3_id, 'Smoked Masala Chaas', 'Spiced buttermilk infused with roasted cumin, fresh coriander and ginger', 9500, 'veg', true, false, 1),
      (p_business_id, v_cat3_id, 'Warm Gulab Jamun', 'Melt-in-mouth khoya dumplings steeped in rose-cardamom syrup with pistachio dust', 16500, 'veg', true, true, 2);
    v_items_inserted := 10;

    if v_existing_reward_count = 0 then
      insert into public.restaurant_rewards (business_id, title, description, stars_required, is_active, display_order)
      values
        (p_business_id, 'Complimentary Royal Masala Chai', 'Freshly brewed Assam tea with crushed ginger & cardamom', 2, true, 0),
        (p_business_id, 'Warm Gulab Jamun Platter', 'House signature saffron & rose-water dessert on the house', 4, true, 1);
      v_rewards_inserted := 2;
    end if;

  elsif v_clean_preset = 'prakriti_organic' then
    v_theme := 'prakriti';
    v_tagline := 'Farm-to-Table Bowls, Ancient Grains & Botanical Elixirs';

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Farm-Fresh Bowls', 'Locally harvested greens, sprouts & warm broths', v_existing_cat_count, true)
    returning id into v_cat1_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Wholesome Plates', 'Nourishing ancient grains, millets & wood-fired flatbreads', v_existing_cat_count + 1, true)
    returning id into v_cat2_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Botanical Elixirs', 'Cold-pressed juices & slow-steeped herbal infusions', v_existing_cat_count + 2, true)
    returning id into v_cat3_id;

    insert into public.restaurant_menu_items (business_id, category_id, name, description, price_paise, dietary_tag, is_available, is_featured, display_order)
    values
      (p_business_id, v_cat1_id, 'Avocado Sprout Tartine', 'Multigrain sourdough topped with smashed Hass avocado, micro-greens & toasted sesame', 32000, 'vegan', true, true, 0),
      (p_business_id, v_cat1_id, 'Roasted Pumpkin & Sage Velouté', 'Slow-roasted heirloom pumpkin blended with coconut milk and crispy pepitas', 24000, 'vegan', true, false, 1),
      (p_business_id, v_cat1_id, 'Charred Broccoli & Quinoa Salad', 'Tri-color organic quinoa, roasted almonds, pomegranate pearls & lemon-tahini dressing', 29000, 'vegan', true, true, 2),
      (p_business_id, v_cat2_id, 'Foxtail Millet Khichdi Bowl', 'Comforting organic millet and moong lentil bowl tempered with A2 ghee & seasonal veggies', 28000, 'veg', true, true, 0),
      (p_business_id, v_cat2_id, 'Wood-Roasted Mushroom Flatbread', 'Stone-milled whole wheat flatbread with wild shiitake, caramelized onions & thyme', 34000, 'veg', true, false, 1),
      (p_business_id, v_cat2_id, 'Herb-Crusted Tofu Steak', 'Pan-seared organic tofu with basil pesto, sweet potato mash & blistered cherry tomatoes', 33000, 'vegan', true, false, 2),
      (p_business_id, v_cat2_id, 'Crisp Ragi Dosa & Coconut Dip', 'Fermented finger-millet crepe served with freshly ground coconut-coriander chutney', 22000, 'vegan', true, false, 3),
      (p_business_id, v_cat3_id, 'Turmeric Ginger Sunrise Tonic', 'Fresh raw turmeric root, pressed ginger, black pepper & wild forest honey', 16000, 'veg', true, false, 0),
      (p_business_id, v_cat3_id, 'Hibiscus Mint Cooler', 'Sun-steeped ruby hibiscus petals shaken with garden mint and organic lime', 15000, 'vegan', true, true, 1),
      (p_business_id, v_cat3_id, 'Cold-Pressed Green Glow', 'Organic spinach, crisp cucumber, green apple, celery & cold-pressed lemon', 18500, 'vegan', true, false, 2);
    v_items_inserted := 10;

    if v_existing_reward_count = 0 then
      insert into public.restaurant_rewards (business_id, title, description, stars_required, is_active, display_order)
      values
        (p_business_id, 'Organic Botanical Elixir', 'Your choice of any cold-pressed tonic or herbal cooler', 2, true, 0),
        (p_business_id, 'Wholesome Farm Bowl', 'Complimentary seasonal salad or grain bowl on your visit', 5, true, 1);
      v_rewards_inserted := 2;
    end if;

  elsif v_clean_preset = 'bistro_modern' then
    v_theme := 'bistro';
    v_tagline := 'Artisan Small Plates, Craft Coffee & Modern Plates';

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Small Plates', 'Chef-curated starters designed for sharing', v_existing_cat_count, true)
    returning id into v_cat1_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Artisan Mains', 'Handcrafted pasta, risotto & seared signatures', v_existing_cat_count + 1, true)
    returning id into v_cat2_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Craft Coffee & Patisserie', 'Single-origin pours, zero-proof spritzes & tarts', v_existing_cat_count + 2, true)
    returning id into v_cat3_id;

    insert into public.restaurant_menu_items (business_id, category_id, name, description, price_paise, dietary_tag, is_available, is_featured, display_order)
    values
      (p_business_id, v_cat1_id, 'Truffle Mushroom Bruschetta', 'Charred country loaf, whipped mascarpone, sautéed porcini & white truffle oil', 34000, 'veg', true, true, 0),
      (p_business_id, v_cat1_id, 'Burrata & Heirloom Tomato', 'Creamy artisan burrata, aged Modena balsamic reduction, basil oil & toasted pine nuts', 42000, 'veg', true, true, 1),
      (p_business_id, v_cat1_id, 'Crispy Calamari & Saffron Aioli', 'Lightly dusted squid rings flashed crisp, served with charred lemon and saffron aioli', 39500, 'non_veg', true, false, 2),
      (p_business_id, v_cat2_id, 'Wild Mushroom Arborio Risotto', '24-month aged Parmigiano-Reggiano, forest mushrooms, crispy sage & brown butter', 46000, 'veg', true, true, 0),
      (p_business_id, v_cat2_id, 'Pan-Seared Herb Salmon', 'Crispy-skin Norwegian salmon over saffron cauliflower purée & charred asparagus', 69000, 'non_veg', true, true, 1),
      (p_business_id, v_cat2_id, 'Smoked Paprika Roast Chicken', 'Free-range half chicken, thyme pan jus, baby Hasselback potatoes & baby carrots', 49500, 'non_veg', true, false, 2),
      (p_business_id, v_cat2_id, 'Cacio e Pepe Tagliatelle', 'House-extruded ribbon pasta tossed with toasted Tellicherry peppercorn & Pecorino', 41000, 'veg', true, false, 3),
      (p_business_id, v_cat3_id, 'Single-Origin Espresso Tonic', 'Double ristretto layered over botanical tonic water & expressed orange peel', 21000, 'vegan', true, false, 0),
      (p_business_id, v_cat3_id, 'Yuzu Rosemary Spritz', 'Japanese yuzu citrus, smoked rosemary sprig & chilled sparkling mineral water', 22500, 'vegan', true, true, 1),
      (p_business_id, v_cat3_id, '70% Dark Chocolate Ganache Tart', 'Crisp cocoa sablé shell filled with silky Belgian ganache & Maldon sea salt', 28000, 'egg', true, false, 2);
    v_items_inserted := 10;

    if v_existing_reward_count = 0 then
      insert into public.restaurant_rewards (business_id, title, description, stars_required, is_active, display_order)
      values
        (p_business_id, 'Artisan Single-Origin Coffee', 'Complimentary Espresso Tonic, Flat White, or Pour Over', 2, true, 0),
        (p_business_id, 'Chef''s Dark Chocolate Tart', 'Signature patisserie dessert on the house', 4, true, 1);
      v_rewards_inserted := 2;
    end if;

  elsif v_clean_preset = 'samudra_coastal' then
    v_theme := 'samudra';
    v_tagline := 'Fresh Coastal Spices, Malabar Curries & Island Coolers';

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Harbor Bites', 'Crisp coastal tawa fries & shoreline appetizers', v_existing_cat_count, true)
    returning id into v_cat1_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Coastal Mains', 'Coconut-milk curries, ghee roasts & lacy appams', v_existing_cat_count + 1, true)
    returning id into v_cat2_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Island Coolers', 'Chilled tropical refreshers & shoreline sweets', v_existing_cat_count + 2, true)
    returning id into v_cat3_id;

    insert into public.restaurant_menu_items (business_id, category_id, name, description, price_paise, dietary_tag, is_available, is_featured, display_order)
    values
      (p_business_id, v_cat1_id, 'Konkan Rava Fried Prawns', 'Tiger prawns coated in spiced semolina crust, crisp-fried with curry leaves & lime', 44500, 'non_veg', true, true, 0),
      (p_business_id, v_cat1_id, 'Malabar Black Pepper Squid', 'Tender squid rings wok-tossed with Tellicherry black pepper, shallots & coconut slivers', 39500, 'non_veg', true, false, 1),
      (p_business_id, v_cat1_id, 'Banana Leaf Paneer Roast', 'Cottage cheese slow-roasted inside fragrant banana leaf with Byadgi chilli masala', 31500, 'veg', true, true, 2),
      (p_business_id, v_cat2_id, 'Goan Fish Curry & Red Rice', 'Kingfish simmered in tangy kokum and fresh coconut gravy with steamed Goan ukda rice', 46500, 'non_veg', true, true, 0),
      (p_business_id, v_cat2_id, 'Kerala Prawn Moilee', 'Delicate golden coconut milk stew infused with ginger, green chillies & curry leaves', 48500, 'non_veg', true, false, 1),
      (p_business_id, v_cat2_id, 'Mangalore Chicken Ghee Roast', 'Fiery Kundapur red-chilli spice paste slow-roasted in fragrant coastal ghee', 42500, 'non_veg', true, true, 2),
      (p_business_id, v_cat2_id, 'Lacy Appam & Vegetable Ishtu', 'Two soft fermented rice hoppers paired with creamy spiced coconut vegetable stew', 29500, 'vegan', true, false, 3),
      (p_business_id, v_cat3_id, 'Kokum Ginger Coastal Cooler', 'Sun-dried Goan kokum extract shaken with crushed ginger, roasted cumin & soda', 14500, 'vegan', true, true, 0),
      (p_business_id, v_cat3_id, 'Tender Coconut Lime Fizz', 'Fresh malai coconut water, muddled Gondhoraj lime & chilled sparkling water', 16500, 'vegan', true, false, 1),
      (p_business_id, v_cat3_id, 'Goan Serradura Parfait', 'Chilled layers of vanilla whipped cream, crushed Marie biscuit dust & sea-salt caramel', 19500, 'veg', true, false, 2);
    v_items_inserted := 10;

    if v_existing_reward_count = 0 then
      insert into public.restaurant_rewards (business_id, title, description, stars_required, is_active, display_order)
      values
        (p_business_id, 'Chilled Kokum Coastal Cooler', 'Refreshing Goan shoreline cooler served chilled', 2, true, 0),
        (p_business_id, 'Complimentary Harbor Bite', 'Any coastal starter from our Harbor Bites menu', 5, true, 1);
      v_rewards_inserted := 2;
    end if;

  else -- sizzler_diner
    v_theme := 'sizzler';
    v_tagline := 'Sizzling Grills, Double Smash Burgers & Classic Shakes';

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Loaded Starters', 'Crunchy baskets built for the whole booth', v_existing_cat_count, true)
    returning id into v_cat1_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Smash Burgers & Sizzlers', 'Cast-iron sizzlers, smashed patties & toasted brioche', v_existing_cat_count + 1, true)
    returning id into v_cat2_id;

    insert into public.restaurant_menu_categories (business_id, name, description, display_order, is_active)
    values (p_business_id, 'Classic Shakes & Sodas', 'Hand-spun thick shakes & retro fountain floats', v_existing_cat_count + 2, true)
    returning id into v_cat3_id;

    insert into public.restaurant_menu_items (business_id, category_id, name, description, price_paise, dietary_tag, is_available, is_featured, display_order)
    values
      (p_business_id, v_cat1_id, 'Cheesy Peri-Peri Loaded Fries', 'Double-fried skin-on fries drenched in aged cheddar sauce, jalapeños & peri-peri dust', 22500, 'veg', true, true, 0),
      (p_business_id, v_cat1_id, 'Crispy Beer-Battered Onion Rings', 'Thick-cut sweet onion rings fried golden crisp with smoky chipotle ranch dip', 19500, 'veg', true, false, 1),
      (p_business_id, v_cat1_id, 'Hot Honey Buffalo Wings', '6 crispy glazed chicken wings tossed in tangy hot-honey butter with blue-cheese dip', 32500, 'non_veg', true, true, 2),
      (p_business_id, v_cat2_id, 'Double Smash Cheeseburger', 'Two seared juicy patties, melted American cheddar, house pickles & diner sauce on brioche', 36500, 'non_veg', true, true, 0),
      (p_business_id, v_cat2_id, 'Crispy Veg Diner Burger', 'Crunchy spiced potato-corn patty, sharp cheddar, shredded iceberg & tangy mustard mayo', 26500, 'veg', true, false, 1),
      (p_business_id, v_cat2_id, 'Smoky BBQ Chicken Sizzler', 'Flame-grilled chicken breast on a piping-hot cast iron platter with herb rice & grilled corn', 44500, 'non_veg', true, true, 2),
      (p_business_id, v_cat2_id, 'Mac & Three-Cheese Skillet', 'Elbow macaroni baked bubbling in cheddar, gouda & mozzarella with crunchy garlic crumbs', 29500, 'veg', true, false, 3),
      (p_business_id, v_cat3_id, 'Belgian Chocolate Malt Shake', 'Hand-spun dark chocolate ice cream, roasted malt & whipped cream topped with a cherry', 21500, 'veg', true, true, 0),
      (p_business_id, v_cat3_id, 'Madagascar Vanilla Bean Shake', 'Extra-thick classic retro diner milkshake spun with real vanilla bean pods', 19500, 'veg', true, false, 1),
      (p_business_id, v_cat3_id, 'Classic Cherry Cola Float', 'Icy fountain cherry cola crowned with a generous scoop of vanilla ice cream', 16500, 'veg', true, false, 2);
    v_items_inserted := 10;

    if v_existing_reward_count = 0 then
      insert into public.restaurant_rewards (business_id, title, description, stars_required, is_active, display_order)
      values
        (p_business_id, 'Loaded Peri-Peri Fries Basket', 'Crispy cheesy diner fries basket on the house', 2, true, 0),
        (p_business_id, 'Classic Hand-Spun Milkshake', 'Your choice of Chocolate Malt or Vanilla Bean shake', 4, true, 1);
      v_rewards_inserted := 2;
    end if;
  end if;

  insert into public.restaurant_profiles (
    business_id,
    is_enabled,
    menu_theme_template,
    tagline,
    updated_at
  )
  values (
    p_business_id,
    true,
    v_theme,
    v_tagline,
    pg_catalog.clock_timestamp()
  )
  on conflict (business_id) do update
    set menu_theme_template = excluded.menu_theme_template,
        tagline = coalesce(nullif(restaurant_profiles.tagline, ''), excluded.tagline),
        updated_at = pg_catalog.clock_timestamp();

  return pg_catalog.jsonb_build_object(
    'presetKey', v_clean_preset,
    'themeTemplate', v_theme,
    'categoriesInserted', 3,
    'itemsInserted', v_items_inserted,
    'rewardsInserted', v_rewards_inserted
  );
end;
$$;

revoke all on function public.apply_restaurant_menu_preset(uuid, text) from public, anon;
grant execute on function public.apply_restaurant_menu_preset(uuid, text) to authenticated, service_role;

-- ============================================================================
-- 7. UPGRADE public.get_public_restaurant_menu & get_restaurant_floor_and_analytics
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
  v_games jsonb := '[]'::jsonb;
  v_loyalty_rules jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_rules_row record;
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
         rp.games_enabled, rp.loyalty_enabled, rp.table_ordering_enabled,
         rp.menu_theme_template, rp.custom_logo_url, rp.custom_accent_color,
         rp.updated_at
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

  if v_profile.games_enabled then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', g.id,
          'businessId', g.business_id,
          'gameSlug', g.game_slug,
          'title', g.title,
          'category', g.category,
          'isEnabled', g.is_enabled,
          'pointsPerWin', g.points_per_win,
          'maxPointsPerDayPerCustomer', g.max_points_per_day_per_customer,
          'cooldownMinutes', g.cooldown_minutes
        )
        order by g.created_at asc
      ),
      '[]'::jsonb
    )
      into v_games
      from public.restaurant_game_configs g
     where g.business_id = v_biz.id
       and g.is_enabled = true;
  end if;

  select lr.* into v_rules_row
    from public.restaurant_loyalty_rules lr
   where lr.business_id = v_biz.id
   limit 1;

  if found then
    v_loyalty_rules := pg_catalog.jsonb_build_object(
      'businessId', v_rules_row.business_id,
      'starsPerVerifiedVisit', v_rules_row.stars_per_verified_visit,
      'pointsPerStarExchange', v_rules_row.points_per_star_exchange,
      'allowPointExchange', v_rules_row.allow_point_exchange,
      'maxStarsViaExchangePerWeek', v_rules_row.max_stars_via_exchange_per_week,
      'wifiNetworkName', v_rules_row.wifi_network_name,
      'wifiPassword', v_rules_row.wifi_password,
      'suggestionBoxEnabled', v_rules_row.suggestion_box_enabled,
      'updatedAt', v_rules_row.updated_at
    );
  else
    v_loyalty_rules := pg_catalog.jsonb_build_object(
      'businessId', v_biz.id,
      'starsPerVerifiedVisit', 1,
      'pointsPerStarExchange', 100,
      'allowPointExchange', true,
      'maxStarsViaExchangePerWeek', 2,
      'wifiNetworkName', null,
      'wifiPassword', null,
      'suggestionBoxEnabled', true,
      'updatedAt', v_profile.updated_at
    );
  end if;

  if v_profile.loyalty_enabled then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', r.id,
          'businessId', r.business_id,
          'title', r.title,
          'description', r.description,
          'starsRequired', r.stars_required,
          'isActive', r.is_active,
          'maxRedemptionsTotal', r.max_redemptions_total,
          'redemptionsCount', r.redemptions_count,
          'displayOrder', r.display_order
        )
        order by r.display_order asc, r.stars_required asc, r.created_at asc
      ),
      '[]'::jsonb
    )
      into v_rewards
      from public.restaurant_rewards r
     where r.business_id = v_biz.id
       and r.is_active = true;
  end if;

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
      'tableOrderingEnabled', coalesce(v_profile.table_ordering_enabled, false),
      'menuThemeTemplate', coalesce(v_profile.menu_theme_template, 'default'),
      'customLogoUrl', v_profile.custom_logo_url,
      'customAccentColor', v_profile.custom_accent_color,
      'updatedAt', v_profile.updated_at
    ),
    'table', v_table,
    'categories', v_categories,
    'items', v_items,
    'games', v_games,
    'loyaltyRules', v_loyalty_rules,
    'rewards', v_rewards
  );
end;
$$;

create or replace function public.get_restaurant_floor_and_analytics(
  p_slug text,
  p_staff_pin_hash text default null
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
  v_ordering_enabled boolean := false;
  v_calls jsonb := '[]'::jsonb;
  v_pending_claims jsonb := '[]'::jsonb;
  v_table_orders jsonb := '[]'::jsonb;
  v_qr_scans bigint := 0;
  v_checked_in_diners bigint := 0;
  v_games_played bigint := 0;
  v_game_points_issued bigint := 0;
  v_verified_visits bigint := 0;
  v_stars_issued bigint := 0;
  v_rewards_claimed bigint := 0;
  v_rewards_fulfilled bigint := 0;
begin
  select b.id, b.slug, b.name into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
   limit 1;

  if not found then
    raise exception 'Restaurant not found.' using errcode = 'P0002';
  end if;

  if not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: valid Staff PIN or owner session required.' using errcode = '42501';
  end if;

  select coalesce(rp.table_ordering_enabled, false) into v_ordering_enabled
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', tc.id,
        'businessId', tc.business_id,
        'tableId', tc.table_id,
        'tableNumber', coalesce(rt.table_number, 'Table'),
        'tableKey', coalesce(rt.table_key, ''),
        'customerId', tc.customer_id,
        'callType', tc.call_type,
        'status', tc.status,
        'createdAt', tc.created_at,
        'resolvedAt', tc.resolved_at
      )
      order by tc.created_at desc
    ),
    '[]'::jsonb
  )
    into v_calls
    from public.restaurant_table_calls tc
    left join public.restaurant_tables rt on rt.id = tc.table_id
   where tc.business_id = v_biz.id
     and tc.status in ('open', 'acknowledged');

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', rc.id,
        'businessId', rc.business_id,
        'customerId', rc.customer_id,
        'customerName', coalesce(c.display_name, 'Diner'),
        'rewardId', rc.reward_id,
        'rewardTitle', coalesce(r.title, 'Reward'),
        'claimCode', rc.claim_code,
        'starsSpent', rc.stars_spent,
        'status', rc.status,
        'createdAt', rc.created_at
      )
      order by rc.created_at desc
    ),
    '[]'::jsonb
  )
    into v_pending_claims
    from public.restaurant_reward_claims rc
    left join public.restaurant_rewards r on r.id = rc.reward_id
    left join public.restaurant_customers c on c.id = rc.customer_id
   where rc.business_id = v_biz.id
     and rc.status = 'pending_staff_verification';

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'businessId', o.business_id,
        'tableId', o.table_id,
        'tableNumber', rt.table_number,
        'tableKey', rt.table_key,
        'customerId', o.customer_id,
        'guestName', o.guest_name,
        'items', o.items,
        'status', o.status,
        'approvedBy', o.approved_by,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
    into v_table_orders
    from (
      select *
        from public.restaurant_table_orders rto
       where rto.business_id = v_biz.id
         and rto.status in ('pending_approval', 'approved_for_kitchen', 'preparing')
       order by rto.created_at desc
       limit 50
    ) o
    left join public.restaurant_tables rt on rt.id = o.table_id;

  select count(*)::bigint into v_qr_scans
    from public.analytics_events ae
   where ae.business_id = v_biz.id
     and ae.event_type = 'qr_scan';

  select count(distinct x.customer_id)::bigint into v_checked_in_diners
    from (
      select gs.customer_id from public.restaurant_game_sessions gs where gs.business_id = v_biz.id
      union
      select st.customer_id from public.restaurant_loyalty_star_transactions st where st.business_id = v_biz.id
    ) x;

  select count(*)::bigint into v_games_played
    from public.restaurant_game_sessions gs
   where gs.business_id = v_biz.id
     and gs.status = 'completed';

  select coalesce(sum(pt.points_delta), 0)::bigint into v_game_points_issued
    from public.restaurant_game_point_transactions pt
   where pt.business_id = v_biz.id
     and pt.points_delta > 0;

  select count(*)::bigint into v_verified_visits
    from public.restaurant_verified_visits vv
   where vv.business_id = v_biz.id;

  select coalesce(sum(st.stars_delta), 0)::bigint into v_stars_issued
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.stars_delta > 0;

  select count(*)::bigint into v_rewards_claimed
    from public.restaurant_reward_claims rc
   where rc.business_id = v_biz.id;

  select count(*)::bigint into v_rewards_fulfilled
    from public.restaurant_reward_claims rc
   where rc.business_id = v_biz.id
     and rc.status = 'fulfilled';

  return pg_catalog.jsonb_build_object(
    'activeTableCalls', v_calls,
    'pendingRewardClaims', v_pending_claims,
    'tableOrderingEnabled', v_ordering_enabled,
    'tableOrders', v_table_orders,
    'analytics', pg_catalog.jsonb_build_object(
      'qrScans', v_qr_scans,
      'checkedInDiners', v_checked_in_diners,
      'gamesPlayed', v_games_played,
      'gamePointsIssued', v_game_points_issued,
      'verifiedPaidVisits', v_verified_visits,
      'loyaltyStarsIssued', v_stars_issued,
      'rewardsClaimed', v_rewards_claimed,
      'rewardsFulfilled', v_rewards_fulfilled
    )
  );
end;
$$;

commit;
