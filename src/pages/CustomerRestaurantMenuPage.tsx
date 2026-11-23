import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  Gamepad2,
  Gift,
  Star,
  SearchX,
  Loader2,
  MessageSquareHeart,
  MessageSquare,
  Wifi,
  BellRing,
  ChevronRight,
  Copy,
  Check,
  X,
  Receipt,
  CheckCircle2,
  UserPlus,
  Inbox,
} from 'lucide-react';
import type {
  MenuThemeTemplate,
  OpenTableBillSummary,
  PublicRestaurantMenuPayload,
  RestaurantCustomerWalletState,
  RestaurantTableCall,
  RestaurantTableCallType,
  RestaurantTableMessage,
} from '../types/restaurant';
import { businessRepository } from '../services/storage';
import { MENU_THEME_LIST } from '../config/menuPresets';
import { copyText } from '../utils/clipboard';
import { formatPriceFromPaise } from '../utils/restaurantValidation';
import { TABLE_CALL_TYPE_METADATA } from '../utils/hospitalityHelpers';
import { CustomerGameArena } from '../components/restaurant/CustomerGameArena';
import {
  CustomerLoyaltyHeroCard,
  CustomerRewardsAndExtrasView,
} from '../components/restaurant/CustomerLoyaltyAndExtrasHub';
import { CustomerDigitalMenuView } from '../components/restaurant/CustomerDigitalMenuView';
import { CustomerChatAndBillDrawer } from '../components/restaurant/CustomerChatAndBillDrawer';

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

type HubView = 'launcher' | 'menu' | 'games' | 'rewards' | 'extras';

interface HubThemePalette {
  pageShell: string;
  headerCard: string;
  titleClass: string;
  subtitleClass: string;
  tableBadge: string;
  joinBanner: string;
  joinIconBox: string;
  joinSubtitle: string;
  actionBlock: string;
  actionTitle: string;
  actionSubtitle: string;
  chevronClass: string;
  brandIconBox: string;
}

