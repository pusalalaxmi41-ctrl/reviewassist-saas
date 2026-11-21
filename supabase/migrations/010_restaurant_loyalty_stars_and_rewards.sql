-- ============================================================================
-- ReviewAssist — Phase 3: Candour-Style Table Hub, Loyalty Stars Ledger,
--                         Point-to-Star Exchange & Reward Catalogue
-- File: supabase/migrations/010_restaurant_loyalty_stars_and_rewards.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying in Supabase SQL Editor.
--
-- Purpose:
-- 1. Creates normalized tables with ENABLE + FORCE ROW LEVEL SECURITY and
--    REVOKE ALL FROM public, anon:
--      - public.restaurant_loyalty_rules (1:1 per business)
--      - public.restaurant_loyalty_star_transactions (Immutable append-only ledger)
--      - public.restaurant_rewards (Owner-defined reward catalogue)
--      - public.restaurant_reward_claims (6-char claim tickets for staff verification)
--      - public.restaurant_suggestions (Private Suggestion Box messages from table guests)
-- 2. Enforces strict tenant isolation for business owners via
--    public.is_business_owner(business_id).
-- 3. Provides hardened SECURITY DEFINER RPC functions:
--      - public.exchange_game_points_for_star(...)
--      - public.claim_restaurant_reward(...)
--      - public.submit_restaurant_suggestion(...)
--    Plus upgrades public.register_or_resume_restaurant_customer and
--    public.get_public_restaurant_menu to include Loyalty Stars, rules, and rewards.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE: public.restaurant_loyalty_rules (1:1 per business)
-- ============================================================================
create table if not exists public.restaurant_loyalty_rules (
  business_id uuid primary key
    references public.businesses(id) on delete cascade,
  stars_per_verified_visit integer not null default 1,
  points_per_star_exchange integer not null default 100,
  allow_point_exchange boolean not null default true,
  max_stars_via_exchange_per_week integer not null default 2,
  wifi_network_name text,
  wifi_password text,
  suggestion_box_enabled boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint rlr_stars_per_visit_chk check (
    stars_per_verified_visit >= 1 and stars_per_verified_visit <= 50
  ),
  constraint rlr_points_per_star_chk check (
    points_per_star_exchange >= 1 and points_per_star_exchange <= 100000
  ),
  constraint rlr_max_weekly_exchange_chk check (
    max_stars_via_exchange_per_week >= 0 and max_stars_via_exchange_per_week <= 100
  ),
  constraint rlr_wifi_ssid_len_chk check (
    wifi_network_name is null or pg_catalog.char_length(pg_catalog.btrim(wifi_network_name)) <= 80
  ),
  constraint rlr_wifi_pass_len_chk check (
    wifi_password is null or pg_catalog.char_length(pg_catalog.btrim(wifi_password)) <= 120
  )
);

comment on table public.restaurant_loyalty_rules is
  'Owner-configured loyalty economy rules, point-to-star exchange rate, weekly cap, guest Wi-Fi, and suggestion box toggle.';

-- ============================================================================
-- 2. TABLE: public.restaurant_loyalty_star_transactions (IMMUTABLE LEDGER)
-- ============================================================================
create table if not exists public.restaurant_loyalty_star_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  customer_id uuid not null
    references public.restaurant_customers(id) on delete cascade,
  tx_type text not null,
  stars_delta integer not null,
  balance_after integer not null,
  idempotency_key text not null,
  verified_by_staff_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),

  constraint rlst_tx_type_chk check (
    tx_type in (
      'verified_visit',
      'game_point_exchange',
      'reward_redeemed',
      'owner_adjustment',
      'expired'
    )
  ),
  constraint rlst_balance_non_negative_chk check (
    balance_after >= 0
  ),
  constraint rlst_idempotency_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(idempotency_key)) between 4 and 160
  ),
  constraint rlst_unique_idempotency_per_business unique (business_id, idempotency_key)
);

