-- ============================================================================
-- Vitaran AI Reviews / LoyaltyOS — Module 8:
-- Standalone Loyalty & AI Google Review System (Anti-Fraud Static QR/NFC,
-- 4-Layer Visit Cooldown / Counter PIN / Cashier Approval, In-Store 4-Digit
-- Reward Verification Lock & AI Review Bonus Stars)
-- Migration: 031_standalone_loyalty_and_ai_review_os.sql
-- Depends on: 001..030
--
-- SQL Safety Rules Observed:
-- - Every substring extraction uses pg_catalog.substr(x, 1, N) (NEVER substring from/for)
-- - Every new table has ENABLE + FORCE ROW LEVEL SECURITY + REVOKE ALL FROM public, anon
-- - Every SECURITY DEFINER RPC sets search_path = pg_catalog, public, pg_temp
-- ============================================================================

begin;

-- ============================================================================
-- 1. EXPAND public.businesses.category CHECK CONSTRAINT TO INCLUDE 'loyalty'
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
        'gym',
        'loyalty',
        'retail',
        'services'
      )
    );

-- ============================================================================
-- 2. public.loyalty_program_configs (1:1 per business)
-- ============================================================================
create table if not exists public.loyalty_program_configs (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  stars_required integer not null default 5
    constraint lpc_stars_required_chk check (stars_required between 3 and 20),
  reward_title text not null default 'Flat 20% OFF or Free Signature Item',
  reward_description text,
  verification_mode text not null default 'cooldown_only'
    constraint lpc_verification_mode_chk check (verification_mode in ('cooldown_only', 'counter_pin', 'cashier_approval')),
  counter_secret_pin text not null default '1234',
  scan_cooldown_hours integer not null default 12
    constraint lpc_cooldown_hours_chk check (scan_cooldown_hours between 1 and 168),
  google_review_bonus_enabled boolean not null default true,
  google_review_bonus_stars integer not null default 1
    constraint lpc_review_bonus_stars_chk check (google_review_bonus_stars between 1 and 3),
  brand_accent_hex text not null default '#C8F135',
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table public.loyalty_program_configs enable row level security;
alter table public.loyalty_program_configs force row level security;
revoke all on table public.loyalty_program_configs from public, anon;
grant select, insert, update, delete on table public.loyalty_program_configs to authenticated, service_role;

drop policy if exists lpc_owner_all on public.loyalty_program_configs;
create policy lpc_owner_all on public.loyalty_program_configs
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 3. public.loyalty_member_cards (Digital Star Cards per business)
-- ============================================================================
create table if not exists public.loyalty_member_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_code text not null,
  customer_name text not null,
  phone text not null,
  current_stars integer not null default 0
    constraint lmc_current_stars_chk check (current_stars >= 0),
  lifetime_stars integer not null default 0,
  rewards_unlocked integer not null default 0
    constraint lmc_rewards_unlocked_chk check (rewards_unlocked >= 0),
  rewards_redeemed integer not null default 0
    constraint lmc_rewards_redeemed_chk check (rewards_redeemed >= 0),
  google_review_bonus_claimed boolean not null default false,
  pending_redemption_code text,
  last_star_earned_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint lmc_biz_member_code_uniq unique (business_id, member_code),
  constraint lmc_biz_phone_uniq unique (business_id, phone)
);

create index if not exists idx_lmc_biz_created on public.loyalty_member_cards(business_id, created_at desc);

alter table public.loyalty_member_cards enable row level security;
alter table public.loyalty_member_cards force row level security;
revoke all on table public.loyalty_member_cards from public, anon;
grant select, insert, update, delete on table public.loyalty_member_cards to authenticated, service_role;

drop policy if exists lmc_owner_all on public.loyalty_member_cards;
create policy lmc_owner_all on public.loyalty_member_cards
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- 4. public.loyalty_star_events (Audit Log of Visits, Pending, Reviews & Claims)
-- ============================================================================
create table if not exists public.loyalty_star_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  card_id uuid not null references public.loyalty_member_cards(id) on delete cascade,
  event_type text not null
    constraint lse_event_type_chk check (event_type in ('visit_star', 'google_review_bonus', 'manual_bonus', 'reward_redeemed')),
  stars_delta integer not null,
  status text not null default 'approved'
    constraint lse_status_chk check (status in ('pending_approval', 'approved', 'rejected')),
  source_channel text not null default 'qr_nfc'
    constraint lse_source_channel_chk check (source_channel in ('qr_nfc', 'ai_review', 'counter_desk')),
  note text,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists idx_lse_biz_created on public.loyalty_star_events(business_id, created_at desc);
