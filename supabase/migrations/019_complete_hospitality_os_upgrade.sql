-- ============================================================================
-- Vitaran AI Reviews / BistroOS — Complete Hospitality OS Upgrade
-- Migration: 019_complete_hospitality_os_upgrade.sql
-- Depends on: 001..018
--
-- Summary of Changes:
-- 1. Extends public.restaurant_profiles with UPI QR billing, GSTIN, GST %,
--    Service Charge %, Voice Alerts toggle, Accepting Orders toggle, and
--    Unified Hotel Rooms mode (hotel_rooms_enabled).
-- 2. Extends public.restaurant_tables into Unified Tables & Hotel Rooms
--    (location_type 'table'|'room', seat_capacity, occupied_since).
-- 3. Extends public.restaurant_menu_items with show_on_table, show_on_room,
--    spice_level, ingredients_summary, and prep_time_minutes.
-- 4. Extends public.restaurant_table_calls to support 4 micro-service guest
--    requests ('assistance', 'water', 'bill_request', 'clean_table', plus
--    legacy 'ready_for_bill') and waiter assignment (assigned_staff_label).
-- 5. Extends public.restaurant_table_orders with 'ready' status, order_source
--    (QR table/room, Counter POS, Swiggy/Zomato/Magicpin/ONDC/Phone/Website),
--    platform_order_number, packaging_paise, kitchen_note, bill_session_id,
--    payment_status, payment_method, paid_at, and customer_repeat_visit_count.
-- 6. Creates public.restaurant_table_messages (Live 2-Way Table/Room Chat)
--    with ENABLE + FORCE ROW LEVEL SECURITY and REVOKE ALL FROM public, anon.
-- 7. Adds & upgrades hardened SECURITY DEFINER RPCs:
--      - create_pos_or_platform_order
--      - send_table_chat_message
--      - get_table_chat_messages
--      - get_open_table_bill_summary
--      - mark_table_bill_upi_pending
--      - complete_table_bill_checkout
--      - Upgraded create_restaurant_table_call, update_restaurant_table_call_status,
--        submit_customer_table_order, update_table_order_status,
--        get_public_restaurant_menu, get_restaurant_floor_and_analytics.
-- 8. Idempotently registers restaurant_table_orders, restaurant_table_calls,
--    and restaurant_table_messages in supabase_realtime publication.
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXTEND public.restaurant_profiles
-- ============================================================================
alter table public.restaurant_profiles
  add column if not exists upi_id text,
  add column if not exists upi_payee_name text,
  add column if not exists gstin text,
  add column if not exists gst_percent numeric(5,2) not null default 0,
  add column if not exists service_charge_percent numeric(5,2) not null default 0,
  add column if not exists voice_alerts_enabled boolean not null default true,
  add column if not exists accepting_orders boolean not null default true,
  add column if not exists hotel_rooms_enabled boolean not null default false;

alter table public.restaurant_profiles
  drop constraint if exists rp_gst_percent_chk,
  drop constraint if exists rp_service_charge_percent_chk,
  drop constraint if exists rp_upi_id_len_chk,
  drop constraint if exists rp_gstin_len_chk;

alter table public.restaurant_profiles
  add constraint rp_gst_percent_chk check (gst_percent between 0 and 28),
  add constraint rp_service_charge_percent_chk check (service_charge_percent between 0 and 25),
  add constraint rp_upi_id_len_chk check (upi_id is null or pg_catalog.char_length(pg_catalog.btrim(upi_id)) <= 120),
  add constraint rp_gstin_len_chk check (gstin is null or pg_catalog.char_length(pg_catalog.btrim(gstin)) <= 32);

-- ============================================================================
-- 2. EXTEND public.restaurant_tables (Unified Dining Tables & Hotel Rooms)
-- ============================================================================
alter table public.restaurant_tables
  add column if not exists location_type text not null default 'table',
  add column if not exists seat_capacity integer not null default 4,
  add column if not exists occupied_since timestamptz;

alter table public.restaurant_tables
  drop constraint if exists rt_location_type_chk,
  drop constraint if exists rt_seat_capacity_chk;

alter table public.restaurant_tables
  add constraint rt_location_type_chk check (location_type in ('table', 'room')),
  add constraint rt_seat_capacity_chk check (seat_capacity between 1 and 30);

-- ============================================================================
-- 3. EXTEND public.restaurant_menu_items (Table/Room Visibility & Metadata)
-- ============================================================================
alter table public.restaurant_menu_items
  add column if not exists show_on_table boolean not null default true,
  add column if not exists show_on_room boolean not null default true,
  add column if not exists spice_level text,
  add column if not exists ingredients_summary text,
  add column if not exists prep_time_minutes integer;

alter table public.restaurant_menu_items
  drop constraint if exists rmi_spice_level_chk,
  drop constraint if exists rmi_ingredients_len_chk,
  drop constraint if exists rmi_prep_time_chk;

alter table public.restaurant_menu_items
  add constraint rmi_spice_level_chk check (
    spice_level is null or spice_level in ('mild', 'medium', 'spicy', 'extra_spicy')
  ),
  add constraint rmi_ingredients_len_chk check (
    ingredients_summary is null or pg_catalog.char_length(ingredients_summary) <= 400
  ),
  add constraint rmi_prep_time_chk check (
    prep_time_minutes is null or (prep_time_minutes between 1 and 180)
  );

-- ============================================================================
-- 4. EXTEND public.restaurant_table_calls (4 Micro-Services + Waiter Assignment)
-- ============================================================================
alter table public.restaurant_table_calls
  add column if not exists assigned_staff_label text;

alter table public.restaurant_table_calls
  drop constraint if exists rtc_call_type_chk,
  drop constraint if exists rtc_assigned_staff_len_chk;

alter table public.restaurant_table_calls
  add constraint rtc_call_type_chk check (
    call_type in ('assistance', 'water', 'bill_request', 'clean_table', 'ready_for_bill')
  ),
  add constraint rtc_assigned_staff_len_chk check (
    assigned_staff_label is null or pg_catalog.char_length(assigned_staff_label) <= 100
  );

-- ============================================================================
-- 5. EXTEND public.restaurant_table_orders (POS, Aggregators & Open Table Bills)
-- ============================================================================
alter table public.restaurant_table_orders
  add column if not exists order_source text not null default 'qr_table',
  add column if not exists platform_order_number text,
  add column if not exists packaging_paise integer not null default 0,
  add column if not exists kitchen_note text,
  add column if not exists bill_session_id uuid,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists customer_repeat_visit_count integer not null default 1;

alter table public.restaurant_table_orders
  drop constraint if exists rto_status_chk,
  drop constraint if exists rto_order_source_chk,
  drop constraint if exists rto_packaging_chk,
  drop constraint if exists rto_payment_status_chk,
  drop constraint if exists rto_payment_method_chk,
  drop constraint if exists rto_kitchen_note_len_chk;