create index if not exists idx_rlst_biz_customer_time
  on public.restaurant_loyalty_star_transactions (business_id, customer_id, created_at desc);

-- Append-only immutability trigger on Loyalty Star ledger
create or replace function public.prevent_loyalty_star_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception 'public.restaurant_loyalty_star_transactions is an immutable ledger and cannot be updated or deleted'
    using errcode = '42501';
end;
$fn$;

revoke all on function public.prevent_loyalty_star_ledger_mutation() from public, anon, authenticated, service_role;

drop trigger if exists trg_rlst_immutable on public.restaurant_loyalty_star_transactions;
create trigger trg_rlst_immutable
  before update or delete on public.restaurant_loyalty_star_transactions
  for each row
  execute function public.prevent_loyalty_star_ledger_mutation();

-- ============================================================================
-- 3. TABLE: public.restaurant_rewards
-- ============================================================================
create table if not exists public.restaurant_rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  stars_required integer not null default 5,
  is_active boolean not null default true,
  max_redemptions_total integer,
  redemptions_count integer not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint rr_title_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 100
  ),
  constraint rr_desc_len_chk check (
    description is null or pg_catalog.char_length(pg_catalog.btrim(description)) <= 260
  ),
  constraint rr_stars_required_chk check (
    stars_required >= 1 and stars_required <= 1000
  ),
  constraint rr_max_redemptions_chk check (
    max_redemptions_total is null or max_redemptions_total >= 1
  ),
  constraint rr_redemptions_count_chk check (
    redemptions_count >= 0
  )
);

create index if not exists idx_restaurant_rewards_biz_order
  on public.restaurant_rewards (business_id, is_active, display_order asc, stars_required asc);

-- ============================================================================
-- 4. TABLE: public.restaurant_reward_claims
-- ============================================================================
create table if not exists public.restaurant_reward_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  customer_id uuid not null
    references public.restaurant_customers(id) on delete cascade,
  reward_id uuid not null
    references public.restaurant_rewards(id) on delete restrict,
  claim_code text not null,
  stars_spent integer not null,
  status text not null default 'pending_staff_verification',
  fulfilled_at timestamptz,
  fulfilled_by text,
  created_at timestamptz not null default pg_catalog.now(),

  constraint rrc_claim_code_format_chk check (
    claim_code ~ '^[A-Z0-9]{6}$'
  ),
  constraint rrc_stars_spent_chk check (
    stars_spent >= 1 and stars_spent <= 1000
  ),
  constraint rrc_status_chk check (
    status in ('pending_staff_verification', 'fulfilled', 'cancelled')
  ),
  constraint rrc_unique_code_per_business unique (business_id, claim_code)
);

create index if not exists idx_restaurant_reward_claims_biz_customer
  on public.restaurant_reward_claims (business_id, customer_id, created_at desc);

-- ============================================================================
-- 5. TABLE: public.restaurant_suggestions
-- ============================================================================
create table if not exists public.restaurant_suggestions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_id uuid
    references public.restaurant_tables(id) on delete set null,
  customer_name text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),

  constraint rs_name_len_chk check (
    customer_name is null or pg_catalog.char_length(pg_catalog.btrim(customer_name)) <= 80
  ),
  constraint rs_message_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(message)) between 2 and 1000
  )
);

create index if not exists idx_restaurant_suggestions_biz_time
  on public.restaurant_suggestions (business_id, is_read, created_at desc);

drop trigger if exists trg_restaurant_loyalty_rules_updated_at on public.restaurant_loyalty_rules;
create trigger trg_restaurant_loyalty_rules_updated_at
  before update on public.restaurant_loyalty_rules
  for each row
  execute function public.touch_restaurant_updated_at();

drop trigger if exists trg_restaurant_rewards_updated_at on public.restaurant_rewards;
create trigger trg_restaurant_rewards_updated_at
  before update on public.restaurant_rewards
  for each row
  execute function public.touch_restaurant_updated_at();

