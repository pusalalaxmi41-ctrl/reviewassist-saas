-- ============================================================================
-- Migration 020: Interactive Custom Floor Plan Studio & Waiter Order Flow
-- Depends on: 001..019
--
--   1. Adds custom Room Dimensions (floor_width_ft x floor_height_ft) on
--      public.restaurant_profiles.
--   2. Adds custom spatial coordinates & geometry (table_shape, pos_x, pos_y,
--      width_units, height_units) on public.restaurant_tables.
--   3. Adds owner-verified atomic RPC public.save_restaurant_floor_layout.
--   4. Upgrades public.get_restaurant_floor_and_analytics (derived directly
--      from live Migration 019) to return floorWidthFt, floorHeightFt, and
--      table layout coordinates (tableShape, posX, posY, widthUnits, heightUnits).
--
-- SQL Guardrails:
--   - Idempotent DDL (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS)
--   - Uses pg_catalog.substr only (strict PostgreSQL compliance)
--   - set search_path = pg_catalog, public, pg_temp on every SECURITY DEFINER RPC
-- ============================================================================

begin;

-- 1. Extend public.restaurant_profiles with room canvas dimensions
alter table public.restaurant_profiles
  add column if not exists floor_width_ft integer not null default 40,
  add column if not exists floor_height_ft integer not null default 28;

alter table public.restaurant_profiles
  drop constraint if exists rp_floor_width_chk,
  drop constraint if exists rp_floor_height_chk;

alter table public.restaurant_profiles
  add constraint rp_floor_width_chk check (floor_width_ft between 10 and 300),
  add constraint rp_floor_height_chk check (floor_height_ft between 10 and 300);

-- 2. Extend public.restaurant_tables with spatial floor plan coordinates & geometry
alter table public.restaurant_tables
  add column if not exists table_shape text not null default 'rectangle',
  add column if not exists pos_x numeric(6,2),
  add column if not exists pos_y numeric(6,2),
  add column if not exists width_units numeric(5,2) not null default 14,
  add column if not exists height_units numeric(5,2) not null default 14;

alter table public.restaurant_tables
  drop constraint if exists rt_table_shape_chk,
  drop constraint if exists rt_pos_x_chk,
  drop constraint if exists rt_pos_y_chk,
  drop constraint if exists rt_width_units_chk,
  drop constraint if exists rt_height_units_chk;

alter table public.restaurant_tables
  add constraint rt_table_shape_chk check (table_shape in ('square', 'rectangle', 'round')),
  add constraint rt_pos_x_chk check (pos_x is null or (pos_x >= 0 and pos_x <= 100)),
  add constraint rt_pos_y_chk check (pos_y is null or (pos_y >= 0 and pos_y <= 100)),
  add constraint rt_width_units_chk check (width_units >= 6 and width_units <= 45),
  add constraint rt_height_units_chk check (height_units >= 6 and height_units <= 45);

-- 3. Atomic owner RPC to persist floor dimensions + all dragged table coordinates in 1 roundtrip
create or replace function public.save_restaurant_floor_layout(
  p_business_id uuid,
  p_floor_width_ft integer default 40,
  p_floor_height_ft integer default 28,
  p_tables jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_w integer := greatest(10, least(300, coalesce(p_floor_width_ft, 40)));
  v_h integer := greatest(10, least(300, coalesce(p_floor_height_ft, 28)));
  v_elem jsonb;
  v_tbl_id uuid;
  v_shape text;
  v_x numeric(6,2);
  v_y numeric(6,2);
  v_wu numeric(5,2);
  v_hu numeric(5,2);
  v_seats integer;
  v_updated_count integer := 0;
begin
  if not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: only the business owner can customize the floor layout.' using errcode = '42501';
  end if;

  update public.restaurant_profiles
     set floor_width_ft = v_w,
         floor_height_ft = v_h,
         updated_at = pg_catalog.clock_timestamp()
   where business_id = p_business_id;

  if p_tables is not null and pg_catalog.jsonb_typeof(p_tables) = 'array' then
    for v_elem in select * from pg_catalog.jsonb_array_elements(p_tables) loop
      begin
        v_tbl_id := (v_elem ->> 'id')::uuid;
      exception when others then
        continue;
      end;

      v_shape := pg_catalog.lower(pg_catalog.btrim(coalesce(v_elem ->> 'tableShape', 'rectangle')));
      if v_shape not in ('square', 'rectangle', 'round') then
        v_shape := 'rectangle';
      end if;

      v_x := greatest(0, least(94, coalesce((v_elem ->> 'posX')::numeric, 4)));
      v_y := greatest(0, least(90, coalesce((v_elem ->> 'posY')::numeric, 4)));
      v_wu := greatest(6, least(45, coalesce((v_elem ->> 'widthUnits')::numeric, 14)));
      v_hu := greatest(6, least(45, coalesce((v_elem ->> 'heightUnits')::numeric, 14)));
      v_seats := greatest(1, least(30, coalesce((v_elem ->> 'seatCapacity')::integer, 4)));

      update public.restaurant_tables
         set table_shape = v_shape,
             pos_x = v_x,
             pos_y = v_y,
             width_units = v_wu,
             height_units = v_hu,
             seat_capacity = v_seats,
             updated_at = pg_catalog.clock_timestamp()
       where id = v_tbl_id
         and business_id = p_business_id;

      if found then
        v_updated_count := v_updated_count + 1;
      end if;
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'floorWidthFt', v_w,
    'floorHeightFt', v_h,
    'updatedTablesCount', v_updated_count
  );
end;
$$;

revoke all on function public.save_restaurant_floor_layout(uuid, integer, integer, jsonb) from public;
grant execute on function public.save_restaurant_floor_layout(uuid, integer, integer, jsonb) to authenticated, service_role;

-- 4. Upgrade get_restaurant_floor_and_analytics (100% column-aligned with live Migration 019)
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
  v_floor_w integer := 40;
  v_floor_h integer := 28;
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
         coalesce(rp.business_mode, 'restaurant'),
         coalesce(rp.floor_width_ft, 40),
         coalesce(rp.floor_height_ft, 28)
    into v_ordering_enabled, v_business_mode, v_floor_w, v_floor_h
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
        'tableShape', coalesce(rt.table_shape, 'rectangle'),
        'posX', rt.pos_x,
        'posY', rt.pos_y,
        'widthUnits', coalesce(rt.width_units, 14),
        'heightUnits', coalesce(rt.height_units, 14),
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
    'floorWidthFt', v_floor_w,
    'floorHeightFt', v_floor_h,
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

revoke all on function public.get_restaurant_floor_and_analytics(text, text) from public;
grant execute on function public.get_restaurant_floor_and_analytics(text, text) to anon, authenticated, service_role;

commit;