alter table public.restaurant_table_orders
  add constraint rto_status_chk check (
    status in ('pending_approval', 'approved_for_kitchen', 'preparing', 'ready', 'served', 'cancelled')
  ),
  add constraint rto_order_source_chk check (
    order_source in (
      'qr_table', 'qr_room', 'pos_dine_in', 'pos_takeaway', 'pos_delivery',
      'swiggy', 'zomato', 'magicpin', 'ondc', 'phone', 'website'
    )
  ),
  add constraint rto_packaging_chk check (packaging_paise >= 0 and packaging_paise <= 1000000),
  add constraint rto_payment_status_chk check (
    payment_status in ('unpaid', 'upi_pending_verify', 'paid')
  ),
  add constraint rto_payment_method_chk check (
    payment_method is null or payment_method in ('cash', 'upi', 'card', 'platform_prepaid')
  ),
  add constraint rto_kitchen_note_len_chk check (
    kitchen_note is null or pg_catalog.char_length(kitchen_note) <= 300
  );

create index if not exists idx_rto_biz_table_payment
  on public.restaurant_table_orders (business_id, table_id, payment_status, created_at desc);

create index if not exists idx_rto_biz_source_status
  on public.restaurant_table_orders (business_id, order_source, status, created_at desc);

-- ============================================================================
-- 6. NEW TABLE: public.restaurant_table_messages (Live 2-Way Table/Room Chat)
-- ============================================================================
create table if not exists public.restaurant_table_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'manager', 'system')),
  sender_name text,
  message_text text not null check (pg_catalog.char_length(pg_catalog.btrim(message_text)) between 1 and 600),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_rtm_biz_table_created
  on public.restaurant_table_messages (business_id, table_id, created_at asc);

alter table public.restaurant_table_messages enable row level security;
alter table public.restaurant_table_messages force row level security;

revoke all on table public.restaurant_table_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.restaurant_table_messages to authenticated;
grant all on table public.restaurant_table_messages to service_role;

drop policy if exists "rtm_owner_all" on public.restaurant_table_messages;
create policy "rtm_owner_all"
  on public.restaurant_table_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = restaurant_table_messages.business_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = restaurant_table_messages.business_id
        and b.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. HELPER: Ownership Check & Realtime Publication (Idempotent)
-- ============================================================================
create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
      from public.businesses b
     where b.id = p_business_id
       and auth.uid() is not null
       and b.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.restaurant_table_orders;
exception when duplicate_object or undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.restaurant_table_calls;
exception when duplicate_object or undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.restaurant_table_messages;
exception when duplicate_object or undefined_object then null;
end $$;

-- ============================================================================
-- 8. UPGRADE RPC: create_restaurant_table_call (supports 4 micro-services)
-- ============================================================================
create or replace function public.create_restaurant_table_call(
  p_slug text,
  p_table_key text,
  p_customer_id uuid default null,
  p_call_type text default 'assistance'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_table_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_clean_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_call_type, 'assistance')));
  v_biz record;
  v_table record;
  v_existing public.restaurant_table_calls%rowtype;
  v_msg_text text;
begin
  if v_clean_type not in ('assistance', 'water', 'bill_request', 'clean_table', 'ready_for_bill') then
    raise exception 'Invalid table call type.' using errcode = '22023';
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

  select rt.* into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_table_key
     and rt.is_active = true
   limit 1;

  if not found then
    raise exception 'Table not found or inactive.' using errcode = 'P0002';
  end if;

  -- Spam protection: reuse open/acknowledged call of same type within 15 minutes
  select * into v_existing
    from public.restaurant_table_calls tc
   where tc.business_id = v_biz.id
     and tc.table_id = v_table.id
     and tc.call_type = v_clean_type
     and tc.status in ('open', 'acknowledged')
     and tc.created_at >= (pg_catalog.clock_timestamp() - interval '15 minutes')
   order by tc.created_at desc
   limit 1;

  if not found then
    insert into public.restaurant_table_calls (
      business_id,
      table_id,
      customer_id,
      call_type,
      status
    )
    values (
      v_biz.id,
      v_table.id,
      p_customer_id,
      v_clean_type,
      'open'
    )
    returning * into v_existing;

    -- Also post a clean system activity line in the live table chat thread
    v_msg_text := case v_clean_type
      when 'water' then 'Guest requested drinking water'
      when 'clean_table' then 'Guest requested table cleaning'
      when 'bill_request' then 'Guest asked for the final bill'
      when 'ready_for_bill' then 'Guest asked for the final bill'
      else 'Guest called a waiter for assistance'
    end;

    insert into public.restaurant_table_messages (
      business_id, table_id, sender_role, sender_name, message_text, is_read
    ) values (
      v_biz.id, v_table.id, 'system', 'System', v_msg_text, false
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_existing.id,
    'businessId', v_existing.business_id,
    'tableId', v_existing.table_id,
    'tableNumber', v_table.table_number,
    'tableKey', v_table.table_key,
    'locationType', coalesce(v_table.location_type, 'table'),
    'customerId', v_existing.customer_id,
    'callType', v_existing.call_type,
    'status', v_existing.status,
    'assignedStaffLabel', v_existing.assigned_staff_label,
    'createdAt', v_existing.created_at,
    'resolvedAt', v_existing.resolved_at
  );
end;
$$;

revoke all on function public.create_restaurant_table_call(text, text, uuid, text) from public;
grant execute on function public.create_restaurant_table_call(text, text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. UPGRADE RPC: update_restaurant_table_call_status (supports waiter assign)
--    Drop old 4-arg signature first to avoid PostgREST overload ambiguity.
-- ============================================================================
drop function if exists public.update_restaurant_table_call_status(text, uuid, text, text);

create or replace function public.update_restaurant_table_call_status(
  p_slug text,
  p_call_id uuid,
  p_new_status text,
  p_staff_pin_hash text default null,
  p_assigned_staff_label text default null
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
  v_clean_assign text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_assigned_staff_label, '')), 1, 100), '');
  v_biz record;
  v_updated public.restaurant_table_calls%rowtype;
  v_table record;
