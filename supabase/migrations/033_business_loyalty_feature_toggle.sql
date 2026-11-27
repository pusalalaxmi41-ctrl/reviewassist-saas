-- ============================================================================
-- Migration 033: Modular Business Loyalty Feature Toggle (loyalty_enabled)
-- (Indexed as 033 after 032_clinic_os_queue_rx_recalls_and_payouts.sql)
--
-- Summary:
-- 1. Adds `loyalty_enabled boolean NOT NULL DEFAULT false` on `public.businesses`.
-- 2. Backfills existing `category = 'loyalty'` businesses to `loyalty_enabled = true`,
--    keeping pure AI Review businesses at `loyalty_enabled = false` by default.
-- 3. Preserves strict `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`,
--    and `REVOKE ALL FROM public, anon` on `public.businesses`.
-- 4. Adds hardened `SECURITY DEFINER` RPC `public.set_business_loyalty_enabled`
--    verified by `public.is_business_owner(p_business_id)` or `public.is_platform_admin()`.
-- 5. Updates `public.get_public_business_by_slug`, `public.get_public_loyalty_hub`,
--    and `public.admin_list_businesses` so `loyalty_enabled` / `loyaltyEnabled`
--    is always returned accurately to customer portals, owners, and platform admins.
-- ============================================================================

-- 1. Add per-business loyalty switch & backfill category = 'loyalty'
alter table public.businesses
  add column if not exists loyalty_enabled boolean not null default false;

update public.businesses
   set loyalty_enabled = true
 where category = 'loyalty'
   and loyalty_enabled is distinct from true;

-- Preserve strict RLS + REVOKE guardrails on public.businesses
alter table public.businesses enable row level security;
alter table public.businesses force row level security;
revoke all on table public.businesses from public, anon;

-- 2. Hardened SECURITY DEFINER RPC: public.set_business_loyalty_enabled
create or replace function public.set_business_loyalty_enabled(
  p_business_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_biz public.businesses%rowtype;
  v_next boolean := coalesce(p_enabled, false);
begin
  if p_business_id is null then
    raise exception 'p_business_id is required' using errcode = '22023';
  end if;

  if pg_catalog.coalesce(auth.uid()::text, '') = ''
     or (
       not public.is_business_owner(p_business_id)
       and not public.is_platform_admin()
     )
  then
    raise exception 'Unauthorized: Only the business owner or a platform admin can toggle Loyalty rewards.'
      using errcode = '42501';
  end if;

  update public.businesses b
     set loyalty_enabled = v_next,
         updated_at = pg_catalog.now()
   where b.id = p_business_id
  returning * into v_biz;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_biz.id,
    'ownerId', v_biz.owner_id,
    'slug', v_biz.slug,
    'name', v_biz.name,
    'category', v_biz.category,
    'city', v_biz.city,
    'googleReviewUrl', v_biz.google_review_url,
    'googleReviewUrlIsPlaceholder', v_biz.google_review_url_is_placeholder,
    'reviewFont', coalesce(v_biz.review_font, 'classic'),
    'loyaltyEnabled', v_biz.loyalty_enabled,
    'status', v_biz.status,
    'statusChangedAt', v_biz.status_changed_at,
    'statusReason', v_biz.status_reason,
    'accountState', v_biz.account_state,
    'deletionRequestedAt', v_biz.deletion_requested_at,
    'deletionScheduledFor', v_biz.deletion_scheduled_for,
    'deletedReason', v_biz.deleted_reason,
    'createdAt', v_biz.created_at
  );
end;
$$;

revoke all on function public.set_business_loyalty_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_business_loyalty_enabled(uuid, boolean) to authenticated, service_role;

-- 3. Update public.get_public_business_by_slug to return loyalty_enabled
drop function if exists public.get_public_business_by_slug(text);

create or replace function public.get_public_business_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  category text,
  city text,
  google_review_url text,
  google_review_url_is_placeholder boolean,
  review_font text,
  loyalty_enabled boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
