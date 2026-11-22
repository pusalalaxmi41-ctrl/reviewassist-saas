import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Gamepad2,
  Sparkles,
  MessageSquare,
  Settings,
  BarChart3,
  ExternalLink,
  Clock,
  ShieldAlert,
  Ban,
  CheckCircle2,
  UserCheck,
  Users,
  Package,
} from 'lucide-react';
import type {
  Business,
  BusinessMetrics,
  AnalyticsEvent,
  CustomerDraftRecord,
} from '../types/business';
import { businessRepository } from '../services/storage';
import { categoryLabels } from '../services/business/mockBusinesses';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { QRCodeManager } from '../components/dashboard/QRCodeManager';
import { CustomerDraftsView } from '../components/dashboard/CustomerDraftsView';
import { GoogleUrlSettings } from '../components/dashboard/GoogleUrlSettings';
import { BusinessCategorySettings } from '../components/dashboard/BusinessCategorySettings';
import { AIConfigurationSettings } from '../components/dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../components/dashboard/BusinessKnowledgeSettings';
import {
  RestaurantManagerView,
  type RestaurantWorkspaceSection,
} from '../components/dashboard/RestaurantManagerView';

type PrimaryDestination =
  | 'overview'
  | 'menu'
  | 'staff'
  | 'inventory'
  | 'tables'
  | 'games_loyalty';

type LoyaltyAndReviewsMode = 'loyalty' | 'ai_reviews';
type AiReviewSubTab = 'drafts' | 'qr' | 'analytics' | 'settings';

function parseDestinationFromParam(param: string | null): {
  destination: PrimaryDestination;
  loyaltyMode?: LoyaltyAndReviewsMode;
  aiSubTab?: AiReviewSubTab;
} {
  switch (param) {
    case 'menu':
      return { destination: 'menu' };
    case 'staff':
      return { destination: 'staff' };
    case 'inventory':
      return { destination: 'inventory' };
    case 'tables':
      return { destination: 'tables' };
    case 'games_loyalty':
      return { destination: 'games_loyalty', loyaltyMode: 'loyalty' };
    case 'ai_reviews':
    case 'drafts':
      return {
        destination: 'games_loyalty',
        loyaltyMode: 'ai_reviews',
        aiSubTab: 'drafts',
      };
    case 'qr':
      return {
        destination: 'games_loyalty',
        loyaltyMode: 'ai_reviews',
        aiSubTab: 'qr',
      };
    case 'analytics':
      return {
        destination: 'games_loyalty',
        loyaltyMode: 'ai_reviews',
        aiSubTab: 'analytics',
      };
    case 'settings':
      return {
        destination: 'games_loyalty',
        loyaltyMode: 'ai_reviews',
        aiSubTab: 'settings',
      };
    case 'restaurant':
    case 'overview':
    default:
      return { destination: 'overview' };
  }
}