begin
  if v_clean_status not in ('open', 'acknowledged', 'resolved') then
    raise exception 'Invalid table call status.' using errcode = '22023';
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

  update public.restaurant_table_calls
     set status = v_clean_status,
         assigned_staff_label = coalesce(v_clean_assign, assigned_staff_label),
         resolved_at = case when v_clean_status = 'resolved' then pg_catalog.clock_timestamp() else null end
   where id = p_call_id
     and business_id = v_biz.id
   returning * into v_updated;

  if not found then
    raise exception 'Table call alert not found.' using errcode = 'P0002';
  end if;

  select rt.table_number, rt.table_key, rt.location_type into v_table
    from public.restaurant_tables rt
   where rt.id = v_updated.table_id;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'businessId', v_updated.business_id,
    'tableId', v_updated.table_id,
    'tableNumber', coalesce(v_table.table_number, 'Table'),
    'tableKey', coalesce(v_table.table_key, ''),
    'locationType', coalesce(v_table.location_type, 'table'),
    'customerId', v_updated.customer_id,
    'callType', v_updated.call_type,
    'status', v_updated.status,
    'assignedStaffLabel', v_updated.assigned_staff_label,
    'createdAt', v_updated.created_at,
    'resolvedAt', v_updated.resolved_at
  );
end;
$$;

revoke all on function public.update_restaurant_table_call_status(text, uuid, text, text, text) from public;
grant execute on function public.update_restaurant_table_call_status(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. UPGRADE RPC: submit_customer_table_order (6 params w/ kitchen_note,
--     open bill session grouping, repeat visit count & table occupancy)
-- ============================================================================
drop function if exists public.submit_customer_table_order(text, text, uuid, text, jsonb);

create or replace function public.submit_customer_table_order(
  p_slug text,
  p_table_key text default null,
  p_customer_id uuid default null,
  p_guest_name text default null,
  p_items jsonb default '[]'::jsonb,
  p_kitchen_note text default null
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
  v_clean_note text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_kitchen_note, '')), 1, 300), '');
  v_biz record;
  v_profile record;
  v_table record;
  v_table_id uuid := null;
  v_table_number text := null;
  v_table_key_resolved text := null;
  v_order_source text := 'qr_table';
  v_bill_session_id uuid := null;
  v_repeat_visits integer := 1;
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

  select rp.is_enabled, rp.table_ordering_enabled, rp.accepting_orders into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  if not found or v_profile.is_enabled = false then
    raise exception 'Digital menu is not enabled for this restaurant.' using errcode = '42501';
  end if;

  if v_profile.table_ordering_enabled = false then
    raise exception 'Customer phone ordering is currently turned off. Please place your order with your server.' using errcode = '42501';
  end if;

  if coalesce(v_profile.accepting_orders, true) = false then
    raise exception 'We are temporarily paused and not accepting new orders right now.' using errcode = '42501';
  end if;

  if v_clean_table_key is not null then
    select rt.id, rt.table_number, rt.table_key, rt.location_type into v_table
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
       and rt.is_active = true
     limit 1;

    if found then
      v_table_id := v_table.id;
      v_table_number := v_table.table_number;
      v_table_key_resolved := v_table.table_key;
      v_order_source := case when v_table.location_type = 'room' then 'qr_room' else 'qr_table' end;

      select o.bill_session_id into v_bill_session_id
        from public.restaurant_table_orders o
       where o.business_id = v_biz.id
         and o.table_id = v_table_id
         and o.payment_status <> 'paid'
         and o.status <> 'cancelled'
         and o.bill_session_id is not null
       order by o.created_at desc
       limit 1;

      if v_bill_session_id is null then
        v_bill_session_id := gen_random_uuid();
      end if;

      update public.restaurant_tables
         set occupied_since = coalesce(occupied_since, pg_catalog.clock_timestamp())
       where id = v_table_id;
    end if;
  end if;

  if p_customer_id is not null then
    select greatest(1, count(*)::integer + 1) into v_repeat_visits
      from public.restaurant_verified_visits vv
     where vv.business_id = v_biz.id
       and vv.customer_id = p_customer_id;
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
    status,
    order_source,
    kitchen_note,
    bill_session_id,
    payment_status,
    customer_repeat_visit_count
  )
  values (
    v_biz.id,
    v_table_id,
    p_customer_id,
    case when v_clean_guest is not null then pg_catalog.substr(v_clean_guest, 1, 80) else null end,
    v_validated_items,
    'pending_approval',
    v_order_source,
    v_clean_note,
    v_bill_session_id,
    'unpaid',
    v_repeat_visits
  )
  returning * into v_inserted;

  if v_table_id is not null then
    insert into public.restaurant_table_messages (
      business_id, table_id, sender_role, sender_name, message_text, is_read
    ) values (
      v_biz.id,
      v_table_id,
      'system',
      'System',
      'New order placed (' || pg_catalog.jsonb_array_length(v_validated_items)::text || ' items) — sent for kitchen confirmation',
      false
    );
  end if;

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
    'orderSource', v_inserted.order_source,
    'platformOrderNumber', v_inserted.platform_order_number,
    'packagingPaise', v_inserted.packaging_paise,
    'kitchenNote', v_inserted.kitchen_note,
    'billSessionId', v_inserted.bill_session_id,
    'paymentStatus', v_inserted.payment_status,
    'paymentMethod', v_inserted.payment_method,
    'paidAt', v_inserted.paid_at,
    'customerRepeatVisitCount', v_inserted.customer_repeat_visit_count,
    'approvedBy', v_inserted.approved_by,
    'createdAt', v_inserted.created_at,
    'updatedAt', v_inserted.updated_at
  );
end;
$$;

revoke all on function public.submit_customer_table_order(text, text, uuid, text, jsonb, text) from public;
grant execute on function public.submit_customer_table_order(text, text, uuid, text, jsonb, text) to anon, authenticated, service_role;

-- ============================================================================
-- 11. NEW RPC 1: create_pos_or_platform_order (Counter POS & Swiggy/Zomato)
--     Routes straight to 'approved_for_kitchen'; never attaches delivery/platform
--     orders to any dining table bill!
-- ============================================================================
create or replace function public.create_pos_or_platform_order(
  p_business_id uuid,
  p_order_source text,
  p_table_id uuid default null,
  p_platform_order_number text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_kitchen_note text default null,
  p_packaging_paise integer default 0,
  p_items jsonb default '[]'::jsonb,
  p_staff_label text default 'Owner',
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_source text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_order_source, 'pos_dine_in')));
  v_clean_plat_no text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_platform_order_number, '')), 1, 60), '');
  v_clean_cust_name text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_customer_name, '')), 1, 80), '');
  v_clean_phone text := nullif(pg_catalog.btrim(coalesce(p_customer_phone, '')), '');
  v_clean_note text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_kitchen_note, '')), 1, 300), '');
  v_packaging integer := greatest(0, least(1000000, coalesce(p_packaging_paise, 0)));
  v_staff_label text;
  v_table record;
  v_resolved_table_id uuid := null;
  v_table_number text := null;
  v_table_key text := null;
  v_bill_session_id uuid := null;
  v_customer_id uuid := null;
  v_repeat_visits integer := 1;
  v_payment_status text := 'unpaid';
  v_payment_method text := null;
  v_elem jsonb;
  v_item_id uuid;
  v_qty integer;
  v_item_note text;
  v_menu_item record;
  v_validated_items jsonb := '[]'::jsonb;
  v_inserted public.restaurant_table_orders%rowtype;