-- ============================================================================
-- 6. GRANTS & ROW LEVEL SECURITY
-- ============================================================================
alter table public.restaurant_loyalty_rules enable row level security;
alter table public.restaurant_loyalty_rules force row level security;

alter table public.restaurant_loyalty_star_transactions enable row level security;
alter table public.restaurant_loyalty_star_transactions force row level security;

alter table public.restaurant_rewards enable row level security;
alter table public.restaurant_rewards force row level security;

alter table public.restaurant_reward_claims enable row level security;
alter table public.restaurant_reward_claims force row level security;

alter table public.restaurant_suggestions enable row level security;
alter table public.restaurant_suggestions force row level security;

revoke all on table
  public.restaurant_loyalty_rules,
  public.restaurant_loyalty_star_transactions,
  public.restaurant_rewards,
  public.restaurant_reward_claims,
  public.restaurant_suggestions
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.restaurant_loyalty_rules,
  public.restaurant_rewards
to authenticated;

grant select on table
  public.restaurant_loyalty_star_transactions
to authenticated;

grant select, update on table
  public.restaurant_reward_claims,
  public.restaurant_suggestions
to authenticated;

grant all on table
  public.restaurant_loyalty_rules,
  public.restaurant_loyalty_star_transactions,
  public.restaurant_rewards,
  public.restaurant_reward_claims,
  public.restaurant_suggestions
to service_role;

-- 6a. Owner RLS Policies for restaurant_loyalty_rules
drop policy if exists rlr_owner_select on public.restaurant_loyalty_rules;
create policy rlr_owner_select on public.restaurant_loyalty_rules
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rlr_owner_insert on public.restaurant_loyalty_rules;
create policy rlr_owner_insert on public.restaurant_loyalty_rules
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists rlr_owner_update on public.restaurant_loyalty_rules;
create policy rlr_owner_update on public.restaurant_loyalty_rules
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rlr_owner_delete on public.restaurant_loyalty_rules;
create policy rlr_owner_delete on public.restaurant_loyalty_rules
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- 6b. Owner RLS Policies for restaurant_rewards
drop policy if exists rr_owner_select on public.restaurant_rewards;
create policy rr_owner_select on public.restaurant_rewards
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rr_owner_insert on public.restaurant_rewards;
create policy rr_owner_insert on public.restaurant_rewards
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists rr_owner_update on public.restaurant_rewards;
create policy rr_owner_update on public.restaurant_rewards
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rr_owner_delete on public.restaurant_rewards;
create policy rr_owner_delete on public.restaurant_rewards
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- 6c. Owner RLS Policies for restaurant_loyalty_star_transactions (Read-Only)
drop policy if exists rlst_owner_select on public.restaurant_loyalty_star_transactions;
create policy rlst_owner_select on public.restaurant_loyalty_star_transactions
  for select to authenticated
  using (public.is_business_owner(business_id));

