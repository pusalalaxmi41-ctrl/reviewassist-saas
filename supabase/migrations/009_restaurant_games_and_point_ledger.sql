-- ============================================================================
-- ReviewAssist — Phase 2: Customer Identity, Restaurant Games & Secure Game-Points Ledger
-- File: supabase/migrations/009_restaurant_games_and_point_ledger.sql
--
-- STATUS: NOT APPLIED AUTOMATICALLY. Review before applying in Supabase SQL Editor.
--
-- Purpose:
-- 1. Creates normalized tables with ENABLE + FORCE ROW LEVEL SECURITY and
--    REVOKE ALL FROM public, anon:
--      - public.restaurant_customers
--      - public.restaurant_game_configs
--      - public.restaurant_game_sessions
--      - public.restaurant_game_point_transactions (Immutable append-only ledger)
-- 2. Enforces strict tenant isolation for business owners via
--    public.is_business_owner(business_id).
-- 3. Provides hardened SECURITY DEFINER RPC functions:
--      - public.register_or_resume_restaurant_customer(...)
--      - public.get_public_restaurant_games(...)
--      - public.start_restaurant_game_session(...)
--      - public.complete_restaurant_game_session(...)
--    Points are NEVER accepted from the client: the server validates answers,
--    enforces cooldowns & daily caps, and writes idempotent ledger entries.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLE: public.restaurant_customers
-- ============================================================================
create table if not exists public.restaurant_customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique
    references auth.users(id) on delete set null,
  display_name text not null,
  phone_or_email text unique,
  guest_token_hash text unique,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_customers_name_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(display_name)) between 1 and 80
  ),
  constraint restaurant_customers_contact_len_chk check (
    phone_or_email is null or pg_catalog.char_length(pg_catalog.btrim(phone_or_email)) between 3 and 160
  ),
  constraint restaurant_customers_token_len_chk check (
    guest_token_hash is null or pg_catalog.char_length(pg_catalog.btrim(guest_token_hash)) between 8 and 128
  )
);

comment on table public.restaurant_customers is
  'Diner accounts for saving Game Points and Loyalty Stars across visits (supports instant guest token or phone/email claim).';

-- ============================================================================
-- 2. TABLE: public.restaurant_game_configs
-- ============================================================================
create table if not exists public.restaurant_game_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  game_slug text not null,
  title text not null,
  category text not null default 'solo',
  is_enabled boolean not null default true,
  points_per_win integer not null default 10,
  max_points_per_day_per_customer integer not null default 50,
  cooldown_minutes integer not null default 5,
  custom_questions jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint restaurant_game_configs_slug_chk check (
    game_slug in ('dish-trivia', 'memory-match', 'table-word-chain', 'speed-tap')
  ),
  constraint restaurant_game_configs_title_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 100
  ),
  constraint restaurant_game_configs_category_chk check (
    category in ('solo', 'same_table', 'restaurant_wide')
  ),
  constraint restaurant_game_configs_points_chk check (
    points_per_win >= 0 and points_per_win <= 1000
  ),
  constraint restaurant_game_configs_daily_max_chk check (
    max_points_per_day_per_customer >= 0 and max_points_per_day_per_customer <= 10000
  ),
  constraint restaurant_game_configs_cooldown_chk check (
    cooldown_minutes >= 0 and cooldown_minutes <= 1440
  ),
  constraint restaurant_game_configs_questions_chk check (
    custom_questions is null or pg_catalog.jsonb_typeof(custom_questions) = 'array'
  ),
  constraint restaurant_game_configs_unique_per_business unique (business_id, game_slug)
);

create index if not exists idx_restaurant_game_configs_biz
  on public.restaurant_game_configs (business_id, is_enabled);

-- ============================================================================
-- 3. TABLE: public.restaurant_game_sessions
-- ============================================================================
create table if not exists public.restaurant_game_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  table_id uuid
    references public.restaurant_tables(id) on delete set null,
  customer_id uuid not null
    references public.restaurant_customers(id) on delete cascade,
  game_slug text not null,
  status text not null default 'in_progress',
  server_seed jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  points_awarded integer not null default 0,
  started_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,

  constraint restaurant_game_sessions_status_chk check (
    status in ('in_progress', 'completed', 'expired')
  ),
  constraint restaurant_game_sessions_points_chk check (
    points_awarded >= 0 and points_awarded <= 1000
  )
);

