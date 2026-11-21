import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  Gamepad2,
  Gift,
  Star,
  SearchX,
  Loader2,
  Sparkles,
  MessageSquareHeart,
} from 'lucide-react';
import type {
  DietaryTag,
  PublicRestaurantMenuPayload,
  RestaurantCustomerWalletState,
} from '../types/restaurant';
import { businessRepository } from '../services/storage';
import {
  DIETARY_TAG_METADATA,
  formatPriceFromPaise,
} from '../utils/restaurantValidation';
import { CustomerGameArena } from '../components/restaurant/CustomerGameArena';
import {
  CustomerFloatingServicePill,
  CustomerLoyaltyHeroCard,
  CustomerRewardsAndExtrasView,
} from '../components/restaurant/CustomerLoyaltyAndExtrasHub';

const CUSTOMER_STORAGE_KEY = 'vitaran_diner_session_v1';

interface StoredDinerIdentity {
  displayName: string;
  phoneOrEmail: string | null;
  guestTokenHash: string;
}

function getOrCreateGuestTokenHash(): string {
  const randomPart = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `guest-${randomPart}`;
}

function loadStoredDinerIdentity(): StoredDinerIdentity | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as StoredDinerIdentity;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveStoredDinerIdentity(identity: StoredDinerIdentity): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify(identity),
      );
    }
  } catch {
    // ignore storage errors
  }
}

function getDishVisualPalette(
  dishName: string,
  dietaryTag: DietaryTag,
): { bg: string; emoji: string; accent: string } {
  const lower = dishName.toLowerCase();
  if (
    lower.includes('biryani') ||
    lower.includes('rice') ||
    lower.includes('pulao')
  ) {
    return {
      bg: 'from-amber-100 via-orange-50 to-amber-50',
      emoji: '🍛',
      accent: '#D97706',
    };
  }
  if (
    lower.includes('cooler') ||
    lower.includes('lime') ||
    lower.includes('mojito') ||
    lower.includes('juice') ||
    lower.includes('drink') ||
    lower.includes('coffee') ||
    lower.includes('chai')
  ) {
    return {
      bg: 'from-emerald-100 via-teal-50 to-lime-50',
      emoji: '🍹',
      accent: '#059669',
    };
  }
  if (
    lower.includes('paneer') ||
    lower.includes('starter') ||
    lower.includes('tikka') ||
    lower.includes('kebab')
  ) {
    return {
      bg: 'from-orange-100 via-amber-50 to-yellow-50',
      emoji: '🥘',
      accent: '#EA580C',
    };
  }
  if (dietaryTag === 'non_veg') {
    return {
      bg: 'from-rose-100 via-orange-50 to-amber-50',
      emoji: '🍗',
      accent: '#DC2626',
    };
  }
  return {
    bg: 'from-[#D2DB76]/45 via-emerald-50 to-[#F8F9FA]',
    emoji: '🥗',
    accent: '#059669',
  };
}

type HubView = 'menu' | 'games' | 'rewards' | 'extras';