function getHubThemePalette(theme: MenuThemeTemplate): HubThemePalette {
  switch (theme) {
    case 'masala':
      return {
        pageShell:
          'masala-parchment-bg -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 px-4 sm:px-6 pt-6 pb-12 min-h-[84vh]',
        headerCard:
          'rounded-2xl border-4 border-double border-amber-600/60 bg-[#FFFDF7] px-5 py-4 shadow-sm',
        titleClass:
          'font-serif-editorial text-[21px] font-bold tracking-tight text-[#7A1624]',
        subtitleClass: 'text-[12px] italic text-[#7A4420]',
        tableBadge:
          'rounded-full border border-[#F4C430] bg-[#7A1624] px-3.5 py-1.5 text-[12px] font-extrabold text-[#F4C430]',
        joinBanner:
          'rounded-2xl border-2 border-[#F4C430]/75 bg-[#7A1624] text-[#FDF8EE] shadow-md hover:bg-[#5C0E19]',
        joinIconBox: 'rounded-xl bg-[#F4C430] text-[#4A1216]',
        joinSubtitle: 'text-[#F4C430]',
        actionBlock:
          'rounded-2xl border-2 border-double border-amber-600/50 bg-[#FFFDF7] shadow-2xs hover:border-[#7A1624]/60',
        actionTitle: 'font-serif-editorial text-[16px] font-bold text-[#4A1216]',
        actionSubtitle: 'text-[12.5px] font-medium text-[#7A4420]',
        chevronClass: 'text-[#7A1624]/70',
        brandIconBox: 'rounded-2xl bg-[#7A1624] text-[#F4C430]',
      };
    case 'prakriti':
      return {
        pageShell:
          'prakriti-paper-bg -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 px-4 sm:px-6 pt-6 pb-12 min-h-[84vh]',
        headerCard:
          'rounded-3xl border border-[#2D4A33]/20 bg-[#FAF6EE] px-5 py-4 shadow-sm',
        titleClass:
          'font-serif-editorial text-[21px] font-bold tracking-tight text-[#2D4A33]',
        subtitleClass: 'text-[12px] font-medium text-[#4E644F]',
        tableBadge:
          'rounded-full bg-[#B85D3B] px-3.5 py-1.5 text-[12px] font-extrabold text-[#FAF6EE]',
        joinBanner:
          'rounded-3xl border border-[#4A6B50]/40 bg-[#2D4A33] text-[#FAF6EE] shadow-md hover:bg-[#223927]',
        joinIconBox: 'rounded-2xl bg-[#B85D3B] text-[#FAF6EE]',
        joinSubtitle: 'text-[#E7DFCE]',
        actionBlock:
          'rounded-3xl border border-[#2D4A33]/15 bg-[#FAF6EE] shadow-2xs hover:border-[#2D4A33]/40',
        actionTitle: 'font-serif-editorial text-[16px] font-bold text-[#1E3F20]',
        actionSubtitle: 'text-[12.5px] font-medium text-[#4E644F]',
        chevronClass: 'text-[#2D4A33]/70',
        brandIconBox: 'rounded-2xl bg-[#2D4A33] text-[#FAF6EE]',
      };
    case 'bistro':
      return {
        pageShell:
          'bistro-obsidian-bg -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 px-4 sm:px-6 pt-6 pb-12 min-h-[84vh]',
        headerCard:
          'rounded-none border border-[#C5A880]/55 bg-[#1B1B1B] px-5 py-4',
        titleClass:
          'text-[19px] font-light uppercase tracking-[0.18em] text-[#FAF7F2]',
        subtitleClass: 'text-[11.5px] tracking-[0.06em] text-[#C5A880]',
        tableBadge:
          'rounded-none border border-[#C5A880] bg-transparent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C5A880]',
        joinBanner:
          'rounded-none border border-[#C5A880] bg-[#1B1B1B] text-[#FAF7F2] hover:bg-[#242424]',
        joinIconBox: 'rounded-none bg-[#C5A880] text-[#141414]',
        joinSubtitle: 'text-[#C5A880]',
        actionBlock:
          'rounded-none border border-[#C5A880]/40 bg-[#FAF7F2] hover:border-[#C5A880]',
        actionTitle:
          'text-[14.5px] font-bold uppercase tracking-[0.06em] text-[#141414]',
        actionSubtitle: 'text-[12px] font-medium text-[#4B4B4B]',
        chevronClass: 'text-[#141414]/60',
        brandIconBox: 'rounded-none border border-[#C5A880] bg-[#141414] text-[#C5A880]',
      };
    case 'samudra':
      return {
        pageShell:
          'samudra-coastal-bg -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 px-4 sm:px-6 pt-6 pb-12 min-h-[84vh]',
        headerCard:
          'rounded-3xl border border-[#1A365D]/15 bg-[#FFFFFF] px-5 py-4 shadow-sm',
        titleClass: 'text-[20px] font-extrabold tracking-tight text-[#1A365D]',
        subtitleClass: 'text-[12px] font-medium text-[#3B5978]',
        tableBadge:
          'rounded-full bg-[#0D9488] px-3.5 py-1.5 text-[12px] font-extrabold text-[#FFFFFF]',
        joinBanner:
          'rounded-3xl border border-[#2DD4BF]/40 bg-[#1A365D] text-[#FFFFFF] shadow-md hover:bg-[#152C4D]',
        joinIconBox: 'rounded-2xl bg-[#0D9488] text-[#FFFFFF]',
        joinSubtitle: 'text-[#99F6E4]',
        actionBlock:
          'rounded-3xl border border-[#1A365D]/12 bg-[#FFFFFF] shadow-2xs hover:border-[#0D9488]/50',
        actionTitle: 'text-[16px] font-extrabold text-[#1A365D]',
        actionSubtitle: 'text-[12.5px] font-medium text-[#4A627A]',
        chevronClass: 'text-[#0D9488]',
        brandIconBox: 'rounded-2xl bg-[#1A365D] text-[#2DD4BF]',
      };
    case 'sizzler':
      return {
        pageShell:
          'sizzler-diner-bg -mx-4 sm:-mx-6 -mt-6 sm:-mt-12 px-4 sm:px-6 pt-6 pb-12 min-h-[84vh]',
        headerCard:
          'rounded-2xl border-2 border-[#111827] bg-[#FACC15] px-5 py-4 shadow-[4px_4px_0px_#111827]',
        titleClass: 'text-[21px] font-black uppercase tracking-tight text-[#111827]',
        subtitleClass: 'text-[12px] font-bold text-[#7F1D1D]',
        tableBadge:
          'rounded-xl border-2 border-[#111827] bg-[#DC2626] px-3 py-1 text-[11.5px] font-black uppercase text-[#FEFCE8]',
        joinBanner:
          'rounded-2xl border-2 border-[#111827] bg-[#DC2626] text-[#FEFCE8] shadow-[4px_4px_0px_#111827] hover:bg-[#B91C1C]',
        joinIconBox: 'rounded-xl border-2 border-[#111827] bg-[#FACC15] text-[#111827]',
        joinSubtitle: 'text-[#FACC15]',
        actionBlock:
          'rounded-2xl border-2 border-[#111827] bg-[#FFFFFF] shadow-[4px_4px_0px_#111827] hover:translate-x-[1px] hover:translate-y-[1px]',
        actionTitle: 'text-[15.5px] font-black uppercase text-[#111827]',
        actionSubtitle: 'text-[12px] font-semibold text-[#374151]',
        chevronClass: 'text-[#DC2626]',
        brandIconBox: 'rounded-xl border-2 border-[#111827] bg-[#DC2626] text-[#FACC15]',
      };
    default:
      return {
        pageShell: 'pb-8',
        headerCard: 'bistro-card px-5 py-4',
        titleClass: 'text-[20px] font-extrabold tracking-tight text-[#111827]',
        subtitleClass: 'text-[12px] font-medium text-[#6B7280]',
        tableBadge:
          'rounded-full bg-[#D2DB76] px-3.5 py-1.5 text-[12px] font-extrabold text-[#1E1B4B]',
        joinBanner:
          'rounded-2xl border border-[#1E1B4B]/10 bg-[#1E1B4B] text-[#FFFFFF] shadow-md hover:bg-[#2E2A6E]',
        joinIconBox: 'rounded-xl bg-[#D2DB76] text-[#1E1B4B]',
        joinSubtitle: 'text-[#D2DB76]',
        actionBlock: 'bistro-card hover:border-[#1E1B4B]/30',
        actionTitle: 'text-[16px] font-extrabold text-[#111827]',
        actionSubtitle: 'text-[12.5px] font-medium text-[#6B7280]',
        chevronClass: 'text-[#6B7280]',
        brandIconBox: 'rounded-2xl bg-[#1E1B4B] text-[#D2DB76]',
      };
  }
}

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
  const [activeView, setActiveView] = useState<HubView>('launcher');

  // Quick 5-Second Loyalty Join Modal (New Guests)
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Instant Wi-Fi Modal
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);

  // 2-Button Call Waiter / Ready for Bill Pop-up & 4-Pill Instant Service Bar
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCall, setActiveCall] = useState<RestaurantTableCall | null>(
    null,
  );
  const [callingType, setCallingType] =
    useState<RestaurantTableCallType | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [serviceToast, setServiceToast] = useState<string | null>(null);

  // Live Open Bill, 4-Stage Order Progress Stepper & 2-Way Table Chat
  const [billSummary, setBillSummary] = useState<OpenTableBillSummary | null>(
    null,
  );
  const [chatMessages, setChatMessages] = useState<RestaurantTableMessage[]>(
    [],
  );
  const [chatDrawerTab, setChatDrawerTab] = useState<null | 'chat' | 'bill'>(
    null,
  );

  const resolvedTableKey = payload?.table?.tableKey ?? tableKey ?? null;

  const refreshLiveTableState = useCallback(async () => {
    if (!businessSlug || !resolvedTableKey) return;
    try {
      const [bill, msgs] = await Promise.all([
        businessRepository.getOpenTableBillSummary({
          businessSlug,
          tableKey: resolvedTableKey,
        }),
        businessRepository.getTableChatMessages({
          businessSlug,
          tableKey: resolvedTableKey,
        }),
      ]);
      setBillSummary(bill);
      setChatMessages(msgs);
    } catch {
      // ignore transient guest poll errors
    }
  }, [businessSlug, resolvedTableKey]);

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

  useEffect(() => {
    if (!payload?.business.id || !resolvedTableKey) return;
    const initTimer = window.setTimeout(() => {
      void refreshLiveTableState();
    }, 0);
    const unsub = businessRepository.subscribeToHospitalityRealtime(
      payload.business.id,
      () => {
        void refreshLiveTableState();
      },
    );
    const poll = window.setInterval(() => {
      void refreshLiveTableState();
    }, 6000);
    return () => {
      window.clearTimeout(initTimer);
      unsub();
      window.clearInterval(poll);
    };
  }, [payload?.business.id, resolvedTableKey, refreshLiveTableState]);

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

  async function handleQuickJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;
    setJoinError(null);
    setJoining(true);
    try {
      const existing = loadStoredDinerIdentity();
      const guestTokenHash =
        existing?.guestTokenHash ?? getOrCreateGuestTokenHash();
      const created =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: joinName.trim() || 'Guest Diner',
          phoneOrEmail: joinPhone.trim() || null,
          guestTokenHash,
          businessSlug,
        });
      saveStoredDinerIdentity({
        displayName: created.customer.displayName,
        phoneOrEmail: created.customer.phoneOrEmail,
        guestTokenHash,
      });
      setWallet(created);
      setShowJoinModal(false);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function handleCopyWifi(pwd: string) {
    const ok = await copyText(pwd);
    if (ok) {
      setCopiedWifi(true);
      window.setTimeout(() => setCopiedWifi(false), 2000);
    }
  }

  async function handleRequestStaff(callType: RestaurantTableCallType) {
    if (!payload) return;
    const resolvedKey = payload.table?.tableKey ?? tableKey ?? null;
    if (!resolvedKey) {
      setCallError(
        'Scan the QR standee on your table so your server knows which table to visit.',
      );
      return;
    }
    setCallError(null);
    setCallingType(callType);
    try {
      const created = await businessRepository.createRestaurantTableCall({
        businessSlug: payload.business.slug,
        tableKey: resolvedKey,
        customerId: wallet?.customer.id ?? null,
        callType,
      });
      setActiveCall(created);
      const meta =
        TABLE_CALL_TYPE_METADATA[callType] ??
        TABLE_CALL_TYPE_METADATA.assistance;
      const msg = `${meta.emoji} ${meta.label} sent to staff!`;
      setServiceToast(msg);
      window.setTimeout(() => {
        setServiceToast((prev) => (prev === msg ? null : prev));
      }, 3500);
      await refreshLiveTableState();
    } catch (err) {
      setCallError((err as Error).message);
    } finally {
      setCallingType(null);
    }
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

  // Full-Screen Culturally Themed Digital Menu Sub-View
  if (activeView === 'menu') {
    return (
      <>
        <CustomerDigitalMenuView
          businessSlug={business.slug}
          businessName={business.name}
          businessCity={business.city}
          profile={profile}
          table={table}
          tableKey={tableKey}
          categories={categories}
          items={items}
          wallet={wallet}
          onBackToHub={() => setActiveView('launcher')}
          onOrderSubmitted={() => {
            void refreshLiveTableState();
          }}
          onOpenChatAndBill={
            resolvedTableKey ? (tab) => setChatDrawerTab(tab) : undefined
          }
        />
        {chatDrawerTab && resolvedTableKey && (
          <CustomerChatAndBillDrawer
            businessSlug={business.slug}
            businessName={business.name}
            tableKey={resolvedTableKey}
            tableNumber={table?.tableNumber ?? resolvedTableKey}
            customerName={wallet?.customer.displayName ?? null}
            initialTab={chatDrawerTab}
            billSummary={billSummary}
            messages={chatMessages}
            onClose={() => setChatDrawerTab(null)}
            onRefresh={refreshLiveTableState}
            onQuickServiceCall={handleRequestStaff}
          />
        )}
      </>
    );
  }

  // Smooth Sub-Views: Games, Rewards, Extras
  if (activeView === 'games' && profile.gamesEnabled) {
    return (
      <div className="mx-auto w-full max-w-md pb-10">
        <CustomerGameArena
          businessId={business.id}
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={table?.tableKey ?? tableKey ?? null}
          tableNumber={table?.tableNumber ?? null}
          availableGames={payload.games}
          onWalletUpdated={(next) => setWallet(next)}
          onClose={() => setActiveView('launcher')}
        />
      </div>
    );
  }

  if (activeView === 'rewards' && profile.loyaltyEnabled) {
    return (
      <div className="mx-auto w-full max-w-md pb-10">
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
          onBackToMenu={() => setActiveView('launcher')}
        />
      </div>
    );
  }

  if (activeView === 'extras') {
    return (
      <div className="mx-auto w-full max-w-md pb-10">
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
          onBackToMenu={() => setActiveView('launcher')}
        />
      </div>
    );
  }

  const activeTheme: MenuThemeTemplate =
    profile.menuThemeTemplate ?? 'default';
  const activeThemeMeta =
    MENU_THEME_LIST.find((t) => t.id === activeTheme) ??
    MENU_THEME_LIST[MENU_THEME_LIST.length - 1];
  const hubTheme = getHubThemePalette(activeTheme);

  return (
    <div
      data-hub-theme={activeTheme}
      className={`transition-colors duration-200 animate-fadeSlideUp ${hubTheme.pageShell}`}
    >
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* 1. TOP BRAND HEADER CARD (Harmonized with Selected Cultural Template) */}
        <header
          className={`${hubTheme.headerCard} flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {profile.customLogoUrl ? (
              <img
                src={profile.customLogoUrl}
                alt={`${business.name} logo`}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-black/10"
              />
            ) : (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center shadow-sm ${hubTheme.brandIconBox}`}
              >
                <UtensilsCrossed className="h-5 w-5" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`truncate ${hubTheme.titleClass}`}>
                {business.name}
              </h1>
              <p className={`truncate ${hubTheme.subtitleClass}`}>
                {profile.tagline || `${business.city} • Welcome to Your Table`}
              </p>
            </div>
          </div>

          {/* Table / Room Pill Badge */}
          {table ? (
            <div
              data-testid="detected-table-badge"
              className={`shrink-0 text-center shadow-2xs whitespace-nowrap ${hubTheme.tableBadge}`}
            >
              {table.tableNumber}
            </div>
          ) : (
            tableKey && (
              <div
                className={`shrink-0 whitespace-nowrap ${hubTheme.tableBadge}`}
              >
                {tableKey}
              </div>
            )
          )}
        </header>

        {/* 1B. 4-PILL INSTANT SERVICE BAR (Waiter | Water | Bill | Clean) */}
        {resolvedTableKey && (
          <div className="space-y-2">
            <div
              className="grid grid-cols-4 gap-2"
              role="group"
              aria-label="1-Tap Instant Table Service"
            >
              {(
                [
                  { type: 'assistance' as const, emoji: '🙋', label: 'Waiter' },
                  { type: 'water' as const, emoji: '💧', label: 'Water' },
                  { type: 'bill_request' as const, emoji: '🧾', label: 'Bill' },
                  { type: 'clean_table' as const, emoji: '🧹', label: 'Clean' },
                ] as const
              ).map((pill) => {
                const isSending = callingType === pill.type;
                return (
                  <button
                    key={pill.type}
                    type="button"
                    disabled={callingType !== null}
                    onClick={() => void handleRequestStaff(pill.type)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-2.5 px-1.5 text-center shadow-2xs transition-all active:scale-[0.96] cursor-pointer ${
                      pill.type === 'bill_request'
                        ? 'border-rose-200 bg-[#FEF2F2] text-[#991B1B] hover:bg-rose-100'
                        : 'border-[#1E1B4B]/12 bg-[#FFFFFF] text-[#1E1B4B] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <span className="text-[16px] leading-none" aria-hidden>
                      {pill.emoji}
                    </span>
                    <span className="text-[11px] font-extrabold leading-tight">
                      {isSending ? 'Sent…' : pill.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {serviceToast && (
              <div
                role="status"
                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[12px] font-extrabold text-[#065F46] animate-fadeSlideUp"
              >
                <span>{serviceToast}</span>
                <button
                  type="button"
                  onClick={() => setServiceToast(null)}
                  className="p-0.5 cursor-pointer"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1C. LIVE 4-STAGE ORDER PROGRESS STEPPER & OPEN BILL CARD */}
        {resolvedTableKey && billSummary && billSummary.orderCount > 0 && (() => {
          const latestOrder =
            billSummary.orders[billSummary.orders.length - 1] ?? null;
          const activeStepIdx = billSummary.isCheckedOut
            ? 3
            : latestOrder?.status === 'served'
              ? 3
              : latestOrder?.status === 'ready'
                ? 2
                : latestOrder?.status === 'preparing'
                  ? 1
                  : 0;
          const steps = ['Received', 'Preparing', 'Ready', 'Served'];

          return (
            <div className="rounded-2xl border-2 border-[#1E1B4B]/15 bg-[#FFFFFF] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#6B7280]">
                    {billSummary.isCheckedOut
                      ? 'Checkout Approved ✓'
                      : `Live Order Tracker • ${billSummary.orderCount} Order${billSummary.orderCount === 1 ? '' : 's'}`}
                  </p>
                  <p className="text-[17px] font-black text-[#1E1B4B] tabular-nums">
                    {formatPriceFromPaise(
                      billSummary.grandTotalPaise,
                      billSummary.currencyCode,
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
                    billSummary.isCheckedOut
                      ? 'bg-emerald-100 text-[#065F46]'
                      : billSummary.paymentStatus === 'upi_pending_verify'
                        ? 'bg-amber-100 text-[#92400E]'
                        : 'bg-[#F8F9FA] border border-[#1E1B4B]/12 text-[#1E1B4B]'
                  }`}
                >
                  {billSummary.isCheckedOut
                    ? '✓ Paid & Verified'
                    : billSummary.paymentStatus === 'upi_pending_verify'
                      ? 'UPI Paid — Staff Checking'
                      : 'Pay at Checkout'}
                </span>
              </div>

              {/* 4-Stage Stepper */}
              <div className="grid grid-cols-4 gap-1.5">
                {steps.map((label, idx) => {
                  const reached = idx <= activeStepIdx;
                  const isCurrent = idx === activeStepIdx;
                  return (
                    <div key={label} className="space-y-1 text-center">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          reached
                            ? isCurrent
                              ? 'bg-[#D2DB76] ring-1 ring-[#1E1B4B]/40'
                              : 'bg-[#059669]'
                            : 'bg-[#E5E7EB]'
                        }`}
                      />
                      <p
                        className={`text-[10.5px] font-extrabold ${
                          reached ? 'text-[#1E1B4B]' : 'text-[#9CA3AF]'
                        }`}
                      >
                        {label}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setChatDrawerTab('bill')}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3 text-[12px] font-extrabold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  <Receipt className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  {billSummary.isCheckedOut
                    ? 'Download Receipt →'
                    : 'View Bill & Pay →'}
                </button>
                <button
                  type="button"
                  onClick={() => setChatDrawerTab('chat')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3 text-[12px] font-extrabold text-[#1E1B4B] hover:bg-white cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Chat
                </button>
              </div>
            </div>
          );
        })()}

        {/* 2. LOYALTY STATUS & QUICK JOIN CARD */}
        {profile.loyaltyEnabled &&
          (wallet ? (
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
          ) : (
            <button
              type="button"
              onClick={() => {
                setJoinError(null);
                setShowJoinModal(true);
              }}
              className={`w-full p-4 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-between gap-3 ${hubTheme.joinBanner}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center ${hubTheme.joinIconBox}`}
                >
                  <Star className="h-5 w-5" fill="currentColor" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-extrabold">
                    ★ Join Loyalty &amp; Collect Stars
                  </p>
                  <p
                    className={`text-[12px] font-semibold ${hubTheme.joinSubtitle}`}
                  >
                    Tap to Start (5 sec) • Unlock free dining perks
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-5 w-5 shrink-0 ${hubTheme.joinSubtitle}`}
                aria-hidden
              />
            </button>
          ))}

        {/* 3. STACKED FULL-WIDTH HORIZONTAL ACTION BLOCKS (6 Blocks — Theme Harmonized) */}
        <nav aria-label="Table Hub Actions" className="space-y-3">
          {/* BLOCK 1: DIGITAL MENU */}
          <button
            type="button"
            data-testid="launcher-block-menu"
            onClick={() => setActiveView('menu')}
            className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${hubTheme.actionBlock}`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-2xs"
                style={{
                  backgroundColor: activeThemeMeta.swatches[0],
                  color: activeThemeMeta.swatches[2],
                }}
              >
                <UtensilsCrossed className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={hubTheme.actionTitle}>Digital Menu</span>
                  <span className="rounded-full bg-[#D2DB76]/65 px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#1E1B4B]">
                    {items.length} Dishes
                  </span>
                </div>
                <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                  {profile.tableOrderingEnabled
                    ? 'Explore Digital Menu & Send Table Order'
                    : 'Explore Digital Menu'}
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
              aria-hidden
            />
          </button>

          {/* BLOCK 2: GUEST WI-FI */}
          <button
            type="button"
            data-testid="launcher-block-wifi"
            onClick={() => setShowWifiModal(true)}
            className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${hubTheme.actionBlock}`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E1B4B]/[0.08] text-[#1E1B4B]">
                <Wifi className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <span className={hubTheme.actionTitle}>Guest Wi-Fi</span>
                <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                  {loyaltyRules?.wifiNetworkName
                    ? `Connect to Wi-Fi (${loyaltyRules.wifiNetworkName})`
                    : 'Connect to Wi-Fi & Table Notes'}
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
              aria-hidden
            />
          </button>

          {/* BLOCK 3: PLAY TABLE GAMES */}
          {profile.gamesEnabled && (
            <button
              type="button"
              data-testid="launcher-block-games"
              onClick={() => setActiveView('games')}
              className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${hubTheme.actionBlock}`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center ${hubTheme.brandIconBox}`}
                >
                  <Gamepad2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <span className={hubTheme.actionTitle}>Play Table Games</span>
                  <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                    Play &amp; Earn Game Points while you wait
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
                aria-hidden
              />
            </button>
          )}

          {/* BLOCK 4: REWARDS & LOYALTY WALLET */}
          {profile.loyaltyEnabled && (
            <button
              type="button"
              data-testid="launcher-block-rewards"
              onClick={() => setActiveView('rewards')}
              className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${hubTheme.actionBlock}`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D2DB76]/60 text-[#1E1B4B]">
                  <Gift className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={hubTheme.actionTitle}>
                      Rewards &amp; Loyalty Wallet
                    </span>
                    {(rewards ?? []).length > 0 && (
                      <span className="rounded-full bg-[#1E1B4B]/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1E1B4B] tabular-nums">
                        {(rewards ?? []).length}
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                    Rewards &amp; Star Conversion
                  </p>
                </div>
              </div>
              <ChevronRight
                className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
                aria-hidden
              />
            </button>
          )}

          {/* BLOCK 5: LEAVE A GOOGLE REVIEW */}
          <Link
            to={`/r/${business.slug}`}
            data-testid="launcher-block-review"
            className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] ${hubTheme.actionBlock}`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-[#D97706]">
                <Star className="h-5 w-5" fill="#FACC15" aria-hidden />
              </span>
              <div className="min-w-0">
                <span className={hubTheme.actionTitle}>
                  Leave a Google Review
                </span>
                <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                  Share Your Experience in 30 seconds
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
              aria-hidden
            />
          </Link>

          {/* BLOCK 6: CALL WAITER / READY FOR BILL */}
          <button
            type="button"
            data-testid="launcher-block-waiter"
            onClick={() => {
              setCallError(null);
              setShowCallModal(true);
            }}
            className={`w-full p-4 flex items-center justify-between gap-3.5 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${hubTheme.actionBlock}`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-[#D97706]">
                <BellRing className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={hubTheme.actionTitle}>
                    Call Waiter / Ready for Bill
                  </span>
                  {activeCall && (
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-[#059669]">
                      Notified ✓
                    </span>
                  )}
                </div>
                <p className={`mt-0.5 ${hubTheme.actionSubtitle}`}>
                  Notify Your Server directly from your table
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 ${hubTheme.chevronClass}`}
              aria-hidden
            />
          </button>
        </nav>
      </div>

      {/* =====================================================================
          MODAL 1: 5-SECOND QUICK LOYALTY JOIN (Name + Phone)
         ===================================================================== */}
      {showJoinModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Join Loyalty & Collect Stars"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={(e) => void handleQuickJoinSubmit(e)}
            className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-6 shadow-2xl space-y-4 animate-fadeSlideUp"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                  <UserPlus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[18px] font-extrabold text-[#111827]">
                    Join {business.name} Loyalty
                  </h3>
                  <p className="text-[12px] text-[#6B7280]">
                    Takes 5 seconds — save Stars across every visit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {joinError && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-semibold text-red-800">
                {joinError}
              </p>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="quickJoinName"
                  className="block text-[12px] font-bold text-[#111827]"
                >
                  Your Name
                </label>
                <input
                  id="quickJoinName"
                  type="text"
                  required
                  maxLength={80}
                  placeholder="e.g. Aarav"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="quickJoinPhone"
                  className="block text-[12px] font-bold text-[#111827]"
                >
                  Phone Number
                </label>
                <input
                  id="quickJoinPhone"
                  type="tel"
                  required
                  maxLength={160}
                  placeholder="e.g. +91 98765 43210"
                  value={joinPhone}
                  onChange={(e) => setJoinPhone(e.target.value)}
                  className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-5 py-3 text-[14px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Star
                className="h-4 w-4 text-[#D2DB76]"
                fill="currentColor"
                aria-hidden
              />
              {joining ? 'Creating Pass…' : 'Create My Loyalty Pass'}
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: INSTANT GUEST WI-FI MODAL (1-Tap Copy Password)
         ===================================================================== */}
      {showWifiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guest Wi-Fi"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-6 shadow-2xl space-y-4 animate-fadeSlideUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
                  <Wifi className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[18px] font-extrabold text-[#111827]">
                    Guest Wi-Fi
                  </h3>
                  <p className="text-[12px] text-[#6B7280]">
                    Complimentary dining room Wi-Fi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWifiModal(false)}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {loyaltyRules?.wifiNetworkName ? (
              <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    Network Name (SSID)
                  </span>
                  <p className="text-[16px] font-extrabold text-[#111827]">
                    {loyaltyRules.wifiNetworkName}
                  </p>
                </div>
                {loyaltyRules.wifiPassword && (
                  <div className="flex items-center justify-between gap-2 border-t border-[#1E1B4B]/10 pt-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                        Password
                      </span>
                      <p className="font-mono text-[15px] font-extrabold text-[#1E1B4B]">
                        {loyaltyRules.wifiPassword}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyWifi(loyaltyRules.wifiPassword!)
                      }
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[12px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      {copiedWifi ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                          Copy Password
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 text-[13px] text-[#6B7280]">
                Ask your server for today&apos;s guest Wi-Fi password.
              </p>
            )}

            {(loyaltyRules?.suggestionBoxEnabled ?? true) && (
              <button
                type="button"
                onClick={() => {
                  setShowWifiModal(false);
                  setActiveView('extras');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-4 py-2.5 text-[13px] font-bold text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <Inbox className="h-4 w-4" aria-hidden /> Open Private Suggestion Box
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: 2-BUTTON CALL WAITER / READY FOR BILL POP-UP
         ===================================================================== */}
      {showCallModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Call Waiter or Ready for Bill"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-6 shadow-2xl space-y-4 animate-fadeSlideUp">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-extrabold text-[#111827]">
                  Notify Your Server {table ? `• ${table.tableNumber}` : ''}
                </h3>
                <p className="text-[12px] text-[#6B7280]">
                  Your request appears immediately on our staff floor screen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {callError && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] font-semibold text-[#D97706]">
                {callError}
              </p>
            )}

            {activeCall && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-[13px] font-bold text-[#059669] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {activeCall.callType === 'ready_for_bill'
                    ? 'Server notified to bring your bill!'
                    : 'Server notified — right over to your table!'}
                </span>
              </div>
            )}

            <div className="grid gap-3">
              <button
                type="button"
                disabled={callingType !== null}
                onClick={() => void handleRequestStaff('assistance')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-4 py-3 text-[14px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
              >
                <BellRing className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                {callingType === 'assistance'
                  ? 'Notifying Server…'
                  : 'Call Waiter (Need Assistance)'}
              </button>

              <button
                type="button"
                disabled={callingType !== null}
                onClick={() => void handleRequestStaff('ready_for_bill')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#1E1B4B] bg-[#FFFFFF] px-4 py-3 text-[14px] font-extrabold text-[#111827] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                {callingType === 'ready_for_bill'
                  ? 'Notifying Server…'
                  : 'Ready for Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating 2-Way Table Chat & Open Bill Button */}
      {resolvedTableKey && (
        <button
          type="button"
          onClick={() =>
            setChatDrawerTab(
              billSummary && billSummary.orderCount > 0 ? 'bill' : 'chat',
            )
          }
          className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#1E1B4B] px-4 text-[13px] font-extrabold text-white shadow-xl ring-2 ring-[#D2DB76] hover:bg-[#2E2A6E] active:scale-[0.97] transition-all cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-[#D2DB76]" aria-hidden />
          <span>Chat &amp; Bill</span>
          {chatMessages.length > 0 && (
            <span className="rounded-full bg-[#D2DB76] px-1.5 py-0.5 text-[10.5px] font-black text-[#1E1B4B] tabular-nums">
              {chatMessages.length}
            </span>
          )}
        </button>
      )}

      {/* Live 2-Way Chat & Bill Checkout Drawer */}
      {chatDrawerTab && resolvedTableKey && (
        <CustomerChatAndBillDrawer
          businessSlug={business.slug}
          businessName={business.name}
          tableKey={resolvedTableKey}
          tableNumber={table?.tableNumber ?? resolvedTableKey}
          customerName={wallet?.customer.displayName ?? null}
          initialTab={chatDrawerTab}
          billSummary={billSummary}
          messages={chatMessages}
          onClose={() => setChatDrawerTab(null)}
          onRefresh={refreshLiveTableState}
          onQuickServiceCall={handleRequestStaff}
        />
      )}
    </div>
  );
}