create index if not exists idx_restaurant_game_sessions_customer_time
  on public.restaurant_game_sessions (business_id, customer_id, game_slug, started_at desc);

create index if not exists idx_restaurant_game_sessions_biz_time
  on public.restaurant_game_sessions (business_id, started_at desc);

-- ============================================================================
-- 4. TABLE: public.restaurant_game_point_transactions (IMMUTABLE LEDGER)
-- ============================================================================
create table if not exists public.restaurant_game_point_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null
    references public.businesses(id) on delete cascade,
  customer_id uuid not null
    references public.restaurant_customers(id) on delete cascade,
  session_id uuid unique
    references public.restaurant_game_sessions(id) on delete set null,
  tx_type text not null,
  points_delta integer not null,
  balance_after integer not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),

  constraint rgpt_tx_type_chk check (
    tx_type in ('game_win', 'exchanged_for_star', 'owner_adjustment', 'expired')
  ),
  constraint rgpt_balance_non_negative_chk check (
    balance_after >= 0
  ),
  constraint rgpt_idempotency_len_chk check (
    pg_catalog.char_length(pg_catalog.btrim(idempotency_key)) between 4 and 160
  ),
  constraint rgpt_unique_idempotency_per_business unique (business_id, idempotency_key)
);

create index if not exists idx_rgpt_biz_customer_time
  on public.restaurant_game_point_transactions (business_id, customer_id, created_at desc);

-- Append-only enforcement on game point ledger
create or replace function public.prevent_game_point_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception 'public.restaurant_game_point_transactions is an immutable ledger and cannot be updated or deleted'
    using errcode = '42501';
end;
$fn$;

revoke all on function public.prevent_game_point_ledger_mutation() from public, anon, authenticated, service_role;

drop trigger if exists trg_rgpt_immutable on public.restaurant_game_point_transactions;
create trigger trg_rgpt_immutable
  before update or delete on public.restaurant_game_point_transactions
  for each row
  execute function public.prevent_game_point_ledger_mutation();

drop trigger if exists trg_restaurant_customers_updated_at on public.restaurant_customers;
create trigger trg_restaurant_customers_updated_at
  before update on public.restaurant_customers
  for each row
  execute function public.touch_restaurant_updated_at();

drop trigger if exists trg_restaurant_game_configs_updated_at on public.restaurant_game_configs;
create trigger trg_restaurant_game_configs_updated_at
  before update on public.restaurant_game_configs
  for each row
  execute function public.touch_restaurant_updated_at();

-- ============================================================================
-- 5. GRANTS & ROW LEVEL SECURITY
-- ============================================================================
alter table public.restaurant_customers enable row level security;
alter table public.restaurant_customers force row level security;

alter table public.restaurant_game_configs enable row level security;
alter table public.restaurant_game_configs force row level security;

alter table public.restaurant_game_sessions enable row level security;
alter table public.restaurant_game_sessions force row level security;

alter table public.restaurant_game_point_transactions enable row level security;
alter table public.restaurant_game_point_transactions force row level security;

revoke all on table
  public.restaurant_customers,
  public.restaurant_game_configs,
  public.restaurant_game_sessions,
  public.restaurant_game_point_transactions
from public, anon, authenticated;

-- Authenticated owners manage their own game configs and read their business sessions & point transactions
grant select, insert, update, delete on table public.restaurant_game_configs to authenticated;
grant select on table public.restaurant_game_sessions to authenticated;
grant select on table public.restaurant_game_point_transactions to authenticated;

grant all on table
  public.restaurant_customers,
  public.restaurant_game_configs,
  public.restaurant_game_sessions,
  public.restaurant_game_point_transactions
to service_role;

-- Owner RLS for restaurant_game_configs
drop policy if exists restaurant_game_configs_owner_select on public.restaurant_game_configs;
create policy restaurant_game_configs_owner_select on public.restaurant_game_configs
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists restaurant_game_configs_owner_insert on public.restaurant_game_configs;
create policy restaurant_game_configs_owner_insert on public.restaurant_game_configs
  for insert to authenticated
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_game_configs_owner_update on public.restaurant_game_configs;
create policy restaurant_game_configs_owner_update on public.restaurant_game_configs
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

drop policy if exists restaurant_game_configs_owner_delete on public.restaurant_game_configs;
create policy restaurant_game_configs_owner_delete on public.restaurant_game_configs
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- Owner read-only RLS for restaurant_game_sessions & restaurant_game_point_transactions
drop policy if exists restaurant_game_sessions_owner_select on public.restaurant_game_sessions;
create policy restaurant_game_sessions_owner_select on public.restaurant_game_sessions
  for select to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists rgpt_owner_select on public.restaurant_game_point_transactions;