create index if not exists idx_lse_card_created on public.loyalty_star_events(card_id, created_at desc);

alter table public.loyalty_star_events enable row level security;
alter table public.loyalty_star_events force row level security;
revoke all on table public.loyalty_star_events from public, anon;
grant select, insert, update, delete on table public.loyalty_star_events to authenticated, service_role;

drop policy if exists lse_owner_all on public.loyalty_star_events;
create policy lse_owner_all on public.loyalty_star_events
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ============================================================================
-- Helper: Canonical phone normalizer
-- ============================================================================
create or replace function public.normalize_loyalty_phone(p_raw text)
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
-- Helper: Ensure default loyalty_program_configs row exists
-- ============================================================================
create or replace function public.ensure_loyalty_config(p_business_id uuid)
returns public.loyalty_program_configs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cfg public.loyalty_program_configs%rowtype;
begin
  select * into v_cfg
    from public.loyalty_program_configs
   where business_id = p_business_id
   limit 1;

  if not found then
    insert into public.loyalty_program_configs (business_id)
    values (p_business_id)
    on conflict (business_id) do nothing;

    select * into v_cfg
      from public.loyalty_program_configs
     where business_id = p_business_id
     limit 1;
  end if;

  return v_cfg;
end;
$$;

-- ============================================================================
-- RPC 1: public.get_public_loyalty_hub(p_slug, p_phone)
-- Never leaks counter_secret_pin to public callers!
-- ============================================================================
create or replace function public.get_public_loyalty_hub(
  p_slug text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_phone text := public.normalize_loyalty_phone(p_phone);
  v_biz record;
  v_cfg public.loyalty_program_configs%rowtype;
  v_card public.loyalty_member_cards%rowtype;
  v_card_json jsonb := null;
  v_events jsonb := '[]'::jsonb;
begin
  select b.id, b.name, b.slug, b.city, b.category, b.google_review_url, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    return null;
  end if;

  v_cfg := public.ensure_loyalty_config(v_biz.id);

  if v_clean_phone <> '' then
    select * into v_card
      from public.loyalty_member_cards c
     where c.business_id = v_biz.id
       and c.phone = v_clean_phone
     limit 1;

    if found then
      v_card_json := jsonb_build_object(
        'id', v_card.id,
        'businessId', v_card.business_id,
        'memberCode', v_card.member_code,
        'customerName', v_card.customer_name,
        'phone', v_card.phone,
        'currentStars', v_card.current_stars,
        'lifetimeStars', v_card.lifetime_stars,
        'rewardsUnlocked', v_card.rewards_unlocked,
        'rewardsRedeemed', v_card.rewards_redeemed,
        'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
        'pendingRedemptionCode', v_card.pending_redemption_code,
        'lastStarEarnedAt', v_card.last_star_earned_at,
        'createdAt', v_card.created_at,
        'updatedAt', v_card.updated_at
      );

      select coalesce(jsonb_agg(e_row order by e_created desc), '[]'::jsonb)
        into v_events
        from (
          select
            jsonb_build_object(
              'id', lse.id,
              'businessId', lse.business_id,
              'cardId', lse.card_id,
              'eventType', lse.event_type,
              'starsDelta', lse.stars_delta,
              'status', lse.status,
              'sourceChannel', lse.source_channel,
              'note', lse.note,
              'createdAt', lse.created_at
            ) as e_row,
            lse.created_at as e_created
          from public.loyalty_star_events lse
          where lse.card_id = v_card.id
          order by lse.created_at desc
          limit 12
        ) sub;
    end if;
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_biz.id,
      'name', v_biz.name,
      'slug', v_biz.slug,
      'city', v_biz.city,
      'category', v_biz.category,
      'googleReviewUrl', v_biz.google_review_url
    ),
    'config', jsonb_build_object(
      'businessId', v_cfg.business_id,
      'starsRequired', v_cfg.stars_required,
      'rewardTitle', v_cfg.reward_title,
      'rewardDescription', v_cfg.reward_description,
      'verificationMode', v_cfg.verification_mode,
      'scanCooldownHours', v_cfg.scan_cooldown_hours,
      'googleReviewBonusEnabled', v_cfg.google_review_bonus_enabled,
      'googleReviewBonusStars', v_cfg.google_review_bonus_stars,
      'brandAccentHex', v_cfg.brand_accent_hex,
      'updatedAt', v_cfg.updated_at
    ),
    'card', v_card_json,
    'recentEvents', v_events
  );