-- 6d. Owner RLS Policies for restaurant_reward_claims & restaurant_suggestions
drop policy if exists rrc_owner_select on public.restaurant_reward_claims;
create policy rrc_owner_select on public.restaurant_reward_claims
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rrc_owner_update on public.restaurant_reward_claims;
create policy rrc_owner_update on public.restaurant_reward_claims
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists rs_owner_select on public.restaurant_suggestions;
create policy rs_owner_select on public.restaurant_suggestions
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rs_owner_update on public.restaurant_suggestions;
create policy rs_owner_update on public.restaurant_suggestions
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 7. RPC 1: public.exchange_game_points_for_star
--    Atomically converts `points_per_star_exchange` Game Points into +1
--    Loyalty Star, enforcing `allow_point_exchange`, weekly cap
--    (`max_stars_via_exchange_per_week`), sufficient balance, and idempotency.
-- ============================================================================
create or replace function public.exchange_game_points_for_star(
  p_slug text,
  p_customer_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_idem text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_biz record;
  v_profile record;
  v_rules record;
  v_existing_star_tx public.restaurant_loyalty_star_transactions%rowtype;
  v_existing_pt_tx public.restaurant_game_point_transactions%rowtype;
  v_current_points integer := 0;
  v_current_stars integer := 0;
  v_exchanged_this_week integer := 0;
  v_new_points integer := 0;
  v_new_stars integer := 0;
begin
  if p_customer_id is null then
    raise exception 'Customer check-in is required.' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_clean_idem) < 4 or pg_catalog.char_length(v_clean_idem) > 160 then
    raise exception 'A valid idempotency key (4..160 chars) is required.' using errcode = '22023';
  end if;

  select b.id, b.slug into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  select rp.* into v_profile
    from public.restaurant_profiles rp
   where rp.business_id = v_biz.id
     and rp.is_enabled = true
     and rp.loyalty_enabled = true
   limit 1;

  if not found then
    raise exception 'Loyalty Stars are currently disabled for this restaurant.' using errcode = '42501';
  end if;

  -- Idempotency check: if already processed, return the stored balances without double-exchanging
  select * into v_existing_star_tx
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.idempotency_key = v_clean_idem
   limit 1;

  if found then
    select coalesce(pt.balance_after, 0) into v_current_points
      from public.restaurant_game_point_transactions pt
     where pt.business_id = v_biz.id
       and pt.customer_id = p_customer_id
     order by pt.created_at desc
     limit 1;

    return pg_catalog.jsonb_build_object(
      'alreadyProcessed', true,
      'pointsSpent', 0,
      'starsEarned', v_existing_star_tx.stars_delta,
      'newGamePointsBalance', coalesce(v_current_points, 0),
      'newLoyaltyStarsBalance', v_existing_star_tx.balance_after,
      'starTransactionId', v_existing_star_tx.id
    );
  end if;

  -- Load loyalty rules (or defaults if row not created yet)
  select lr.* into v_rules
    from public.restaurant_loyalty_rules lr
   where lr.business_id = v_biz.id
   limit 1;

  if not found then
    select
      1 as stars_per_verified_visit,
      100 as points_per_star_exchange,
      true as allow_point_exchange,
      2 as max_stars_via_exchange_per_week
    into v_rules;
  end if;

  if not v_rules.allow_point_exchange then
    raise exception 'Point-to-Star exchange is disabled by this restaurant.' using errcode = '42501';
  end if;

  -- Weekly exchange cap check (rolling 7 days)
  select coalesce(sum(st.stars_delta), 0)::integer
    into v_exchanged_this_week
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.customer_id = p_customer_id
     and st.tx_type = 'game_point_exchange'
     and st.created_at >= (pg_catalog.clock_timestamp() - interval '7 days');

  if v_exchanged_this_week >= v_rules.max_stars_via_exchange_per_week then
    raise exception 'Weekly Point-to-Star exchange limit (% star(s)/week) reached.', v_rules.max_stars_via_exchange_per_week
      using errcode = '42501';
  end if;

  -- Verify sufficient Game Points balance
  select coalesce(pt.balance_after, 0)
    into v_current_points
    from public.restaurant_game_point_transactions pt
   where pt.business_id = v_biz.id
     and pt.customer_id = p_customer_id
   order by pt.created_at desc
   limit 1;
  v_current_points := coalesce(v_current_points, 0);

  if v_current_points < v_rules.points_per_star_exchange then
    raise exception 'Insufficient Game Points: % pts required to exchange for 1 Loyalty Star (you have % pts).',
      v_rules.points_per_star_exchange, v_current_points
      using errcode = '22023';
  end if;

  select coalesce(st.balance_after, 0)
    into v_current_stars
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.customer_id = p_customer_id
   order by st.created_at desc
   limit 1;
  v_current_stars := coalesce(v_current_stars, 0);

  v_new_points := v_current_points - v_rules.points_per_star_exchange;
  v_new_stars := v_current_stars + 1;

  -- Atomic debit in Game-Points Ledger
  insert into public.restaurant_game_point_transactions (
    business_id,
    customer_id,
    session_id,
    tx_type,
    points_delta,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    v_biz.id,
    p_customer_id,
    null,
    'exchanged_for_star',
    -v_rules.points_per_star_exchange,
    v_new_points,
    v_clean_idem,
    pg_catalog.jsonb_build_object('starsEarned', 1)
  )
  returning * into v_existing_pt_tx;

  -- Atomic credit in Loyalty-Stars Ledger
  insert into public.restaurant_loyalty_star_transactions (
    business_id,
    customer_id,
    tx_type,
    stars_delta,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    v_biz.id,
    p_customer_id,
    'game_point_exchange',
    1,
    v_new_stars,
    v_clean_idem,
    pg_catalog.jsonb_build_object(
      'pointsSpent', v_rules.points_per_star_exchange,
      'pointTransactionId', v_existing_pt_tx.id
    )
  )
  returning * into v_existing_star_tx;

  return pg_catalog.jsonb_build_object(
    'alreadyProcessed', false,
    'pointsSpent', v_rules.points_per_star_exchange,
    'starsEarned', 1,
    'newGamePointsBalance', v_new_points,
    'newLoyaltyStarsBalance', v_new_stars,
    'starTransactionId', v_existing_star_tx.id
  );