export default function CustomerRestaurantMenuPage() {
  const { businessSlug, tableKey } = useParams<{
    businessSlug: string;
    tableKey?: string;
  }>();

  const [payload, setPayload] = useState<PublicRestaurantMenuPayload | null>(
    null,
  );
  const [wallet, setWallet] = useState<RestaurantCustomerWalletState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [activeView, setActiveView] = useState<HubView>('menu');

  useEffect(() => {
    async function loadMenuAndWallet() {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await businessRepository.getPublicRestaurantMenu(
        businessSlug,
        tableKey ?? null,
      );
      setPayload(data);

      const stored = loadStoredDinerIdentity();
      if (stored && data) {
        try {
          const w =
            await businessRepository.registerOrResumeRestaurantCustomer({
              displayName: stored.displayName,
              phoneOrEmail: stored.phoneOrEmail,
              guestTokenHash: stored.guestTokenHash,
              businessSlug,
            });
          setWallet(w);
        } catch {
          // ignore resume error
        }
      }

      setLoading(false);
    }
    void loadMenuAndWallet();
  }, [businessSlug, tableKey]);

  async function ensureCustomerWallet(): Promise<RestaurantCustomerWalletState | null> {
    if (wallet) return wallet;
    if (!businessSlug) return null;

    const existing = loadStoredDinerIdentity();
    const guestTokenHash =
      existing?.guestTokenHash ?? getOrCreateGuestTokenHash();
    const displayName = existing?.displayName || 'Guest Diner';
    const phoneOrEmail = existing?.phoneOrEmail ?? null;

    const created =
      await businessRepository.registerOrResumeRestaurantCustomer({
        displayName,
        phoneOrEmail,
        guestTokenHash,
        businessSlug,
      });
    saveStoredDinerIdentity({
      displayName: created.customer.displayName,
      phoneOrEmail: created.customer.phoneOrEmail,
      guestTokenHash,
    });
    setWallet(created);
    return created;
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-md bistro-card p-12 text-center"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#1E1B4B]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-medium text-[#6B7280]">
          Loading table hub…
        </p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md bistro-card p-8 text-center space-y-3"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#111827]">
          Digital menu unavailable
        </h1>
        <p className="mx-auto max-w-sm text-[14px] text-[#6B7280] leading-relaxed">
          This restaurant&apos;s digital menu is not currently active. You can still share your dining experience on our review page.
        </p>
        {businessSlug && (
          <div className="pt-2">
            <Link
              to={`/r/${businessSlug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1E1B4B] px-5 py-2.5 text-[14px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E]"
            >
              <MessageSquareHeart className="h-4 w-4" aria-hidden /> Leave a Review
            </Link>
          </div>
        )}
      </div>
    );
  }

  const { business, profile, table, categories, items, loyaltyRules, rewards } =
    payload;

  const visibleItems = items.filter((item) => {
    if (
      selectedCategoryId !== 'all' &&
      item.categoryId !== selectedCategoryId
    ) {
      return false;
    }
    if (vegOnly && item.dietaryTag !== 'veg' && item.dietaryTag !== 'vegan') {
      return false;
    }
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-md pb-24 space-y-3.5 animate-fadeSlideUp">
      {/* 1. TOP BRAND HEADER (Matches Mockup 2) */}
      <header className="bistro-card px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] shadow-2xs">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[19px] font-extrabold tracking-tight text-[#111827]">
              {business.name}
            </h1>
            <p className="truncate text-[12px] font-medium text-[#6B7280]">
              {profile.tagline || `${business.city} • Table Menu & Loyalty`}
            </p>
          </div>
        </div>

        {/* Warm Champagne Gold Table Pill Badge */}
        {table ? (
          <div
            data-testid="detected-table-badge"
            className="shrink-0 rounded-full bg-[#D2DB76] px-3.5 py-1.5 text-center shadow-2xs"
          >
            <span className="text-[12px] font-extrabold text-[#1E1B4B] whitespace-nowrap">
              {table.tableNumber}
            </span>
          </div>
        ) : (
          tableKey && (
            <div className="shrink-0 rounded-full bg-[#D2DB76] px-3.5 py-1.5 text-[12px] font-extrabold text-[#1E1B4B]">
              {tableKey}
            </div>
          )
        )}
      </header>

      {/* 2. COMPACT LOYALTY & QUICK-ACTION STRIP (Directly Above the Menu) */}
      <CustomerLoyaltyHeroCard
        businessId={business.id}
        businessSlug={business.slug}
        businessName={business.name}
        loyaltyEnabled={profile.loyaltyEnabled}
        loyaltyRules={loyaltyRules}
        rewards={rewards}
        wallet={wallet}
        onWalletUpdated={(next) => setWallet(next)}
        onEnsureCustomerWallet={ensureCustomerWallet}
        onOpenRewards={() => setActiveView('rewards')}
      />

      {/* 3 Horizontal Action Pills (Matches Mockup 2) */}
      <div className="grid grid-cols-3 gap-2">
        {profile.gamesEnabled && (
          <button
            type="button"
            onClick={() =>
              setActiveView((v) => (v === 'games' ? 'menu' : 'games'))
            }
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold transition-all duration-150 active:scale-[0.98] cursor-pointer ${
              activeView === 'games'
                ? 'bg-[#D2DB76] text-[#1E1B4B] ring-2 ring-[#1E1B4B]'
                : 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs hover:bg-[#2E2A6E]'
            }`}
          >
            <span>Play Games</span>
            <Gamepad2 className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
          </button>
        )}

        {profile.loyaltyEnabled && (
          <button
            type="button"
            onClick={() =>
              setActiveView((v) => (v === 'rewards' ? 'menu' : 'rewards'))
            }
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold transition-all duration-150 active:scale-[0.98] cursor-pointer ${
              activeView === 'rewards'
                ? 'bg-[#D2DB76] text-[#1E1B4B] ring-2 ring-[#1E1B4B]'
                : 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs hover:bg-[#2E2A6E]'
            }`}
          >
            <span>Rewards</span>
            <Gift className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
          </button>
        )}

        <Link
          to={`/r/${business.slug}`}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[12px] font-extrabold text-[#111827] shadow-2xs transition-all duration-150 hover:border-[#1E1B4B] active:scale-[0.98]"
        >
          <span>Google Review</span>
          <Star
            className="h-3.5 w-3.5 text-[#D97706]"
            fill="#D2DB76"
            aria-hidden
          />
        </Link>
      </div>

      {/* 3. ACTIVE VIEW: MENU FIRST vs. SMOOTH SUB-VIEWS (GAMES / REWARDS / WI-FI) */}
      {activeView === 'games' && profile.gamesEnabled ? (
        <CustomerGameArena
          businessId={business.id}
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={table?.tableKey ?? tableKey ?? null}
          tableNumber={table?.tableNumber ?? null}
          availableGames={payload.games}
          onWalletUpdated={(next) => setWallet(next)}
          onClose={() => setActiveView('menu')}
        />
      ) : activeView === 'rewards' && profile.loyaltyEnabled ? (
        <CustomerRewardsAndExtrasView
          businessId={business.id}
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={table?.tableKey ?? tableKey ?? null}
          loyaltyRules={loyaltyRules}
          rewards={rewards}
          wallet={wallet}
          onWalletUpdated={(next) => setWallet(next)}
          onEnsureCustomerWallet={ensureCustomerWallet}
          mode="rewards"
          onBackToMenu={() => setActiveView('menu')}
        />
      ) : activeView === 'extras' ? (
        <CustomerRewardsAndExtrasView
          businessId={business.id}
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={table?.tableKey ?? tableKey ?? null}
          loyaltyRules={loyaltyRules}
          rewards={rewards}
          wallet={wallet}
          onWalletUpdated={(next) => setWallet(next)}
          onEnsureCustomerWallet={ensureCustomerWallet}
          mode="extras"
          onBackToMenu={() => setActiveView('menu')}
        />
      ) : (
        /* DIGITAL MENU FIRST (Matches Mockup 2) */
        <section aria-label="Digital Menu" className="space-y-3">
          {/* Section Header + Classy Waiter Note */}
          <div className="flex items-baseline justify-between px-1 pt-1">
            <h2 className="text-[19px] font-extrabold tracking-tight text-[#111827]">
              Digital Menu
            </h2>
            <p className="text-[11px] font-semibold text-[#6B7280]">
              Ready to order? Just let your server know.
            </p>
          </div>

          {/* Sticky Horizontal Category Tabs + Pure Veg Filter Pill */}
          <div className="sticky top-2 z-20 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF]/95 p-1.5 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-extrabold whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              All
            </button>

            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-extrabold whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}

            <button
              type="button"
              aria-pressed={vegOnly}
              onClick={() => setVegOnly((v) => !v)}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer ${
                vegOnly
                  ? 'border-[#059669] bg-emerald-50 text-[#059669]'
                  : 'border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#111827]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#059669]" />
              Pure Veg
            </button>
          </div>

          {/* 2-Column Mobile Grid of Appetizing Dish Cards (Strictly ZERO + Cart Buttons) */}
          {visibleItems.length === 0 ? (
            <div className="bistro-card p-8 text-center space-y-2">
              <UtensilsCrossed
                className="mx-auto h-7 w-7 text-[#6B7280]"
                aria-hidden
              />
              <h3 className="text-[16px] font-bold text-[#111827]">
                {vegOnly
                  ? 'No Pure Veg dishes in this category'
                  : 'Menu items are being updated'}
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                {vegOnly
                  ? 'Tap "Pure Veg" again or switch categories to view all dishes.'
                  : 'Please ask your server for today’s specials.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleItems.map((dish) => {
                const dMeta = DIETARY_TAG_METADATA[dish.dietaryTag];
                const visual = getDishVisualPalette(dish.name, dish.dietaryTag);

                return (
                  <article
                    key={dish.id}
                    className="bistro-card p-3 flex flex-col justify-between space-y-2.5"
                  >
                    <div className="space-y-2.5">
                      {/* Rounded Appetizing Dish Visual Header */}
                      <div
                        className={`relative flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${visual.bg} border border-[#1E1B4B]/[0.06]`}
                      >
                        {dish.imageUrl ? (
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className="text-[36px] drop-shadow-xs select-none"
                              aria-hidden
                            >
                              {visual.emoji}
                            </span>
                          </div>
                        )}

                        {dish.isFeatured && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-[#1E1B4B]/90 px-2 py-0.5 text-[10px] font-bold text-[#D2DB76] backdrop-blur-xs">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden />
                            Special
                          </span>
                        )}
                      </div>

                      {/* Bold Dish Name */}
                      <h3 className="text-[14px] font-extrabold text-[#111827] leading-snug line-clamp-1">
                        {dish.name}
                      </h3>

                      {/* Formatted Price + Green/Red Veg/Non-Veg Pill Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[14px] font-extrabold text-[#111827] tabular-nums">
                          {formatPriceFromPaise(
                            dish.pricePaise,
                            profile.currencyCode,
                          )}
                        </span>

                        {dish.dietaryTag !== 'none' && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                            style={{
                              borderColor: dMeta.borderColor,
                              backgroundColor: dMeta.bgColor,
                              color: dMeta.textColor,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: dMeta.dotColor }}
                            />
                            {dMeta.shortLabel}
                          </span>
                        )}
                      </div>

                      {/* 2-Line Description */}
                      {dish.description && (
                        <p className="text-[11.5px] text-[#6B7280] leading-relaxed line-clamp-2">
                          {dish.description}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. FLOATING BOTTOM SERVICE PILL (Matches Mockup 2) */}
      <CustomerFloatingServicePill
        businessSlug={business.slug}
        tableKey={table?.tableKey ?? tableKey ?? null}
        tableNumber={table?.tableNumber ?? null}
        customerId={wallet?.customer.id ?? null}
        onOpenWifiAndExtras={() =>
          setActiveView((v) => (v === 'extras' ? 'menu' : 'extras'))
        }
      />
    </div>
  );
}