begin
  if v_clean_slug !~ '^[a-z0-9-]{3,80}$' then
    return;
  end if;

  return query
  select
    b.id,
    b.slug,
    b.name,
    b.category,
    b.city,
    b.google_review_url,
    b.google_review_url_is_placeholder,
    coalesce(b.review_font, 'classic') as review_font,
    coalesce(b.loyalty_enabled, false) as loyalty_enabled,
    b.created_at
  from public.businesses b
  where b.slug = v_clean_slug
    and coalesce(b.status, 'active') = 'active'
    and coalesce(b.account_state, 'active') = 'active'
  limit 1;
end;
$$;

revoke all on function public.get_public_business_by_slug(text) from public;
grant execute on function public.get_public_business_by_slug(text) to anon, authenticated, service_role;

-- 4. Update public.get_public_loyalty_hub to expose loyaltyEnabled on business
create or replace function public.get_public_loyalty_hub(
  p_slug text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
  select
    b.id,
    b.name,
    b.slug,
    b.city,
    b.category,
    b.google_review_url,
    coalesce(b.loyalty_enabled, false) as loyalty_enabled,
    b.status,
    b.account_state
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

  if v_biz.loyalty_enabled and v_clean_phone <> '' then
    select * into v_card
      from public.loyalty_member_cards c
     where c.business_id = v_biz.id
       and c.phone = v_clean_phone
     limit 1;

    if found then
      v_card_json := pg_catalog.jsonb_build_object(
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

      select coalesce(pg_catalog.jsonb_agg(e_row order by e_created desc), '[]'::jsonb)
        into v_events
        from (
          select
            pg_catalog.jsonb_build_object(
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

  return pg_catalog.jsonb_build_object(
    'business', pg_catalog.jsonb_build_object(
      'id', v_biz.id,
      'name', v_biz.name,
      'slug', v_biz.slug,
      'city', v_biz.city,
      'category', v_biz.category,
      'googleReviewUrl', v_biz.google_review_url,
      'loyaltyEnabled', v_biz.loyalty_enabled
    ),
    'config', pg_catalog.jsonb_build_object(
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

-- 5. Update public.admin_list_businesses to include loyalty_enabled
drop function if exists public.admin_list_businesses(text, text, integer, integer);

create or replace function public.admin_list_businesses(
  p_search text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  owner_id uuid,
  owner_email text,
  owner_created_at timestamptz,
  owner_last_sign_in_at timestamptz,
  slug text,
  name text,
  category text,
  city text,
  google_review_url text,
  google_review_url_is_placeholder boolean,
  loyalty_enabled boolean,
  status text,
  status_changed_at timestamptz,
  status_changed_by uuid,
  status_reason text,
  account_state text,
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  deleted_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_search, ''))), '');
  v_status text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin() then
    raise exception 'Forbidden: platform admin access required' using errcode = '42501';
  end if;

  if v_status is not null and v_status <> 'all' and v_status not in ('pending', 'active', 'rejected', 'suspended') then
    raise exception 'Invalid status filter' using errcode = '22023';
  end if;

  return query
  select
    b.id,
    b.owner_id,
    coalesce(u.email::text, 'unknown@redacted.local') as owner_email,
    coalesce(u.created_at, b.created_at) as owner_created_at,
    u.last_sign_in_at as owner_last_sign_in_at,
    b.slug,
    b.name,
    b.category,
    b.city,
    b.google_review_url,
    b.google_review_url_is_placeholder,
    coalesce(b.loyalty_enabled, false) as loyalty_enabled,
    b.status,
    b.status_changed_at,
    b.status_changed_by,
    b.status_reason,
    b.account_state,
    b.deletion_requested_at,
    b.deletion_scheduled_for,
    b.deleted_reason,
    b.created_at,
    b.updated_at,
    count(*) over () as total_count
  from public.businesses b
  left join auth.users u on u.id = b.owner_id
  where (v_status is null or v_status = 'all' or b.status = v_status)
    and (
      v_search is null
      or pg_catalog.lower(b.name) like '%' || v_search || '%'
      or pg_catalog.lower(b.slug) like '%' || v_search || '%'
      or pg_catalog.lower(b.city) like '%' || v_search || '%'
      or pg_catalog.lower(coalesce(u.email::text, '')) like '%' || v_search || '%'
    )
  order by
    case when b.status = 'pending' then 0 else 1 end asc,
    b.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_businesses(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_businesses(text, text, integer, integer) to authenticated;