end;
$$;

revoke all on function public.exchange_game_points_for_star(text, uuid, text) from public;
grant execute on function public.exchange_game_points_for_star(text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC 2: public.claim_restaurant_reward
--    Atomically verifies customer has enough Loyalty Stars, deducts
--    `stars_required` in `restaurant_loyalty_star_transactions`, increments
--    `redemptions_count`, and issues a 6-character claim code for staff.
-- ============================================================================
create or replace function public.claim_restaurant_reward(
  p_slug text,
  p_customer_id uuid,
  p_reward_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_idem text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_biz record;
  v_reward public.restaurant_rewards%rowtype;
  v_existing_tx public.restaurant_loyalty_star_transactions%rowtype;
  v_existing_claim public.restaurant_reward_claims%rowtype;
  v_current_stars integer := 0;
  v_new_stars integer := 0;
  v_claim_code text;
begin
  if p_customer_id is null or p_reward_id is null then
    raise exception 'Customer ID and Reward ID are required.' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_clean_idem) < 4 or pg_catalog.char_length(v_clean_idem) > 160 then
    raise exception 'A valid idempotency key (4..160 chars) is required.' using errcode = '22023';
  end if;

  select b.id, b.slug into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;

  if not found then
    raise exception 'Restaurant is not active.' using errcode = 'P0002';
  end if;

  -- Idempotency check
  select * into v_existing_tx
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.idempotency_key = v_clean_idem
   limit 1;

  if found then
    select * into v_existing_claim
      from public.restaurant_reward_claims rc
     where rc.business_id = v_biz.id
       and rc.customer_id = p_customer_id
       and rc.reward_id = p_reward_id
     order by rc.created_at desc
     limit 1;

    select * into v_reward
      from public.restaurant_rewards r
     where r.id = p_reward_id;

    return pg_catalog.jsonb_build_object(
      'alreadyProcessed', true,
      'newLoyaltyStarsBalance', v_existing_tx.balance_after,
      'claim', pg_catalog.jsonb_build_object(
        'id', v_existing_claim.id,
        'businessId', v_existing_claim.business_id,
        'customerId', v_existing_claim.customer_id,
        'rewardId', v_existing_claim.reward_id,
        'rewardTitle', coalesce(v_reward.title, 'Reward'),
        'claimCode', v_existing_claim.claim_code,
        'starsSpent', v_existing_claim.stars_spent,
        'status', v_existing_claim.status,
        'createdAt', v_existing_claim.created_at
      )
    );
  end if;

  select * into v_reward
    from public.restaurant_rewards r
   where r.id = p_reward_id
     and r.business_id = v_biz.id
     and r.is_active = true
     for update;

  if not found then
    raise exception 'Reward is not available.' using errcode = 'P0002';
  end if;

  if v_reward.max_redemptions_total is not null
     and v_reward.redemptions_count >= v_reward.max_redemptions_total
  then
    raise exception 'This reward has reached its maximum redemption limit.' using errcode = '42501';
  end if;

  select coalesce(st.balance_after, 0)
    into v_current_stars
    from public.restaurant_loyalty_star_transactions st
   where st.business_id = v_biz.id
     and st.customer_id = p_customer_id
   order by st.created_at desc
   limit 1;
  v_current_stars := coalesce(v_current_stars, 0);

  if v_current_stars < v_reward.stars_required then
    raise exception 'Insufficient Loyalty Stars: % Stars required (you have % Stars).',
      v_reward.stars_required, v_current_stars
      using errcode = '22023';
  end if;

  v_new_stars := v_current_stars - v_reward.stars_required;

  -- Generate 6-character uppercase alphanumeric claim code
  v_claim_code := pg_catalog.upper(
    pg_catalog.substring(pg_catalog.replace(gen_random_uuid()::text, '-', '') from 1 for 6)
  );

  insert into public.restaurant_loyalty_star_transactions (
    business_id,
    customer_id,
    tx_type,
    stars_delta,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    v_biz.id,
    p_customer_id,
    'reward_redeemed',
    -v_reward.stars_required,
    v_new_stars,
    v_clean_idem,
    pg_catalog.jsonb_build_object(
      'rewardId', v_reward.id,
      'rewardTitle', v_reward.title,
      'claimCode', v_claim_code
    )
  )
  returning * into v_existing_tx;

  insert into public.restaurant_reward_claims (
    business_id,
    customer_id,
    reward_id,
    claim_code,
    stars_spent,
    status
  )
  values (
    v_biz.id,
    p_customer_id,
    v_reward.id,
    v_claim_code,
    v_reward.stars_required,
    'pending_staff_verification'
  )
  returning * into v_existing_claim;

  update public.restaurant_rewards
     set redemptions_count = redemptions_count + 1
   where id = v_reward.id;

  return pg_catalog.jsonb_build_object(
    'alreadyProcessed', false,
    'newLoyaltyStarsBalance', v_new_stars,
    'claim', pg_catalog.jsonb_build_object(
      'id', v_existing_claim.id,
      'businessId', v_existing_claim.business_id,
      'customerId', v_existing_claim.customer_id,
      'rewardId', v_existing_claim.reward_id,
      'rewardTitle', v_reward.title,
      'claimCode', v_existing_claim.claim_code,
      'starsSpent', v_existing_claim.stars_spent,
      'status', v_existing_claim.status,
      'createdAt', v_existing_claim.created_at
    )
  );
end;
$$;

revoke all on function public.claim_restaurant_reward(text, uuid, uuid, text) from public;
grant execute on function public.claim_restaurant_reward(text, uuid, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. RPC 3: public.submit_restaurant_suggestion
--    Private Suggestion Box submission from a table guest to the owner.
-- ============================================================================
create or replace function public.submit_restaurant_suggestion(
  p_slug text,
  p_table_key text default null,
  p_customer_name text default null,
  p_message text default ''
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
  v_clean_name text := nullif(pg_catalog.btrim(coalesce(p_customer_name, '')), '');
  v_clean_msg text := pg_catalog.btrim(coalesce(p_message, ''));
  v_biz record;
  v_rules record;
  v_table_id uuid := null;
  v_inserted public.restaurant_suggestions%rowtype;
begin
  if pg_catalog.char_length(v_clean_msg) < 2 or pg_catalog.char_length(v_clean_msg) > 1000 then
    raise exception 'Suggestion message must be between 2 and 1000 characters.' using errcode = '22023';
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

  select lr.suggestion_box_enabled into v_rules
    from public.restaurant_loyalty_rules lr
   where lr.business_id = v_biz.id
   limit 1;

  if found and v_rules.suggestion_box_enabled = false then
    raise exception 'Suggestion box is currently disabled for this restaurant.' using errcode = '42501';
  end if;

  if v_clean_table_key is not null then
    select rt.id into v_table_id
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
     limit 1;
  end if;

  insert into public.restaurant_suggestions (
    business_id,
    table_id,
    customer_name,
    message
  )
  values (
    v_biz.id,
    v_table_id,
    case when v_clean_name is not null then pg_catalog.substring(v_clean_name from 1 for 80) else null end,
    v_clean_msg
  )
  returning * into v_inserted;

  return pg_catalog.jsonb_build_object(
    'id', v_inserted.id,
    'businessId', v_inserted.business_id,
    'tableId', v_inserted.table_id,
    'customerName', v_inserted.customer_name,
    'message', v_inserted.message,
    'isRead', v_inserted.is_read,
    'createdAt', v_inserted.created_at
  );
end;
$$;

revoke all on function public.submit_restaurant_suggestion(text, text, text, text) from public;
grant execute on function public.submit_restaurant_suggestion(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 10. UPGRADE register_or_resume_restaurant_customer & get_public_restaurant_menu
-- ============================================================================
create or replace function public.register_or_resume_restaurant_customer(
  p_display_name text,
  p_phone_or_email text default null,
  p_guest_token_hash text default null,
  p_business_slug text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_name text := pg_catalog.btrim(coalesce(p_display_name, 'Guest Diner'));
  v_clean_contact text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_phone_or_email, ''))), '');
  v_clean_token text := nullif(pg_catalog.btrim(coalesce(p_guest_token_hash, '')), '');
  v_clean_slug text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_business_slug, ''))), '');
  v_customer public.restaurant_customers%rowtype;
  v_biz_id uuid := null;
  v_points_balance integer := 0;
  v_stars_balance integer := 0;
  v_exchanged_this_week integer := 0;
  v_point_txs jsonb := '[]'::jsonb;
  v_star_txs jsonb := '[]'::jsonb;
  v_claims jsonb := '[]'::jsonb;
