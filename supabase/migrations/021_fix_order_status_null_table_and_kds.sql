-- ============================================================================
-- Migration 021: Fix update_table_order_status & update_restaurant_table_call_status
--                for NULL table_id orders (Swiggy, Zomato, Takeaway, Delivery,
--                and General Menu QR orders)
-- Depends on: 001..020
--
-- Root Cause Fixed:
--   Migration 019 declared a composite record variable for table lookup and only
--   populated it when table_id was non-null. For off-premise orders (Swiggy,
--   Zomato, Phone, Takeaway, Delivery) or general-menu QR orders where table_id
--   IS NULL, accessing fields on that unassigned composite variable threw
--   PostgreSQL ERROR 55000 and rolled back the status update on both Main
--   Dashboard and Dark-Mode Chef KDS.
--
-- Fix:
--   Use explicit nullable scalar variables (`v_table_number`, `v_table_key`,
--   `v_location_type`) initialized to NULL/'table', eliminating any possibility
--   of unassigned record access.
-- ============================================================================

begin;

-- 1. Fix public.update_table_order_status (100% safe when table_id IS NULL)
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
  v_table_number text := null;
  v_table_key text := null;
  v_location_type text := 'table';
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
    select rt.table_number, rt.table_key, coalesce(rt.location_type, 'table')
      into v_table_number, v_table_key, v_location_type
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
    'tableNumber', v_table_number,
    'tableKey', v_table_key,
    'locationType', coalesce(v_location_type, 'table'),
    'customerId', v_updated.customer_id,
    'guestName', v_updated.guest_name,
    'items', v_updated.items,
    'status', v_updated.status,
    'orderSource', coalesce(v_updated.order_source, 'qr_table'),
    'platformOrderNumber', v_updated.platform_order_number,
    'packagingPaise', coalesce(v_updated.packaging_paise, 0),
    'kitchenNote', v_updated.kitchen_note,
    'billSessionId', v_updated.bill_session_id,
    'paymentStatus', coalesce(v_updated.payment_status, 'unpaid'),
    'paymentMethod', v_updated.payment_method,
    'paidAt', v_updated.paid_at,
    'customerRepeatVisitCount', coalesce(v_updated.customer_repeat_visit_count, 1),
    'approvedBy', v_updated.approved_by,
    'createdAt', v_updated.created_at,
    'updatedAt', v_updated.updated_at
  );
end;
$$;

revoke all on function public.update_table_order_status(text, uuid, text, text, text) from public;
grant execute on function public.update_table_order_status(text, uuid, text, text, text) to anon, authenticated, service_role;

-- 2. Harden public.update_restaurant_table_call_status with scalar variables too
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
  v_table_number text := null;
  v_table_key text := null;
  v_location_type text := 'table';
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

  if v_updated.table_id is not null then
    select rt.table_number, rt.table_key, coalesce(rt.location_type, 'table')
      into v_table_number, v_table_key, v_location_type
      from public.restaurant_tables rt
     where rt.id = v_updated.table_id
     limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'businessId', v_updated.business_id,
    'tableId', v_updated.table_id,
    'tableNumber', coalesce(v_table_number, 'Table'),
    'tableKey', coalesce(v_table_key, ''),
    'locationType', coalesce(v_location_type, 'table'),
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

commit;