begin
  if not public.is_owner_or_valid_staff_pin(p_business_id, p_staff_pin_hash) then
    raise exception 'Unauthorized: owner session or valid Staff PIN required.' using errcode = '42501';
  end if;

  if v_source not in (
    'qr_table', 'qr_room', 'pos_dine_in', 'pos_takeaway', 'pos_delivery',
    'swiggy', 'zomato', 'magicpin', 'ondc', 'phone', 'website'
  ) then
    raise exception 'Unsupported order source.' using errcode = '22023';
  end if;

  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 60
  then
    raise exception 'Please add at least 1 menu item to create an order.' using errcode = '22023';
  end if;

  v_staff_label := public.resolve_staff_member_label(p_business_id, p_staff_pin_hash, coalesce(p_staff_label, 'Owner'));

  -- Only attach table_id and bill_session_id for dine-in/room orders; keep takeaway/delivery/platform separate!
  if v_source in ('pos_dine_in', 'qr_table', 'qr_room') and p_table_id is not null then
    select rt.id, rt.table_number, rt.table_key into v_table
      from public.restaurant_tables rt
     where rt.id = p_table_id
       and rt.business_id = p_business_id
     limit 1;

    if found then
      v_resolved_table_id := v_table.id;
      v_table_number := v_table.table_number;
      v_table_key := v_table.table_key;

      select o.bill_session_id into v_bill_session_id
        from public.restaurant_table_orders o
       where o.business_id = p_business_id
         and o.table_id = v_resolved_table_id
         and o.payment_status <> 'paid'
         and o.status <> 'cancelled'
         and o.bill_session_id is not null
       order by o.created_at desc
       limit 1;

      if v_bill_session_id is null then
        v_bill_session_id := gen_random_uuid();
      end if;

      update public.restaurant_tables
         set occupied_since = coalesce(occupied_since, pg_catalog.clock_timestamp())
       where id = v_resolved_table_id;
    end if;
  end if;

  -- Aggregator orders are usually platform prepaid
  if v_source in ('swiggy', 'zomato', 'magicpin', 'ondc') then
    v_payment_status := 'paid';
    v_payment_method := 'platform_prepaid';
  end if;

  -- Detect repeat guest count when customer phone is provided (auto-links lightweight guest record)
  if v_clean_phone is not null then
    select c.id into v_customer_id
      from public.restaurant_customers c
     where pg_catalog.lower(coalesce(c.phone_or_email, '')) = pg_catalog.lower(v_clean_phone)
     limit 1;

    if v_customer_id is null then
      insert into public.restaurant_customers (
        display_name,
        phone_or_email,
        guest_token_hash
      )
      values (
        coalesce(v_clean_cust_name, 'Guest'),
        v_clean_phone,
        'phone-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.lower(v_clean_phone)), 1, 20)
      )
      on conflict (guest_token_hash) do update
        set phone_or_email = excluded.phone_or_email
      returning id into v_customer_id;
    end if;

    if v_customer_id is not null then
      select greatest(
        1,
        (
          select count(*)::integer
            from public.restaurant_verified_visits vv
           where vv.business_id = p_business_id
             and vv.customer_id = v_customer_id
        ) + (
          select count(*)::integer
            from public.restaurant_table_orders po
           where po.business_id = p_business_id
             and po.customer_id = v_customer_id
             and po.status <> 'cancelled'
        ) + 1
      ) into v_repeat_visits;
    end if;
  end if;

  for v_elem in select * from pg_catalog.jsonb_array_elements(p_items) loop
    begin
      v_item_id := (v_elem ->> 'itemId')::uuid;
    exception when others then
      raise exception 'Invalid menu item ID.' using errcode = '22023';
    end;

    v_qty := greatest(1, least(50, coalesce((v_elem ->> 'quantity')::integer, 1)));
    v_item_note := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(v_elem ->> 'notes', '')), 1, 160), '');

    select i.id, i.name, i.price_paise into v_menu_item
      from public.restaurant_menu_items i
     where i.id = v_item_id
       and i.business_id = p_business_id
     limit 1;

    if not found then
      raise exception 'Menu item not found for this business.' using errcode = 'P0002';
    end if;

    v_validated_items := v_validated_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'itemId', v_menu_item.id,
        'name', v_menu_item.name,
        'quantity', v_qty,
        'pricePaise', v_menu_item.price_paise,
        'notes', v_item_note
      )
    );
  end loop;

  insert into public.restaurant_table_orders (
    business_id,
    table_id,
    customer_id,
    guest_name,
    items,
    status,
    approved_by,
    order_source,
    platform_order_number,
    packaging_paise,
    kitchen_note,
    bill_session_id,
    payment_status,
    payment_method,
    paid_at,
    customer_repeat_visit_count
  )
  values (
    p_business_id,
    v_resolved_table_id,
    v_customer_id,
    v_clean_cust_name,
    v_validated_items,
    'approved_for_kitchen',
    v_staff_label,
    v_source,
    v_clean_plat_no,
    v_packaging,
    v_clean_note,
    v_bill_session_id,
    v_payment_status,
    v_payment_method,
    case when v_payment_status = 'paid' then pg_catalog.clock_timestamp() else null end,
    v_repeat_visits
  )
  returning * into v_inserted;

  return pg_catalog.jsonb_build_object(
    'id', v_inserted.id,
    'businessId', v_inserted.business_id,
    'tableId', v_inserted.table_id,
    'tableNumber', v_table_number,
    'tableKey', v_table_key,
    'customerId', v_inserted.customer_id,
    'guestName', v_inserted.guest_name,
    'items', v_inserted.items,
    'status', v_inserted.status,
    'orderSource', v_inserted.order_source,
    'platformOrderNumber', v_inserted.platform_order_number,
    'packagingPaise', v_inserted.packaging_paise,
    'kitchenNote', v_inserted.kitchen_note,
    'billSessionId', v_inserted.bill_session_id,
    'paymentStatus', v_inserted.payment_status,
    'paymentMethod', v_inserted.payment_method,
    'paidAt', v_inserted.paid_at,
    'customerRepeatVisitCount', v_inserted.customer_repeat_visit_count,
    'approvedBy', v_inserted.approved_by,
    'createdAt', v_inserted.created_at,
    'updatedAt', v_inserted.updated_at
  );
end;
$$;