create policy rgpt_owner_select on public.restaurant_game_point_transactions
  for select to authenticated
  using (public.is_business_owner(business_id));

-- ============================================================================
-- 6. RPC 1: public.register_or_resume_restaurant_customer
--    Creates or resumes a diner profile by phone/email or guest token hash,
--    and returns the diner's current Game Points balance & recent ledger for
--    the requested business slug.
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
  v_balance integer := 0;
  v_txs jsonb := '[]'::jsonb;
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
      into v_balance
      from public.restaurant_game_point_transactions t
     where t.business_id = v_biz_id
       and t.customer_id = v_customer.id
     order by t.created_at desc
     limit 1;

    v_balance := coalesce(v_balance, 0);

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
      into v_txs
      from (
        select *
          from public.restaurant_game_point_transactions t
         where t.business_id = v_biz_id
           and t.customer_id = v_customer.id
         order by t.created_at desc
         limit 20
      ) x;
  end if;

  return pg_catalog.jsonb_build_object(
    'customer', pg_catalog.jsonb_build_object(
      'id', v_customer.id,
      'displayName', v_customer.display_name,
      'phoneOrEmail', v_customer.phone_or_email,
      'createdAt', v_customer.created_at
    ),
    'gamePointsBalance', v_balance,
    'recentTransactions', v_txs
  );
end;
$$;

revoke all on function public.register_or_resume_restaurant_customer(text, text, text, text) from public;
grant execute on function public.register_or_resume_restaurant_customer(text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 7. RPC 2: public.start_restaurant_game_session
--    Verifies the business & game are active, checks daily point caps and
--    cooldowns, creates an 'in_progress' session, and returns a sanitized
--    challenge (never exposing answer indices to the client).
-- ============================================================================
create or replace function public.start_restaurant_game_session(
  p_slug text,
  p_table_key text,
  p_customer_id uuid,
  p_game_slug text
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
  v_clean_game text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_game_slug, '')));
  v_biz record;
  v_profile record;
  v_config record;
  v_table_id uuid := null;
  v_last_completed timestamptz;
  v_points_today integer := 0;
  v_questions jsonb;
  v_client_questions jsonb := '[]'::jsonb;
  v_answer_indices jsonb := '[]'::jsonb;
  v_server_seed jsonb;
  v_client_challenge jsonb;
  v_session_id uuid;
  v_q jsonb;
  v_idx integer := 0;
