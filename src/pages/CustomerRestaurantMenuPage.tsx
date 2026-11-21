import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  MapPin,
  Sparkles,
  Gamepad2,
  Award,
  MessageSquareHeart,
  SearchX,
  Loader2,
  HandPlatter,
  Gift,
  Wifi,
  Inbox,
} from 'lucide-react';
import type {
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
  CustomerLoyaltyHeroCard,
  CustomerRewardsAndExtrasView,
  CustomerTableServiceCallBar,
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
        className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-12 text-center shadow-2xs"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#244B40]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-medium text-[#626B65]">
          Loading table hub…
        </p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center shadow-2xs space-y-3"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3EC] text-[#244B40]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#252B29]">
          Digital menu unavailable
        </h1>
        <p className="mx-auto max-w-sm text-[14px] text-[#626B65] leading-relaxed">
          This restaurant&apos;s digital menu is not currently active. You can still share your dining experience on our review page.
        </p>
        {businessSlug && (
          <div className="pt-2">
            <Link
              to={`/r/${businessSlug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#244B40] px-5 py-2.5 text-[14px] font-semibold text-[#FFFFFF] hover:bg-[#1C3B32]"
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

  const hasExtras =
    Boolean(loyaltyRules?.wifiNetworkName) ||
    (loyaltyRules?.suggestionBoxEnabled ?? true);

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

  const categoriesToRender =
    selectedCategoryId === 'all'
      ? categories
      : categories.filter((c) => c.id === selectedCategoryId);

  return (
    <div className="space-y-4">
      {/* 1. Restaurant Header Card & Waiter-Assisted Notice */}
      <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF3EC] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#244B40]">
                <UtensilsCrossed className="h-3 w-3" aria-hidden /> Table Hub &amp; Menu
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#626B65]">
                <MapPin className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                {business.city}
              </span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#252B29]">
              {business.name}
            </h1>
            {profile.tagline && (
              <p className="text-[14px] text-[#626B65] leading-relaxed">
                {profile.tagline}
              </p>
            )}
          </div>

          {/* Detected Table Badge */}
          {table ? (
            <div
              data-testid="detected-table-badge"
              className="rounded-2xl border border-[#244B40] bg-[#244B40] px-3.5 py-2 text-right text-[#FFFFFF] shadow-2xs"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#E8EFEA]">
                Your Table
              </p>
              <p className="text-[15px] font-bold leading-tight">
                {table.tableNumber}
              </p>
              {table.tableLabel && (
                <p className="text-[11px] text-[#E8EFEA]">{table.tableLabel}</p>
              )}
            </div>
          ) : (
            tableKey && (
              <div className="rounded-2xl border border-[#E4BD63] bg-[#FAF3DF] px-3 py-1.5 text-[12px] font-medium text-[#252B29]">
                Table: {tableKey}
              </div>
            )
          )}
        </div>

        {/* Waiter-Service Notice (Strictly No Self-Service Ordering) */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC]/70 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#244B40] text-[#FFFFFF]">
            <HandPlatter className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-[13px] font-medium text-[#252B29] leading-snug">
            <strong className="font-semibold text-[#244B40]">
              Ready to order?
            </strong>{' '}
            Please let your server know. Our staff will take your order right at your table.
          </p>
        </div>

        {/* Sleek Table Service Bar ("Call Waiter" / "Ready for Bill") when viewing from a table QR */}
        {table && (
          <CustomerTableServiceCallBar
            businessSlug={business.slug}
            tableKey={table.tableKey}
            tableNumber={table.tableNumber}
            customerId={wallet?.customer.id ?? null}
          />
        )}

        {/* Single-Tap Candour-Style Navigation Bar */}
        <div className="flex gap-2 overflow-x-auto pt-1 pb-0.5">
          <button
            type="button"
            onClick={() => setActiveView('menu')}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeView === 'menu'
                ? 'bg-[#244B40] text-[#FFFFFF]'
                : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            Menu ({items.length})
          </button>

          {profile.loyaltyEnabled && (
            <button
              type="button"
              onClick={() => setActiveView('rewards')}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'rewards'
                  ? 'bg-[#244B40] text-[#FFFFFF]'
                  : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
              }`}
            >
              <Gift className="h-3.5 w-3.5" aria-hidden />
              Rewards ({(rewards ?? []).length})
            </button>
          )}

          {profile.gamesEnabled && (
            <button
              type="button"
              onClick={() => setActiveView('games')}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'games'
                  ? 'bg-[#244B40] text-[#FFFFFF]'
                  : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
              }`}
            >
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
              Play Games
            </button>
          )}

          {hasExtras && (
            <button
              type="button"
              onClick={() => setActiveView('extras')}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'extras'
                  ? 'bg-[#244B40] text-[#FFFFFF]'
                  : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
              }`}
            >
              {loyaltyRules?.wifiNetworkName ? (
                <Wifi className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Inbox className="h-3.5 w-3.5" aria-hidden />
              )}
              {loyaltyRules?.wifiNetworkName
                ? 'Wi-Fi & Notes'
                : 'Suggestion Box'}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Candour-Style Visual Star Card & Personal Loyalty QR Pass */}
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

      {/* 3. ACTIVE HUB SECTION */}
      {activeView === 'games' && profile.gamesEnabled ? (
        <CustomerGameArena
          businessId={business.id}
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={table?.tableKey ?? tableKey ?? null}
          tableNumber={table?.tableNumber ?? null}
          availableGames={payload.games}
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
        />
      ) : (
        <>
          {/* Category Filter Pills & Pure Veg Filter */}
          <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                Browse Categories
              </span>
              <label className="inline-flex items-center gap-2 rounded-full border border-[#DDE4DC] bg-[#F7F7F2] px-3 py-1 text-[12px] font-semibold text-[#166534] cursor-pointer">
                <input
                  type="checkbox"
                  checked={vegOnly}
                  onChange={(e) => setVegOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#16A34A]"
                />
                Pure Veg Only
              </label>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#244B40] text-[#FFFFFF]'
                    : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
                }`}
              >
                All Dishes ({items.length})
              </button>
              {categories.map((cat) => {
                const active = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#244B40] text-[#FFFFFF]'
                        : 'border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:bg-[#EEF3EC]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Categories & Dishes */}
          {categories.length === 0 || visibleItems.length === 0 ? (
            <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center shadow-2xs space-y-2">
              <UtensilsCrossed
                className="mx-auto h-8 w-8 text-[#626B65]"
                aria-hidden
              />
              <h2 className="text-[17px] font-semibold text-[#252B29]">
                {vegOnly
                  ? 'No Pure Veg dishes in this view'
                  : 'Menu items are being updated'}
              </h2>
              <p className="text-[13px] text-[#626B65]">
                {vegOnly
                  ? 'Uncheck "Pure Veg Only" or switch categories to browse more dishes.'
                  : 'Please ask your server for today’s specials.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categoriesToRender.map((cat) => {
                const catItems = visibleItems.filter(
                  (i) => i.categoryId === cat.id,
                );
                if (catItems.length === 0) return null;

                return (
                  <section
                    key={cat.id}
                    aria-label={cat.name}
                    className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3.5"
                  >
                    <div className="border-b border-[#DDE4DC] pb-2.5">
                      <h2 className="text-[18px] font-bold text-[#252B29]">
                        {cat.name}
                      </h2>
                      {cat.description && (
                        <p className="text-[12px] text-[#626B65] mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="divide-y divide-[#DDE4DC]/80">
                      {catItems.map((dish) => {
                        const dMeta = DIETARY_TAG_METADATA[dish.dietaryTag];
                        return (
                          <div
                            key={dish.id}
                            className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {dish.dietaryTag !== 'none' && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{
                                      borderColor: dMeta.borderColor,
                                      backgroundColor: dMeta.bgColor,
                                      color: dMeta.textColor,
                                    }}
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: dMeta.dotColor }}
                                    />
                                    {dMeta.shortLabel}
                                  </span>
                                )}
                                {dish.isFeatured && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2 py-0.5 text-[10px] font-semibold text-[#252B29]">
                                    <Sparkles
                                      className="h-2.5 w-2.5 text-[#244B40]"
                                      aria-hidden
                                    />
                                    Chef&apos;s Special
                                  </span>
                                )}
                              </div>

                              <h3 className="text-[16px] font-semibold text-[#252B29] leading-snug">
                                {dish.name}
                              </h3>

                              {dish.description && (
                                <p className="text-[13px] text-[#626B65] leading-relaxed">
                                  {dish.description}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <span className="inline-block rounded-xl bg-[#EEF3EC] px-3 py-1.5 text-[15px] font-bold text-[#244B40]">
                                {formatPriceFromPaise(
                                  dish.pricePaise,
                                  profile.currencyCode,
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Single-Tap Candour-Style Action Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.gamesEnabled && (
              <button
                type="button"
                onClick={() => setActiveView('games')}
                className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 text-left shadow-2xs flex items-start gap-3.5 hover:border-[#244B40] hover:bg-[#EEF3EC]/30 transition-colors cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF3EC] text-[#244B40]">
                  <Gamepad2 className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#252B29]">
                      Play Table Games →
                    </h3>
                    <span className="rounded-full bg-[#FAF3DF] border border-[#E4BD63] px-2 py-0.5 text-[10px] font-semibold text-[#252B29]">
                      Earn Game Points
                    </span>
                  </div>
                  <p className="text-[12px] text-[#626B65] leading-relaxed">
                    Play Chef&apos;s Table Trivia, Flavor Memory Match, or Pass-the-Phone Table Challenge while your meal is prepared.
                  </p>
                </div>
              </button>
            )}

            {profile.loyaltyEnabled && (
              <button
                type="button"
                onClick={() => setActiveView('rewards')}
                className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 text-left shadow-2xs flex items-start gap-3.5 hover:border-[#244B40] hover:bg-[#EEF3EC]/30 transition-colors cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FAF3DF] text-[#244B40] border border-[#E4BD63]">
                  <Award className="h-5 w-5" aria-hidden />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#252B29]">
                      Rewards &amp; Claim Tickets →
                    </h3>
                    <span className="rounded-full bg-[#EEF3EC] px-2 py-0.5 text-[10px] font-semibold text-[#244B40]">
                      Redeem Stars
                    </span>
                  </div>
                  <p className="text-[12px] text-[#626B65] leading-relaxed">
                    Browse our reward catalogue and redeem your Loyalty Stars for instant 6-character claim tickets.
                  </p>
                </div>
              </button>
            )}

            {hasExtras && (
              <button
                type="button"
                onClick={() => setActiveView('extras')}
                className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 text-left shadow-2xs flex items-start gap-3.5 hover:border-[#244B40] hover:bg-[#EEF3EC]/30 transition-colors cursor-pointer sm:col-span-2"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF3EC] text-[#244B40]">
                  {loyaltyRules?.wifiNetworkName ? (
                    <Wifi className="h-5 w-5" aria-hidden />
                  ) : (
                    <Inbox className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[15px] font-bold text-[#252B29]">
                    {loyaltyRules?.wifiNetworkName
                      ? `Guest Wi-Fi (${loyaltyRules.wifiNetworkName}) & Private Suggestion Box →`
                      : 'Private Table Suggestion Box →'}
                  </h3>
                  <p className="text-[12px] text-[#626B65] leading-relaxed">
                    {loyaltyRules?.wifiNetworkName
                      ? 'Tap to copy the table Wi-Fi password or send a private hospitality note directly to the owner.'
                      : 'Tap to send a private hospitality suggestion or dish request directly to the owner.'}
                  </p>
                </div>
              </button>
            )}
          </div>
        </>
      )}

      {/* 4. Subtle Link to Leave a Google Review (/r/:businessSlug) */}
      <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF3EC] text-[#244B40]">
            <MessageSquareHeart className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#252B29]">
              Enjoyed dining at {business.name}?
            </p>
            <p className="text-[12px] text-[#626B65]">
              Share your honest feedback in 30 seconds with our quick review assistant.
            </p>
          </div>
        </div>
        <Link
          to={`/r/${business.slug}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#244B40] bg-[#EEF3EC]/60 px-4 py-2 text-[13px] font-semibold text-[#244B40] hover:bg-[#244B40] hover:text-[#FFFFFF] transition-colors"
        >
          <MessageSquareHeart className="h-4 w-4" aria-hidden /> Share Experience
        </Link>
      </div>
    </div>
  );
}