revoke all on function public.create_pos_or_platform_order(uuid, text, uuid, text, text, text, text, integer, jsonb, text, text) from public;
grant execute on function public.create_pos_or_platform_order(uuid, text, uuid, text, text, text, text, integer, jsonb, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 12. UPGRADE RPC: update_table_order_status (adds 'ready' status + chat ping)
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
  v_clean_staff text;
  v_biz record;
  v_updated public.restaurant_table_orders%rowtype;
  v_table record;
begin
  if v_clean_status not in ('pending_approval', 'approved_for_kitchen', 'preparing', 'ready', 'served', 'cancelled') then
    raise exception 'Invalid table order status.' using errcode = '22023';
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

  v_clean_staff := public.resolve_staff_member_label(v_biz.id, p_staff_pin_hash, p_staff_label);

  update public.restaurant_table_orders
     set status = v_clean_status,
         approved_by = case
           when v_clean_status in ('approved_for_kitchen', 'preparing', 'ready', 'served')
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

    if v_clean_status = 'ready' then
      insert into public.restaurant_table_messages (
        business_id, table_id, sender_role, sender_name, message_text, is_read
      ) values (
        v_biz.id, v_updated.table_id, 'system', 'Kitchen', 'Your order is freshly prepared and on its way!', false
      );
    end if;
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
    'orderSource', v_updated.order_source,
    'platformOrderNumber', v_updated.platform_order_number,
    'packagingPaise', v_updated.packaging_paise,
    'kitchenNote', v_updated.kitchen_note,
    'billSessionId', v_updated.bill_session_id,
    'paymentStatus', v_updated.payment_status,
    'paymentMethod', v_updated.payment_method,
    'paidAt', v_updated.paid_at,
    'customerRepeatVisitCount', v_updated.customer_repeat_visit_count,
    'approvedBy', v_updated.approved_by,
    'createdAt', v_updated.created_at,
    'updatedAt', v_updated.updated_at
  );
end;
$$;

revoke all on function public.update_table_order_status(text, uuid, text, text, text) from public;
grant execute on function public.update_table_order_status(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 13. NEW RPC 2 & 3: send_table_chat_message & get_table_chat_messages
-- ============================================================================
create or replace function public.send_table_chat_message(
  p_slug text,
  p_table_key text,
  p_sender_role text,
  p_sender_name text default null,
  p_message_text text default '',
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
  v_clean_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_role text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_sender_role, 'customer')));
  v_name text := nullif(pg_catalog.substr(pg_catalog.btrim(coalesce(p_sender_name, '')), 1, 80), '');
  v_msg text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_message_text, '')), 1, 600);
  v_biz record;
  v_table record;
  v_thread jsonb := '[]'::jsonb;
begin
  if v_role not in ('customer', 'manager', 'system') then
    raise exception 'Invalid sender role.' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_msg) < 1 then
    raise exception 'Message cannot be empty.' using errcode = '22023';
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

  if v_role = 'manager' and not public.is_owner_or_valid_staff_pin(v_biz.id, p_staff_pin_hash) then
    raise exception 'Unauthorized: owner session or valid Staff PIN required to send manager replies.' using errcode = '42501';
  end if;

  select rt.id, rt.table_number, rt.table_key into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_key
   limit 1;

  if not found then
    raise exception 'Table or room not found.' using errcode = 'P0002';
  end if;

  insert into public.restaurant_table_messages (
    business_id, table_id, sender_role, sender_name, message_text, is_read
  ) values (
    v_biz.id,
    v_table.id,
    v_role,
    coalesce(v_name, case when v_role = 'manager' then 'Manager' when v_role = 'system' then 'System' else 'Guest' end),
    v_msg,
    (v_role = 'manager')
  );

  if v_role = 'manager' then
    update public.restaurant_table_messages
       set is_read = true
     where business_id = v_biz.id
       and table_id = v_table.id
       and sender_role = 'customer'
       and is_read = false;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', m.id,
        'businessId', m.business_id,
        'tableId', m.table_id,
        'tableNumber', v_table.table_number,
        'tableKey', v_table.table_key,
        'senderRole', m.sender_role,
        'senderName', m.sender_name,
        'messageText', m.message_text,
        'isRead', m.is_read,
        'createdAt', m.created_at
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
    into v_thread
    from (
      select * from public.restaurant_table_messages
       where business_id = v_biz.id
         and table_id = v_table.id
       order by created_at desc
       limit 80
    ) m;

  return v_thread;
end;
$$;

revoke all on function public.send_table_chat_message(text, text, text, text, text, text) from public;
grant execute on function public.send_table_chat_message(text, text, text, text, text, text) to anon, authenticated, service_role;