begin
  if p_customer_id is null then
    raise exception 'Customer check-in is required before starting a game.' using errcode = '22023';
  end if;

  select b.id, b.name, b.slug into v_biz
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
     and rp.games_enabled = true
   limit 1;

  if not found then
    raise exception 'Table games are currently disabled for this restaurant.' using errcode = '42501';
  end if;

  select gc.* into v_config
    from public.restaurant_game_configs gc
   where gc.business_id = v_biz.id
     and gc.game_slug = v_clean_game
   limit 1;

  if not found then
    -- Use default active rules if the owner has not customized this game row yet
    select
      gen_random_uuid() as id,
      v_biz.id as business_id,
      v_clean_game as game_slug,
      case v_clean_game
        when 'dish-trivia' then 'Chef''s Table Trivia'
        when 'memory-match' then 'Flavor Memory Match'
        when 'table-word-chain' then 'Pass-the-Phone Table Challenge'
        else 'Speed Tap Challenge'
      end as title,
      case v_clean_game
        when 'table-word-chain' then 'same_table'
        else 'solo'
      end as category,
      true as is_enabled,
      10 as points_per_win,
      50 as max_points_per_day_per_customer,
      5 as cooldown_minutes,
      null::jsonb as custom_questions
    into v_config;
  end if;

  if not v_config.is_enabled then
    raise exception 'This game is currently turned off by the restaurant.' using errcode = '42501';
  end if;

  -- Check cooldown
  if v_config.cooldown_minutes > 0 then
    select max(s.completed_at) into v_last_completed
      from public.restaurant_game_sessions s
     where s.business_id = v_biz.id
       and s.customer_id = p_customer_id
       and s.game_slug = v_clean_game
       and s.status = 'completed';

    if v_last_completed is not null
       and v_last_completed > (pg_catalog.clock_timestamp() - pg_catalog.make_interval(mins => v_config.cooldown_minutes))
    then
      raise exception 'Cooldown active: please wait % minute(s) before replaying this game.', v_config.cooldown_minutes
        using errcode = '42501';
    end if;
  end if;

  -- Check daily point cap
  select coalesce(sum(t.points_delta), 0)::integer
    into v_points_today
    from public.restaurant_game_point_transactions t
   where t.business_id = v_biz.id
     and t.customer_id = p_customer_id
     and t.tx_type = 'game_win'
     and t.created_at >= (current_date::timestamptz);

  if v_points_today >= v_config.max_points_per_day_per_customer then
    raise exception 'Daily game point limit (% pts) reached for today.', v_config.max_points_per_day_per_customer
      using errcode = '42501';
  end if;

  if v_clean_table_key is not null then
    select rt.id into v_table_id
      from public.restaurant_tables rt
     where rt.business_id = v_biz.id
       and rt.table_key = v_clean_table_key
       and rt.is_active = true
     limit 1;
  end if;

  -- Build game challenge & server seed
  if v_clean_game = 'dish-trivia' then
    v_questions := coalesce(
      nullif(v_config.custom_questions, '[]'::jsonb),
      $q$[
        {
          "prompt": "Which aromatic spice gives traditional Dum Biryani its golden hue and royal aroma?",
          "options": ["Saffron (Kesar)", "Paprika", "Mustard Seed", "Fenugreek"],
          "correctIndex": 0
        },
        {
          "prompt": "At what temperature is a traditional clay Tandoor oven typically fired?",
          "options": ["100°C", "400°C+ (High heat)", "50°C", "Room temperature"],
          "correctIndex": 1
        },
        {
          "prompt": "Which herb is freshly muddled into a classic Mint Lime Cooler?",
          "options": ["Rosemary", "Thyme", "Fresh Pudina (Mint)", "Oregano"],
          "correctIndex": 2
        }
      ]$q$::jsonb
    );

    for v_q in select * from pg_catalog.jsonb_array_elements(v_questions)
    loop
      v_client_questions := v_client_questions || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'index', v_idx,
          'prompt', v_q ->> 'prompt',
          'options', v_q -> 'options'
        )
      );
      v_answer_indices := v_answer_indices || pg_catalog.jsonb_build_array(
        coalesce((v_q ->> 'correctIndex')::integer, 0)
      );
      v_idx := v_idx + 1;
    end loop;

    v_server_seed := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'expectedAnswers', v_answer_indices,
      'totalQuestions', v_idx
    );
    v_client_challenge := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'questions', v_client_questions
    );

  elsif v_clean_game = 'memory-match' then
    v_server_seed := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'pairsRequired', 4,
      'maxMovesAllowed', 14
    );
    v_client_challenge := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'pairsRequired', 4,
      'maxMovesAllowed', 14,
      'cards', $c$["🍛","🍛","🥗","🥗","🍹","🍹","🥘","🥘"]$c$::jsonb
    );

  else
    -- table-word-chain / pass-the-phone table challenge
    v_server_seed := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'roundsRequired', 3,
      'expectedPrompts', $p$[
        {"round": 1, "prompt": "Player 1: Pick the dish slow-cooked in a sealed pot", "options": ["Dum Biryani", "Garden Salad", "Ice Cream"], "correctIndex": 0},
        {"round": 2, "prompt": "Pass to Player 2: Pick the classic accompaniment to cools down spicy curry", "options": ["Hot Chili Oil", "Chilled Cucumber Raita", "Black Coffee"], "correctIndex": 1},
        {"round": 3, "prompt": "Pass to Player 3: Pick the crispy South Indian fermented rice & lentil crepe", "options": ["Naan", "Masala Dosa", "Roti"], "correctIndex": 1}
      ]$p$::jsonb
    );
    v_client_challenge := pg_catalog.jsonb_build_object(
      'gameSlug', v_clean_game,
      'rounds', $r$[
        {"round": 1, "prompt": "Player 1: Pick the dish slow-cooked in a sealed pot", "options": ["Dum Biryani", "Garden Salad", "Ice Cream"]},
        {"round": 2, "prompt": "Pass to Player 2: Pick the classic accompaniment that cools down spicy curry", "options": ["Hot Chili Oil", "Chilled Cucumber Raita", "Black Coffee"]},
        {"round": 3, "prompt": "Pass to Player 3: Pick the crispy South Indian fermented rice & lentil crepe", "options": ["Naan", "Masala Dosa", "Roti"]}
      ]$r$::jsonb
    );
  end if;

  insert into public.restaurant_game_sessions (
    business_id,
    table_id,
    customer_id,
    game_slug,
    status,
    server_seed
  )
  values (
    v_biz.id,
    v_table_id,
    p_customer_id,
    v_clean_game,
    'in_progress',
    v_server_seed
  )
  returning id into v_session_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', v_session_id,
    'businessId', v_biz.id,
    'gameSlug', v_clean_game,
    'title', v_config.title,
    'pointsPerWin', v_config.points_per_win,
    'challenge', v_client_challenge
  );
