-- ============================================================================
-- Migration 007: Expanded Local Business Categories & Customer Review Font
-- Adds:
--   1. Expanded businesses.category check constraint (9 local business types)
--   2. businesses.review_font column ('classic' | 'handwritten' | 'script' |
--      'typewriter' | 'gothic' | 'gothic_bold')
--   3. Updated get_public_business_by_slug(p_slug) returning review_font
-- ============================================================================

alter table public.businesses
  drop constraint if exists businesses_category_chk;

alter table public.businesses
  add constraint businesses_category_chk
    check (category in (
      'restaurant', 'cafe', 'hotel', 'pg',
      'salon', 'clinic', 'gym', 'retail', 'services'
    ));

alter table public.businesses
  add column if not exists review_font text not null default 'classic';

alter table public.businesses
  drop constraint if exists businesses_review_font_chk;

alter table public.businesses
  add constraint businesses_review_font_chk
    check (review_font in (
      'classic', 'handwritten', 'script',
      'typewriter', 'gothic', 'gothic_bold'
    ));

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
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_slug, '')));
begin
  if v_clean_slug !~ '^[a-z0-9-]{3,80}$' then
    return;
  end if;

  return query
  select b.id, b.slug, b.name, b.category, b.city,
         b.google_review_url, b.google_review_url_is_placeholder,
         b.review_font, b.created_at
    from public.businesses b
   where b.slug = v_clean_slug
     and b.status = 'active'
     and b.account_state = 'active'
   limit 1;
end;
$$;

revoke all on function public.get_public_business_by_slug(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_business_by_slug(text) to service_role;