create or replace function public.get_table_chat_messages(
  p_slug text,
  p_table_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_biz record;
  v_table record;
  v_thread jsonb := '[]'::jsonb;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then return '[]'::jsonb; end if;

  select rt.id, rt.table_number, rt.table_key into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_key
   limit 1;

  if not found then return '[]'::jsonb; end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', m.id,
        'businessId', m.business_id,
        'tableId', m.table_id,
        'tableNumber', v_table.table_number,
        'tableKey', v_table.table_key,
        'senderRole', m.sender_role,
        'senderName', m.sender_name,
        'messageText', m.message_text,
        'isRead', m.is_read,
        'createdAt', m.created_at
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
    into v_thread
    from (
      select * from public.restaurant_table_messages
       where business_id = v_biz.id
         and table_id = v_table.id
       order by created_at desc
       limit 80
    ) m;

  return v_thread;
end;
$$;

revoke all on function public.get_table_chat_messages(text, text) from public;
grant execute on function public.get_table_chat_messages(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 14. NEW RPC 4: get_open_table_bill_summary (Multi-Order Bill + GST CGST/SGST)
-- ============================================================================
create or replace function public.get_open_table_bill_summary(
  p_slug text,
  p_table_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_biz record;
  v_profile record;
  v_table record;
  v_orders jsonb := '[]'::jsonb;
  v_paid_orders jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_gst_pct numeric(5,2) := 0;
  v_sc_pct numeric(5,2) := 0;
  v_gst_paise bigint := 0;
  v_cgst_paise bigint := 0;
  v_sgst_paise bigint := 0;
  v_sc_paise bigint := 0;
  v_grand_total bigint := 0;
  v_payment_status text := 'unpaid';
  v_bill_requested boolean := false;
  v_is_checked_out boolean := false;
  v_latest_paid_at timestamptz := null;
  v_latest_paid_method text := null;
  v_latest_session uuid := null;
begin
  select b.id, b.name, b.slug, b.city into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then return null; end if;

  select rp.currency_code, rp.upi_id, rp.upi_payee_name, rp.gstin,
         coalesce(rp.gst_percent, 0) as gst_percent,
         coalesce(rp.service_charge_percent, 0) as service_charge_percent
    into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  select rt.* into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_key
   limit 1;

  if not found then return null; end if;

  v_gst_pct := coalesce(v_profile.gst_percent, 0);
  v_sc_pct := coalesce(v_profile.service_charge_percent, 0);

  -- Gather active unpaid orders on this table/room
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'businessId', o.business_id,
        'tableId', o.table_id,
        'tableNumber', v_table.table_number,
        'tableKey', v_table.table_key,
        'customerId', o.customer_id,
        'guestName', o.guest_name,
        'items', o.items,
        'status', o.status,
        'orderSource', o.order_source,
        'kitchenNote', o.kitchen_note,
        'billSessionId', o.bill_session_id,
        'paymentStatus', o.payment_status,
        'paymentMethod', o.payment_method,
        'paidAt', o.paid_at,
        'customerRepeatVisitCount', o.customer_repeat_visit_count,
        'approvedBy', o.approved_by,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at
      )
      order by o.created_at asc
    ),
    '[]'::jsonb
  )
    into v_orders
    from public.restaurant_table_orders o
   where o.business_id = v_biz.id
     and o.table_id = v_table.id
     and o.status <> 'cancelled'
     and o.payment_status <> 'paid';

  if pg_catalog.jsonb_array_length(v_orders) > 0 then
    select coalesce(sum(((elem ->> 'pricePaise')::bigint * (elem ->> 'quantity')::bigint)), 0)
      into v_subtotal
      from public.restaurant_table_orders o,
           lateral pg_catalog.jsonb_array_elements(o.items) as elem
     where o.business_id = v_biz.id
       and o.table_id = v_table.id
       and o.status <> 'cancelled'
       and o.payment_status <> 'paid';

    if exists (
      select 1 from public.restaurant_table_orders o
       where o.business_id = v_biz.id
         and o.table_id = v_table.id
         and o.status <> 'cancelled'
         and o.payment_status = 'upi_pending_verify'
    ) then
      v_payment_status := 'upi_pending_verify';
    end if;
  else
    -- Check if there is a freshly paid checkout session (within last 6 hours) for downloadable receipt
    select o.bill_session_id, o.paid_at, o.payment_method
      into v_latest_session, v_latest_paid_at, v_latest_paid_method
      from public.restaurant_table_orders o
     where o.business_id = v_biz.id
       and o.table_id = v_table.id
       and o.status <> 'cancelled'
       and o.payment_status = 'paid'
       and o.paid_at >= (pg_catalog.clock_timestamp() - interval '6 hours')
     order by o.paid_at desc
     limit 1;

    if found then
      v_is_checked_out := true;
      v_payment_status := 'paid';

      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', o.id,
            'businessId', o.business_id,
            'tableId', o.table_id,
            'tableNumber', v_table.table_number,
            'tableKey', v_table.table_key,
            'customerId', o.customer_id,
            'guestName', o.guest_name,
            'items', o.items,
            'status', o.status,
            'orderSource', o.order_source,
            'kitchenNote', o.kitchen_note,
            'billSessionId', o.bill_session_id,
            'paymentStatus', o.payment_status,
            'paymentMethod', o.payment_method,
            'paidAt', o.paid_at,
            'createdAt', o.created_at,
            'updatedAt', o.updated_at
          )
          order by o.created_at asc
        ),
        '[]'::jsonb
      )
        into v_paid_orders
        from public.restaurant_table_orders o
       where o.business_id = v_biz.id
         and o.table_id = v_table.id
         and o.status <> 'cancelled'
         and o.payment_status = 'paid'
         and (
           (v_latest_session is not null and o.bill_session_id = v_latest_session)
           or (v_latest_session is null and o.paid_at = v_latest_paid_at)
         );

      v_orders := v_paid_orders;

      select coalesce(sum(((elem ->> 'pricePaise')::bigint * (elem ->> 'quantity')::bigint)), 0)
        into v_subtotal
        from public.restaurant_table_orders o,
             lateral pg_catalog.jsonb_array_elements(o.items) as elem
       where o.business_id = v_biz.id
         and o.table_id = v_table.id
         and o.status <> 'cancelled'
         and o.payment_status = 'paid'
         and (
           (v_latest_session is not null and o.bill_session_id = v_latest_session)
           or (v_latest_session is null and o.paid_at = v_latest_paid_at)
         );
    end if;
  end if;

  v_gst_paise := round((v_subtotal::numeric * v_gst_pct) / 100.0)::bigint;
  v_cgst_paise := (v_gst_paise / 2);
  v_sgst_paise := v_gst_paise - v_cgst_paise;
  v_sc_paise := round((v_subtotal::numeric * v_sc_pct) / 100.0)::bigint;
  v_grand_total := v_subtotal + v_gst_paise + v_sc_paise;

  select exists (
    select 1 from public.restaurant_table_calls tc
     where tc.business_id = v_biz.id
       and tc.table_id = v_table.id
       and tc.call_type in ('bill_request', 'ready_for_bill')
       and tc.status in ('open', 'acknowledged')
  ) into v_bill_requested;

  return pg_catalog.jsonb_build_object(
    'businessId', v_biz.id,
    'businessName', v_biz.name,
    'tableId', v_table.id,
    'tableNumber', v_table.table_number,
    'tableKey', v_table.table_key,
    'locationType', coalesce(v_table.location_type, 'table'),
    'occupiedSince', v_table.occupied_since,
    'orders', v_orders,
    'orderCount', pg_catalog.jsonb_array_length(v_orders),
    'subtotalPaise', v_subtotal,
    'gstPercent', v_gst_pct,
    'gstPaise', v_gst_paise,
    'cgstPaise', v_cgst_paise,
    'sgstPaise', v_sgst_paise,
    'serviceChargePercent', v_sc_pct,
    'serviceChargePaise', v_sc_paise,
    'grandTotalPaise', v_grand_total,
    'currencyCode', coalesce(v_profile.currency_code, 'INR'),
    'gstin', v_profile.gstin,
    'upiId', v_profile.upi_id,
    'upiPayeeName', coalesce(v_profile.upi_payee_name, v_biz.name),
    'paymentStatus', v_payment_status,
    'paymentMethod', v_latest_paid_method,
    'paidAt', v_latest_paid_at,
    'billRequested', v_bill_requested,
    'isCheckedOut', v_is_checked_out
  );
end;
$$;

revoke all on function public.get_open_table_bill_summary(text, text) from public;
grant execute on function public.get_open_table_bill_summary(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 15. NEW RPC 5: mark_table_bill_upi_pending (Guest taps "I've Paid via UPI")
-- ============================================================================
create or replace function public.mark_table_bill_upi_pending(
  p_slug text,
  p_table_key text,
  p_guest_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_key text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_table_key, '')));
  v_biz record;
  v_table record;
  v_count integer := 0;
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  select rt.id, rt.table_number into v_table
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.table_key = v_clean_key
   limit 1;

  if not found then
    raise exception 'Table or room not found.' using errcode = 'P0002';
  end if;

  update public.restaurant_table_orders
     set payment_status = 'upi_pending_verify',
         payment_method = 'upi',
         updated_at = pg_catalog.clock_timestamp()
   where business_id = v_biz.id
     and table_id = v_table.id
     and status <> 'cancelled'
     and payment_status = 'unpaid';

  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.restaurant_table_messages (
      business_id, table_id, sender_role, sender_name, message_text, is_read
    ) values (
      v_biz.id,
      v_table.id,
      'system',
      coalesce(nullif(pg_catalog.btrim(coalesce(p_guest_name, '')), ''), 'Guest'),
      'UPI payment submitted — staff verifying payment for checkout',
      false
    );
  end if;

  return public.get_open_table_bill_summary(v_clean_slug, v_clean_key);