end;
$$;

revoke all on function public.start_restaurant_game_session(text, text, uuid, text) from public;
grant execute on function public.start_restaurant_game_session(text, text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 8. RPC 3: public.complete_restaurant_game_session
--    Validates answers/performance strictly on the backend, enforces
--    idempotency (preventing double-claiming on refresh/retry) and daily caps,
--    atomically writes to public.restaurant_game_point_transactions, and
--    returns the verified points earned + updated balance.
-- ============================================================================
create or replace function public.complete_restaurant_game_session(
  p_session_id uuid,
  p_customer_id uuid,
  p_submission jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_clean_idem text := pg_catalog.btrim(coalesce(p_idempotency_key, ''));
  v_session public.restaurant_game_sessions%rowtype;
  v_existing_tx public.restaurant_game_point_transactions%rowtype;
  v_config record;
  v_expected jsonb;
  v_submitted jsonb;
  v_total integer := 0;
  v_correct integer := 0;
  v_i integer := 0;
  v_passed boolean := false;
  v_points_today integer := 0;
  v_remaining_daily integer := 0;
  v_points_to_award integer := 0;
  v_prev_balance integer := 0;
  v_new_balance integer := 0;
  v_pairs integer := 0;
  v_moves integer := 0;
begin
  if p_session_id is null or p_customer_id is null then
    raise exception 'Session ID and customer ID are required.' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_clean_idem) < 4 or pg_catalog.char_length(v_clean_idem) > 160 then
    raise exception 'A valid idempotency key (4..160 chars) is required.' using errcode = '22023';
  end if;

  select * into v_session
    from public.restaurant_game_sessions s
   where s.id = p_session_id
     and s.customer_id = p_customer_id
     for update;

  if not found then
    raise exception 'Game session not found for this customer.' using errcode = 'P0002';
  end if;

  -- Idempotency check: if already completed or idempotency key already recorded, return existing result without double-awarding
  select * into v_existing_tx
    from public.restaurant_game_point_transactions t
   where t.business_id = v_session.business_id
     and (t.idempotency_key = v_clean_idem or t.session_id = v_session.id)
   limit 1;

  if found then
    return pg_catalog.jsonb_build_object(
      'sessionId', v_session.id,
      'alreadyProcessed', true,
      'passed', v_existing_tx.points_delta > 0,
      'score', v_session.score,
      'pointsAwarded', v_existing_tx.points_delta,
      'newBalance', v_existing_tx.balance_after,
      'transactionId', v_existing_tx.id
    );
  end if;

  if v_session.status <> 'in_progress' then
    select coalesce(t.balance_after, 0) into v_prev_balance
      from public.restaurant_game_point_transactions t
     where t.business_id = v_session.business_id
       and t.customer_id = p_customer_id
     order by t.created_at desc
     limit 1;

    return pg_catalog.jsonb_build_object(
      'sessionId', v_session.id,
      'alreadyProcessed', true,
      'passed', v_session.points_awarded > 0,
      'score', v_session.score,
      'pointsAwarded', v_session.points_awarded,
      'newBalance', coalesce(v_prev_balance, 0),
      'transactionId', null
    );
  end if;

  -- Load game config
  select gc.* into v_config
    from public.restaurant_game_configs gc
   where gc.business_id = v_session.business_id
     and gc.game_slug = v_session.game_slug
   limit 1;

  if not found then
    select
      10 as points_per_win,
      50 as max_points_per_day_per_customer
    into v_config;
  end if;

  -- Server-side answer / performance verification
  if v_session.game_slug = 'dish-trivia' then
    v_expected := coalesce(v_session.server_seed -> 'expectedAnswers', '[]'::jsonb);
    v_submitted := coalesce(p_submission -> 'answers', '[]'::jsonb);
    v_total := pg_catalog.jsonb_array_length(v_expected);

    if pg_catalog.jsonb_typeof(v_submitted) = 'array' and v_total > 0 then
      for v_i in 0 .. (v_total - 1)
      loop
        if (v_submitted ->> v_i) is not null
           and (v_submitted ->> v_i)::integer = (v_expected ->> v_i)::integer
        then
          v_correct := v_correct + 1;
        end if;
      end loop;
    end if;

    v_passed := (v_total > 0 and v_correct >= pg_catalog.ceil(v_total::numeric * 0.66));

  elsif v_session.game_slug = 'memory-match' then
    v_pairs := coalesce((p_submission ->> 'matchedPairs')::integer, 0);
    v_moves := coalesce((p_submission ->> 'movesTaken')::integer, 999);
    v_correct := v_pairs;
    v_passed := (
      v_pairs >= coalesce((v_session.server_seed ->> 'pairsRequired')::integer, 4)
      and v_moves >= v_pairs
      and v_moves <= coalesce((v_session.server_seed ->> 'maxMovesAllowed')::integer, 14)
    );

  else
    -- table-word-chain
    v_expected := coalesce(v_session.server_seed -> 'expectedPrompts', '[]'::jsonb);
    v_submitted := coalesce(p_submission -> 'answers', '[]'::jsonb);
    v_total := pg_catalog.jsonb_array_length(v_expected);

    if pg_catalog.jsonb_typeof(v_submitted) = 'array' and v_total > 0 then
      for v_i in 0 .. (v_total - 1)
      loop
        if (v_submitted ->> v_i) is not null
           and (v_submitted ->> v_i)::integer = ((v_expected -> v_i) ->> 'correctIndex')::integer
        then
          v_correct := v_correct + 1;
        end if;
      end loop;
    end if;

    v_passed := (v_total > 0 and v_correct >= pg_catalog.ceil(v_total::numeric * 0.66));
  end if;

  -- Calculate current balance and remaining daily cap
  select coalesce(t.balance_after, 0)
    into v_prev_balance
    from public.restaurant_game_point_transactions t
   where t.business_id = v_session.business_id
     and t.customer_id = p_customer_id
   order by t.created_at desc
   limit 1;
  v_prev_balance := coalesce(v_prev_balance, 0);

  if v_passed then
    select coalesce(sum(t.points_delta), 0)::integer
      into v_points_today
      from public.restaurant_game_point_transactions t
     where t.business_id = v_session.business_id
       and t.customer_id = p_customer_id
       and t.tx_type = 'game_win'
       and t.created_at >= (current_date::timestamptz);

    v_remaining_daily := greatest(0, v_config.max_points_per_day_per_customer - v_points_today);
    v_points_to_award := least(v_config.points_per_win, v_remaining_daily);
  end if;

  v_new_balance := v_prev_balance + v_points_to_award;

  update public.restaurant_game_sessions
     set status = 'completed',
         score = v_correct,
         points_awarded = v_points_to_award,
         completed_at = pg_catalog.clock_timestamp()
   where id = v_session.id;

  if v_points_to_award > 0 then
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
      v_session.business_id,
      p_customer_id,
      v_session.id,
      'game_win',
      v_points_to_award,
      v_new_balance,
      v_clean_idem,
      pg_catalog.jsonb_build_object(
        'gameSlug', v_session.game_slug,
        'score', v_correct
      )
    )
    returning * into v_existing_tx;
  end if;

  return pg_catalog.jsonb_build_object(
    'sessionId', v_session.id,
    'alreadyProcessed', false,
    'passed', v_passed,
    'score', v_correct,
    'pointsAwarded', v_points_to_award,
    'newBalance', v_new_balance,
    'transactionId', v_existing_tx.id
  );
end;
$$;

revoke all on function public.complete_restaurant_game_session(uuid, uuid, jsonb, text) from public;
grant execute on function public.complete_restaurant_game_session(uuid, uuid, jsonb, text) to anon, authenticated, service_role;

-- ============================================================================
-- 9. UPGRADE get_public_restaurant_menu TO RETURN ENABLED GAME CONFIGS
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
    'games', v_games
  );
end;
$$;

revoke all on function public.get_public_restaurant_menu(text, text) from public;
grant execute on function public.get_public_restaurant_menu(text, text) to anon, authenticated, service_role;

commit;