end;
$$;

revoke all on function public.get_public_loyalty_hub(text, text) from public;
grant execute on function public.get_public_loyalty_hub(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 2: public.claim_loyalty_visit_star(...)
-- Enforces server cooldown + counter PIN OR pending cashier approval
-- ============================================================================
create or replace function public.claim_loyalty_visit_star(
  p_slug text,
  p_customer_name text,
  p_phone text,
  p_counter_pin text default null,
  p_source_channel text default 'qr_nfc'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_customer_name, '')), 1, 80);
  v_clean_phone text := public.normalize_loyalty_phone(p_phone);
  v_channel text := case
    when p_source_channel in ('qr_nfc', 'ai_review', 'counter_desk') then p_source_channel
    else 'qr_nfc'
  end;
  v_biz record;
  v_cfg public.loyalty_program_configs%rowtype;
  v_card public.loyalty_member_cards%rowtype;
  v_card_count integer := 0;
  v_next_code text;
  v_next_stars integer := 0;
  v_earned_rewards integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_event public.loyalty_star_events%rowtype;
  v_pending_exists boolean := false;
begin
  if pg_catalog.char_length(v_clean_name) < 2 then
    raise exception 'Please enter your name (at least 2 characters).';
  end if;
  if pg_catalog.char_length(v_clean_phone) < 7 then
    raise exception 'Please enter a valid phone number.';
  end if;

  select b.id, b.status, b.account_state
    into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    raise exception 'Business not found or inactive.';
  end if;

  v_cfg := public.ensure_loyalty_config(v_biz.id);

  if v_cfg.verification_mode = 'counter_pin' then
    if pg_catalog.btrim(coalesce(p_counter_pin, '')) <> v_cfg.counter_secret_pin then
      raise exception 'Invalid Counter PIN — ask the cashier for today''s 4-digit code.';
    end if;
  end if;

  select * into v_card
    from public.loyalty_member_cards c
   where c.business_id = v_biz.id
     and c.phone = v_clean_phone
   limit 1
   for update;

  if not found then
    select count(*) into v_card_count
      from public.loyalty_member_cards c
     where c.business_id = v_biz.id;
    v_next_code := 'STAR-' || pg_catalog.lpad((v_card_count + 1)::text, 3, '0');

    insert into public.loyalty_member_cards (
      business_id, member_code, customer_name, phone
    ) values (
      v_biz.id, v_next_code, v_clean_name, v_clean_phone
    )
    returning * into v_card;
  else
    -- Enforce anti-fraud cooldown against last approved visit star
    if v_card.last_star_earned_at is not null
       and v_now < (v_card.last_star_earned_at + make_interval(hours => v_cfg.scan_cooldown_hours)) then
      raise exception 'Cooldown active: You already earned a star recently. Come back on your next visit!';
    end if;
  end if;

  if v_cfg.verification_mode = 'cashier_approval' then
    select exists(
      select 1 from public.loyalty_star_events e
       where e.card_id = v_card.id
         and e.status = 'pending_approval'
    ) into v_pending_exists;

    if v_pending_exists then
      raise exception 'Your star request is already waiting for cashier approval.';
    end if;

    update public.loyalty_member_cards
       set customer_name = v_clean_name,
           updated_at = v_now
     where id = v_card.id
     returning * into v_card;

    insert into public.loyalty_star_events (
      business_id, card_id, event_type, stars_delta, status, source_channel, note
    ) values (
      v_biz.id, v_card.id, 'visit_star', 1, 'pending_approval', v_channel, 'Waiting for counter approval'
    )
    returning * into v_event;

    return jsonb_build_object(
      'pendingApproval', true,
      'justUnlockedReward', false,
      'starsRequired', v_cfg.stars_required,
      'card', jsonb_build_object(
        'id', v_card.id,
        'businessId', v_card.business_id,
        'memberCode', v_card.member_code,
        'customerName', v_card.customer_name,
        'phone', v_card.phone,
        'currentStars', v_card.current_stars,
        'lifetimeStars', v_card.lifetime_stars,
        'rewardsUnlocked', v_card.rewards_unlocked,
        'rewardsRedeemed', v_card.rewards_redeemed,
        'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
        'pendingRedemptionCode', v_card.pending_redemption_code,
        'lastStarEarnedAt', v_card.last_star_earned_at,
        'createdAt', v_card.created_at,
        'updatedAt', v_card.updated_at
      ),
      'eventId', v_event.id
    );
  end if;

  -- Instant approved (+1 star, convert stars_required into rewards_unlocked)
  v_next_stars := v_card.current_stars + 1;
  if v_next_stars >= v_cfg.stars_required then
    v_earned_rewards := v_next_stars / v_cfg.stars_required;
    v_next_stars := v_next_stars % v_cfg.stars_required;
  end if;

  update public.loyalty_member_cards
     set customer_name = v_clean_name,
         current_stars = v_next_stars,
         lifetime_stars = lifetime_stars + 1,
         rewards_unlocked = rewards_unlocked + v_earned_rewards,
         last_star_earned_at = v_now,
         updated_at = v_now
   where id = v_card.id
   returning * into v_card;

  insert into public.loyalty_star_events (
    business_id, card_id, event_type, stars_delta, status, source_channel, note
  ) values (
    v_biz.id, v_card.id, 'visit_star', 1, 'approved', v_channel, 'Verified in-store visit star'
  )
  returning * into v_event;

  return jsonb_build_object(
    'pendingApproval', false,
    'justUnlockedReward', v_earned_rewards > 0,
    'starsRequired', v_cfg.stars_required,
    'card', jsonb_build_object(
      'id', v_card.id,
      'businessId', v_card.business_id,
      'memberCode', v_card.member_code,
      'customerName', v_card.customer_name,
      'phone', v_card.phone,
      'currentStars', v_card.current_stars,
      'lifetimeStars', v_card.lifetime_stars,
      'rewardsUnlocked', v_card.rewards_unlocked,
      'rewardsRedeemed', v_card.rewards_redeemed,
      'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
      'pendingRedemptionCode', v_card.pending_redemption_code,
      'lastStarEarnedAt', v_card.last_star_earned_at,
      'createdAt', v_card.created_at,
      'updatedAt', v_card.updated_at
    ),
    'eventId', v_event.id
  );