end;
$$;

revoke all on function public.mark_table_bill_upi_pending(text, text, text) from public;
grant execute on function public.mark_table_bill_upi_pending(text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 16. NEW RPC 6: complete_table_bill_checkout (Settle Open Bill + Reset Table)
-- ============================================================================
create or replace function public.complete_table_bill_checkout(
  p_business_id uuid,
  p_table_id uuid,
  p_payment_method text default 'cash',
  p_staff_label text default 'Owner',
  p_staff_pin_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_method text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payment_method, 'cash')));
  v_staff text;
  v_biz record;
  v_table record;
  v_session_id uuid;
  v_settled_count integer := 0;
begin
  if v_method not in ('cash', 'upi', 'card', 'platform_prepaid') then
    raise exception 'Invalid payment method.' using errcode = '22023';
  end if;

  if not public.is_owner_or_valid_staff_pin(p_business_id, p_staff_pin_hash) then
    raise exception 'Unauthorized: owner session or valid Staff PIN required.' using errcode = '42501';
  end if;

  select b.id, b.slug into v_biz
    from public.businesses b
   where b.id = p_business_id
   limit 1;

  if not found then
    raise exception 'Business not found.' using errcode = 'P0002';
  end if;

  select rt.* into v_table
    from public.restaurant_tables rt
   where rt.id = p_table_id
     and rt.business_id = p_business_id
   limit 1;

  if not found then
    raise exception 'Table or room not found for this business.' using errcode = 'P0002';
  end if;

  v_staff := public.resolve_staff_member_label(p_business_id, p_staff_pin_hash, coalesce(p_staff_label, 'Owner'));

  select coalesce(
    (
      select o.bill_session_id from public.restaurant_table_orders o
       where o.business_id = p_business_id
         and o.table_id = p_table_id
         and o.status <> 'cancelled'
         and o.payment_status <> 'paid'
         and o.bill_session_id is not null
       order by o.created_at desc
       limit 1
    ),
    gen_random_uuid()
  ) into v_session_id;

  update public.restaurant_table_orders
     set status = 'served',
         payment_status = 'paid',
         payment_method = v_method,
         paid_at = pg_catalog.clock_timestamp(),
         bill_session_id = coalesce(bill_session_id, v_session_id),
         approved_by = coalesce(approved_by, v_staff),
         updated_at = pg_catalog.clock_timestamp()
   where business_id = p_business_id
     and table_id = p_table_id
     and status <> 'cancelled'
     and payment_status <> 'paid';

  get diagnostics v_settled_count = row_count;

  -- Resolve open bill requests on this table/room
  update public.restaurant_table_calls
     set status = 'resolved',
         resolved_at = pg_catalog.clock_timestamp()
   where business_id = p_business_id
     and table_id = p_table_id
     and call_type in ('bill_request', 'ready_for_bill')
     and status in ('open', 'acknowledged');

  -- Return table/room to Available / Ready for Guests
  update public.restaurant_tables
     set occupied_since = null
   where id = p_table_id
     and business_id = p_business_id;

  -- Post confirmation message into live guest chat thread
  insert into public.restaurant_table_messages (
    business_id, table_id, sender_role, sender_name, message_text, is_read
  ) values (
    p_business_id,
    p_table_id,
    'system',
    v_staff,
    'Checkout approved — your final bill is ready to download under View Bill',
    true
  );

  return pg_catalog.jsonb_build_object(
    'settledOrdersCount', v_settled_count,
    'billSummary', public.get_open_table_bill_summary(v_biz.slug, v_table.table_key)
  );
end;
$$;

revoke all on function public.complete_table_bill_checkout(uuid, uuid, text, text, text) from public;
grant execute on function public.complete_table_bill_checkout(uuid, uuid, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 17. UPGRADE RPC: get_public_restaurant_menu (adds new profile, table & item fields)
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
  v_table_loc text := null;
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
         rp.business_mode, rp.upi_id, rp.upi_payee_name, rp.gstin,
         rp.gst_percent, rp.service_charge_percent, rp.voice_alerts_enabled,
         rp.accepting_orders, rp.hotel_rooms_enabled, rp.updated_at
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
      'locationType', coalesce(rt.location_type, 'table'),
      'seatCapacity', coalesce(rt.seat_capacity, 4),
      'occupiedSince', rt.occupied_since,
      'isActive', rt.is_active
    ),
    coalesce(rt.location_type, 'table')
      into v_table, v_table_loc
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
        'displayOrder', i.display_order,
        'showOnTable', coalesce(i.show_on_table, true),
        'showOnRoom', coalesce(i.show_on_room, true),
        'spiceLevel', i.spice_level,
        'ingredientsSummary', i.ingredients_summary,
        'prepTimeMinutes', i.prep_time_minutes
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
     and i.is_available = true
     and (
       v_table_loc is null
       or (v_table_loc = 'table' and coalesce(i.show_on_table, true) = true)
       or (v_table_loc = 'room' and coalesce(i.show_on_room, true) = true)
     );

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
      'businessMode', coalesce(v_profile.business_mode, 'restaurant'),
      'customLogoUrl', v_profile.custom_logo_url,
      'customAccentColor', v_profile.custom_accent_color,
      'upiId', v_profile.upi_id,
      'upiPayeeName', v_profile.upi_payee_name,
      'gstin', v_profile.gstin,
      'gstPercent', coalesce(v_profile.gst_percent, 0),
      'serviceChargePercent', coalesce(v_profile.service_charge_percent, 0),
      'voiceAlertsEnabled', coalesce(v_profile.voice_alerts_enabled, true),
      'acceptingOrders', coalesce(v_profile.accepting_orders, true),
      'hotelRoomsEnabled', coalesce(v_profile.hotel_rooms_enabled, false),
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