export default function BusinessDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParsed = parseDestinationFromParam(searchParams.get('tab'));

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    searchParams.get('slug') || 'the-urban-kitchen',
  );
  const [destination, setDestination] = useState<PrimaryDestination>(
    initialParsed.destination,
  );
  const [loyaltyMode, setLoyaltyMode] = useState<LoyaltyAndReviewsMode>(
    initialParsed.loyaltyMode ?? 'loyalty',
  );
  const [aiSubTab, setAiSubTab] = useState<AiReviewSubTab>(
    initialParsed.aiSubTab ?? 'drafts',
  );
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);
      const list = await businessRepository.getBusinesses();
      setBusinesses(list);

      const paramSlug = searchParams.get('slug');
      if (paramSlug) {
        const match = list.find((b) => b.slug === paramSlug);
        if (match) setSelectedSlug(match.slug);
      } else if (list.length > 0) {
        setSelectedSlug((prev) =>
          list.some((b) => b.slug === prev) ? prev : list[0].slug,
        );
      }
      setLoading(false);
    }
    void loadBusinesses();
  }, [searchParams]);

  const currentBusiness =
    businesses.find((b) => b.slug === selectedSlug) ?? businesses[0];

  useEffect(() => {
    if (!currentBusiness) return;

    async function loadBusinessData() {
      const [m, evts, drfts] = await Promise.all([
        businessRepository.getMetrics(currentBusiness.id),
        businessRepository.getEvents(currentBusiness.id),
        businessRepository.getDrafts(currentBusiness.id),
      ]);
      setMetrics(m);
      setEvents(evts);
      setDrafts(drfts);
    }

    void loadBusinessData();
  }, [currentBusiness]);

  function handleSelectBusiness(newSlug: string) {
    setSelectedSlug(newSlug);
    setSearchParams({ slug: newSlug, tab: destination });
  }

  function handleDestinationChange(next: PrimaryDestination) {
    setDestination(next);
    if (currentBusiness) {
      setSearchParams({ slug: currentBusiness.slug, tab: next });
    }
  }

  function handleBusinessUpdated(updated: Business) {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b)),
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center" role="status" aria-live="polite">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[15px] font-medium text-[#6B7280]">
          Loading BistroOS workspace…
        </p>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="bistro-card py-16 px-6 text-center">
        <Building2 className="mx-auto h-12 w-12 text-[#6B7280]" aria-hidden />
        <h2 className="mt-3 text-[20px] font-bold text-[#111827]">
          No Restaurant Registered
        </h2>
        <p className="mt-1 text-[15px] text-[#6B7280]">
          Set up your restaurant workspace to launch your Digital Menu, Table QRs, and Loyalty Hub.
        </p>
        <Link
          to="/setup"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-5 py-2.5 text-[14px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add Restaurant
        </Link>
      </div>
    );
  }

  const currentStatus = currentBusiness.status ?? 'pending';
  const currentAccountState = currentBusiness.accountState ?? 'active';
  const isBusinessLive =
    currentStatus === 'active' && currentAccountState === 'active';

  const statusPillConfig: Record<
    NonNullable<Business['status']>,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: 'Awaiting Approval',
      className: 'bg-amber-50 text-[#D97706] border-amber-200',
      Icon: Clock,
    },
    active: {
      label: 'Active',
      className: 'bg-emerald-50 text-[#059669] border-emerald-200',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-900 border-red-300',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-gray-100 text-[#111827] border-gray-300',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  const navDestinations: {
    id: PrimaryDestination;
    label: string;
    shortLabel: string;
    Icon: typeof LayoutDashboard;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Live Overview',
      shortLabel: 'Overview',
      Icon: LayoutDashboard,
    },
    {
      id: 'menu',
      label: 'Digital Menu',
      shortLabel: 'Menu',
      Icon: UtensilsCrossed,
    },
    {
      id: 'staff',
      label: 'Staff & Waiters',
      shortLabel: 'Staff',
      Icon: Users,
    },
    {
      id: 'inventory',
      label: 'Stock & Expenses',
      shortLabel: 'Stock',
      Icon: Package,
    },
    {
      id: 'tables',
      label: 'Tables & QRs',
      shortLabel: 'Tables',
      Icon: QrCode,
    },
    {
      id: 'games_loyalty',
      label: 'Games, Loyalty & Reviews',
      shortLabel: 'Loyalty',
      Icon: Gamepad2,
      badge: drafts.length > 0 ? drafts.length : undefined,
    },
  ];

  const isRestaurantDestination =
    destination === 'overview' ||
    destination === 'menu' ||
    destination === 'staff' ||
    destination === 'inventory' ||
    destination === 'tables' ||
    (destination === 'games_loyalty' && loyaltyMode === 'loyalty');

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      {/* LEFT SIDEBAR — 5 Plain-English Destinations (Matches Mockup 1) */}
      <aside
        aria-label="BistroOS Workspace Navigation"
        className="lg:col-span-3 bistro-card p-4 flex flex-col justify-between lg:min-h-[620px] space-y-6"
      >
        <div className="space-y-5">
          {/* Restaurant Switcher Header */}
          <div className="space-y-2 border-b border-[#1E1B4B]/10 pb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Active Restaurant
              </span>
              <Link
                to="/setup"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#1E1B4B] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> New
              </Link>
            </div>

            <div className="flex h-11 items-center gap-2 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3">
              <Building2
                className="h-4 w-4 shrink-0 text-[#1E1B4B]"
                aria-hidden
              />
              <select
                aria-label="Select active restaurant"
                value={currentBusiness.slug}
                onChange={(e) => handleSelectBusiness(e.target.value)}
                className="w-full min-w-0 truncate bg-transparent text-[14px] font-bold text-[#111827] focus:outline-none cursor-pointer"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5 Plain-English Destinations */}
          <nav className="flex overflow-x-auto lg:flex-col gap-1.5">
            {navDestinations.map(({ id, label, shortLabel, Icon, badge }) => {
              const isActive = destination === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleDestinationChange(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                    isActive
                      ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
                      : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
                      }`}
                      aria-hidden
                    />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </span>
                  {badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-[#D2DB76] text-[#1E1B4B]'
                          : 'bg-[#1E1B4B]/[0.08] text-[#1E1B4B]'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Owner Footer Badge in Sidebar */}
        <div className="hidden lg:block border-t border-[#1E1B4B]/10 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E1B4B] text-[#D2DB76] font-bold text-[14px]">
              <UserCheck className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-[#111827]">
                {currentBusiness.name}
              </p>
              <p className="truncate text-[12px] text-[#6B7280]">
                {categoryLabels[currentBusiness.category]} • {currentBusiness.city}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${currentPill.className}`}
            >
              <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
              {currentPill.label}
            </span>
            {isBusinessLive && (
              <Link
                to={`/r/${currentBusiness.slug}/menu`}
                target="_blank"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1E1B4B] hover:underline"
              >
                Guest Hub <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="lg:col-span-9 min-w-0 space-y-6">
        {/* Non-Active Business Notice (only shown if account is pending/suspended) */}
        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4 text-[#D97706]" aria-hidden />
                  <h2 className="text-[15px] font-bold text-[#111827]">
                    {currentBusiness.status === 'pending'
                      ? 'Workspace in Preview Mode (Awaiting Platform Approval)'
                      : 'Public Review Redirect Offline'}
                  </h2>
                </div>
                <p className="text-[13px] text-[#6B7280]">
                  You can configure your Digital Menu, Table QRs, and Loyalty Rules below. Public customer pages unlock as soon as your account is active.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6 MODE BAR: Switch cleanly between Games & Loyalty and AI Reviews */}
        {destination === 'games_loyalty' && (
          <div className="bistro-card p-2 inline-flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLoyaltyMode('loyalty')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                loyaltyMode === 'loyalty'
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
              }`}
            >
              <Gamepad2
                className={`h-4 w-4 ${
                  loyaltyMode === 'loyalty'
                    ? 'text-[#D2DB76]'
                    : 'text-[#1E1B4B]'
                }`}
                aria-hidden
              />
              <span>Games, Loyalty &amp; Rewards</span>
            </button>
            <button
              type="button"
              onClick={() => setLoyaltyMode('ai_reviews')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                loyaltyMode === 'ai_reviews'
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
              }`}
            >
              <Sparkles
                className={`h-4 w-4 ${
                  loyaltyMode === 'ai_reviews'
                    ? 'text-[#D2DB76]'
                    : 'text-[#1E1B4B]'
                }`}
                aria-hidden
              />
              <span>AI Reviews &amp; Google QR</span>
              {drafts.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                    loyaltyMode === 'ai_reviews'
                      ? 'bg-[#D2DB76] text-[#1E1B4B]'
                      : 'bg-[#1E1B4B]/10 text-[#1E1B4B]'
                  }`}
                >
                  {drafts.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* DESTINATIONS 1–6 (Restaurant Workspace) */}
        {isRestaurantDestination && (
          <RestaurantManagerView
            key={`restaurant-mgmt-${currentBusiness.id}`}
            business={currentBusiness}
            isBusinessLive={isBusinessLive}
            activeSection={destination as RestaurantWorkspaceSection}
            onSectionChange={(sec) => handleDestinationChange(sec)}
          />
        )}

        {/* INTEGRATED AI REVIEWS SUB-VIEW INSIDE TAB 6 */}
        {destination === 'games_loyalty' && loyaltyMode === 'ai_reviews' && (
          <div className="space-y-6 animate-fadeSlideUp">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
                  AI Reviews
                </h1>
                <p className="mt-1 text-[14px] text-[#6B7280]">
                  Manage guest feedback drafts, Google Maps review QR codes, and AI drafting knowledge.
                </p>
              </div>
              {isBusinessLive && (
                <Link
                  to={`/r/${currentBusiness.slug}`}
                  target="_blank"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-4 text-[13px] font-semibold text-[#1E1B4B] hover:bg-[#F8F9FA]"
                >
                  Open 5-Step Review Page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>

            {/* Clean Sub-Tab Switcher for AI Reviews */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  {
                    id: 'drafts',
                    label: `Customer Drafts (${drafts.length})`,
                    Icon: MessageSquare,
                  },
                  {
                    id: 'qr',
                    label: 'Review QR & WhatsApp',
                    Icon: QrCode,
                  },
                  {
                    id: 'analytics',
                    label: 'Review Funnel',
                    Icon: BarChart3,
                  },
                  {
                    id: 'settings',
                    label: 'AI & Google Links',
                    Icon: Settings,
                  },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = aiSubTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAiSubTab(id)}
                    className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                      active
                        ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
                        : 'border border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {aiSubTab === 'drafts' && (
              <CustomerDraftsView
                key={`drafts-mgmt-${currentBusiness.id}`}
                business={currentBusiness}
                drafts={drafts}
                onDraftUpdated={(updatedRecord) => {
                  setDrafts((prev) =>
                    prev.map((item) =>
                      item.id === updatedRecord.id ? updatedRecord : item,
                    ),
                  );
                }}
              />
            )}

            {aiSubTab === 'qr' &&
              (isBusinessLive ? (
                <QRCodeManager
                  key={currentBusiness.id}
                  business={currentBusiness}
                />
              ) : (
                <div className="bistro-card p-10 text-center space-y-3">
                  <Clock className="mx-auto h-8 w-8 text-[#D97706]" aria-hidden />
                  <h3 className="text-[18px] font-bold text-[#111827]">
                    Review QR Locked Until Approved
                  </h3>
                  <p className="mx-auto max-w-md text-[14px] text-[#6B7280]">
                    Once your account is active, your downloadable Google Review QR poster and WhatsApp links appear here.
                  </p>
                </div>
              ))}

            {aiSubTab === 'analytics' && (
              <AnalyticsView
                metrics={metrics}
                events={events}
                businessName={currentBusiness.name}
              />
            )}

            {aiSubTab === 'settings' && (
              <div className="space-y-6">
                <BusinessCategorySettings
                  key={`biz-category-${currentBusiness.id}`}
                  business={currentBusiness}
                  onUpdated={handleBusinessUpdated}
                />
                <AIConfigurationSettings
                  key={`ai-config-${currentBusiness.id}`}
                  business={currentBusiness}
                />
                <BusinessKnowledgeSettings
                  key={`biz-knowledge-${currentBusiness.id}`}
                  business={currentBusiness}
                />
                <GoogleUrlSettings
                  key={`google-url-${currentBusiness.id}`}
                  business={currentBusiness}
                  onUpdated={handleBusinessUpdated}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