begin
  if pg_catalog.char_length(v_clean_name) < 1 then
    v_clean_name := 'Guest Diner';
  end if;
  if pg_catalog.char_length(v_clean_name) > 80 then
    v_clean_name := pg_catalog.substring(v_clean_name from 1 for 80);
  end if;

  if v_clean_contact is not null then
    select * into v_customer
      from public.restaurant_customers rc
     where rc.phone_or_email = v_clean_contact
     limit 1;
  end if;

  if v_customer.id is null and v_clean_token is not null then
    select * into v_customer
      from public.restaurant_customers rc
     where rc.guest_token_hash = v_clean_token
     limit 1;
  end if;

  if v_customer.id is null then
    insert into public.restaurant_customers (
      auth_user_id,
      display_name,
      phone_or_email,
      guest_token_hash
    )
    values (
      auth.uid(),
      v_clean_name,
      v_clean_contact,
      v_clean_token
    )
    returning * into v_customer;
  else
    update public.restaurant_customers
       set display_name = v_clean_name,
           phone_or_email = coalesce(v_clean_contact, restaurant_customers.phone_or_email),
           guest_token_hash = coalesce(v_clean_token, restaurant_customers.guest_token_hash),
           updated_at = pg_catalog.clock_timestamp()
     where id = v_customer.id
     returning * into v_customer;
  end if;

  if v_clean_slug is not null then
    select b.id into v_biz_id
      from public.businesses b
     where b.slug = v_clean_slug
       and b.status = 'active'
       and b.account_state = 'active'
     limit 1;
  end if;

  if v_biz_id is not null then
    select coalesce(t.balance_after, 0)
      into v_points_balance
      from public.restaurant_game_point_transactions t
     where t.business_id = v_biz_id
       and t.customer_id = v_customer.id
     order by t.created_at desc
     limit 1;
    v_points_balance := coalesce(v_points_balance, 0);

    select coalesce(st.balance_after, 0)
      into v_stars_balance
      from public.restaurant_loyalty_star_transactions st
     where st.business_id = v_biz_id
       and st.customer_id = v_customer.id
     order by st.created_at desc
     limit 1;
    v_stars_balance := coalesce(v_stars_balance, 0);

    select coalesce(sum(st.stars_delta), 0)::integer
      into v_exchanged_this_week
      from public.restaurant_loyalty_star_transactions st
     where st.business_id = v_biz_id
       and st.customer_id = v_customer.id
       and st.tx_type = 'game_point_exchange'
       and st.created_at >= (pg_catalog.clock_timestamp() - interval '7 days');

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', x.id,
          'businessId', x.business_id,
          'customerId', x.customer_id,
          'sessionId', x.session_id,
          'txType', x.tx_type,
          'pointsDelta', x.points_delta,
          'balanceAfter', x.balance_after,
          'idempotencyKey', x.idempotency_key,
          'metadata', x.metadata,
          'createdAt', x.created_at
        )
        order by x.created_at desc
      ),
      '[]'::jsonb
    )
      into v_point_txs
      from (
        select *
          from public.restaurant_game_point_transactions t
         where t.business_id = v_biz_id
           and t.customer_id = v_customer.id
         order by t.created_at desc
         limit 20
      ) x;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', sx.id,
          'businessId', sx.business_id,
          'customerId', sx.customer_id,
          'txType', sx.tx_type,
          'starsDelta', sx.stars_delta,
          'balanceAfter', sx.balance_after,
          'idempotencyKey', sx.idempotency_key,
          'verifiedByStaffLabel', sx.verified_by_staff_label,
          'metadata', sx.metadata,
          'createdAt', sx.created_at
        )
        order by sx.created_at desc
      ),
      '[]'::jsonb
    )
      into v_star_txs
      from (
        select *
          from public.restaurant_loyalty_star_transactions st
         where st.business_id = v_biz_id
           and st.customer_id = v_customer.id
         order by st.created_at desc
         limit 20
      ) sx;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', cx.id,
          'businessId', cx.business_id,
          'customerId', cx.customer_id,
          'rewardId', cx.reward_id,
          'rewardTitle', coalesce(r.title, 'Reward'),
          'claimCode', cx.claim_code,
          'starsSpent', cx.stars_spent,
          'status', cx.status,
          'fulfilledAt', cx.fulfilled_at,
          'createdAt', cx.created_at
        )
        order by cx.created_at desc
      ),
      '[]'::jsonb
    )
      into v_claims
      from (
        select *
          from public.restaurant_reward_claims rc
         where rc.business_id = v_biz_id
           and rc.customer_id = v_customer.id
         order by rc.created_at desc
         limit 20
      ) cx
      left join public.restaurant_rewards r on r.id = cx.reward_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'customer', pg_catalog.jsonb_build_object(
      'id', v_customer.id,
      'displayName', v_customer.display_name,
      'phoneOrEmail', v_customer.phone_or_email,
      'createdAt', v_customer.created_at
    ),
    'gamePointsBalance', v_points_balance,
    'loyaltyStarsBalance', v_stars_balance,
    'starsExchangedThisWeek', v_exchanged_this_week,
    'recentTransactions', v_point_txs,
    'recentStarTransactions', v_star_txs,
    'rewardClaims', v_claims
  );
end;
$$;

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

commit;