-- ============================================================================
-- 18. UPGRADE RPC: get_restaurant_floor_and_analytics
--     Includes all active/unpaid/recent orders (incl. 'ready' & platform),
--     assigned_staff_label on calls, enriched tables/rooms, and recent chat msgs.
-- ============================================================================
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
  v_business_mode text := 'restaurant';
  v_calls jsonb := '[]'::jsonb;
  v_pending_claims jsonb := '[]'::jsonb;
  v_table_orders jsonb := '[]'::jsonb;
  v_recent_orders jsonb := '[]'::jsonb;
  v_table_messages jsonb := '[]'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_staff_counts_today jsonb := '{}'::jsonb;
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

  select coalesce(rp.table_ordering_enabled, false),
         coalesce(rp.business_mode, 'restaurant')
    into v_ordering_enabled, v_business_mode
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
   limit 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', rt.id,
        'businessId', rt.business_id,
        'tableNumber', rt.table_number,
        'tableLabel', rt.table_label,
        'tableKey', rt.table_key,
        'locationType', coalesce(rt.location_type, 'table'),
        'seatCapacity', coalesce(rt.seat_capacity, 4),
        'occupiedSince', rt.occupied_since,
        'isActive', rt.is_active
      )
      order by rt.location_type asc, rt.table_number asc
    ),
    '[]'::jsonb
  )
    into v_tables
    from public.restaurant_tables rt
   where rt.business_id = v_biz.id
     and rt.is_active = true;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', tc.id,
        'businessId', tc.business_id,
        'tableId', tc.table_id,
        'tableNumber', coalesce(rt.table_number, 'Table'),
        'tableKey', coalesce(rt.table_key, ''),
        'locationType', coalesce(rt.location_type, 'table'),
        'customerId', tc.customer_id,
        'callType', tc.call_type,
        'status', tc.status,
        'assignedStaffLabel', tc.assigned_staff_label,
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

  -- Active kitchen orders only (preserves exact contract: served clears kitchen queue)
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'businessId', o.business_id,
        'tableId', o.table_id,
        'tableNumber', rt.table_number,
        'tableKey', rt.table_key,
        'locationType', coalesce(rt.location_type, 'table'),
        'customerId', o.customer_id,
        'guestName', o.guest_name,
        'items', o.items,
        'status', o.status,
        'orderSource', coalesce(o.order_source, 'qr_table'),
        'platformOrderNumber', o.platform_order_number,
        'packagingPaise', coalesce(o.packaging_paise, 0),
        'kitchenNote', o.kitchen_note,
        'billSessionId', o.bill_session_id,
        'paymentStatus', coalesce(o.payment_status, 'unpaid'),
        'paymentMethod', o.payment_method,
        'paidAt', o.paid_at,
        'customerRepeatVisitCount', coalesce(o.customer_repeat_visit_count, 1),
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
         and rto.status in ('pending_approval', 'approved_for_kitchen', 'preparing', 'ready')
       order by rto.created_at desc
       limit 80
    ) o
    left join public.restaurant_tables rt on rt.id = o.table_id;

  -- All unpaid open-table orders + recent 24h served/paid/platform orders
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'businessId', o.business_id,
        'tableId', o.table_id,
        'tableNumber', rt.table_number,
        'tableKey', rt.table_key,
        'locationType', coalesce(rt.location_type, 'table'),
        'customerId', o.customer_id,
        'guestName', o.guest_name,
        'items', o.items,
        'status', o.status,
        'orderSource', coalesce(o.order_source, 'qr_table'),
        'platformOrderNumber', o.platform_order_number,
        'packagingPaise', coalesce(o.packaging_paise, 0),
        'kitchenNote', o.kitchen_note,
        'billSessionId', o.bill_session_id,
        'paymentStatus', coalesce(o.payment_status, 'unpaid'),
        'paymentMethod', o.payment_method,
        'paidAt', o.paid_at,
        'customerRepeatVisitCount', coalesce(o.customer_repeat_visit_count, 1),
        'approvedBy', o.approved_by,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
    into v_recent_orders
    from (
      select *
        from public.restaurant_table_orders rto
       where rto.business_id = v_biz.id
         and (
           rto.status in ('pending_approval', 'approved_for_kitchen', 'preparing', 'ready')
           or (rto.status = 'served' and rto.payment_status <> 'paid')
           or (rto.created_at >= pg_catalog.clock_timestamp() - interval '24 hours')
         )
       order by rto.created_at desc
       limit 120
    ) o
    left join public.restaurant_tables rt on rt.id = o.table_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', m.id,
        'businessId', m.business_id,
        'tableId', m.table_id,
        'tableNumber', coalesce(rt.table_number, 'Table'),
        'tableKey', coalesce(rt.table_key, ''),
        'locationType', coalesce(rt.location_type, 'table'),
        'senderRole', m.sender_role,
        'senderName', m.sender_name,
        'messageText', m.message_text,
        'isRead', m.is_read,
        'createdAt', m.created_at
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
    into v_table_messages
    from (
      select * from public.restaurant_table_messages rtm
       where rtm.business_id = v_biz.id
         and rtm.created_at >= pg_catalog.clock_timestamp() - interval '24 hours'
       order by rtm.created_at desc
       limit 150
    ) m
    left join public.restaurant_tables rt on rt.id = m.table_id;

  select coalesce(
    pg_catalog.jsonb_object_agg(agg.verified_by_label, agg.cnt),
    '{}'::jsonb
  )
    into v_staff_counts_today
    from (
      select vv.verified_by_label, count(*)::integer as cnt
        from public.restaurant_verified_visits vv
       where vv.business_id = v_biz.id
         and vv.created_at >= date_trunc('day', pg_catalog.now() at time zone 'UTC')
       group by vv.verified_by_label
    ) agg;

  select count(*)::bigint into v_qr_scans
    from public.analytics_events ae
   where ae.business_id = v_biz.id
     and ae.event_type = 'qr_scan';

  select count(distinct cid)::bigint into v_checked_in_diners
    from (
      select customer_id as cid from public.restaurant_game_sessions where business_id = v_biz.id
      union
      select customer_id as cid from public.restaurant_verified_visits where business_id = v_biz.id
      union
      select customer_id as cid from public.restaurant_loyalty_star_transactions where business_id = v_biz.id
    ) u;

  select count(*)::bigint into v_games_played
    from public.restaurant_game_sessions gs
   where gs.business_id = v_biz.id
     and gs.status = 'completed';

  select coalesce(sum(gp.points_delta), 0)::bigint into v_game_points_issued
    from public.restaurant_game_point_transactions gp
   where gp.business_id = v_biz.id
     and gp.tx_type = 'game_win';

  select count(*)::bigint into v_verified_visits
    from public.restaurant_verified_visits vv
   where vv.business_id = v_biz.id;

  select coalesce(sum(ls.stars_delta), 0)::bigint into v_stars_issued
    from public.restaurant_loyalty_star_transactions ls
   where ls.business_id = v_biz.id
     and ls.stars_delta > 0;

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
    'businessMode', v_business_mode,
    'tableOrders', v_table_orders,
    'recentOrders', v_recent_orders,
    'tableMessages', v_table_messages,
    'tables', v_tables,
    'staffVerificationCountsToday', v_staff_counts_today,
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