end;
$$;

revoke all on function public.claim_loyalty_visit_star(text, text, text, text, text) from public;
grant execute on function public.claim_loyalty_visit_star(text, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 3: public.claim_loyalty_google_review_bonus(p_slug, p_phone)
-- ============================================================================
create or replace function public.claim_loyalty_google_review_bonus(
  p_slug text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_phone text := public.normalize_loyalty_phone(p_phone);
  v_biz record;
  v_cfg public.loyalty_program_configs%rowtype;
  v_card public.loyalty_member_cards%rowtype;
  v_next_stars integer := 0;
  v_earned_rewards integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select b.id into v_biz
    from public.businesses b
   where b.slug = v_clean_slug
     and coalesce(b.status, 'active') = 'active'
     and coalesce(b.account_state, 'active') = 'active'
   limit 1;

  if not found then
    raise exception 'Business not found or inactive.';
  end if;

  v_cfg := public.ensure_loyalty_config(v_biz.id);
  if not v_cfg.google_review_bonus_enabled then
    raise exception 'Google review bonus stars are currently disabled for this store.';
  end if;

  select * into v_card
    from public.loyalty_member_cards c
   where c.business_id = v_biz.id
     and c.phone = v_clean_phone
   limit 1
   for update;

  if not found then
    raise exception 'Please collect your first visit star before claiming the Google review bonus.';
  end if;

  if v_card.google_review_bonus_claimed then
    raise exception 'Google review bonus star already claimed for this loyalty card.';
  end if;

  v_next_stars := v_card.current_stars + v_cfg.google_review_bonus_stars;
  if v_next_stars >= v_cfg.stars_required then
    v_earned_rewards := v_next_stars / v_cfg.stars_required;
    v_next_stars := v_next_stars % v_cfg.stars_required;
  end if;

  update public.loyalty_member_cards
     set current_stars = v_next_stars,
         lifetime_stars = lifetime_stars + v_cfg.google_review_bonus_stars,
         rewards_unlocked = rewards_unlocked + v_earned_rewards,
         google_review_bonus_claimed = true,
         updated_at = v_now
   where id = v_card.id
   returning * into v_card;

  insert into public.loyalty_star_events (
    business_id, card_id, event_type, stars_delta, status, source_channel, note
  ) values (
    v_biz.id, v_card.id, 'google_review_bonus', v_cfg.google_review_bonus_stars, 'approved', 'ai_review', 'AI Google Review bonus star claimed'
  );

  return jsonb_build_object(
    'pendingApproval', false,
    'justUnlockedReward', v_earned_rewards > 0,
    'starsRequired', v_cfg.stars_required,
    'card', jsonb_build_object(
      'id', v_card.id,
      'businessId', v_card.business_id,
      'memberCode', v_card.member_code,
      'customerName', v_card.customer_name,
      'phone', v_card.phone,
      'currentStars', v_card.current_stars,
      'lifetimeStars', v_card.lifetime_stars,
      'rewardsUnlocked', v_card.rewards_unlocked,
      'rewardsRedeemed', v_card.rewards_redeemed,
      'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
      'pendingRedemptionCode', v_card.pending_redemption_code,
      'lastStarEarnedAt', v_card.last_star_earned_at,
      'createdAt', v_card.created_at,
      'updatedAt', v_card.updated_at
    )
  );
end;
$$;

revoke all on function public.claim_loyalty_google_review_bonus(text, text) from public;
grant execute on function public.claim_loyalty_google_review_bonus(text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 4: public.request_or_confirm_loyalty_reward_redemption(...)
-- Action 'request' (public guest) generates 4-digit counter lock code (#R-xxxx)
-- Action 'confirm' (authenticated owner) verifies in person & redeems reward
-- ============================================================================
create or replace function public.request_or_confirm_loyalty_reward_redemption(
  p_slug text default null,
  p_business_id uuid default null,
  p_card_id uuid default null,
  p_phone text default null,
  p_action text default 'request'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
  v_clean_phone text := public.normalize_loyalty_phone(p_phone);
  v_card public.loyalty_member_cards%rowtype;
  v_code text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_action = 'request' then
    select c.* into v_card
      from public.loyalty_member_cards c
      join public.businesses b on b.id = c.business_id
     where b.slug = v_clean_slug
       and c.phone = v_clean_phone
       and coalesce(b.status, 'active') = 'active'
       and coalesce(b.account_state, 'active') = 'active'
     limit 1
     for update of c;

    if not found then
      raise exception 'Loyalty card not found for this phone number.';
    end if;

    if v_card.rewards_unlocked < 1 then
      raise exception 'No unlocked rewards ready yet — keep collecting stars!';
    end if;

    if v_card.pending_redemption_code is null then
      v_code := (1000 + (abs(('x' || pg_catalog.substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int) % 9000))::text;
      update public.loyalty_member_cards
         set pending_redemption_code = v_code,
             updated_at = v_now
       where id = v_card.id
       returning * into v_card;
    end if;

    return jsonb_build_object(
      'id', v_card.id,
      'businessId', v_card.business_id,
      'memberCode', v_card.member_code,
      'customerName', v_card.customer_name,
      'phone', v_card.phone,
      'currentStars', v_card.current_stars,
      'lifetimeStars', v_card.lifetime_stars,
      'rewardsUnlocked', v_card.rewards_unlocked,
      'rewardsRedeemed', v_card.rewards_redeemed,
      'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
      'pendingRedemptionCode', v_card.pending_redemption_code,
      'lastStarEarnedAt', v_card.last_star_earned_at,
      'createdAt', v_card.created_at,
      'updatedAt', v_card.updated_at
    );
  end if;

  -- Owner confirm path
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized: Only the store owner can confirm reward redemptions.';
  end if;

  select * into v_card
    from public.loyalty_member_cards c
   where c.business_id = p_business_id
     and c.id = p_card_id
   limit 1
   for update;

  if not found or v_card.rewards_unlocked < 1 then
    raise exception 'No unlocked reward available to redeem on this card.';
  end if;

  update public.loyalty_member_cards
     set rewards_unlocked = greatest(0, rewards_unlocked - 1),
         rewards_redeemed = rewards_redeemed + 1,
         pending_redemption_code = null,
         updated_at = v_now
   where id = v_card.id
   returning * into v_card;

  insert into public.loyalty_star_events (
    business_id, card_id, event_type, stars_delta, status, source_channel, note
  ) values (
    p_business_id, v_card.id, 'reward_redeemed', 0, 'approved', 'counter_desk', 'Reward verified & handed over in store'
  );

  return jsonb_build_object(
    'id', v_card.id,
    'businessId', v_card.business_id,
    'memberCode', v_card.member_code,
    'customerName', v_card.customer_name,
    'phone', v_card.phone,
    'currentStars', v_card.current_stars,
    'lifetimeStars', v_card.lifetime_stars,
    'rewardsUnlocked', v_card.rewards_unlocked,
    'rewardsRedeemed', v_card.rewards_redeemed,
    'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
    'pendingRedemptionCode', v_card.pending_redemption_code,
    'lastStarEarnedAt', v_card.last_star_earned_at,
    'createdAt', v_card.created_at,
    'updatedAt', v_card.updated_at
  );
end;
$$;

revoke all on function public.request_or_confirm_loyalty_reward_redemption(text, uuid, uuid, text, text) from public;
grant execute on function public.request_or_confirm_loyalty_reward_redemption(text, uuid, uuid, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- RPC 5: public.approve_pending_loyalty_star(p_business_id, p_event_id, p_decision)
-- ============================================================================
create or replace function public.approve_pending_loyalty_star(
  p_business_id uuid,
  p_event_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_event public.loyalty_star_events%rowtype;
  v_card public.loyalty_member_cards%rowtype;
  v_cfg public.loyalty_program_configs%rowtype;
  v_next_stars integer := 0;
  v_earned_rewards integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized access to store loyalty approvals.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision (must be approved or rejected).';
  end if;

  select * into v_event
    from public.loyalty_star_events e
   where e.id = p_event_id
     and e.business_id = p_business_id
     and e.status = 'pending_approval'
   limit 1
   for update;

  if not found then
    raise exception 'Pending star request not found or already resolved.';
  end if;

  if p_decision = 'rejected' then
    update public.loyalty_star_events
       set status = 'rejected',
           note = 'Declined by cashier'
     where id = v_event.id
     returning * into v_event;

    return jsonb_build_object('status', 'rejected', 'eventId', v_event.id);
  end if;

  v_cfg := public.ensure_loyalty_config(p_business_id);

  select * into v_card
    from public.loyalty_member_cards c
   where c.id = v_event.card_id
   limit 1
   for update;

  v_next_stars := v_card.current_stars + greatest(1, v_event.stars_delta);
  if v_next_stars >= v_cfg.stars_required then
    v_earned_rewards := v_next_stars / v_cfg.stars_required;
    v_next_stars := v_next_stars % v_cfg.stars_required;
  end if;

  update public.loyalty_member_cards
     set current_stars = v_next_stars,
         lifetime_stars = lifetime_stars + greatest(1, v_event.stars_delta),
         rewards_unlocked = rewards_unlocked + v_earned_rewards,
         last_star_earned_at = v_now,
         updated_at = v_now
   where id = v_card.id
   returning * into v_card;

  update public.loyalty_star_events
     set status = 'approved',
         note = 'Approved by cashier at counter'
   where id = v_event.id
   returning * into v_event;

  return jsonb_build_object(
    'status', 'approved',
    'eventId', v_event.id,
    'cardId', v_card.id
  );
end;
$$;

revoke all on function public.approve_pending_loyalty_star(uuid, uuid, text) from public;
grant execute on function public.approve_pending_loyalty_star(uuid, uuid, text) to authenticated, service_role;

-- ============================================================================
-- RPC 6: public.issue_loyalty_desk_star(...) (Owner manual walk-in star)
-- ============================================================================
create or replace function public.issue_loyalty_desk_star(
  p_business_id uuid,
  p_customer_name text,
  p_phone text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_name text := pg_catalog.substr(pg_catalog.btrim(coalesce(p_customer_name, '')), 1, 80);
  v_clean_phone text := public.normalize_loyalty_phone(p_phone);
  v_cfg public.loyalty_program_configs%rowtype;
  v_card public.loyalty_member_cards%rowtype;
  v_card_count integer := 0;
  v_next_stars integer := 0;
  v_earned_rewards integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized access to issue desk loyalty star.';
  end if;
  if pg_catalog.char_length(v_clean_phone) < 7 then
    raise exception 'Please enter a valid customer mobile number.';
  end if;

  v_cfg := public.ensure_loyalty_config(p_business_id);

  select * into v_card
    from public.loyalty_member_cards c
   where c.business_id = p_business_id
     and c.phone = v_clean_phone
   limit 1
   for update;

  if not found then
    if pg_catalog.char_length(v_clean_name) < 2 then
      v_clean_name := 'Walk-In Guest';
    end if;
    select count(*) into v_card_count
      from public.loyalty_member_cards c
     where c.business_id = p_business_id;
    insert into public.loyalty_member_cards (
      business_id, member_code, customer_name, phone
    ) values (
      p_business_id,
      'STAR-' || pg_catalog.lpad((v_card_count + 1)::text, 3, '0'),
      v_clean_name,
      v_clean_phone
    )
    returning * into v_card;
  end if;

  v_next_stars := v_card.current_stars + 1;
  if v_next_stars >= v_cfg.stars_required then
    v_earned_rewards := v_next_stars / v_cfg.stars_required;
    v_next_stars := v_next_stars % v_cfg.stars_required;
  end if;

  update public.loyalty_member_cards
     set current_stars = v_next_stars,
         lifetime_stars = lifetime_stars + 1,
         rewards_unlocked = rewards_unlocked + v_earned_rewards,
         last_star_earned_at = v_now,
         updated_at = v_now
   where id = v_card.id
   returning * into v_card;

  insert into public.loyalty_star_events (
    business_id, card_id, event_type, stars_delta, status, source_channel, note
  ) values (
    p_business_id, v_card.id, 'manual_bonus', 1, 'approved', 'counter_desk', coalesce(nullif(pg_catalog.btrim(p_note), ''), 'Issued by desk cashier')
  );

  return jsonb_build_object(
    'id', v_card.id,
    'businessId', v_card.business_id,
    'memberCode', v_card.member_code,
    'customerName', v_card.customer_name,
    'phone', v_card.phone,
    'currentStars', v_card.current_stars,
    'lifetimeStars', v_card.lifetime_stars,
    'rewardsUnlocked', v_card.rewards_unlocked,
    'rewardsRedeemed', v_card.rewards_redeemed,
    'googleReviewBonusClaimed', v_card.google_review_bonus_claimed,
    'pendingRedemptionCode', v_card.pending_redemption_code,
    'lastStarEarnedAt', v_card.last_star_earned_at,
    'createdAt', v_card.created_at,
    'updatedAt', v_card.updated_at
  );
end;
$$;

revoke all on function public.issue_loyalty_desk_star(uuid, text, text, text) from public;
grant execute on function public.issue_loyalty_desk_star(uuid, text, text, text) to authenticated, service_role;

-- ============================================================================
-- RPC 7: public.get_loyalty_owner_dashboard(p_business_id)
-- ============================================================================
create or replace function public.get_loyalty_owner_dashboard(
  p_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_cfg public.loyalty_program_configs%rowtype;
  v_month_start timestamptz := date_trunc('month', pg_catalog.clock_timestamp());
  v_total_members integer := 0;
  v_stars_month integer := 0;
  v_rewards_redeemed integer := 0;
  v_rewards_unlocked integer := 0;
  v_ai_reviews integer := 0;
  v_cards jsonb := '[]'::jsonb;
  v_pending_events jsonb := '[]'::jsonb;
  v_feed jsonb := '[]'::jsonb;
begin
  if p_business_id is null or not public.is_business_owner(p_business_id) then
    raise exception 'Unauthorized access to store loyalty dashboard.';
  end if;

  v_cfg := public.ensure_loyalty_config(p_business_id);

  select count(*), coalesce(sum(rewards_redeemed), 0), coalesce(sum(rewards_unlocked), 0)
    into v_total_members, v_rewards_redeemed, v_rewards_unlocked
    from public.loyalty_member_cards c
   where c.business_id = p_business_id;

  select
    coalesce(sum(case when status = 'approved' and created_at >= v_month_start then stars_delta else 0 end), 0),
    coalesce(sum(case when status = 'approved' and event_type = 'google_review_bonus' then 1 else 0 end), 0)
    into v_stars_month, v_ai_reviews
    from public.loyalty_star_events e
   where e.business_id = p_business_id;

  select coalesce(jsonb_agg(c_row order by c_updated desc), '[]'::jsonb)
    into v_cards
    from (
      select
        jsonb_build_object(
          'id', c.id,
          'businessId', c.business_id,
          'memberCode', c.member_code,
          'customerName', c.customer_name,
          'phone', c.phone,
          'currentStars', c.current_stars,
          'lifetimeStars', c.lifetime_stars,
          'rewardsUnlocked', c.rewards_unlocked,
          'rewardsRedeemed', c.rewards_redeemed,
          'googleReviewBonusClaimed', c.google_review_bonus_claimed,
          'pendingRedemptionCode', c.pending_redemption_code,
          'lastStarEarnedAt', c.last_star_earned_at,
          'createdAt', c.created_at,
          'updatedAt', c.updated_at
        ) as c_row,
        c.updated_at as c_updated
      from public.loyalty_member_cards c
      where c.business_id = p_business_id
      order by c.updated_at desc
      limit 150
    ) sub_cards;

  select coalesce(jsonb_agg(p_row order by p_created asc), '[]'::jsonb)
    into v_pending_events
    from (
      select
        jsonb_build_object(
          'id', e.id,
          'businessId', e.business_id,
          'cardId', e.card_id,
          'customerName', c.customer_name,
          'memberCode', c.member_code,
          'phone', c.phone,
          'eventType', e.event_type,
          'starsDelta', e.stars_delta,
          'status', e.status,
          'sourceChannel', e.source_channel,
          'note', e.note,
          'createdAt', e.created_at
        ) as p_row,
        e.created_at as p_created
      from public.loyalty_star_events e
      join public.loyalty_member_cards c on c.id = e.card_id
      where e.business_id = p_business_id
        and e.status = 'pending_approval'
      order by e.created_at asc
      limit 50
    ) sub_pend;

  select coalesce(jsonb_agg(f_row order by f_created desc), '[]'::jsonb)
    into v_feed
    from (
      select
        jsonb_build_object(
          'id', e.id,
          'businessId', e.business_id,
          'cardId', e.card_id,
          'customerName', c.customer_name,
          'memberCode', c.member_code,
          'phone', c.phone,
          'eventType', e.event_type,
          'starsDelta', e.stars_delta,
          'status', e.status,
          'sourceChannel', e.source_channel,
          'note', e.note,
          'createdAt', e.created_at
        ) as f_row,
        e.created_at as f_created
      from public.loyalty_star_events e
      join public.loyalty_member_cards c on c.id = e.card_id
      where e.business_id = p_business_id
      order by e.created_at desc
      limit 35
    ) sub_feed;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'businessId', v_cfg.business_id,
      'starsRequired', v_cfg.stars_required,
      'rewardTitle', v_cfg.reward_title,
      'rewardDescription', v_cfg.reward_description,
      'verificationMode', v_cfg.verification_mode,
      'counterSecretPin', v_cfg.counter_secret_pin,
      'scanCooldownHours', v_cfg.scan_cooldown_hours,
      'googleReviewBonusEnabled', v_cfg.google_review_bonus_enabled,
      'googleReviewBonusStars', v_cfg.google_review_bonus_stars,
      'brandAccentHex', v_cfg.brand_accent_hex,
      'createdAt', v_cfg.created_at,
      'updatedAt', v_cfg.updated_at
    ),
    'kpis', jsonb_build_object(
      'totalMembers', v_total_members,
      'starsIssuedThisMonth', v_stars_month,
      'aiReviewsGenerated', v_ai_reviews,
      'rewardsUnlocked', v_rewards_unlocked,
      'rewardsRedeemed', v_rewards_redeemed
    ),
    'memberDirectory', v_cards,
    'pendingApprovals', v_pending_events,
    'recentActivityFeed', v_feed
  );
end;
$$;

revoke all on function public.get_loyalty_owner_dashboard(uuid) from public;
grant execute on function public.get_loyalty_owner_dashboard(uuid) to authenticated, service_role;

commit;
